/**
 * Hooks into requests with one of the following keys:
 *   autoBet - for autoBet
 *   autoReturn - for autoReturn
 */
chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    var game = sender.url.indexOf("http://csgolounge.com/") === 0 ? 0 :
               sender.url.indexOf("http://dota2lounge.com/") === 0 ? 1 :
               -1;

    // Enable auto-betting/auto-returning
    if((request.autoBet || request.autoReturn) && game !== -1) {
        if (bet.autoBetting[game]) {
            sendResponse(false);    
            return;
        }

        console.log("Enabling auto due to request:");
        console.log(request);

        bet.type[game] = request.autoBet ? "autoBet" : "autoReturn";
        if (request.autoBet) {
            bet.matchNum[game] = request.autoBet.matchNum;
            bet.enableAuto(request.autoBet.url, request.autoBet.data, !game);
        } else {
            bet.enableAuto(request.autoReturn.url, "", !game);
        }
    }

    // Disable auto-betting
    if ((request.autoBet === false || request.autoReturn === false) && game !== -1) {
        bet.disableAuto(false, game);
    }

    // Get current state of auto-betting
    if(request.hasOwnProperty("get")) {
        if ((request.get === "autoBet" || request.get === "autoReturn") && game !== -1) {
            sendResponse({enabled: bet.autoBetting[game],
                          type: bet.type[game],
                          time: bet.lastBetTime[game],
                          worth: bet.betData[game].worth,
                          rebetDelay: bet.autoDelay,
                          error: bet.lastError[game],
                          matchId: bet.matchNum[game],
                          numTries: bet.numTries[game]});
        } else {
            sendResponse(window[request.get]);
        }
    }
});

/**
 * Bet-a-tron 9000 
 * Based on oldshit.js
 * Uses arrays for keeping track of csgo/dota2lounge, format: [csgo, dota2]
 *
 * Sends messages to content scripts with updates. Possible messages are:
 * {autoBet: {worth: <worth>, // when autobet starts
 *            time: <start-time>},
 *            rebetDelay: <re-bet delay>}
 * {autoBet: false} // when autobet stops
 * {autoBet: { // when autobet ticks (error is received from Lounge)
 *          time: <bet-time>,
 *          error: <error>
 *      }}
 * {autoBet: true} // when autobet succeeds
 *
 * autoBet can be replaced with autoReturn in all messages, with some keys missing
 */

var bet = { // not a class - don't instantiate
    autoDelay: 10000,
    type: ["autoBet","autoBet"], // autoBet || autoReturn
    autoBetting: [false, false],
    matchNum: [0,0], // for hash purposes
    betData: [{},{}],
    lastError: ["",""],
    lastBetTime: [0,0],
    numTries: [0,0],
    baseUrls: ["http://csgolounge.com/", "http://dota2lounge.com/"]
};

// example data:
// ldef_index%5B%5D=2682&lquality%5B%5D=0&id%5B%5D=711923886&worth=0.11&on=a&match=1522&tlss=2e7877e8d42fb969c5f6f517243c2d19
bet.enableAuto = function(url, data, csgo) {
    console.log("Auto-betting");
    var g = csgo ? 0 : 1; // short for game

    if (bet.autoBetting[g]) {
        console.log("Already auto-betting");
        return false;
    }
    if (!url || (!data && bet.type[g] === "autoBet")) {
        console.log("Can't autobet without URL and data");
        return false;
    }

    bet.autoBetting[g] = true;
    bet.lastBetTime[g] = Date.now();
    bet.numTries[g] = 0;

    if (bet.type[g] === "autoBet") {
        // extract data
        var hash = /tlss=([0-9a-z]*)/.exec(data)[1],
            data = data.replace("tlss="+hash,""),
            worthArr = data.match(/worth=[0-9.0-9]*/g),
            worth = 0;

        if (!worthArr) { // keys don't have worth, don't ask me why
            worthArr = [];
            worth = -1;
        }

        for (var i = 0, j = worthArr.length; i < j; i++) {
            var parsed = parseFloat(worthArr[i].substr(6));
            if (!isNaN(parsed))
                worth += parsed;
        }

        bet.betData[g] = {
            hash: hash,
            data: data,
            worth: worth
        };
    }

    bet.betData[g].url = url;

    bet.autoBetting[g] = bet.autoLoop(g);
    console.log("Enabling for "+g+": "+bet.autoBetting[g]);
    if (bet.autoBetting[g]) {
        // send event to all lounge tabs
        var msg = {};
        msg[bet.type[g]] = {
            worth: bet.betData[g].worth, 
            time: bet.lastBetTime[g], 
            rebetDelay: bet.autoDelay,
            error: bet.lastError[g],
            matchId: bet.matchNum[g]
        };
        sendMessageToContentScript(msg, -1-g);
    }
    return bet.autoBetting;
};
bet.disableAuto = function(success, game) {
    console.log("Disabling auto-bet");

    this.autoBetting[game] = false;

    var msg = {};
    msg[bet.type[game]] = success || false;
    sendMessageToContentScript(msg, -1-game);
};
bet.autoLoop = function(game) {
    var success = [true,true];

    for (var g = 0; g < 2; ++g) {
        console.log("Game: " + g);
        console.log("Betdata:");
        console.log(bet.betData);

        if (bet.type[g] === "autoBet") {
            if (!bet.betData[g] || !bet.betData[g].data) { // if not betting
                // mostly failsafe for next if statement
                success[g] = false;
                continue;
            }
            if (bet.betData[g].data.indexOf("&on=") === -1) { // if not a betting request
                console.log("Not a betting request");
                success[g] = false;
                continue;
            }
        }
        
        if (!bet.autoBetting[g]) { // if no longer auto-betting, for some reason
            success[g] = false;
            console.log("No longer auto-betting");
            continue;
        }

        // repeat request
        console.log("Performing request:");
        console.log({url: bet.betData[g].url, data: bet.betData[g].data});
        $.ajax({
            url: bet.betData[g].url,
            type: bet.type[g] === "autoBet" ? "POST" : "GET",
            data: bet.type[g] === "autoBet" ? bet.betData[g].data + "tlss="+bet.betData[g].hash : "",
            success: (function(g){return function(data) {
                // Lounge returns nothing if success
                if (data) {
                    console.log("Received error from auto ("+(["CS:GO", "Dota 2"])[g]+"):");
                    console.log(data.substr(0,500));
                    bet.lastError[g] = data;
                    bet.lastBetTime[g] = Date.now();
                    bet.numTries[g]++;

                    var msg = {};
                    msg[bet.type[g]] = {
                        time: bet.lastBetTime[g],
                        error: data,
                        numTries: bet.numTries[g]
                    }
                    sendMessageToContentScript(msg,-1-g);
                    if (data.indexOf("You have to relog in order to place a bet.") !== -1) {
                        bet.renewHash(0, g);
                    }
                    setTimeout(bet.autoLoop, bet.autoDelay); // recall
                } else {
                    // happy times
                    console.log("Bet was succesfully placed ("+(["CS:GO", "Dota 2"])[g]+")");
                    bet.disableAuto(true, g);
                    // tell tabs of our great success
                    var msg = {};
                    msg[bet.type[g]] = true;
                    sendMessageToContentScript(msg, -1-g);
                }
            }})(g),
            error: (function(g){return function(xhr) {
                var err = "Error (#"+xhr.status+") while autoing. Retrying";
                bet.lastBetTime[g] = Date.now();
                console.log(err);

                var msg = {};
                msg[bet.type[g]] = {
                    time: bet.lastBetTime[g],
                    error: err
                };

                sendMessageToContentScript(msg, -1-g);
                setTimeout(bet.autoLoop, bet.autoDelay);
            }})(g)
        });
    }
    if (game===0 || game===1)
        return success[game];

    return true;
};
bet.renewHash = function(numTries, game) {
    console.log("Renewing hash");
    var numTries = numTries || 0;

    // let's just assume match num works
    $.ajax({
        url: bet.baseUrls[game]+"match?m="+bet.matchNum,
        type: "GET",
        async: false,
        success: function(data) {
            // don't parse HTML, just extract from text
            var startInd = data.indexOf('id="placebut'),
                endInd = data.indexOf(">Place Bet<"),
                elmText = data.substring(startInd, endInd),
                hash = /[0-9]{4}['", ]*([0-9a-z]*)/.exec(elmText); // optionally replace second * with {32}

            if (!hash) {
                console.log("Failed to find hash");
                bet.disableAuto(false, game);
                return;
            }

            hash = hash[1];

            if (startInd === -1) {
                console.log("Failed to get button element, re-attempting in 5s");
                setTimeout((function(g){
                    return function(){
                        bet.renewHash(false,g)
                    }
                })(game), 5000);
            } else {
                console.log("Elm text: "+elmText);
                console.log("Found a hash: "+hash);
                bet.betData[game].hash = hash;
            }
        },
        error: function() {
            console.log("Error while renewing hash (#"+numTries+"), re-attempting in 5s");
            numTries++;
            if (numTries < 5) {
                setTimeout((function(x,g){
                    return function(){
                        bet.renewHash(x,g)
                    }
                })(numTries,game), 5000);
                return;
            }

            console.log("Retried too many times!");
            bet.disableAuto(false, game);
        }
    });
};