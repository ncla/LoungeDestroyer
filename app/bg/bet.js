var baseUrls = ['//csgolounge.com/', '//dota2lounge.com/'];

/**
 * AUTO-BETTING v2
 *
 * `bet` object
 * This is where all the data about auto-betting/-returning/-accepting is stored. This data is also being sent
 * to content pages for all tabs every time there is an update in autobetting, so the values entered in properties are important for both back-end and front-end.
 * bet[0] represents CS:GO Lounge, bet[1] is for DOTA2 Lounge.
 *
 * Few notes about the object properties:
 * type - can be autoBet || autoReturn || autoAccept || autoFreeze, is determine by outgoing HTTP request, or manually for auto-accepting
 * matchNum - match number, can be any value that evalutes to false, used only for auto-betting window for matches where the matchID is displayed
 * betData - AJAX object that is being used by auto-betting/-returning in the loop (instead of constructing it every time, like in first version)
 * lastError - last massage / error, used for displaying in auto-bet window
 * lastBetTime - last time in epoch when there was an attempt at auto-betting. Attribute used by all types.
 * numTries - number of re-tries, used for auto-betting/-returning
 * loopTimer - setTimeout gets stored in this attribute for auto-betting/-returning
 * tabId - tabId from where the initial betting request was initiated
 * navigatedAway - used by autoReturning, if it is false, and user left tab on /mybets the whole time, it will continue to auto-return seamlessly
 *
 * lastOffer - string of trade offer URL, used for not accepting same trade multiple times
 * acceptStart - epoch time when the trade accepting was started
 * acceptLoop - same as loopTimer, but for trade accepting, but does not loop
 *
 * chrome.extension.onMessage.addListener
 * Is where we listen for any user interactions with auto-betting window, status update requests, queue updates,
 * and react accordingly.
 *
 *
 */
var bet = {};
bet[0] = {
    type: 'autoBet',
    autoBetting: false,

    matchNum: 0,
    betData: {},
    lastError: '',
    lastBetTime: 0,
    numTries: 0,
    loopTimer: null,
    tabId: -1,
    navigatedAway: true,

    lastOffer: '',
    acceptStart: 0,
    acceptLoop: null
};
bet[1] = $.extend({}, bet[0]);

/**
 * Listens for any messages sent from content pages and reacts accordingly
 */
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    // We need URL from the tab
    if (!sender.url) {
        return;
    }

    var game = determineGameByURL(sender.url);

    if (request.hasOwnProperty('autoBet')) {
        if (request.autoBet === 'disable') {
            // Disable logic for auto-returning / auto-betting
            if (bet[game].type === 'autoBet' || bet[game].type === 'autoReturn') {
                bet.disableAuto(false, game);
            }

            // Disable logic for auto-accepting
            if (bet[game].type === 'autoAccept') {
                disableAutoAccept(game, false);
            }

            console.log('AUTOBET :: Forcefully setting navigatedAway true');
            bet[game].navigatedAway = true;
        }

        // Return current state of auto-betting, usually happens when a tab is refreshed and we need to display the auto-betting window
        if (request.autoBet === 'status') {
            sendResponse(bet[game]);
        }

        if (request.autoBet === 'continueAutoReturn') {
            var continueAuto = sender.tab && bet[game].navigatedAway === false && bet[game].tabId === sender.tab.id;
            console.log('AUTOBET :: Continuing auto-returning:', continueAuto);
            sendResponse(continueAuto);
        }
    }

    // Handle auto-accept
    if (request.hasOwnProperty('queue')) {
        handleQueue(request.queue, game, sender);
    }

});

/**
 * Enables auto-betting, this is called from chrome.webRequest.onBeforeRequest callback
 *
 * @param game Game ID, -1 = None, 0 = CSGO, 1 = DOTA2
 * @param ajaxObject Final jQuery AJAX object that will be passed to bet.autoLoop
 */
bet.enableAuto = function(game, ajaxObject) {
    console.log('Auto-betting');

    if (bet[game].autoBetting) {
        console.log('Already auto-betting');
        return false;
    }

    bet[game].autoBetting = true;
    bet[game].lastBetTime = Date.now();
    bet[game].numTries = 0;
    bet[game].lastError = 'No response received yet.';

    bet[game].betData = ajaxObject;

    bet[game].navigatedAway = bet[game].type !== 'autoReturn';

    console.log('AUTOBET :: navigatedAway set', bet[game].navigatedAway);

    console.log('AUTOBET :: betData in enableAuto');
    console.log(bet[game].betData);

    bet[game].autoBetting = bet.autoLoop(game);

    console.log('AUTOBET :: Enabling for ' + game + ': ' + bet[game].autoBetting);
    if (bet[game].autoBetting) {
        sendMessageToContentScript({autoBet: bet[game]}, -1 - game);
    }

    return bet[game].autoBetting;
};

/**
 * Disables auto-betting, and depending if it was a successful autobet, it will reload the tab (sites default behaviour)
 *
 * @param success true if disabled by auto-betting (or successful), false if disabled by user (unsuccessful)
 * @param game Game ID, -1 = None, 0 = CSGO, 1 = DOTA2
 */
bet.disableAuto = function(success, game) {
    console.log('AUTOBET :: Disabling auto-bet');

    bet[game].autoBetting = false;

    // We clone the object because we don't necessarily want the `action` property to be stored in `bet` object
    var msg = $.extend({}, bet[game]);
    msg.action = {disableAuto: false};
    msg = {autoBet: msg};

    sendMessageToContentScript(msg, -1 - game);

    if (success === true) {
        // Refreshing tab where the auto-betting was initiated from, if tab no longer exists, we create one
        // The reason we do this is because we need to read queue / trade offer related data from the site
        chrome.tabs.reload(bet[game].tabId, function() {
            var e = chrome.runtime.lastError;
            if (e) {
                console.log('Error finding tab that auto-bet was started from: ', e);
                chrome.tabs.create({url: ('http:' + baseUrls[game]), active: false}, function(details) {
                    var e = chrome.runtime.lastError;
                    if (e) {
                        console.log('Error creating a new tab', e);
                    }
                });
            }
        });
    }
};

/**
 * Initiated by bet.enableAuto. It will append success and error callbacks to the already existing AJAX object
 * and send the request for a specific game. Updates object `bet` throughout the progress and keeps looping itself.
 *
 * @param game {int} 0 for CS:GO, 1 for DOTA2
 * @returns {boolean} false if no longer-autobetting, true otherwise
 */
bet.autoLoop = function(game) {
    console.log('AUTOBET :: Game', game, 'Request data', bet[game].betData);

    // If no longer auto-betting
    if (!bet[game].autoBetting) {
        console.log('AUTOBET :: No longer auto-betting');
        return false;
    }

    var ajaxObj = bet[game].betData;

    ajaxObj['success'] = (function(game) {
        return function (data) {
            if (data) {
                console.log('AUTOBET :: Received error from auto (' + (['CS:GO', 'Dota 2'])[game] + '):', data.substr(0, 500));

                bet[game].lastError = data;
                bet[game].lastBetTime = Date.now();
                bet[game].numTries++;

                var extraDelay = Math.random() * 1750 - 450;

                sendMessageToContentScript({autoBet: bet[game]}, -1 - game);

                clearTimeout(bet[game].loopTimer);

                console.log('AUTOBET :: Delaying next request by ', extraDelay, 'ms', 'for game', game);

                bet[game].loopTimer = setTimeout(function() {
                    bet.autoLoop(game)
                }, ((LoungeUser.userSettings.autoDelay || 5) * 1000) + extraDelay);
            } else {
                console.log('Bet was succesfully placed (' + (['CS:GO', 'Dota 2'])[game] + ')');
                bet.disableAuto(true, game);
            }
        }
    })(game);

    ajaxObj['error'] = (function(game) {
        return function (xhr) {
            var err = 'HTTP Error (#' + xhr.status + ') while autoing. Retrying';
            bet[game].lastBetTime = Date.now();
            bet[game].lastError = err;
            bet[game].numTries++;

            console.log('AUTOBET :: Error received response:', err);

            sendMessageToContentScript({autoBet: bet[game]}, -1 - game);

            clearTimeout(bet[game].loopTimer);

            bet[game].loopTimer = setTimeout(function() {
                bet.autoLoop(game)
            }, ((LoungeUser.userSettings.autoDelay || 5) * 1000));
        }
    })(game);

    $.ajax(ajaxObj);

    return true;
};

var pathRegexp = new RegExp('https?://.*?/(.*)');

/**
 * This is the starting point, auto-betting/-returning works by hooking into the requests. To be able to send requests from
 * background we have to do various things: we cancel the request sent from the tab, gather all the information to restore
 * the authenticity of the request. After that is done, we send the request and initiate the loop which is handled by bet.autoLoop
 */
chrome.webRequest.onBeforeRequest.addListener(function requestListener(details) {
        if (['0', '3'].indexOf(LoungeUser.userSettings.enableAuto) !== -1) {
            return;
        }

        // Used to store form data
        var data;
        var game = determineGameByURL(details.url);
        var protocol = details.url.indexOf('https://') !== -1 ? 'https:' : 'http:';

        // TODO: Maybe cancel the request anyway? Currently user can presss the button again on CSGL (when using CleanLounge)
        if (bet[game].autoBetting || game === -1) {
            return;
        }

        if (details.tabId === -1) {
            return;
        }

        // POST data should contain POST data
        if (details.method === 'POST') {
            if (!details.requestBody || !details.requestBody.formData) {
                return;
            }

            // Store form data
            data = details.requestBody.formData;
        }

        var urlPath = pathRegexp.exec(details.url);

        if (urlPath === null) {
            return;
        }

        urlPath = urlPath[1];

        var ajaxObject = {};

        var isBet = (data !== undefined && data.on !== undefined && data['lquality[]'] !== undefined);
        var isReturn = (details.method === 'GET' && urlPath === 'ajax/postToReturn.php');

        if (isBet || isReturn) {
            console.log('AUTOBET :: ', urlPath);
            console.log('AUTOBET :: webRequest details', details);

            ajaxObject['url'] = details.url;
            ajaxObject['type'] = details.method || 'GET';
            ajaxObject['timeout'] = 10000;
            ajaxObject['headers'] = {};

            if (details.type === 'xmlhttprequest') {
                ajaxObject.headers['X-Requested-With'] = 'XMLHttpRequest';
            }

            console.log('AUTOBET :: AJAX object before tab info', $.extend({}, ajaxObject));

            chrome.tabs.sendMessage(details.tabId, {serialize: '#betpoll', cookies: true, windowUrl: true, ajaxObjects: true}, function(tabResponse) {
                // TODO Handling: When reloading extension, chrome.tabs does not become aware of existing tabs until they are refresh, tabResponse becomes undefined
                if (tabResponse === undefined) {
                    console.log('AUTOBET :: Tab response failed, tab needs to be reloaded for extension to pick it up');
                    return;
                }

                console.log('AUTOBET :: Tab response', tabResponse);

                ajaxObject.headers['Data-Cookie'] = tabResponse.cookies;
                ajaxObject.headers['Data-Referer'] = tabResponse.windowUrl;

                if (isBet && details.method === 'POST') {
                    var serializedData;

                    var allAjaxObjs = tabResponse.ajaxObjects || [];

                    allAjaxObjs = allAjaxObjs.reverse();

                    // TODO: Take the last request because user might change what he bets on the match
                    for (i = 0; i < allAjaxObjs.length; i++) {
                        if (allAjaxObjs[i].hasOwnProperty('url') && urlPath === allAjaxObjs[i]['url']) {
                            console.log('AUTOBET :: This is the one', allAjaxObjs[i]);

                            if (allAjaxObjs[i].hasOwnProperty('data')) {
                                serializedData = allAjaxObjs[i]['data'];
                                console.log('AUTOBET :: serializedData', serializedData);
                                break;
                            }
                        }
                    }

                    if (serializedData === undefined) {
                        console.log('AUTOBET :: Serialized data still not found');

                        serializedData = tabResponse.serialize;
                        var blacklistedKeys = ['id[]', 'ldef_index[]', 'lquality[]', 'on', 'worth'];
                        for (var k in data) {
                            if (blacklistedKeys.indexOf(k) === -1) {
                                serializedData += '&' + k + '=' + data[k];
                            }
                        }
                    }

                    ajaxObject['data'] = serializedData;
                }

                console.log('AUTOBET :: AJAX object after tab info', $.extend({}, ajaxObject));

                if(isBet) {
                    bet[game].type = 'autoBet';
                } else if (isReturn) {
                    bet[game].type = 'autoReturn';
                } else {
                    console.error('AUTOBET :: WHAT THE FUUUUUUUUUUUUUUUUUUUUUUUUK');
                }

                bet[game].matchNum = (isBet && data.match && data.match.length > 0 && data.match[0]) ? parseInt(data.match[0]) : '';
                bet[game].tabId = details.tabId;

                console.log('AUTOBET :: Match number', bet[game].matchNum);
                console.log('AUTOBET :: bet variable', bet[game]);

                bet.enableAuto(game, ajaxObject);

            });

            return {cancel: true};
        }
    },

    {
        urls: ['*://csgolounge.com/*', '*://dota2lounge.com/*'],
        types: ['xmlhttprequest']
    },
    ['requestBody', 'blocking']
);

chrome.webRequest.onBeforeRequest.addListener(function requestListener(details) {
        var urlPath = pathRegexp.exec(details.url);

        if (urlPath === null) {
            return;
        }

        urlPath = urlPath[1];

        var game = determineGameByURL(details.url);

        if (urlPath !== 'mybets' && details.method === 'GET' && bet[game].tabId === details.tabId && bet[game].navigatedAway === false) {
            console.log('AUTOBET :: User navigated away from /mybets');
            bet[game].navigatedAway = true;
        }
    },

    {
        urls: ['*://csgolounge.com/*', '*://dota2lounge.com/*'],
        types: ['main_frame']
    },
    []
);

chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
        var headers = details.requestHeaders;
        var baseUrlRegexp = /^https?:\/\/[\da-zA-Z\.-]+\.[a-z]{2,6}/;
        var baseUrl = details.url.match(baseUrlRegexp);
        var referer;
        var newHeaders = [];
        var dataHeaders = {};

        for (var i = 0; i < headers.length; ++i) {
            if (headers[i].name === 'Origin') {
                // Replace the "Origin" header with the URL being requested
                headers[i].value = headers[i].value.replace('chrome-extension://' + chrome.runtime.id, baseUrl);
            }

            // We put Data headers in separate array, we will loop through headers once more to check if we need to overwrite headers
            if (headers[i].name.indexOf('Data-') === 0) {
                // Push data headers to separate object
                dataHeaders[headers[i].name.replace('Data-', '')] = {
                    name: headers[i].name.replace('Data-', ''),
                    value: headers[i].value
                };
            }

            // Push normal headers to new header variable
            if(headers[i].name.indexOf('Data-') !== 0) {
                newHeaders.push({
                    name: headers[i].name,
                    value: headers[i].value
                })
            }
        }

        // Check if any of the new headers exist within data headers, if found, data header value will replace new header value
        for (var i = 0; i < newHeaders.length; ++i) {
            if(dataHeaders.hasOwnProperty(newHeaders[i].name)) {
                newHeaders[i].value = dataHeaders[newHeaders[i].name].value;
                // Delete the data header as we have found it
                delete dataHeaders[newHeaders[i].name];
            }
        }

        // All remaining data headers that did not exist already in new headers array, we just add them normally
        $.each(dataHeaders, function(i, v) {
            newHeaders.push({
                name: v.name,
                value: v.value
            });
        });

        return {requestHeaders: newHeaders};
    },

    {
        urls: ['<all_urls>'],
        types: ['xmlhttprequest']
    },
    ['blocking', 'requestHeaders']
);

/**
 * Handles queue data
 * @param data Queue data from queue.js, see variable queue for object structure @ queue.js
 * @param game Determined within chrome.webRequest.onBeforeRequest
 * @param sender Sender a.k.a. the tab from where the queue data was sent
 */
function handleQueue(data, game) {
    console.log('AUTOACCEPT :: gameid', game);
    // Check if the trade offer link we are receiving does not match the last one
    if (data.offer !== bet[game].lastOffer) {
        if (LoungeUser.userSettings.notifyTradeOffer == '1') {
            createNotification('Queue trade offer received',
                (['CSGO', 'Dota2'])[game] + 'Lounge has sent you a trade offer',
                'taburl',
                {title: 'Open trade offer'},
                data.offer);
        }

        if (['0', '2'].indexOf(LoungeUser.userSettings.enableAuto) === -1) {
            bet[game].type = 'autoAccept';
            bet[game].autoBetting = true;
            bet[game].lastError = 'Nothing has happened yet, fetching Session ID cookie now.';

            sendMessageToContentScript({autoBet: bet[game]}, -1 - game);

            var id = data.offer.replace(/\D/g, '');

            impregnateSteamSession(data.offer, function(details) {
                if(details === null) {
                    bet[game].lastError = 'Session ID cookie was not found, cancelling auto-accepting..';
                    disableAutoAccept(game, false);

                    return;
                }

                bet[game].acceptStart = Date.now();
                var delay = LoungeUser.userSettings.acceptDelay;
                bet[game].lastError = (delay == 0 ? 'Accepting trade offer instantly' : 'Accepting trade offer in ' + delay + ' seconds');
                sendMessageToContentScript({autoBet: bet[game]}, -1 - game);

                bet[game].acceptLoop = setTimeout(function() {

                    bet[game].lastError = 'Accepting trade offer..';
                    sendMessageToContentScript({autoBet: bet[game]}, -1 - game);

                    $.ajax({
                        url: 'https://steamcommunity.com/tradeoffer/' + id + '/accept',
                        type: 'POST',
                        data: {
                            sessionid: decodeURIComponent(details.value),
                            serverid: 1,
                            tradeofferid: id
                        },
                        headers: {
                            'Data-Referer': data.offer
                        },
                        timeout: 30000,
                        success: function(data) {
                            console.log('AUTOACCEPT :: Success response for accepting trade', data.length);

                            // Ask returns page to keep returning
                            chrome.storage.local.set({lastAutoAccept: Date.now()});

                            var bNeedsEmailConfirmation = data && data.needs_email_confirmation;
                            var bNeedsMobileConfirmation = data && data.needs_mobile_confirmation;

                            bet[game].lastError = (data.tradeid ? 'Successfully accepted trade offer!' : 'Additional confirmation needed!');

                            if (bNeedsEmailConfirmation) {
                                bet[game].lastError += ' To complete this trade, a confirmation email by Steam has been sent to ' +
                                    'your address (ending in "%s") with additional instructions.'.replace(/%s/, data.email_domain);
                            }

                            if (bNeedsMobileConfirmation) {
                                bet[game].lastError += ' To complete this trade, you must verify it in your Steam Mobile app. ' +
                                    'You can verify it by launching the app and navigating to the Confirmations page from the menu.';
                            }

                            disableAutoAccept(game, true);
                        },
                        error: function(jqXHR, textStatus) {
                            console.log('AUTOACCEPT :: Error accepting trade', jqXHR.status, textStatus);
                            bet[game].lastError = 'There was an error when accepting trade offer, HTTP Status code #' + jqXHR.status + '.';

                            var data = $.parseJSON(jqXHR.responseText);

                            if (data && data.strError) {
                                bet[game].lastError += ' ' + data.strError;
                            }

                            // 403 status code gets returned if you are logged out
                            if (jqXHR.status === 403) {
                                bet[game].lastError += ' Make sure that you are logged in on Steam with the same account you are using CS:GOLounge/DOTA2Lounge with.';
                            }

                            disableAutoAccept(game, false);
                        }
                    });
                }, ((LoungeUser.userSettings.acceptDelay || 10) * 1000));
            });
        }
        // Store this trade offer within queue object
        bet[game].lastOffer = data.offer;
    }
}

function disableAutoAccept(game, success) {
    bet[game].autoBetting = false;
    clearTimeout(bet[game].acceptLoop);
    bet[game].acceptStart = 0;

    var msg = $.extend({}, bet[game]);
    msg.action = {disableAuto: success};
    msg = {autoBet: msg};

    sendMessageToContentScript(msg, -1 - game);
}

function getSteamSessionCookie(callback) {
    chrome.cookies.get({url: 'https://steamcommunity.com', name: 'sessionid'}, function(details) {
        callback(details);
    });
}

function impregnateSteamSession(url, callback) {
    getSteamSessionCookie(function(details) {
        if (details !== null) {
            console.log('AUTOBET :: sessionID cookie found');
            callback(details);
            return;
        }

        console.log('AUTOBET :: sessionID cookie missing');

        $.ajax({
            url: url,
            type: 'GET'
        }).always(function() {
            getSteamSessionCookie(function(details) {
                console.log('AUTOBET :: sessionID cookie after fetching Steam page', details);
                callback(details);
            });
        });
    });
}