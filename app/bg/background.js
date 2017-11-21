var LoungeUser = new User();
var currencyFallback = {'USDAUD':1.1503, 'USDCAD': 1.1359, 'USDEUR': 0.8006, 'USDGBP': 0.6256, 'USDRUB': 43.59, 'USDUSD': 1};

LoungeUser.loadUserSettings(function() {
    console.log('Settings for background.js have loaded!');
    autoDelay = parseInt(LoungeUser.userSettings.autoDelay) * 1000 || 5000;
});

var isFirefox = typeof InstallTrigger !== 'undefined';

var marketPriceListUpdatedEpoch;
var bettingItemListUpdatedEpoch;

chrome.storage.local.get(['marketPriceListUpdatedEpoch', 'bettingItemListUpdatedEpoch'], function(result) {
    marketPriceListUpdatedEpoch = result.marketPriceListUpdatedEpoch || 0;
    bettingItemListUpdatedEpoch = result.bettingItemListUpdatedEpoch || 0;
});

var lastTimeUserVisited = null;
var lastTimeStorageFail = 0;
var baseURLs = {
    730: 'https://csgolounge.com/',
    570: 'https://dota2lounge.com/'
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Make changes to LoungeUser user settings once the settings are changed from extension pop-up
    if (request.hasOwnProperty('changeSetting')) {
        for (var name in request.changeSetting) {
            LoungeUser.userSettings[name] = request.changeSetting[name];
        }
    }

    // sets user setting and sends sync message to every other tab
    if (request.hasOwnProperty('saveSetting')) {
        for (var name in request.saveSetting) {
            LoungeUser.saveSetting(name, request.saveSetting[name]);
        }
    }

    // for if the content script doesn't have access to User
    if (request.hasOwnProperty('getSetting')) {
        var resp = {};
        for (var i = 0; i < request.getSetting.length; ++i) {
            resp[request.getSetting[i]] = LoungeUser.userSettings[request.getSetting[i]];
        }

        sendResponse(resp);
    }

    if (request.hasOwnProperty('giveMeBackpackURL')) {
        sendResponse(lastBackpackAjaxURL);
    }

    // Open new tab if none exists
    if (request.hasOwnProperty('tab')) {
        console.log('Opening tab', request, sender);
        openTabIfNotExist(request.tab, true, sender.tab.windowId);
    }

    // Get content of file
    if (request.hasOwnProperty('getFile')) {
        var dir = chrome.runtime.getPackageDirectoryEntry(function(entry) {
            // get specific file
            entry.getFile(request.getFile, {create: false}, function(fileEntry) {
                    // read file content
                    var reader = new FileReader();
                    reader.addEventListener('loadend', function(val) {
                        sendResponse({data: this.result});
                    });

                    reader.addEventListener('error', function(err) {
                        sendResponse({error: err});
                    });

                    fileEntry.file(function(file) {
                        reader.readAsText(file);
                    });

                },

                function(err) {
                    sendResponse({error: err});
                }

            );
        });

        return true;
    }

    // Create notification
    if (request.hasOwnProperty('notification')) {
        var data = request.notification;
        createNotification(data.title, data.message, data.buttons);
    }

    // Overwrite variable in format {set: {variable: {key: newValue}}}
    if (request.hasOwnProperty('set')) {
        for (var v in request.set) {
            var oldVar = window[v];
            var newVar = oldVar;

            for (var k in request.set[v]) {
                newVar[k] = request.set[v][k];
            }

            window[v] = newVar;
        }
    }

    if (request.hasOwnProperty('refetchMarketPriceList')) {
        updateMarketPriceList(sendResponse);
        if (sendResponse) {
            return true;
        }
    }

    if (request.hasOwnProperty('refetchCurrencyConversionRates')) {
        updateCurrencyConversion(sendResponse);
        if (sendResponse) {
            return true;
        }
    }

    if (request.hasOwnProperty('refetchCsglValues')) {
        updateCsgoloungeItemValues(sendResponse);
        if (sendResponse) {
            return true;
        }
    }

    if (request.hasOwnProperty('openSettings')) {
        openSettingsTab();
    }

    if (request.hasOwnProperty('doAjaxRequest')) {
        console.log('Sending a request to', request['doAjaxRequest']['url']);
        var ajax = request['doAjaxRequest'];

        if (!ajax.hasOwnProperty('dataType')) {
            ajax['dataType'] = 'text';
        }

        ajax['success'] = function(data) {
            sendResponse({
                success: true,
                data: data
            });
        };

        ajax['error'] = function(jqXHR) {
            sendResponse({
                success: false,
                data: jqXHR
            });
        };

        $.ajax(ajax);

        return true;
    }
});

/**
 * Send message to content scripts
 * @param int tabId - ID of tab to send to, 0 for all HTTP/HTTPS tabs,
 *                    -1 for all CSGOLounge tabs,
 *                    -2 for all Dota2Lounge tabs,
 *                    -3 for both (NOTE: currently all CSGOLounge tabs)
 * Don't ask me why I chose negativ numbers. I don't know.
 */
function sendMessageToContentScript(message, tabId) {
    if (tabId > 0) {
        chrome.tabs.sendMessage(tabId, message);
    } else {
        // Although they claim to, Chrome do not support arrays as url parameter for query
        // Therefore, -3 is currently the same as -1
        console.log('Sending message to ' + tabId);
        console.log(message);
        var url = ['*://*/*', '*://csgolounge.com/*', '*://dota2lounge.com/*', '*://csgolounge.com/*'][tabId * -1 || 0] || '*://*/*';
        chrome.tabs.query({url: url}, function(tabs) {
            for (var i = 0; i < tabs.length; ++i) {
                chrome.tabs.sendMessage(tabs[i].id, message);
            }
        });
    }
}

function openSettingsTab() {
    openTabIfNotExist(chrome.extension.getURL('settings/index.html'), true);
}

function openTabIfNotExist(url, focus, windowId) {
    chrome.tabs.query({url: url}, function(tabs) {
        if (tabs.length !== 0 && getChromeVersion() !== 49) {
            if (focus === true) {
                chrome.tabs.update(tabs[0].id, {active: true});
            }

            return;
        }

        var tabsObject = { url: url };

        if (windowId !== undefined) {
            tabsObject['windowId'] = windowId;
        }

        chrome.tabs.create(tabsObject);
    });
}

chrome.webRequest.onHeadersReceived.addListener(function(details) {
        // Used for price list updating, be careful if the URL list gets a new domain though
        lastTimeUserVisited = new Date().getTime();

        if ((+new Date() - marketPriceListUpdatedEpoch) > (1000 * 60 * 60 * 12)) {
            console.log('Updating market price list, last update was more than 24 hours ago');
            updateMarketPriceList();
        }

        if ((+new Date() - bettingItemListUpdatedEpoch) > (1000 * 60 * 60 * 24 * 4)) {
            console.log('Updating betting item list, last update was more than 7 days ago');
            updateCsgoloungeItemValues();
        }

        var headers = details.responseHeaders;
        var blockingResponse = {};
        var originalURL = details.url;
        var newHeaders = [];
        var isWaitRedirect = false;

        for (var i = 0, l = headers.length; i < l; ++i) {
            if (headers[i].name == 'Location' && headers[i].value.indexOf('/wait.html') != -1 && LoungeUser.userSettings.redirect == '1') {
                isWaitRedirect = true;
            } else {
                newHeaders.push(headers[i]);
            }
        }

        if (isWaitRedirect) {
            var errHtml = '<h1>LoungeDestroyer</h1><p>LoungeDestroyer is redirecting you away from wait.html redirect page to the page you intended to visit. ' +
                'You can disable this feature in extension settings.</p>';
            chrome.tabs.executeScript(details.tabId, {code: 'document.body.innerHTML += "' + errHtml + '"'});
            chrome.tabs.executeScript(details.tabId, {code: 'setTimeout(function() { window.location = "' + originalURL + '";}, 10000);'});
            blockingResponse.responseHeaders = newHeaders;
        }

        return blockingResponse;
    },

    {
        urls: ['*://csgolounge.com/*', '*://dota2lounge.com/*'],
        types: ['main_frame']
    },
    ['responseHeaders', 'blocking']
);

var lastBackpackAjaxData = [];

chrome.webRequest.onBeforeRequest.addListener(function(details) {
        console.log('onbefore url ' + details.url);
        lastBackpackAjaxData[details.url] = {
            url: details.url,
            method: details.method
        };

        var postData = [];

        console.log(details.requestBody);

        if(details.method === 'POST' && details.hasOwnProperty('requestBody') && details.requestBody.hasOwnProperty('formData')) {
            $.each(details.requestBody.formData, function(postDataIndex, postDataValue) {
                postData[postDataIndex] = postDataValue[0];
            });
        }
        lastBackpackAjaxData[details.url]['data'] = postData;
    },

    {
        urls: ['*://*/ajax/betReturns*', '*://*/ajax/betBackpack*', '*://*/ajax/tradeBackpack*', '*://*/ajax/tradeGifts*', '*://*/ajax/backpack*', '*://*/ajax/showBackpack*', '*://*/ajax/tradeCsRight*', '*://*/ajax/tradeWhatRight*'],
        types: ['xmlhttprequest']
    }
);

chrome.webRequest.onCompleted.addListener(function(details) {
        console.log('Backpack AJAX request detected with URL ', details.url, +new Date());
        console.log(lastBackpackAjaxData[details.url]);
        var message = {inventory: lastBackpackAjaxData[details.url]};
        sendMessageToContentScript(message, details.tabId);
    },

    {
        urls: ['*://*/ajax/betReturns*', '*://*/ajax/betBackpack*', '*://*/ajax/tradeBackpack*', '*://*/ajax/tradeGifts*', '*://*/ajax/backpack*', '*://*/ajax/showBackpack*', '*://*/ajax/tradeCsRight*', '*://*/ajax/tradeWhatRight*'],
        types: ['xmlhttprequest']
    }
);

var resourceTypesAudio = (isFirefox ? ['media', 'other'] : ['other']);

chrome.webRequest.onBeforeRequest.addListener(function requestListener(details) {
        if (['1', '2'].indexOf(LoungeUser.userSettings.beepSoundDisable) != -1) {
            console.log('Detected notif.mp3 sound request..');
            if (LoungeUser.userSettings.beepSoundDisable == '2' && LoungeUser.userSettings.customTradeOfferSound.length > 0) {
                console.log('Applying custom trade offer audio...');
                return {
                    redirectUrl: LoungeUser.userSettings.customTradeOfferSound
                };
            } else {
                console.log('Disabling notif.mp3 sound..');
                return {
                    cancel: true
                };
            }
        }
    },

    {
        urls: ['*://csgolounge.com/audio/notif*', '*://dota2lounge.com/audio/notif*'],
        types: resourceTypesAudio
    },
    ['blocking']
);

var notificationID = 0;
var notifications = {};

chrome.notifications.onButtonClicked.addListener(function(notificationID, buttonIndex) {
    if (notifications.hasOwnProperty(notificationID) && notifications[notificationID]['buttons'].hasOwnProperty(buttonIndex)) {
        notifications[notificationID]['buttons'][buttonIndex]['callback']();
    }
});

chrome.notifications.onClosed.addListener(function(notificationId, wasClosedByUser) {
    console.log('Notification #' + notificationId + ' closed by user: ' + wasClosedByUser);

    notifications[notificationId]['cleared'] = true;
});

function createNotification(title, message, buttons) {
    // Get buttons array with necessary data only
    var tempButtons = [];

    var notificationOptions = {
        type: 'basic',
        iconUrl: '../../icons/128x128.png',
        title: title,
        message: message
    };

    if (!isFirefox) {
        if (buttons !== undefined && buttons !== null) {
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].hasOwnProperty('title')) {
                    tempButtons.push({title: buttons[i]['title']});
                }
            }
        }

        notificationOptions['buttons'] = tempButtons;
    }

    chrome.notifications.create(notificationID.toString(), notificationOptions, function(chromeNotifyId) {
        console.log('Notification #' + chromeNotifyId + ' created!');

        notifications[notificationID] = {
            title: title,
            message: message,
            buttons: buttons,
            cleared: false,
            clearedAmount: 0,
            creationTime: +new Date()
        };

        notificationID++;
    });
}

function clearStuckNotifications() {
    $.each(notifications, function(id, notificationObj) {
        if (notificationObj.cleared === false && notificationObj.clearedAmount < 3 && (+new Date() - notificationObj.creationTime) > 1000 * 60 * 3) {
            console.log('Notification #' + id + ' still not closed after 180 seconds');

            chrome.notifications.clear(id, function(wasCleared) {
                console.log('Notification #' + id + ' cleared: ' + wasCleared);

                notifications['clearedAmount']++;
            });
        }
    });
}

setInterval(function () {
    clearStuckNotifications();
}, 20000);

var lastTimeCheckedMatches = {
    730: 0,
    570: 0
};

function checkNewMatches(ajaxResponse, appID) {
    var activeMatches = {};

    lastTimeCheckedMatches[appID] = +new Date();

    $('.matchmain', ajaxResponse).each(function(index, value) {
        if (!$('.match', value).hasClass('notaviable')) {
            var matchObj = new Match();
            matchObj.parseMatchElement(value);
            activeMatches[matchObj.matchID] = matchObj;
        }
    });

    // No need to do anything if there are no active matches
    if ($.isEmptyObject(activeMatches)) {
        return false;
    }

    var storageName = 'matches' + appID;

    var matchesToNotificate = {};

    chrome.storage.local.get(storageName, function(result) {
        // If no storage, then it is empty object
        var newMatchStorageObject = result[storageName] || {};
        var newMatchesCount = 0;

        // Loop through active matches and check if they are in storage
        $.each(activeMatches, function(index, value) {
            if (typeof newMatchStorageObject[index] == 'undefined') {
                console.log('Match #' + index + ' is new, adding to notify list and saving in local storage.');
                matchesToNotificate[index] = newMatchStorageObject[index] = value;
                newMatchesCount++;
            }
        });

        var tempObj = {};
        tempObj[storageName] = newMatchStorageObject;

        // Setting newly discovered matches in the storage
        chrome.storage.local.set(tempObj, function() {
            if (chrome.runtime.lastError) {
                if ((+new Date() - lastTimeStorageFail) > (1000 * 60 * 60)) {
                    lastTimeStorageFail = +new Date();
                    createNotification('Storage failure', 'Please check if the drive on which this extension is installed on is not full');
                }

                return;
            }
        });

        // We do not want to overwhelm user with individual match notifications
        if (newMatchesCount <= 3) {
            $.each(matchesToNotificate, function(index, value) {
                var msg = (value.teamA.length > 0) ?
                    (value.teamA + ' vs. ' + value.teamB + ' @ ' + value.tournamentName + (value.bestOf ? ', Best of ' + value.bestOf : '') + '\nMatch begins ' + value.timeFromNow) :
                    (value.tournamentName + '\nMatch begins ' + value.timeFromNow);

                createNotification(
                    'A new ' + (appID == 730 ? 'CS:GO' : 'DOTA2') + ' match has been added!', msg, [
                        {
                            title: 'Open match page',
                            callback: function() {
                                openTabIfNotExist((baseURLs[appID] + 'match?m=' + value.matchID), true);
                            }
                        }
                    ]
                );
            });
        }

        // Do notify about matches added in batch, only if the last matches check was recent (< 30 mins)
        if (newMatchesCount > 3 && (+new Date() - lastTimeCheckedMatches[appID]) < 1000 * 60 * 30) {
            createNotification(
                'New ' + (appID == 730 ? 'CS:GO' : 'DOTA2') + ' matches have been added!', newMatchesCount + ' new ' + (appID == 730 ? 'CS:GO' : 'DOTA2') + ' matches have been added', [
                    {
                        title: 'Open home page',
                        callback: function() {
                            openTabIfNotExist(baseURLs[appID], true);
                        }
                    }
                ]
            );
        }
    });
}

/*
    Credit to Bakkes (fork of LoungeCompanion on GitHub)
 */
function checkForNewTradeOffers(data, appID) {
    console.log('Checking for new trade offers on ' + appID);

    // dirty fixerino
    var data = $(data);
    var trades = data.find('a[href$="mytrades"]:first');
    var offers = data.find('a[href$="myoffers"]:first');

    var urlStart = baseURLs[appID];

    if (trades.find('.notification').length > 0) {
        var url = urlStart + 'mytrades';
        $.ajax({
            url: url,
            dataType: 'html',
            type: 'GET',
            success: function(data) {
                var doc = document.implementation.createHTMLDocument('');
                doc.body.innerHTML = data;
                var allNotifications = $('.tradepoll .notification', doc).length;
                if (allNotifications) {
                    sendMessageToContentScript({'tradesNotification' : allNotifications}, appID == 730 ? -1 : -2);
                }
                $('.tradepoll', doc).each(function(i, v) {
                    if ($('.notification', v).length) {
                        var notifyAmount = parseInt($('.notification', v).text(), 10);
                        var tradeURL = urlStart + $('a[href]:eq(0)', v).attr('href');
                        var tradeID = $(v).attr('id').replace('trade', '');
                        console.log(tradeURL);
                        createNotification(
                            'Trade update on ' + (appID == 730 ? 'CS:GO Lounge' : 'DOTA2 Lounge'),
                            notifyAmount == 1 ? 'You have 1 new comment on your trade #' + tradeID : 'You have ' + notifyAmount + ' new comments on your trade # ' + tradeID,
                            [{
                                title: 'Open trade page',
                                callback: function() {
                                    console.log('ebin callback');
                                    openTabIfNotExist(tradeURL, true);
                                }
                            }]
                        );
                    }
                });
            }
        });
    }

    if (offers.find('.notification').length > 0) {
        var url = urlStart + 'myoffers';
        $.ajax({
            url: url,
            dataType: 'html',
            type: 'GET',
            success: function(data) {
                var doc = document.implementation.createHTMLDocument('');
                doc.body.innerHTML = data;
                var allNotifications = $('.tradepoll .notification', doc).length;
                if (allNotifications) {
                    sendMessageToContentScript({'tradesNotification' : allNotifications}, appID == 730 ? -1 : -2);
                }
                $('.tradepoll', doc).each(function(i, v) {
                    if ($('.notification', v).length) {
                        var offerURL = urlStart + $('a[href]:eq(0)', v).attr('href');
                        createNotification(
                            'Trade update for your offer on ' + (appID == 730 ? 'CS:GO Lounge' : 'DOTA2 Lounge'),
                            'A user has replied to your offer',
                            [{
                                title: 'Open offer page',
                                callback: function() {
                                    openTabIfNotExist(offerURL, true);
                                }
                            }]
                        );
                    }
                });
            }
        });
    }
}

function checkHomepages() {
    var checkDotoPage = ['1', '2'].indexOf(LoungeUser.userSettings.notifyMatches) !== -1 || ['1', '2'].indexOf(LoungeUser.userSettings.notifyTrades) !== -1;
    var checkCSGOPage = ['1', '3'].indexOf(LoungeUser.userSettings.notifyMatches) !== -1 || ['1', '3'].indexOf(LoungeUser.userSettings.notifyTrades) !== -1;

    if (checkDotoPage) {
        console.log('Checking DOTA2 home page');
        $.ajax({
            'url': 'http://dota2lounge.com/',
            'type': 'GET',
            'dataType': 'text',
            success: function(data) {
                var doc = document.implementation.createHTMLDocument('');
                doc.body.innerHTML = data;

                if (['1', '2'].indexOf(LoungeUser.userSettings.notifyMatches) !== -1) {
                    checkNewMatches(doc, 570);
                }

                if (['1', '2'].indexOf(LoungeUser.userSettings.notifyTrades) !== -1) {
                    checkForNewTradeOffers(doc, 570);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error fetching DOTA2Lounge home page', textStatus, errorThrown);
            }

        });
    }

    if (checkCSGOPage) {
        console.log('Checking CS:GO home page');
        $.ajax({
            'url': 'http://csgolounge.com/',
            'type': 'GET',
            'dataType': 'text',
            success: function(data) {
                var doc = document.implementation.createHTMLDocument('');
                doc.body.innerHTML = data;

                if (['1', '3'].indexOf(LoungeUser.userSettings.notifyMatches) !== -1) {
                    checkNewMatches(doc, 730);
                }

                if (['1', '3'].indexOf(LoungeUser.userSettings.notifyTrades) !== -1) {
                    checkForNewTradeOffers(doc, 730);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error fetching CSGOLounge home page', textStatus, errorThrown);
            }

        });
    }
}

function updateMarketPriceList(callback) {
    var currentTimestamp = +new Date();

    $.ajax({
        url: 'https://api2.ncla.me/api/items/all/730,570/compact',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            var marketPrices = response.data;

            console.log('Market price list', marketPrices, currentTimestamp);

            marketPriceListUpdatedEpoch = currentTimestamp;

            chrome.storage.local.set({
                'marketPriceList': marketPrices,
                'marketPriceListUpdatedEpoch': currentTimestamp
            });
            console.log('Item price list has been updated!');

            if (callback) {
                callback();
            }
        },
        error: function(error) {
            console.log('Error getting response for item price list API');
            // Just in case so it doesn't send overwhelmingly many requests
            marketPriceListUpdatedEpoch = currentTimestamp;
        }
    });
}

function updateCurrencyConversion(callback) {
    var oReq = new XMLHttpRequest();
    oReq.onload = function() {
        var parsed = JSON.parse(this.responseText);

        var conversionList = {};

        $.each(parsed, function(i, v) {
            conversionList['USD' + v.abbreviation] = parseFloat(v.rate);
        });

        console.log('Currency conversion rates:');
        console.log(conversionList);

        chrome.storage.local.set({'currencyConversionRates': conversionList});
        if (callback) {
            console.log('Callback:', callback);
            callback();
        }
    };

    oReq.onerror = function() {
        setTimeout(updateCurrencyConversion, 60000);
        chrome.storage.local.set({'currencyConversionRates': currencyFallback});
    };

    oReq.open('get', 'https://api.ncla.me/destroyer/currencies', true);
    oReq.send();
}

function updateCsgoloungeItemValues(callback) {
    console.log('Updating CS:GO Lounge item betting values!');
    var currentTimestamp = +new Date();

    $.ajax({
        url: 'http://csgolounge.com/api/schema.php',
        dataType: 'json',
        success: function(response) {
            var valueStorage = {};

            $.each(response, function(i, v) {
                var floatValue = parseFloat(v.worth);
                if(floatValue > 0) {
                    valueStorage[v.name] = floatValue;
                }
            });

            bettingItemListUpdatedEpoch = currentTimestamp;

            chrome.storage.local.set({
                'csglBettingValues': valueStorage,
                'bettingItemListUpdatedEpoch': currentTimestamp
            });

            if(callback) callback();
            console.log('CS:GO Lounge item betting values updated.');
        },
        error: function(error) {
            console.log('Error getting betting values from API', error);
            bettingItemListUpdatedEpoch = currentTimestamp;
        },
        cache: false
    });
}

function checkForExpiredItems(appID) {
    if (!baseURLs.hasOwnProperty(appID)) {
        throw new Error('Invalid appID specified');
    }

    var url =  baseURLs[appID] + 'mybets';

    console.log('Checking for expired items on ' + url);

    $.ajax({
        url: url,
        dataType: 'html',
        success: function(data) {
            var doc = document.implementation.createHTMLDocument('');
            doc.body.innerHTML = data;

            var items = $(doc).find('.item.Warning');

            if (items.length) {
                createNotification('Items expiring soon', 'There are ' + items.length + ' items on ' + (appID == 730 ? 'CS:GO Lounge' : 'DOTA2 Lounge') + ' about to expire.\nRequest them back if you don\'t want to lose them.');
            }

            console.log('Expired items count on', appID, 'is', items.length);
        },
        error: function() {
            console.error('Error fetching /mybets page for expired items');
        }
    });
}

function autoBumpTrades() {
    for (var appID in baseURLs) {
        if (LoungeUser.userSettings.autoBump != appID && LoungeUser.userSettings.autoBump != '1') {
            continue;
        }

        var url = baseURLs[appID];
        (function(url, appID) {
            return function self() {
                console.log('Checking ', url, ' for bumpable trades');
                $.ajax({
                    url: url + 'mytrades',
                    dataType: 'html',
                    success: function(resp, txt, xhr) {
                        var doc = document.implementation.createHTMLDocument('');
                        doc.body.innerHTML = resp;

                        var bumpBtns = $('.buttonright[onclick*="bumpTrade"]', doc);

                        if (!bumpBtns.length) {
                            return;
                        }

                        bumpBtns.each(function() {
                            var onclick = this.getAttribute('onclick');
                            var params = /bumpTrade\('([0-9]+)'(?:,'([0-9a-zA-Z]+))?/.exec(onclick);

                            // params[1] = trade, params[2] = code
                            if (!params[1]) {
                                return;
                            }

                            var data = 'trade=' + params[1] + (params[2] ? '&code=' + params[2] : '');

                            $.ajax({
                                type: 'POST',
                                url: url + 'ajax/bumpTrade.php',
                                dataType: 'text',
                                headers: {
                                    'Accept': '*/*'
                                },
                                data: data,
                                success: function() {
                                    console.log('Bumped ', params, ' from ', url);
                                },

                                error: function(err) {
                                    console.error('Failed to bump ', params, ' from ', url);
                                }
                            });
                        });
                    },

                    error: function(err) {
                        console.error(err);
                        setTimeout(self, 6000);
                    }
                });
            }
        })(url, appID)();
    }
}

// create alarms, 60 = once an hour (60 minutes), 10080 = week, 360 = 6 hours, 1440 = day
var alarms = {
    itemListUpdate: 60,
    currencyUpdate: 10080,
    expiredReturnsChecking: 360,
    remoteThemesUpdate: 1440,
    autoBump: 10,
    csglBettingValues: 1440,
    checkHomepages: 1
};

// make sure we don't create alarms that already exist
chrome.alarms.getAll(function(a) {
    var existingAlarms = {};

    // loop through existing alarms
    $.each(a, function(ind, alarm) {
        var minToRecall = (alarm.scheduledTime - Date.now()) / (1000 * 60);

        // if it has a name, and time to recall isn't more than periodInMinutes
        if (alarm.name && alarm.periodInMinutes >= Math.abs(minToRecall)) {
            existingAlarms[alarm.name] = alarm.periodInMinutes;
        }
    });

    console.log('Existing alarms:', existingAlarms);

    $.each(alarms, function(name, time) { // loop through alarms we want
        if (!existingAlarms.hasOwnProperty(name) || existingAlarms[name] !== time) {
            console.log('Creating alarm', name, '(', time, ')');
            chrome.alarms.create(name, {
                delayInMinutes: time,
                periodInMinutes: time
            });
        }
    });
});

chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === 'itemListUpdate') {
        console.log('Checking if user has visited CS:GO Lounge recently..');
        var msSinceLastVisit = (new Date().getTime() - lastTimeUserVisited);
        console.log('Since last visit on CS:GL has passed: ' + msSinceLastVisit);

        // Updating only if the user has recently visited Lounge (less than 2 hours). Might want to rethink this.
        if (msSinceLastVisit < 7200000 && LoungeUser.userSettings.useCachedPriceList === '1') {
            updateMarketPriceList();
        } else {
            console.log('Hourly updating conditions were not met: user has not visited site recently and cached price list is disabled');
        }
    }

    if (alarm.name === 'currencyUpdate') {
        console.log('Currency update!');
        updateCurrencyConversion();
    }

    if (alarm.name === 'expiredReturnsChecking') {
        if (['1', '2'].indexOf(LoungeUser.userSettings.notifyExpiredItems) !== -1) {
            checkForExpiredItems(570);
        }

        if (['1', '3'].indexOf(LoungeUser.userSettings.notifyExpiredItems) !== -1) {
            checkForExpiredItems(730);
        }
    }

    if (alarm.name === 'autoBump') {
        if (['1', '730', '570'].indexOf(LoungeUser.userSettings.autoBump) !== -1) {
            autoBumpTrades();
        }
    }

    if (alarm.name === 'csglBettingValues') {
        if (LoungeUser.userSettings.csglBettingValues === '1') {
            updateCsgoloungeItemValues();
        }
    }

    if (alarm.name === 'checkHomepages') {
        checkHomepages();
    }
});

var meaninglessUpdates = [
    '0.9.3.7',
    '0.9.3.8',
    '0.9.3.9',
    '0.9.4.2',
    '0.9.4.3',
    '0.9.4.5',
    '0.9.4.6'
];

function onInstallOrUpdate() {
    updateCurrencyConversion();

    if(LoungeUser.userSettings.useCachedPriceList === '1') {
        updateMarketPriceList();
    }
}

/*
 Fired when the extension is first installed, when the extension is updated to a new version, and when Chrome is updated to a new version.
 https://developer.chrome.com/extensions/runtime#event-onInstalled
 */

if (chrome.runtime.onInstalled === undefined) {
    console.log('chrome.runtime.onInstalled is not supported! Running bare minimum tasks.');
    onInstallOrUpdate();
} else {
    console.log('chrome.runtime.onInstalled is supported!');

    chrome.runtime.onInstalled.addListener(function(details) {
        console.log('chrome.runtime.onInstalled event');
        if (details.reason == 'install') {
            console.log('This is a first install!');
        } else if (details.reason == 'update') {
            var thisVersion = chrome.runtime.getManifest().version;
            if (thisVersion != details.previousVersion) {
                console.log('Updated from ' + details.previousVersion + ' to ' + thisVersion + '!');

                // Don't bother notifying about meaningless updates
                if (meaninglessUpdates.indexOf(thisVersion) === -1) {
                    //createNotification(
                    //    'LoungeDestroyer ' + thisVersion + ' update',
                    //    'LoungeDestroyer has updated to ' + thisVersion + ' version, bringing bug fixes and possibly new stuff. You can read about the changes by pressing button below',
                    //    [{
                    //        title: 'Open changelog',
                    //        callback: function() {
                    //            openTabIfNotExist(chrome.extension.getURL('settings/index.html#openchangelog'), true);
                    //        }
                    //    }]
                    //);
                }

                // Migration forcing setting change for users that have cached item list and hover only market prices
                if(details.previousVersion == '0.8.3.0' && thisVersion == '0.8.3.1') {
                    console.log('Migration 0.8.3.0 => 0.8.3.1');
                    if(LoungeUser.userSettings.useCachedPriceList === '1' && LoungeUser.userSettings.itemMarketPricesv2 !== '2') {
                        console.log('Disabling cached market price list');
                        LoungeUser.saveSetting('useCachedPriceList', '0');
                    }
                }
            }
        }

        onInstallOrUpdate();
    });
}

chrome.browserAction.onClicked.addListener(function(tab) {
    openSettingsTab();
});