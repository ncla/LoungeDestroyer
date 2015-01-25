var LoungeUser = new User(),
    currencyFallback = {"USDAUD":1.1503,"USDCAD":1.1359,"USDEUR":0.8006,"USDGBP":0.6256,"USDRUB":43.59,"USDUSD":1},
    themes = {};
    themeCSS = "";

LoungeUser.loadUserSettings(function() {
    console.log("Settings for background.js have loaded!");
    bet.autoDelay = parseInt(LoungeUser.userSettings.autoDelay) * 1000 || 5000;

    chrome.storage.local.get("themes", function(result){
    	themes = result.themes || {};
    	if (LoungeUser.userSettings.currentTheme) {
    		var name = LoungeUser.userSettings.currentTheme;
    		if (themes.hasOwnProperty(name)) {
    			themeCSS = themes[name].cachedCSS || "";
    		}
    	}

    	// if we don't have any themes
    	if (!Object.keys(themes).length) {
    		console.log("Resetting to bundled themes!");
    		// add bundled themes
    		themes = {
    			cleanlounge: {
	    			url: "http://api.ncla.me/themes/CleanLounge/data.json",
	    			remote: true
	    		}
    		};
    		chrome.storage.local.set({themes: themes}, function(){updateThemes()});
    	}
    });
});

var lastTimeUserVisited = null,
    baseURLs = {
    	730: "http://csgolounge.com/", 
    	570: "http://dota2lounge.com/"
    };

chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    // Make changes to LoungeUser user settings once the settings are changed from extension pop-up
    if(request.hasOwnProperty("changeSetting")) {
        for(var name in request.changeSetting) {
            LoungeUser.userSettings[name] = request.changeSetting[name];
        }
    }

    // sets user setting and sends sync message to every other tab
    if (request.hasOwnProperty("saveSetting")) {
        for(var name in request.saveSetting) {
            LoungeUser.saveSetting(name, request.saveSetting[name]);
        }
    }

    // for if the content script doesn't have access to User
    if (request.hasOwnProperty("getSetting")) {
        var resp = {};
        for (var i = 0; i < request.getSetting.length; ++i) {
            resp[request.getSetting[i]] = LoungeUser.userSettings[request.getSetting[i]];
        }
        sendResponse(resp);
    }

    if(request.hasOwnProperty("giveMeBackpackURL")) {
        sendResponse(lastBackpackAjaxURL);
    }

    // Inject CSS file to specific tab
    if(request.hasOwnProperty("injectCSS")) {
    	console.log("Injecting CSS ("+request.injectCSS+") into tab "+sender.tab.id);
    	chrome.tabs.insertCSS(sender.tab.id, {file: request.injectCSS, runAt: "document_start"}, function(x){console.log(x)});
    }

    // Inject CSS code to specific tab
    if(request.hasOwnProperty("injectCSSCode")) {
    	// put !important on *everything* because Chrome is fucking retarded
    	console.log("Injected CSS code into tab "+sender.tab.id);
    	chrome.tabs.insertCSS(sender.tab.id, {code: importantifyCSS(request.injectCSSCode), runAt: "document_start"}, function(x){console.log(x)});
    }

    // Inject theme CSS (in bg for speed purposes)
    if(request.hasOwnProperty("injectCSSTheme")) {
    	(function loop(id, tries){
    		if (tries > 200)
    			return;

			chrome.tabs.insertCSS(id, {code: themeCSS, runAt: "document_start"}, function(x){
				// retry if it's called before tab exists (dah fuck chrome?)
				var e = chrome.runtime.lastError;
				if (e) {
					console.error("Error while inserting theme CSS: ",e);
					setTimeout(loop.bind(this, id, tries+1), 5);
				}
			});
		})(sender.tab.id, 0);
    }

    // Open new tab if none exists
    if(request.hasOwnProperty("tab")) {
        chrome.tabs.query({url: request.tab}, function(tabs){
            if (tabs.length !== 0)
                return;

            chrome.tabs.create({url: request.tab});
        });
    }

    // Get content of file
    if(request.hasOwnProperty("getFile")) {
    	var dir = chrome.runtime.getPackageDirectoryEntry(function(entry){
    		// get specific file
    		entry.getFile(request.getFile, {create: false}, function(fileEntry){
    			// read file content
    			var reader = new FileReader();
    			reader.addEventListener("loadend", function(val){
    				sendResponse({data: this.result});
    			});
    			reader.addEventListener("error", function(err){
    				sendResponse({error: err});
    			})

    			fileEntry.file(function(file){
    				reader.readAsText(file);
    			});

    		}, function(err){sendResponse({error: err})});
    	});
    	return true;
    }

    // Create notification
    if (request.hasOwnProperty("notification")) {
    	var data = request.notification;
    	createNotification(data.title, data.message, data.messageType, data.buttons, data.buttonUrl);
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

    if(request.hasOwnProperty("updateThemes")) {
    	updateThemes(sendResponse);
    	if (sendResponse)
    		return true;
    }

    if(request.hasOwnProperty("setCurrentTheme")) {
    	var newCurTheme = request.setCurrentTheme;
    	if (typeof newCurTheme !== "string")
    		newCurTheme = LoungeUser.userSettings.currentTheme;

    	console.log("Setting current theme to ",newCurTheme);

    	chrome.storage.local.get("themes", function(result){
	    	themes = result.themes || {};
	    	if (newCurTheme && themes.hasOwnProperty(newCurTheme)) {
	    		themeCSS = themes[newCurTheme].cachedCSS || "";
	    	} else {
	    		themeCSS = "";
	    	}
	    });
    }
    if(request.hasOwnProperty("refetchMarketPriceList")) {
        updateMarketPriceList(sendResponse);
        if (sendResponse)
        	return true;
    }
    if(request.hasOwnProperty("refetchCurrencyConversionRates")) {
        updateCurrencyConversion(sendResponse);
        if (sendResponse)
        	return true;
    }
});

var icons = {"-1": "icons/icon_unknown.png", "0": "icons/icon_offline.png", "1": "icons/icon_online.png"};

function setBotstatus(value) {
    chrome.browserAction.setIcon({path: icons[value.toString()]});
    chrome.storage.local.get('botsOnline', function(result) {
        if(result.botsOnline != value) {
            console.log("Bot status changed!!!!111");
            chrome.storage.local.set({"botsOnline": value});
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
        lastTimeUserVisited = new Date().getTime(); // Used for price list updating, be careful if the URL list gets a new domain though

        var headers = details.responseHeaders,
            blockingResponse = {},
            originalURL = details.url,
            newHeaders = [],
            isWaitRedirect = false;
        console.log("Old headers: ", headers);
        for(var i = 0, l = headers.length; i < l; ++i) {
            if(headers[i]['name'] == 'Location' && headers[i].value.indexOf("/wait.html") != -1 && LoungeUser.userSettings.redirect == "1") {
                isWaitRedirect = true;
            } else {
                newHeaders.push(headers[i]);
            }
        }
        console.log("New headers: ", newHeaders);
        if(isWaitRedirect) {
            var errHtml = "<h1>LoungeDestroyer</h1><p>LoungeDestroyer is redirecting you away from wait.html redirect page to the page you intended to visit. " +
                "You can disable this feature in extension settings.</p>";
            chrome.tabs.executeScript(details.tabId, {code: "document.body.innerHTML += '"+errHtml+"'"});
            chrome.tabs.executeScript(details.tabId, {code: "setTimeout(function() { window.location = '"+originalURL+"';}, 10000);"});
            blockingResponse.responseHeaders = newHeaders;
        }
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
        if(notificationID.indexOf("_match") != -1 || notificationID.indexOf("_mytrade") != -1 || notificationID.indexOf("_myoffer") != -1 || notificationID.indexOf("_offer") !== -1) {
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

/*setInterval(function() {
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
}, 5000);*/

function checkNewMatches(ajaxResponse, appID) {
    var activeMatches = {};

    $(".matchmain", ajaxResponse).each(function(index, value) {
        if(!$(".match", value).hasClass("notaviable")) {
            var matchID = $("a", value).attr("href").replace("match?m=", "").replace("predict?m=", "");
            var tournament = $(".matchheader div:eq(1)", value).text().trim();
            var teamA = $(".teamtext:eq(0) b", value).text().trim();
            var teamB = $(".teamtext:eq(1) b", value).text().trim();
            var matchWhenTextNode = $(".matchheader .whenm:eq(0)", value)
                .contents()
                .filter(function() {
                    return this.nodeType === 3;
                });
            var when = $(matchWhenTextNode).text().trim() || " in near future..";
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
        var newMatchStorageObject = result[storageName];

        if($.isEmptyObject(result)) {
            // Init
            console.log("empty object");
        }
        else {
            $.each(activeMatches, function(index, value) {
                if (typeof result[storageName][index] == 'undefined') {
                    console.log("Match #" + index + " is new, adding to notify list and saving in local storage.");
                    matchesToNotificate[index] = value;
                    newMatchStorageObject[index] = value;
                }
            });
        }

        var tempObj = {};
        tempObj[storageName] = newMatchStorageObject;

        // Setting newly discovered matches in the storage
        chrome.storage.local.set(tempObj);

        var countNotify = Object.keys(matchesToNotificate).length;
        if(countNotify >= 3) {
            createNotification(
                "New matches have been added for betting on " + (appID == 730 ? "CS:GO" : "DOTA2") + " Lounge",
                "",
                "regular",
                null,
                false
            );
        }
        else {
            $.each(matchesToNotificate, function(index, value) {
                var msg = (value.teamA.length > 0) ? (value.teamA + " vs. " + value.teamB + " @ " + value.tournament + "\nMatch begins " + value.when) : (value.tournament + "\nMatch begins " + value.when);
                createNotification(
                    "A new " + (appID == 730 ? "CS:GO" : "DOTA2") + " match has been added!",
                    msg,
                    "match",
                    {title: "Open match page"},
                    baseURLs[appID] + "match?m=" + value.matchID
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

    var urlStart = baseURLs[appID];

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

function updateMarketPriceList(callback) {
    var oReq = new XMLHttpRequest();
    oReq.onload = function() {
        console.log(JSON.parse(this.responseText));
        chrome.storage.local.set({"marketPriceList": JSON.parse(this.responseText)});
        console.log(new Date() + " -- Item price list has been updated!");
        if (callback) {
        	console.log("Callback:",callback);
        	callback();
        }
    };
    oReq.onerror = function() {
        console.log("Error getting response for item price list API");
    };
    oReq.open("get", "http://api.ncla.me/itemlist.php", true);
    oReq.send();
}

function updateCurrencyConversion(callback) {
    var currencyList = [];
    $.each(currencyData, function(i, v) {
        currencyList.push('"USD'+v["naming"]+'"');
    });
    currencyList = currencyList.join();
    var oReq = new XMLHttpRequest();
    oReq.onload = function() {
        var parsed = JSON.parse(this.responseText);
        var rates = parsed['query']['results']['rate'];
        var conversionList = {};
        $.each(rates, function(i, v) {
            conversionList[v["id"]] = parseFloat(v["Rate"]);
        });
        console.log("Currency conversion rates:");
        console.log(conversionList);
        chrome.storage.local.set({"currencyConversionRates": conversionList});
        if (callback) {
        	console.log("Callback:",callback);
        	callback();
        }
    };
    oReq.onerror = function() {
    	setTimeout(updateCurrencyConversion, 30000);
    	chrome.storage.local.set({"currencyConversionRates": currencyFallback});
    };

    oReq.open("get", "http://query.yahooapis.com/v1/public/yql?q=select * from yahoo.finance.xchange where pair in (" + currencyList + ")&format=json&env=store://datatables.org/alltableswithkeys&callback=", true);
    oReq.send();
}
function checkForExpiredItems(appID) {
    console.log("Checking for expired items on " + appID);
    var urlStart = baseURLs[appID];

    get(urlStart + "mybets", function() {
        var doc = document.implementation.createHTMLDocument("");
        doc.body.innerHTML = this.responseText;
        var items = $(doc).find('.item.Warning');
        if(items.length) {
            createNotification("Items expiring soon", "There are "+items.length+" items on " + (appID == 730 ? "CS:GO Lounge" : "DOTA2 Lounge") + " about to expire.\nRequest them back if you don't want to lose them." , "regular", null, false);
        }
    });
}
function autoBumpTrades() {
	for (var appID in baseURLs) {
		if (LoungeUser.userSettings.autoBump != appID && LoungeUser.userSettings.autoBump != "1")
			continue;

		var url = baseURLs[appID];
		(function(url, appID){return function self(){
			console.log("Checking ",url," for bumpable trades");
			$.ajax({
				url: url+"mytrades",
				success: function(resp, txt, xhr){
					var doc = document.implementation.createHTMLDocument("");
					doc.body.innerHTML = resp;

					var bumpBtns = $(".buttonright[onclick*='bumpTrade']", doc);

					if (!bumpBtns.length)
						return;

					bumpBtns.each(function(){
						var onclick = this.getAttribute("onclick"),
						    params = /bumpTrade\('([0-9]+)'(?:,'([0-9a-zA-Z]+))?/.exec(onclick);

						// params[1] = trade, params[2] = code
						if (!params[1])
							return;

						var data = "trade="+params[1]+(params[2] ? "&code="+params[2] : "");

						$.ajax({
							type: "POST",
							url: url+"ajax/bumpTrade.php",
							data: data,
							success: function(){
								console.log("Bumped ",params," from ",url);
							},
							error: function(err){
								console.error("Failed to bump ",params," from ",url);
							}
						});
					});
				},
				error: function(err){
					console.error(err);
					setTimeout(self, 6000);
				}
			});
		}})(url, appID)();
	}
}

// create alarms
var alarms = {
    itemListUpdate: 60, // once an hour
    currencyUpdate: 10080, // once a week
    expiredReturnsChecking: 360, // once every 6 hours'
    remoteThemesUpdate: 1440, // once a day
    autoBump: 10,
}
chrome.alarms.getAll(function(a){ // make sure we don't create alarms that already exist
    var existingAlarms = {};
    $.each(a,function(ind,alarm){ // loop through existing alarms
        if (alarm.name)
            existingAlarms[alarm.name] = alarm.periodInMinutes;
    });

    console.log("Existing alarms:",existingAlarms);

    $.each(alarms,function(name,time){ // loop through alarms we want
        if (!existingAlarms.hasOwnProperty(name) || existingAlarms[name] !== time) {
            console.log("Creating alarm",name,"(",time,")");
            chrome.alarms.create(name, {
                periodInMinutes: time
            });
        }
    });
});

chrome.alarms.onAlarm.addListener(function(alarm) {
    if(alarm.name == "itemListUpdate") {
        console.log("Checking if user has visited CS:GO Lounge recently..");
        var msSinceLastVisit = (new Date().getTime() - lastTimeUserVisited);
        console.log("Since last visit on CS:GL has passed: " + msSinceLastVisit);
        // Updating only if the user has recently visited CS:GL (less than 2 hours). Might want to rethink this.
        if(msSinceLastVisit < 7200000) {
            updateMarketPriceList();
        }
    }
    if(alarm.name == "currencyUpdate") {
        console.log("Currency update!");
        updateCurrencyConversion();
    }
    if(alarm.name == "expiredReturnsChecking") {
        if(["1","2"].indexOf(LoungeUser.userSettings.notifyExpiredItems) !== -1) {
            checkForExpiredItems(570);
        }
        if(["1","3"].indexOf(LoungeUser.userSettings.notifyExpiredItems) !== -1) {
            checkForExpiredItems(730);
        }
    }
    if(alarm.name == "remoteThemesUpdate") {
    	updateThemes();
    }
    if (alarm.name == "autoBump") {
    	if (["1","730","570"].indexOf(LoungeUser.userSettings.autoBump) !== -1)
    		autoBumpTrades();
    }
});

function updateThemes(callback) {
	console.log("Updating themes!");
	chrome.storage.local.get("themes", function(result){
		var themes = result.themes;
		for (var theme in themes) {
			if (themes[theme].remote) {
				console.log("Updating theme "+theme);
				// get JSON
				var url = themes[theme].url+"?cachebreak="+Date.now();
				if (!url)
					continue;

				get(url, function(){
					try {
						var data = this.responseText,
			                json = JSON.parse(data),
			                err = "";
			                required = ["name", "title", "author", "version", "css", "bg"]

			            for (var i = 0; i < required.length; ++i) {
			                if (!json[required[i]]) {
			                    if (!err)
			                        err = "The following information is missing from the JSON: ";

			                    err += required[i] + " ";
			                }
			            }

			            if (err) {
			                console.error(err);
			                return;
			            }

                        if (themes[theme].version == json.version) {
                            console.log("Version hasn't changed, no need to update");
                            return;
                        }

			            console.log("Everything looks good");

			            // merge new JSON into old, keeping options
			            if (json.options) {
					        for (var k in themes[theme].options) {
					            if (json.options.hasOwnProperty(k)) {
					                json.options[k].checked = themes[theme].options[k].checked;
					            } else {
					                delete themes[theme].options[k];
					            }
					        }
					    }

					    // merge obj and json
					    $.extend(true, themes[theme], json);
					    chrome.storage.local.set({themes: themes});
					} catch (err) {
						console.error("["+theme+"] Failed to update: ",err);
					}

					// cache CSS so we can inject instantly
					get(themes[theme].css+"?cachebreak="+Date.now(), function(){
						if (!this.status) {
							console.error("["+theme+"] Failed to retrieve CSS");
							return;
						}
						var css = importantifyCSS(this.responseText);
						if (css) {
							if (theme === LoungeUser.userSettings.currentTheme)
								themeCSS = css;

				    		themes[theme].cachedCSS = css;
				    		chrome.storage.local.set({themes: themes});
					    }
					});
				});
			}
		}
		if (callback)
			setTimeout(callback, 750); // fake a delay so users don't get worried, yo
	});
}

function importantifyCSS(css){
	if (css) {
    	try {
    		var cssTree = parseCSS(css),
    		    rules = cssTree.stylesheet.rules;

    		for (var i = 0; i < rules.length; ++i) {
    			var rule = rules[i],
    			    decls = rule.declarations;

    			if (!decls)
    				continue;

    			for (var l = 0; l < decls.length; ++l) {
    				if (!decls[l].value)
    					continue;

    				decls[l].value = decls[l].value.replace("!important","").trim() + " !important";
    			}
    		}

    		css = stringifyCSS(cssTree, {compress: true});
    	} catch (err) {
    		console.error("Tried to parse CSS, failed: ",err);
    		return "";
    	}
    }

    return css;
}

/*
 Fired when the extension is first installed, when the extension is updated to a new version, and when Chrome is updated to a new version.
 https://developer.chrome.com/extensions/runtime#event-onInstalled
 */
chrome.runtime.onInstalled.addListener(function(details) {
    console.log("chrome.runtime.onInstalled event");
    if (details.reason == "install") {
        console.log("This is a first install!");
    } else if(details.reason == "update") {
        var thisVersion = chrome.runtime.getManifest().version;
        if(thisVersion != details.previousVersion) {
            console.log("Updated from " + details.previousVersion + " to " + thisVersion + "!");
            createNotification(
                "LoungeDestroyer " + thisVersion + " update",
                "LoungeDestroyer has updated to " + thisVersion + " version, bringing bug fixes and possibly new stuff. You can read about the changes by pressing button bellow",
                "offer", // does not matter.
                {title: "Read changelog"},
                "https://github.com/ncla/LoungeDestroyer/releases"
            );
        }
    }
    updateCurrencyConversion();
    updateMarketPriceList();
});
