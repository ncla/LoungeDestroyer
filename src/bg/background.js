var LoungeUser = new User();
LoungeUser.loadUserSettings(function() {
    console.log("Settings for background.js have loaded!");
});
/*
    Make changes to LoungeUser user settings once the settings are changed from extension pop-up
 */
chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    // Make changes to LoungeUser user settings once the settings are changed from extension pop-up
    if(request.hasOwnProperty("changeSetting")) {
        for(var name in request.changeSetting) {
            LoungeUser.userSettings[name] = request.changeSetting[name];
        }
    }

    if(request.hasOwnProperty("giveMeBackpackURL")) {
        sendResponse(lastBackpackAjaxURL);
    }

    // Inject AJAX prefilter to specific tab
    if(request.hasOwnProperty("injectScript")) {
        console.log("Injecting script ("+request.injectScript+") into tab "+sender.tab.id);
        chrome.tabs.executeScript(sender.tab.id, {file: "src/inject/app/"+request.injectScript}); // TODO: support relative path
    }

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

    // Overwrite variable in format {set: {variable: {key: newValue}}}
    if(request.hasOwnProperty("set")) {
        for (var v in request.set) {
            var oldVar = window[v],
                newVar = oldVar;

            for (var k in request.set[v]) {
                newVar[k] = request.set[v][k];
            }

            window[v] = newVar;
        }
    }
});

var icons = {"-1": "icons/icon_unknown.png", "0": "icons/icon_offline.png", "1": "icons/icon_online.png"};

function setBotstatus(value) {
    chrome.browserAction.setIcon({path: icons[value.toString()]});
    chrome.storage.local.get('botsOnline', function(result) {
        if(result.botsOnline != value) {
            console.log("Bot status changed!!!!111");
            chrome.storage.local.set({"botsOnline": value});
            /*
                Notifications
                https://developer.mozilla.org/en/docs/Web/API/notification
            */
            var message = {action: "updateBotStatus",
                           status: value};
            sendMessageToContentScript(message, null);
            if(value == 1 && result.botsOnline != -1) {
                /* Might not want to notify when installed for first time */
                var notify = new Notification("CS:GO Lounge Bot status",
                    {body: "Bots appear to be online since " + new Date().toLocaleString(),
                        icon: "../../icons/icon_normal_notification.png"});
                setTimeout(function() {
                    notify.close();
                }, 10000);
            }
        }
    });
}

/**
 * Send message to content scripts
 * @param int tabId - ID of tab to send to, 0 for all HTTP/HTTPS tabs,
 *                    -1 for all CSGOLounge tabs,
 *                    -2 for all Dota2Lounge tabs,
 *                    -3 for both (NOTE: currently all CSGOLounge tabs)
 * Don't ask me why I chose negativ numbers. I don't know.
 */
function sendMessageToContentScript(message, tabId) {
    if(tabId>0) {
        chrome.tabs.sendMessage(tabId, message);
    } else {
        // Although they claim to, Chrome do not support arrays as url parameter for query
        // Therefore, -3 is currently the same as -1
        console.log("Sending message to "+tabId);
        console.log(message);
        var url = ["*://*/*", "*://csgolounge.com/*", "*://dota2lounge.com/*", "*://csgolounge.com/*"][tabId*-1 || 0] || "*://*/*";
        chrome.tabs.query({url: url}, function(tabs) {
            for (var i=0; i<tabs.length; ++i) {
                chrome.tabs.sendMessage(tabs[i].id, message);
            }
        });
    }
}

/*
 http://stackoverflow.com/questions/15891827/chrome-api-responseheaders
 http://stackoverflow.com/questions/16928912/url-forwarding-using-chrome-webrequest-after-response-is-received
 */
// Error in event handler for webRequest.onHeadersReceived/1: Invalid value for argument 1. Value must not be less than 0.
// if bot status update is redirected
chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        var headers = details.responseHeaders,
            blockingResponse = {};
        var originalURL = details.url;
        for(var i = 0, l = headers.length; i < l; ++i) {
            /*
             That's right.
             I did it this way.
             What you gonna do now?
             */
            if(headers[i].name == 'Location' && headers[i].value.indexOf("/wait.html") != -1 && LoungeUser.userSettings.redirect == "1") {
                details.responseHeaders.splice(i, 1); // Removes it
                chrome.tabs.update(details.tabId, {url: originalURL});
            }
        }
        blockingResponse.responseHeaders = headers;
        return blockingResponse;
    },
    {urls: ["*://csgolounge.com/*", "*://dota2lounge.com/*"]},
    ["responseHeaders", "blocking"]
);
var lastBackpackAjaxURL = null;

chrome.webRequest.onCompleted.addListener(
    function(details) {
        lastBackpackAjaxURL = details.url;
        var message = {inventory: details.url};
        sendMessageToContentScript(message, details.tabId);
    },
    {
        urls: ["http://*/ajax/betReturns*", "http://*/ajax/betBackpack*", "http://*/ajax/tradeBackpack*", "http://*/ajax/tradeGifts*", "http://*/ajax/backpack*"],
        types: ["xmlhttprequest"]
    }
);

/*
    Performance is the key for background tasks. Using jQuery selectors is fine, createHTMLDocument() doesn't parse
    HTML string in such a way that it loads external resources.
    http://jsperf.com/xmlhttprequest-vs-jquery-ajax/3
 */

setInterval(function() {
    if(LoungeUser.userSettings.notifyBots == "1") {
        var oReq = new XMLHttpRequest();
        oReq.onload = function() {
            var doc = document.implementation.createHTMLDocument("");
            doc.body.innerHTML = this.responseText;
            var center = doc.getElementsByTagName("center")[0];
            if (!center) {
                setBotstatus(-1);
                return;
            }
            var botStatus = center.innerText.replace("BOTS ARE ", "");
            if(botStatus == "ONLINE") {
                setBotstatus(1);
            } else if(botStatus == "OFFLINE") {
                setBotstatus(0);
            }
            else {
                setBotstatus(-1);
            }
        };
        oReq.onerror = function() {
            setBotstatus(-1);
        };
        oReq.open("get", "http://csgolounge.com/status", true);
        oReq.send();
    }
}, 5000);
function checkNewMatches(ajaxResponse, appID) {
    var activeMatches = {};

    $(".matchmain", ajaxResponse).each(function(index, value) {
        if(!$(".match", value).hasClass("notaviable")) {
            var matchID = $("a", value).attr("href").replace("match?m=", "");
            var tournament = $(".whenm:eq(1)", value).text().trim();
            var teamA = $(".teamtext:eq(0) b", value).text().trim();
            var teamB = $(".teamtext:eq(1) b", value).text().trim();
            var when = $(".matchheader .whenm:eq(0)", value).text().trim();
            activeMatches[matchID] = {matchID: matchID, tournament: tournament, teamA: teamA, teamB: teamB, when: when };
        }
    });
    /* Don't bother if there are no matches */
    if($.isEmptyObject(activeMatches)) {
        return false;
    }

    var storageName = "matches" + appID;

    var matchesToNotificate = {};
    chrome.storage.local.get('matches' + appID, function(result) {
        if($.isEmptyObject(result)) {
            // Init
            console.log("empty object");
        }
        else {
            $.each(activeMatches, function(index, value) {
                if (typeof result[storageName][index] == 'undefined') {
                    console.log("Match #" + index + " is new, adding to notify list..");
                    matchesToNotificate[index] = value;
                }
            });
        }

        /* Store new fresh bullshit */
        var tempObj = {}; tempObj[storageName] = activeMatches;
        //console.log(tempObj);
        chrome.storage.local.set(tempObj);

        var countNotify = Object.keys(matchesToNotificate).length;
        if(countNotify >= 3) {
            var notify = new Notification("New matches have been added for betting on " + (appID == 730 ? "CS:GO" : "DOTA2") + " Lounge",
                {icon: "../../icons/icon_normal_notification.png"});
            setTimeout(function() {
                notify.close();
            }, 10000);
        }
        else {
            $.each(matchesToNotificate, function(index, value) {
                var notify = new Notification("A new " + (appID == 730 ? "CS:GO" : "DOTA2") + " match has been added!",
                    {body: value.teamA + " vs. " + value.teamB + " @ " + value.tournament + "\nMatch begins " + value.when,
                        icon: "../../icons/icon_normal_notification.png"});
                setTimeout(function() {
                    notify.close();
                }, 10000);
            });
        }
    });
}

/*
    Credit to Bakkes (fork of LoungeCompanion on GitHub)
 */
function checkForNewTradeOffers(data, appID) {
    console.log("Checking for new trade offers on " + appID);
    var data = $(data); // dirty fixerino
    var trades = data.find('a[href$="mytrades"]:first');
    var offers = data.find('a[href$="myoffers"]:first');

    var urlStart = (appID == 730 ? "http://csgolounge.com/" : "http://dota2lounge.com/");

    if(trades.find(".notification").length > 0) {
        $.get(urlStart + "mytrades"); /* Yeah so someone please slap me for doing this */
        var notification = trades.find(".notification");
        var newCount = notification.text();

        var notify = new Notification("Trade update on " + (appID == 730 ? "CS:GO Lounge" : "DOTA2 Lounge"),
            {body: newCount == 1 ? "You have 1 new comment on your trades" : "You have " + newCount + " new comments on your trades",
                icon: "../../icons/icon_normal_notification.png"});
        setTimeout(function() {
            notify.close();
        }, 10000);
    }
    if(offers.find(".notification").length > 0) {
        $.get(urlStart + "myoffers");
        var notification = offers.find(".notification");
        var newCount = notification.text();

        var notify = new Notification("Offer update on " + (appID == 730 ? "CS:GO Lounge" : "DOTA2 Lounge"),
            {body: newCount == 1 ? "You have 1 new comment on your offers" : "You have " + newCount + " new comments on your offers",
                icon: "../../icons/icon_normal_notification.png"});
        setTimeout(function() {
            notify.close();
        }, 10000);
    }
}

setInterval(function() {
    /*
        Somebody please slap me for this DRY'ness
     */
    var checkDotoPage = (LoungeUser.userSettings.notifyMatches == "1" || LoungeUser.userSettings.notifyMatches == "2"
        || LoungeUser.userSettings.notifyTrades == "1" || LoungeUser.userSettings.notifyTrades == "2");
    var checkCSGOPage = (LoungeUser.userSettings.notifyMatches == "1" || LoungeUser.userSettings.notifyMatches == "3"
        || LoungeUser.userSettings.notifyTrades == "1" || LoungeUser.userSettings.notifyTrades == "3");

    if(checkDotoPage) {
        console.log("Checking DOTA2 matches");
        var oReq = new XMLHttpRequest();
        oReq.onload = function() {
            var doc = document.implementation.createHTMLDocument("");
            doc.body.innerHTML = this.responseText;
            if((LoungeUser.userSettings.notifyMatches == "1" || LoungeUser.userSettings.notifyMatches == "2")) {
                checkNewMatches(doc, 570);
            }
            if(LoungeUser.userSettings.notifyTrades == "1" || LoungeUser.userSettings.notifyTrades == "2") {
                checkForNewTradeOffers(doc, 570);
            }
        };
        oReq.open("get", "http://dota2lounge.com/", true);
        oReq.send();
    }
    if(checkCSGOPage) {
        console.log("Checking CS:GO matches");

        var oReq = new XMLHttpRequest();
        oReq.onload = function() {
            var doc = document.implementation.createHTMLDocument("");
            doc.body.innerHTML = this.responseText;
            if((LoungeUser.userSettings.notifyMatches == "1" || LoungeUser.userSettings.notifyMatches == "3")) {
                checkNewMatches(doc, 730);
            }
            if(LoungeUser.userSettings.notifyTrades == "1" || LoungeUser.userSettings.notifyTrades == "3") {
                checkForNewTradeOffers(doc, 730);
            }
        };
        oReq.open("get", "http://csgolounge.com/", true);
        oReq.send();
    }
}, 20000);



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