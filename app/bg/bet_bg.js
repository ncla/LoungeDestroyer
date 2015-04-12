/**
 * Hooks into requests with one of the following keys:
 *   autoBet - for autoBet
 *   autoReturn - for autoReturn
 */
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    if (!sender.url) {
        return;
    }

    var game = sender.url.indexOf('http://csgolounge.com/') === 0 ? 0 :
               sender.url.indexOf('http://dota2lounge.com/') === 0 ? 1 :
               -1;

    // Disable auto-betting
    if ((request.autoBet === false || request.autoReturn === false) && game !== -1) {
        bet.disableAuto(false, game);
    }

    // Queue offer has been received
    if (request.hasOwnProperty('queue')) {
        handleQueue(request.queue, game, sender);
    }

    // Get current state of auto-betting
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
            sendResponse(window[request.get]);
        }
    }
});

/**
 * Queue storage
 * In bg, since this allows us to only open tab once
 */
var queue = {
    lastOffer: ['', '']
};

// Handle queue update (offer received)
function handleQueue(data, game, sender) {
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

        queue.lastOffer[game] = data.offer;
    }
}

/**
 * Bet-a-tron 9000
 * Based on oldshit.js
 * Uses arrays for keeping track of csgo/dota2lounge, format: [csgo, dota2]
 *
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
var bet = { // not a class - don't instantiate
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
    baseUrls: ['http://csgolounge.com/', 'http://dota2lounge.com/'],
    loopTimer: null,
    tabId: [-1, -1]
};

// example data:
// ldef_index%5B%5D=2682&lquality%5B%5D=0&id%5B%5D=711923886&worth=0.11&on=a&match=1522&tlss=2e7877e8d42fb969c5f6f517243c2d19
bet.enableAuto = function(url, data, csgo, cookies) {
    console.log('Auto-betting');
    console.log(data);

    // short for game
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
                chrome.tabs.create({url: bet.baseUrls[game], active: false}, function(details) {
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

        var headerObj = {
            'X-Requested-With': 'XMLHttpRequest',
            'Data-Referer': bet.baseUrls[g] + 'match?m=' + bet.matchNum[g]
        };
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
                            data += '\r\nDelayed auto by 2 seconds to avoid block.';
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

        var data;
        var newCallback;
        var game = details.url.indexOf('http://csgolounge.com/') === 0 ? 0 :
                   details.url.indexOf('http://dota2lounge.com/') === 0 ? 1 :
                   -1;

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

            data = details.requestBody.formData;
        }

        // This is basically a function, which later gets called by adding more bet data
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

        // if it's a return request
        if (details.method === 'GET') { // gawd damnit csgl, why did you have to make returning a two-step process
            if (pathRegexp.exec(details.url)[1] !== 'ajax/postToReturn.php') {
                return;
            }

            $.ajax({
                url: details.url,
                type: 'GET',
                success: newCallback.bind({
                    type: 'autoReturn',
                    match: false
                }),
                error: requestListener.bind(this, details)
            });

            console.log('Intercepting return request:');
            console.log(details);

            return {cancel: true};
        }

        // if it's a bet request
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
                                'Data-Referer': bet.baseUrls[game] + 'match?m=' + data.match[0],
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

// remove any evidence of us being here
chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
        var headers = details.requestHeaders;
        var baseUrlRegexp = /^https?:\/\/[\da-zA-Z\.-]+\.[a-z]{2,6}/;
        var baseUrl = details.url.match(baseUrlRegexp);
        var referer;

        // replace the "Origin" header with the URL being requested
        for (var i = 0; i < headers.length; ++i) {
            if (headers[i].name === 'Origin') {
                headers[i].value = headers[i].value.replace('chrome-extension://' + chrome.runtime.id, baseUrl);
            }

            if (headers[i].name.indexOf('Data-') === 0) {
                headers.push({
                    name: headers[i].name.replace('Data-', ''),
                    value: headers[i].value
                });
                headers.splice(i, 1);
            }
        }

        return {requestHeaders: headers};
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