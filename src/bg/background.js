var LoungeUser = new User();
LoungeUser.loadUserSettings(function() {
    console.log("Settings for background.js have loaded!");
});

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
                createNotification(
                    "CS:GO Lounge Bot status",
                    "Bots appear to be online since " + new Date().toLocaleString(),
                    "regular",
                    null,
                    false
                );
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
                var errHtml = "<h1>LoungeDestroyer</h1><p>LoungeDestroyer is redirecting you away from wait.html redirect page to the page you intended to visit. " +
                    "You can disable this feature in extension settings.</p>";
                chrome.tabs.executeScript(details.tabId, {code: "document.body.innerHTML += '"+errHtml+"'"});
                chrome.tabs.executeScript(details.tabId, {code: "setTimeout(function() { window.location = '"+originalURL+"';}, 1000);"});
                //chrome.tabs.update(details.tabId, {url: originalURL});
            }
        }
        blockingResponse.responseHeaders = headers;
        return blockingResponse;
    },
    {
        urls: ["*://csgolounge.com/*", "*://dota2lounge.com/*"],
        types: ["main_frame"]
    },
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

var notificationID = 0;
var notifications = {};

chrome.notifications.onButtonClicked.addListener(
    function(notificationID) {
        if(notificationID.indexOf("_match") != -1 || notificationID.indexOf("_mytrade") != -1 || notificationID.indexOf("_myoffer") != -1) {
            chrome.tabs.create({url: notifications[notificationID]});
        }
    }
);
/*
    A function to easily create a notification

    @param title - Notification title
    @param message - Notification message
    @param messageType - This is used to determine what kind of notification that is for buttons when onButtonClicked triggers
    @param buttons - Object containing Chrome notification buttons
    @param buttonUrl - What page should it open when clicked on the button (currently only one URL for all buttons)
 */
function createNotification(title, message, messageType, buttons, buttonUrl) {
    notificationID++;
    notifications[notificationID + "_" + messageType] = buttonUrl;
    var tempButtons = [];
    if(buttons !== null) {
        tempButtons.push(buttons);
    }
    console.log("Button url : " + buttonUrl);
    chrome.notifications.create(notificationID + "_" + messageType, {
        type: "basic",
        iconUrl: "../../icons/icon_normal2.png",
        title: title,
        message: message,
        buttons: tempButtons
    }, function() {});
}

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
            try {
                var botStatus = doc.getElementsByTagName("center")[0].innerText.replace("BOTS ARE ", "");
                if(botStatus == "ONLINE") {
                    setBotstatus(1);
                } else if(botStatus == "OFFLINE") {
                    setBotstatus(0);
                }
                else {
                    setBotstatus(-1);
                }
            } catch(e) {
                console.log("Setting bot status to unknown, error getting bot status: " + e.message);
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
        chrome.storage.local.set(tempObj);

        var countNotify = Object.keys(matchesToNotificate).length;
        if(countNotify >= 3) {
            createNotification(
                "New matches have been added for betting on " + (appID == 730 ? "CS:GO" : "DOTA2") + " Lounge",
                "",
                "regular",
                {},
                false
            );
        }
        else {
            $.each(matchesToNotificate, function(index, value) {
                createNotification(
                    "A new " + (appID == 730 ? "CS:GO" : "DOTA2") + " match has been added!",
                    value.teamA + " vs. " + value.teamB + " @ " + value.tournament + "\nMatch begins " + value.when,
                    "match",
                    {title: "Open match page"},
                    (appID == 730 ? "http://csgolounge.com/" : "http://dota2lounge.com/") + "match?m=" + value.matchID
                );
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
        var url = urlStart + "mytrades";
        $.ajax({
            url: url,
            type: "GET",
            success: function(data) {
                var doc = document.implementation.createHTMLDocument("");
                doc.body.innerHTML = data;
                $(".tradepoll", doc).each(function(i, v) {
                    if($(".notification", v).length) {
                        var notifyAmount = parseInt($(".notification", v).text(), 10);
                        var tradeURL = urlStart + $("a[href]:eq(0)", v).attr("href");
                        var tradeID = $(v).attr("id").replace("trade", "");
                        console.log(tradeURL);
                        createNotification(
                            "Trade update on " + (appID == 730 ? "CS:GO Lounge" : "DOTA2 Lounge"),
                            notifyAmount == 1 ? "You have 1 new comment on your trade #" + tradeID : "You have " + notifyAmount + " new comments on your trade # " + tradeID,
                            "mytrade",
                            {title: "Open trade page"},
                            tradeURL
                        );
                    }
                });
            }
        });
    }
    if(offers.find(".notification").length > 0) {
        var url = urlStart + "myoffers";
        $.ajax({
            url: url,
            type: "GET",
            success: function(data) {
                var doc = document.implementation.createHTMLDocument("");
                doc.body.innerHTML = data;
                $(".tradepoll", doc).each(function(i, v) {
                    if($(".notification", v).length) {
                        var offerURL = urlStart + $("a[href]:eq(0)", v).attr("href");
                        createNotification(
                            "Trade update for your offer on " + (appID == 730 ? "CS:GO Lounge" : "DOTA2 Lounge"),
                            "A user has replied to your offer",
                            "myoffer",
                            {title: "Open offer page"},
                            offerURL
                        );
                    }
                });
            }
        });
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
