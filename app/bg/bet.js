/**
 * Welcome to the magic of auto-betting and auto-returning.
 * This might be the most complicated part of this extension, so grab a coffee and start understanding this piece.
 *
 * # chrome.webRequest.onBeforeRequest
 * This is the core of everything, auto-betting works by hooking into the requests. To be able to send requests from
 * background we have to do various things: we cancel the request sent from the tab, gather all the information to restore
 * the authenticity of the request. After that is done, we send the request and initiate the loop which is handled by bet.autoLoop
 *
 * # bet.autoLoop
 * Self explanatory, goes into loop all the time, gathers bet and request data, sends request, repeat on success/error,
 * while updating bet variable and sending message to tabs to update with auto-betting/returning status
 *
 * # bet.disableAuto / bet.enableAuto
 *
 * # bet
 * Object that holds all the necessary and important data about auto-betting/returning
 *
 * # bet.autoLoop / bet.disableAuto / bet.enableAuto
 * Sends messages to content scripts with updates. Possible messages are:
 * {autoBet: {time: <start-time>, // when autobet starts
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

var bet = {
    autoDelay: 5000,

    // autoBet || autoReturn
    type: ['autoBet', 'autoBet'],
    autoBetting: [false, false],

    // for hash purposes
    matchNum: [0, 0],
    betData: [{}, {}],
    lastError: ['', ''],
    lastBetTime: [0, 0],
    numTries: [0, 0],
    baseUrls: ['//csgolounge.com/', '//dota2lounge.com/'],
    loopTimer: null,
    tabId: [-1, -1]
};

/**
 * Here we listen to incoming messages from the tabs and react accordingly
 */
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    // We need URL from the tab
    if (!sender.url) {
        return;
    }

    // Determining game by URL
    var game = sender.url.indexOf('://csgolounge.com/') !== -1 ? 0 :
               sender.url.indexOf('://dota2lounge.com/') !== -1 ? 1 :
               -1;

    // Disable auto-betting if needed
    if ((request.autoBet === false || request.autoReturn === false) && game !== -1) {
        bet.disableAuto(false, game);
    }

    // Queue offer has been received, happens when a trade offer link has appeared in bottom right corner of the site
    if (request.hasOwnProperty('queue')) {
        handleQueue(request.queue, game, sender);
    }

    // Return current state of auto-betting, usually happens when a tab is refreshed and we need to display the auto-betting window
    if (request.hasOwnProperty('get')) {
        if ((request.get === 'autoBet' || request.get === 'autoReturn') && game !== -1) {
            sendResponse({enabled: bet.autoBetting[game],
                          type: bet.type[game],
                          time: bet.lastBetTime[game],
                          rebetDelay: bet.autoDelay,
                          error: bet.lastError[game],
                          matchId: bet.matchNum[game],
                          numTries: bet.numTries[game]});
        } else {
            // Returns the key for 'get'ing information, wut?
            // TODO: Return object instead with 'enabled' property
            sendResponse(window[request.get]);
        }
    }
});

/**
 * Queue storage
 * In background, since this allows us to only open tab once
 */
var queue = {
    lastOffer: ['', '']
};

/**
 * Handles queue data
 * @param data Queue data from queue.js, see variable queue for object structure @ queue.js
 * @param game Determined within chrome.webRequest.onBeforeRequest
 * @param sender Sender a.k.a. the tab from where the queue data was sent
 */
function handleQueue(data, game, sender) {
    // Check if the trade offer link we are receiving does not match the last one
    if (data.offer !== queue.lastOffer[game]) {
        if (LoungeUser.userSettings.notifyTradeOffer == '1') {
            createNotification('Queue trade offer received',
                (['CSGO', 'Dota2'])[game] + 'Lounge has sent you a trade offer',
                'offer',
                {title: 'Open trade offer'},
                data.offer);
        }

        if (['0', '2'].indexOf(LoungeUser.userSettings.enableAuto) === -1) {
            chrome.tabs.query({url: data.offer}, function(tabs) {
                if (tabs.length !== 0) {
                    return;
                }

                // Focus on trade offer tab when created if true
                var focusOnTradeOfferTab = LoungeUser.userSettings.focusOnTradeofferTab === '1';

                chrome.tabs.create({
                    url: data.offer,
                    windowId: sender.tab.windowId,
                    active: focusOnTradeOfferTab
                });
            });
        }
        // Store this trade offer within queue object
        queue.lastOffer[game] = data.offer;
    }
}

/**
 * Enables the auto-betting
 *
 * Example betting form data:
 * ldef_index%5B%5D=2682&lquality%5B%5D=0&id%5B%5D=711923886&worth=0.11&on=a&match=1522&tlss=2e7877e8d42fb969c5f6f517243c2d19
 *
 * @param url {string} Request URL
 * @param data Seriliazed betting form data
 * @param csgo {boolean}
 * @param cookies Browser cookies, necessary if we want to bet/return from incognito mode
 * @returns {false} if auto-betting did not start, {bet.autoBetting} array otherwise
 */
bet.enableAuto = function(url, data, csgo, cookies) {
    console.log('Auto-betting');
    console.log(data);

    // Short for game
    var g = csgo ? 0 : 1;

    if (bet.autoBetting[g]) {
        console.log('Already auto-betting');
        return false;
    }

    if (!url || (!data && bet.type[g] === 'autoBet')) {
        console.log('Can\'t autobet without URL and data');
        return false;
    }

    bet.autoBetting[g] = true;
    bet.lastBetTime[g] = Date.now();
    bet.numTries[g] = 0;

    bet.betData[g] = {serialized: data,
                        url: url,
                        cookies: cookies};

    bet.autoBetting[g] = bet.autoLoop(g);

    console.log('Enabling for ' + g + ': ' + bet.autoBetting[g]);
    if (bet.autoBetting[g]) {
        // send event to all lounge tabs
        var msg = {};

        msg[bet.type[g]] = {
            time: bet.lastBetTime[g],
            rebetDelay: bet.autoDelay,
            error: bet.lastError[g],
            matchId: bet.matchNum[g]
        };
        sendMessageToContentScript(msg, -1 - g);
    }

    return bet.autoBetting;
};

/**
 * Disables it, duh.
 *
 * @param success {boolean}
 * @param game {int} 0 for CS:GO, 1 for DOTA2
 */
bet.disableAuto = function(success, game) {
    console.log('Disabling auto-bet');

    this.autoBetting[game] = false;

    var msg = {};
    msg[bet.type[game]] = success || false;

    // Previously app/bet.js would refresh tabs on successful auto-bet, but now it refreshes tab that auto-betting
    // was started from. If that tab does not exist no longer, a new one will be created
    if (success) {
        chrome.tabs.reload(bet.tabId[game], function() {
            var e = chrome.runtime.lastError;
            if (e) {
                console.log('Error finding tab that auto-bet was started from: ', e);
                chrome.tabs.create({url: ('http:' + bet.baseUrls[game]), active: false}, function(details) {
                    var e = chrome.runtime.lastError;
                    if (e) {
                        console.log('Error creating a new tab', e);
                    }
                });
            }
        });
    }

    sendMessageToContentScript(msg, -1 - game);
};

/**
 * Initiated by bet.enableAuto, uses the betting data from `bet` object
 *
 * @param game {int} 0 for CS:GO, 1 for DOTA2
 * @returns {boolean}
 */
bet.autoLoop = function(game) {
    var success = [true, true];

    for (var g = 0; g < 2; ++g) {
        console.log('Game: ' + g);
        console.log('Betdata:');
        console.log(bet.betData);

        if (bet.type[g] === 'autoBet') {
            if (!bet.betData[g] || !bet.betData[g].serialized) { // if not betting
                // mostly failsafe for next if statement
                success[g] = false;
                continue;
            }

            if (bet.betData[g].serialized.indexOf('on=') === -1) { // if not a betting request
                console.log('Not a betting request');
                success[g] = false;
                continue;
            }
        }

        if (!bet.autoBetting[g]) { // if no longer auto-betting, for some reason
            success[g] = false;
            console.log('No longer auto-betting');
            continue;
        }

        // repeat request
        console.log('Performing request:');
        console.log({url: bet.betData[g].url, data: bet.betData[g].serialized});

        var protocol = bet.betData[g].url.indexOf('https://') !== -1 ? 'https:' : 'http:';

        var headerObj = {
            'X-Requested-With': 'XMLHttpRequest',
            'Data-Referer': bet.type[g] === 'autoBet' ? protocol + bet.baseUrls[g] + 'match?m=' + bet.matchNum[g] :
                                                        protocol + bet.baseUrls[g] + 'mybets'
        };

        console.log('autoloop cookies', bet.betData[g].cookies);
        if (bet.betData[g].cookies) {
            headerObj['Data-Cookie'] = bet.betData[g].cookies;
        }

        $.ajax({
            url: bet.betData[g].url,
            timeout: 10000,
            type: bet.type[g] === 'autoBet' ? 'POST' : 'GET',
            data: bet.type[g] === 'autoBet' ? bet.betData[g].serialized : '',
            success: (function(g) {
                return function(data) {
                    // Lounge returns nothing if success
                    if (data) {
                        console.log('Received error from auto (' + (['CS:GO', 'Dota 2'])[g] + '):');
                        console.log(data.substr(0, 500));
                        bet.lastError[g] = data;
                        bet.lastBetTime[g] = Date.now();
                        bet.numTries[g]++;

                        var extraDelay = 0;
                        if (data.indexOf('Try again in few seconds.') !== -1) {
                            console.log('Waiting a few seconds to avoid blocking');
                            data += '\n\r\n\rDelaying request by 2 seconds to avoid block.';
                            extraDelay = 2000;
                        }

                        // randomize our delay, so it gets harder for Lounge to detect us
                        extraDelay += Math.random() * 600 - 300;

                        var msg = {};
                        msg[bet.type[g]] = {
                            time: bet.lastBetTime[g],
                            error: data,
                            numTries: bet.numTries[g]
                        };
                        sendMessageToContentScript(msg, -1 - g);
                        /*if (data.indexOf("You have to relog in order to place a bet.") !== -1) {
                         bet.renewHash(0, g);
                         }*/

                        clearTimeout(bet.loopTimer);

                        // recall
                        bet.loopTimer = setTimeout(bet.autoLoop, bet.autoDelay + extraDelay)
                    } else {
                        // happy times
                        console.log('Bet was succesfully placed (' + (['CS:GO', 'Dota 2'])[g] + ')');
                        bet.disableAuto(true, g);

                        // tell tabs of our great success
                        var msg = {};
                        msg[bet.type[g]] = true;

                        //sendMessageToContentScript(msg, -1-g);
                    }
                }
            })(g),

            error: (function(g) {
                return function(xhr) {
                    var err = 'Error (#' + xhr.status + ') while autoing. Retrying';
                    bet.lastBetTime[g] = Date.now();
                    console.log(err);

                    var msg = {};
                    msg[bet.type[g]] = {
                        time: bet.lastBetTime[g],
                        error: err
                    };

                    sendMessageToContentScript(msg, -1 - g);
                    clearTimeout(bet.loopTimer);
                    bet.loopTimer = setTimeout(bet.autoLoop, bet.autoDelay);
                }
            })(g),

            headers: headerObj
        });
    }

    if (game === 0 || game === 1) {
        return success[game];
    }

    return true;
};

// NEW SHIT
// TODO: wait wut, this is not used anywhere

var requestData = {
    listenId: -1,
    data: {},
    url: ''
};

var pathRegexp = new RegExp('https?://.*?/(.*)');

// overwrite betting/return requests for autoing
chrome.webRequest.onBeforeRequest.addListener(function requestListener(details) {
        if (['0', '3'].indexOf(LoungeUser.userSettings.enableAuto) !== -1) {
            return;
        }

        var data; // Used to store form data
        var newCallback; // Callback for AJAX requests
        var game = details.url.indexOf('://csgolounge.com/') !== -1 ? 0 :
                   details.url.indexOf('://dota2lounge.com/') !== -1 ? 1 :
                   -1;
        var protocol = details.url.indexOf('https://') !== -1 ? 'https:' : 'http:';


        if (bet.autoBetting[game] || game === -1) {
            return;
        }

        if (details.tabId === -1) {
            return;
        }

        if (details.method === 'POST') {
            if (!details.requestBody || !details.requestBody.formData) {
                return;
            }

            // Store form data
            data = details.requestBody.formData;
        }

        // Self executing function that returns a function for AJAX success/error callback
        newCallback = (function(url, data, tabId) {
            return function(response) {
                bet.type[game] = this.type || bet.disableAuto(true, game);
                bet.matchNum[game] = this.match ? data.match : '';
                bet.tabId[game] = tabId;

                console.log('Reached newCallback: ', url, data);

                if (!response) {
                    bet.disableAuto(true, game);
                    return;
                }

                bet.enableAuto(url, this.data || '', !game, this.cookies);
            }
        })(details.url, data, details.tabId);

        // If it's a return request
        if (details.method === 'GET') {
            // Cancel out if it is freezing returns request, we handle that request differently within inject.js
            if (pathRegexp.exec(details.url)[1] !== 'ajax/postToReturn.php') {
                return;
            }

            chrome.tabs.sendMessage(details.tabId, {cookies: true},
                (function(details, data, game, that) {
                    return function(d) {
                        var cookies = d.cookies;

                        $.ajax({
                            url: details.url,
                            type: 'GET',
                            success: newCallback.bind({
                                type: 'autoReturn',
                                match: false,
                                cookies: cookies
                            }),
                            error: requestListener.bind(that, details),
                            headers: {
                                'X-Requested-With': 'XMLHttpRequest',
                                'Data-Referer': protocol + bet.baseUrls[game] + 'mybets',
                                'Data-Cookie': cookies
                            }
                        });

                        console.log('Intercepting bet request:');
                        console.log(details, data, d);
                    }
                })(details, data, game, this));

            return {cancel: true};
        }

        // If it's a bet request
        if (data.on !== undefined && data['lquality[]'] !== undefined) {
            // ask for serialized data from tab
            chrome.tabs.sendMessage(details.tabId, {serialize: '#betpoll', cookies: true},
                (function(details, data, game, that) {
                    return function(d) {
                        var serialized = d.serialize;
                        var cookies = d.cookies;

                        // replace bet data with serialized, keep everything else
                        // "on=a&ldef_index%5B%5D=2974&lquality%5B%5D=0&id%5B%5D=1578647120&worth=0.18"
                        var serializedData = serialized;
                        var blacklistedKeys = ['id[]', 'ldef_index[]', 'lquality[]', 'on', 'worth'];
                        for (var k in data) {
                            if (blacklistedKeys.indexOf(k) === -1) {
                                serializedData += '&' + k + '=' + data[k];
                            }
                        }

                        $.ajax({
                            url: details.url,
                            type: 'POST',
                            data: serializedData,
                            timeout: 10000,
                            success: newCallback.bind({
                                type: 'autoBet',
                                match: true,
                                data: serializedData,
                                cookies: cookies
                            }),
                            error: requestListener.bind(that, details),
                            headers: {
                                'X-Requested-With': 'XMLHttpRequest',
                                'Data-Referer': protocol + bet.baseUrls[game] + 'match?m=' + data.match[0],
                                'Data-Cookie': cookies
                            }
                        });

                        console.log('Intercepting bet request:');
                        console.log(details, data, d);
                    }
                })(details, data, game, this));

            return {cancel: true};
        }
    },

    {
        urls: ['*://csgolounge.com/*', '*://dota2lounge.com/*'],
        types: ['xmlhttprequest']
    },
    ['requestBody', 'blocking']
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

// example return data:
/*
{ // url: ajax/postToFreeze.php
    id[]: [""],
    ldef_index[]: ["2733"],
    lquality[]: ["4"],
}
*/

// example bet data:
/*
{ // url: ajax/postBetOffer.php
    id[]: ["7906705XX"],
    ldef_index[]: ["1185"],
    lquality[]: ["0"],
    match: ["1702"],
    on: ["a"],
    tlss: ["4b48933cc594f8e9dadacda9e1597eXX"],
    worth: ["0.04"]
}
*/