var LoungeUser = new User();
LoungeUser.loadUserSettings(function() {
    console.log("Settings for background.js have loaded!");
});
/*
    Make changes to LoungeUser user settings once the settings are changed from extension pop-up
 */
chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    if(request.hasOwnProperty("changeSetting")) {
        for(var name in request.changeSetting) {
            LoungeUser.userSettings[name] = request.changeSetting[name];
        }
    }
    if(request.hasOwnProperty("giveMeBackpackURL")) {
        sendResponse(lastBackpackAjaxURL);
    }
});

function setBotstatus(value) {
    chrome.storage.local.get('botsOnline', function(result) {
        if(result.botsOnline != value) {
            console.log("Bot status changed!!!!111");
            chrome.storage.local.set({"botsOnline": value});
            /*
                Notifications
                https://developer.mozilla.org/en/docs/Web/API/notification
            */
            var message = {action: "updateBotStatus"};
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
function sendMessageToContentScript(message, tabId) {
    if(tabId) {
        chrome.tabs.sendMessage(tabId, message);
    }
    else {
        chrome.tabs.query({}, function(tabs) {
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

            var botStatus = doc.getElementsByTagName("center")[0].innerText.replace("BOTS ARE ", "");
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
            var notify = new Notification("New matches have been added for betting on " + appID,
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

setInterval(function() {
    var notifyWhat = LoungeUser.userSettings.notifyMatches;
    if(notifyWhat != "4") {
        if(notifyWhat == "2" || notifyWhat == "1") {
            console.log("Checking DOTA2 matches");
            var oReq = new XMLHttpRequest();
            oReq.onload = function() {
                var doc = document.implementation.createHTMLDocument("");
                doc.body.innerHTML = this.responseText;
                checkNewMatches(doc, 570);
            };
            oReq.open("get", "http://dota2lounge.com/", true);
            oReq.send();
        }
        if(notifyWhat == "3" || notifyWhat == "1") {
            console.log("Checking CS:GO matches");
            var oReq = new XMLHttpRequest();
            oReq.onload = function() {
                var doc = document.implementation.createHTMLDocument("");
                doc.body.innerHTML = this.responseText;
                checkNewMatches(doc, 730);
            };
            oReq.open("get", "http://csgolounge.com/", true);
            oReq.send();
        }
    }
}, 20000);