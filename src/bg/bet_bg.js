chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    var game = sender.url.indexOf("http://csgolounge.com/") === 0 ? 0 :
               sender.url.indexOf("http://dota2lounge.com/") === 0 ? 1 :
               -1;

    // Enable auto-betting
    if(request.hasOwnProperty("autoBet") && request.autoBet && game !== -1) {
        if (bet.autoBetting[game] || !request.autoBet.data || !request.autoBet.url || !request.autoBet.matchNum) {
            sendResponse(false);    
            return;
        }

        console.log("Enabling autobet with data:");
        console.log(request.autoBet.data);
        bet.matchNum[game] = request.autoBet.matchNum;
        bet.enableAuto(request.autoBet.url, request.autoBet.data, !game);
    }

    // Disable auto-betting
    if (request.hasOwnProperty("autoBet") && request.autoBet === false && game !== -1) {
        bet.disableAuto(false, game);
    }

    // Get current state of auto-betting
    if(request.hasOwnProperty("get")) {
        if (request.get === "autoBet" && game !== -1) {
            sendResponse({enabled: bet.autoBetting[game],
                          time: bet.lastBetTime[game],
                          worth: bet.betData[game].worth,
                          rebetDelay: bet.autoDelay,
                          error: bet.lastError[game],
                          matchId: bet.matchNum[game],
                          numTries: bet.numTries[game]});
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
 */

// TO-DO: support for seperate CSGOLounge and Dota2Lounge betting
var bet = { // not a class - don't instantiate
    autoDelay: 10000,
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
    if (!url || !data) {
        console.log("Can't autobet without URL and data");
        return false;
    }

    bet.autoBetting[g] = true;
    bet.lastBetTime[g] = Date.now();
    bet.numTries[g] = 0;

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
        url: url,
        worth: worth
    };

    bet.autoBetting[g] = bet.autoLoop(g);
    console.log("Enabling for "+g+": "+bet.autoBetting[g]);
    if (bet.autoBetting[g]) {
        // send event to all lounge tabs
        sendMessageToContentScript({autoBet: 
            {
                worth: worth, 
                time: bet.lastBetTime[g], 
                rebetDelay: bet.autoDelay,
                error: bet.lastError[g],
                matchId: bet.matchNum[g]
            }}, -1-g);
    }
    return bet.autoBetting;
};
bet.disableAuto = function(success, game) {
    console.log("Disabling auto-bet");

    this.autoBetting[game] = false;
    sendMessageToContentScript({autoBet: (success || false)}, -1-game);
};
bet.autoLoop = function(game) {
    var success = [true,true];

    for (var g = 0; g < 2; ++g) {
        console.log("Game: " + g);
        console.log("Betdata:");
        console.log(bet.betData);

        if (Object.getOwnPropertyNames(bet.betData[g]).length === 0) { // if not betting
            success[g] = false;
            continue;
        }
        if (bet.betData[g].data.indexOf("&on=") === -1) { // if not a betting request
            console.log("Not a betting request");
            success[g] = false;
            continue;
        }
        if (!bet.autoBetting[g]) { // if no longer auto-betting, for some reason
            success[g] = false;
            console.log("No longer auto-betting");
            continue;
        }

        // repeat request
        console.log("Performing request:");
        console.log({url: bet.betData[g].url, data: bet.betData[g].data + "tlss="+bet.betData[g].hash});
        $.ajax({
            url: bet.betData[g].url,
            type: "POST",
            data: bet.betData[g].data + "tlss="+bet.betData[g].hash,
            success: (function(g){return function(data) {
                // Lounge returns nothing if success
                if (data) {
                    console.log("Received error from auto ("+(["CS:GO", "Dota 2"])[g]+"):");
                    console.log(data.substr(0,500));
                    bet.lastError[g] = data;
                    bet.lastBetTime[g] = Date.now();
                    bet.numTries[g]++;
                    sendMessageToContentScript({
                        autoBet: {
                            time: bet.lastBetTime[g],
                            error: data,
                            numTries: bet.numTries[g]
                        }},-1-g);
                    if (data.indexOf("You have to relog in order to place a bet.") !== -1) {
                        bet.renewHash(0, g);
                    }
                    setTimeout(bet.autoLoop, bet.autoDelay); // recall
                } else {
                    // happy times
                    console.log("Bet was succesfully placed ("+(["CS:GO", "Dota 2"])[g]+")");
                    bet.disableAuto(true, g);
                    // tell tabs of our great success
                    sendMessageToContentScript({autoBet: true}, -1-g);
                }
            }})(g),
            error: (function(g){return function(xhr) {
                var err = "Error (#"+xhr.status+") while autoing. Retrying";
                bet.lastBetTime[g] = Date.now();
                console.log(err);
                sendMessageToContentScript({autoBet: {time: bet.lastBetTime[g], error: err}}, -1-g);
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