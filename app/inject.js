console.log('LoungeDestroyer content script has started..', +new Date());

var appID = (window.location.hostname == 'dota2lounge.com' ? '570' : '730');

var LoungeUser = new User();

var storageMarketItems;
var currencies = {};
var themes = {};
var matchInfoCachev2 = {};
var inventory = new Inventory();
var lastAccept = 0;
var blacklistedItemList = {};
var earlyBackpackLoad = false;
var tradeShowFilter;
var tradeHideFilter;
var tradeItemsHaveArr;
var tradeItemsWantArr;
var timezoneName;
var tradesFiltered = 0;
var isHomepage;
var hideFilteredTrades = true;
var hideFilteredMatches = true;
var siteAjaxReqObj = [];
var freezingItems = false;
var uniqueUserTrades = [];
var themeCssIsEmpty = true;
var marketPriceListUpdatedEpoch;
var bettingItemListUpdatedEpoch;
var useCachedPricesOnly = true;

chrome.storage.local.get(['marketPriceList', 'currencyConversionRates', 'themes', 'matchInfoCachev2', 'lastAutoAccept',
    'blacklistedItemList', 'csglBettingValues', 'userSettings', 'marketPriceListUpdatedEpoch', 'bettingItemListUpdatedEpoch'], function(result) {
    blacklistedItemList = result.blacklistedItemList || {};
    storageMarketItems = result.marketPriceList || {};
    marketPriceListUpdatedEpoch = result.marketPriceListUpdatedEpoch || 0;
    bettingItemListUpdatedEpoch = result.bettingItemListUpdatedEpoch || 0;
    currencies = result.currencyConversionRates || {};
    matchInfoCachev2 = result.matchInfoCachev2 || {'730': {}, '570': {}};
    themes = result.themes || {};
    lastAccept = result.lastAutoAccept || 0;
    csglBettingValues = result.csglBettingValues || {};
    var userSettings = result.userSettings || null;
    console.log('Local storage loaded', +new Date());
    // TODO: Maybe load user settings by passing the result from the same storage get callback?
    LoungeUser.loadUserSettings(function() {
        console.log('User settings have been loaded in content script!', +new Date());
        init();
    }, userSettings);
});

// Inject theme as quickly as possible
// TODO: Requesting background script from content script to inject CSS might not that really faster
if(window.location.href.indexOf('/api/') === -1 && window.location.href.indexOf('view-source:') !== 0) {
    chrome.runtime.sendMessage({injectCSSTheme: true}, function (response) {
        console.log('THEMES :: Theme CSS string is empty', response);
        themeCssIsEmpty = response;
    });
}

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
    // if non-empty, calls sendResponse with arguments at end
    var args = {};

    if (msg.inventory) {
        console.log('Backpack AJAX request detected from background script with URL ', msg.inventory.url, +new Date());
        if (LoungeUser.userSettingsLoaded) {
            if (msg.inventory.url.indexOf('tradeCsRight') != -1 || msg.inventory.url.indexOf('tradeWhatRight') != -1) {
                initiateItemObjectForElementList($('#itemlist .oitm:not(.marketPriced)'), true);
            } else {
                inventory.onInventoryLoaded(msg.inventory);
            }
        } else {
            earlyBackpackLoad = msg.inventory;
        }
    }

    if (msg.hasOwnProperty('changeSetting')) {
        for (var name in msg.changeSetting) {
            LoungeUser.userSettings[name] = msg.changeSetting[name];
        }
    }

    if (msg.hasOwnProperty('serialize')) {
        args.serialize = $(msg.serialize).serialize();
    }

    if (msg.hasOwnProperty('cookies')) {
        args.cookies = document.cookie;
    }

    if (msg.hasOwnProperty('windowUrl')) {
        args.windowUrl = window.location.href;
    }

    if (msg.hasOwnProperty('ajaxObjects')) {
        args.ajaxObjects = siteAjaxReqObj;
    }

    if (msg.tradesNotification) {
        var tradesBtn = $('#menu>a[href="mytrades"]');
        if (tradesBtn.find('.notification').length) {
            tradesBtn.find('.notification').text(msg.tradesNotification);
        } else {
            tradesBtn.prepend($('<div>').attr('class', 'notification').text(msg.tradesNotification));
        }          
    }
    
    if (msg.offersNotification) {
        var offersBtn = $('#menu>a[href="myoffers"]');
        if (offersBtn.find('.notification').length) {
            offersBtn.find('.notification').text(msg.offersNotification);
        } else {
            offersBtn.prepend($('<div>').attr('class', 'notification').text(msg.offersNotification));
        }      
    }
    
    
    if (!$.isEmptyObject(args)) {
        sendResponse(args);
    }
});

/*
 Wrap the init code here, because for this to function properly, we need user settings to be loaded first
 */
function init() {
    if (earlyBackpackLoad) {
        inventory.onInventoryLoaded(earlyBackpackLoad);
    }

    timezoneName = (LoungeUser.userSettings.timezone == 'auto' ? jstz.determine().name() : LoungeUser.userSettings.timezone);

    useCachedPricesOnly = (LoungeUser.userSettings.useCachedPriceList === '1' && LoungeUser.userSettings.itemMarketPricesv2 === '2'
    && ((+new Date() - marketPriceListUpdatedEpoch) < (1000 * 60 * 60 * 24)));

    // do theme-related stuff
    if (LoungeUser.userSettings.currentTheme) {
        var name = LoungeUser.userSettings.currentTheme;
        if (themes.hasOwnProperty(name)) {
            var theme = themes[name];
            var style;

            if (!theme.cachedCSS) {
                style = document.createElement('link');
                style.setAttribute('href', theme.css);
                style.setAttribute('rel', 'stylesheet');
                $(document).ready(function() {
                    document.head.appendChild(style);
                })
            }

            $(document).ready(function() {
                // collapsible menus and columns
                console.log('THEMES :: collapsibleColumns', theme.collapsibleColumns);
                if (theme.collapsibleColumns === true) {
                    $('#submenu, .box').each(function(columnIndex, columnValue) {
                        $toggle = $('<div class="ld-collapse-toggle"></div>');

                        $toggle.click(function() {
                            $(columnValue).toggleClass('ld-collapsed');
                        });

                        $(columnValue).append($toggle);
                    });
                }

                if (theme.disableCss === true) {
                    console.log('THEMES :: Theme requires to have site stylesheet to be disabled');

                    // Don't do anything if we don't have theme CSS injected
                    if (themeCssIsEmpty === false) {
                        var styles = document.styleSheets;
                        for (var i = 0; i < styles.length; i++) {
                            // Look if the stylesheet is remote by checking the URL attribute
                            if (styles[i].href && (styles[i].href.indexOf("/css/bright") !== -1 || styles[i].href.indexOf("/css/gray") !== -1)) {
                                // Check stylesheet rules, if there are any then it is likely stylesheet was not blocked
                                if (styles[i].cssRules !== null && styles[i].cssRules.length > 0) {
                                    console.log('THEMES :: Stylsheet is loaded, hard refreshing..');

                                    chrome.runtime.sendMessage({hardRefresh: true}, function(data) {
                                        console.log('THEMES :: Request to hard refresh was sent');
                                    });

                                    break;
                                }

                                // Stylesheets from cross domains do not allow to read their CSS properties, and we cannot block
                                // them without requesting new permissions from the user
                                if (styles[i].href.indexOf("://cdn.") !== -1 && styles[i].cssRules === null) {
                                    console.log('THEMES :: Stylsheet is loaded from cross domain, manually removing..');
                                    $(styles[i].ownerNode).remove();
                                    break;
                                }
                            }
                        }
                    }
                }
            });

            // load options
            console.log('Got theme: ', theme);
            if (theme.options) {
                var classes = ' ';
                for (var k in theme.options) {
                    if (theme.options[k].checked) {
                        classes += k + ' ';
                    }
                }

                $(document).ready(function() {
                    document.body.className += classes;
                });
            }
        }
    }

    // create RegExp's from users trade filters
    var tradeShowArr = LoungeUser.userSettings.showTradesFilterArray || [];
    var tradeHideArr = LoungeUser.userSettings.hideTradesFilterArray || [];
    tradeItemsHaveArr = LoungeUser.userSettings.hideTradesItemsHaveArray || [];
    tradeItemsWantArr = LoungeUser.userSettings.hideTradesItemsWantArray || [];
    tradeShowFilter = createKeywordRegexp(tradeShowArr);
    tradeHideFilter = createKeywordRegexp(tradeHideArr);

    if (LoungeUser.userSettings.enableAuto === '1' && document.URL.indexOf('/mybets') !== -1) {
        function overrideAlert() {
            var oldAlert = window.alert;
            window.alert = function(msg) {
                if (msg === 'Looks like the bot couldn\'t send you an offer. Please make sure that:\r- your Steam Guard Mobile Authenticator is active,\r- ' +
                    'your trading URL is correct,\r- your armory is not full,\r- your profile is set to public,\r- ' +
                    'you are not trade banned.\rOnce you are sure that you can receive offers via your trading URL try again. You can change the URL in my profile'
                || msg === 'Unexpected error! Looks like our bot couldn\'t send you an offer.') {
                    document.dispatchEvent(new CustomEvent('overrideAlert', {'detail': true}));
                } else {
                    oldAlert(msg);
                }
            }
        }

        document.addEventListener('overrideAlert', function(event) {
            if(event.detail === true) {
                chrome.runtime.sendMessage({notification: {
                    title: (appID === '730' ? 'CS:GO' : 'DOTA2') + ' Lounge bots were not able to send you a trade offer',
                    message: 'Make sure that your Steam account is able to receive and/or send trade offers.',
                    buttons: null
                }});
            }
        });

        addScript({
            textContent: overrideAlert.toString() + " overrideAlert()"
        }, true);
    }

    // the following requires DOM
    $(document).ready(function() {
        // add describing classes to body
        $('body').addClass('appID' + appID);
        var themeChangeElm;

        // dark/light theme
        if (themeChangeElm = document.querySelector('.ddbtn a:nth-of-type(2)')) {
            var theme = /skin=([0-9])/.exec(themeChangeElm.href);
            
            if (theme.length===2) {
                document.body.classList.add(['ld-dark', 'ld-light'][theme[1]]);
            }
        }

        // main/match/whatever
        document.body.classList.add('ld-' + (window.location.pathname.replace('/', '') || 'main'));

        if (document.URL.indexOf('/mytrades') != -1 || $('a:contains("Clean messages")').length) {
            $('body').addClass('mytrades');
        }

        if (document.URL.indexOf('/mybets') != -1) {
            // reload page if draft page
            if (LoungeUser.userSettings.redirect === '1') {
                if (document.body.textContent.indexOf('Item draft is under progress') !== -1) {
                    var title = document.querySelector('main .full h2');
                    var newElm = document.createElement('h2');

                    newElm.setAttribute('style', title.getAttribute('style'));
                    newElm.textContent = 'LoungeDestroyer is reloading this page.';
                    title.parentNode.insertBefore(newElm, title);

                    // reload in 2-4 seconds
                    setTimeout(function() {
                        window.location.reload(true);
                    }, (2 + (Math.random() * 2)) * 1000);
                }
            }

            if (['2', '1'].indexOf(LoungeUser.userSettings.enableAuto) !== -1) {
                $freezeBtn = $('#freezebutton');

                $freezeBtn.css('text-transform', 'uppercase');
                $freezeBtn.prepend('<span class="ld-btn-icon"></span>');

                if (LoungeUser.userSettings.renameButtons2 === '1') {
                    $freezeBtn.text('Fucking ' + $('#placebut').text());
                }

                // inject primitive auto-freeze
                var btn = document.getElementById('freezebutton');
                if (btn) {
                    console.log('Replacing postToFreezeReturn');

                    // remove old onclick listener
                    btn.removeAttribute('onclick');
                    btn.onclick = null;
                    var oldBtn = btn;
                    var btn = oldBtn.cloneNode(true);
                    oldBtn.parentNode.replaceChild(btn, oldBtn);

                    // inject own
                    btn.addEventListener('click', function() {
                        if (this.textContent !== 'Are you sure') {
                            $(this).text('Are you sure').on('click', function() {
                                if(freezingItems === false) {
                                    newFreezeReturn();
                                }
                            });
                        }
                    });
                }
            }

            $('.matchmain').each(function(index, value) {
                var total = 0;
                $('.item', value).each(function(itemIndex, itemValue) {
                    var betItemValue = parseFloat($('.value', itemValue).text().replace('$ ', ''));
                    total = total + betItemValue;
                });

                $(value).addClass('custom-my-bets-margin');
                $('.match .full:eq(0)', value).after('<div class="full total-bet">' +
                '<span style="float: left; margin-right: 0.5em">Total value bet:</span>' +
                '<div class="potwin Value"><b>' + total.toFixed(2) + '</b> Value</div></div>');
            });
        }

        if (isHomepage || document.URL.indexOf('/result?') !== -1 || document.URL.indexOf('/trades') !== -1) {
            if(LoungeUser.userSettings.showTradeFilterBox === '1') {
                $('#tradelist').before('<div class="ld-trade-filters">' +
                    '<div class="ld-trade-filters-buttons">' +
                    '<a href="#" class="buttonright ld-trades-show" style="display: none;">Show filtered trades</a></div>' +
                    '<div class="ld-trade-filters-info"><span class="ld-filtered-amount">0 trades were</span> filtered <br>by your <a href="#"><b>trade filter settings</b></a>' +
                    '</div> </div>');

                $('.ld-trade-filters .ld-trades-show').click(function() {
                    toggleFilteredTrades(this);
                });
            }

            var loadExtraOpt = LoungeUser.userSettings.tradeLoadExtra;

            $('.tradepoll:not(.notavailable):visible').each(function(index, value) {
                var trade = tradeObject(value);

                if (loadExtraOpt === '3' || (loadExtraOpt === '4' && !isHomepage)) {
                    if (isScrolledIntoView(trade.tradeElement)) {
                        trade.getExtraData();
                    }
                }

                if (loadExtraOpt === '2' || (loadExtraOpt === '1' && !isHomepage)) {
                    trade.getExtraData();
                }
            });

        }

        if (isHomepage && LoungeUser.userSettings.showMatchFilterBox === '1') {
            $('div.title:eq(1)').after('<div class="ld-match-filters">' +
                '<div class="ld-match-filters-buttons">' +
                '<a href="#" class="buttonright ld-matches-show" style="display: none;">Show filtered matches</a></div>' +
                '<div class="ld-match-filters-info"><span class="ld-filtered-amount">0 matches were</span> filtered <br>by your <a href="#"><b>match filter settings</b></a>' +
                '</div> </div>');
        }

        $('.ld-trade-filters-info a, .ld-match-filters-info a').click(function() {
            chrome.runtime.sendMessage({openSettings: true}, function(data) {
                console.log('Message sent for opening settings page');
            });
        });

        $('.ld-match-filters .ld-matches-show').click(function() {
            toggleFilteredMatches(this);
        });

        if (document.URL.indexOf('/match?m=') != -1 || document.URL.indexOf('/predict') != -1) {
            if (['2', '1'].indexOf(LoungeUser.userSettings.enableAuto) !== -1) {
                $betBtn = $('#placebut');
                $betBtn.css('text-transform', 'uppercase');

                $betBtn.prepend('<span class="ld-btn-icon"></span>');

                if (LoungeUser.userSettings.renameButtons2 === '1') {
                    $betBtn.text('Fucking ' + $('#placebut').text());
                }
            }

            // convert time to local time
            if (LoungeUser.userSettings.changeTimeToLocal === '1') {
                var timeElm = document.querySelector('main > .box:first-child > div:first-child > div:first-child .half:nth-child(3)');
                if (timeElm) {
                    var newTime = convertLoungeTime(timeElm.textContent);
                    if (newTime) {
                        timeElm.textContent = timeElm.textContent + (newTime ? ', ' + newTime : newTime);
                    }
                }
            }

            var $returnsTab = $('a.tab:contains("Returns")');
            if ($returnsTab.length) {
                $returnsTab.after('<a class="tab" id="ld_cache" onclick="returns = false;">Cached inventory</div>');
                $('section.box div[style="width: 96%;margin: 0 2%;border-radius: 5px;overflow: hidden;"] .tab').width('33%').click(function() {
                    inventory.stopLoadingInventory();
                });

                $('#ld_cache').click(function() {
                    $('.left').text('');
                    document.getElementById('backpack').innerHTML = '<div id="LDloading" class="spin-1"></div>';
                    inventory.getCachedInventory('bettingInventory' + appID + '_' + readCookie('id'), function(bpHTML) {
                        document.getElementById('backpack').innerHTML = bpHTML;
                        inventory.onInventoryLoaded('');
                    });
                });
            }

            var matchID = window.location.href.match(/\d+/);

            if (matchID !== null && appID === '730' && window.location.pathname.indexOf('/predict') === -1 && LoungeUser.userSettings.matchInformation === '1') {
                var $wrapper = $('<div class="box-shiny-alt ld-match-info"></div>');
                $('section.box:eq(1) .box-shiny-alt:eq(0)').after($wrapper);

                $wrapper.html('<div class="ld-loading-spinner spin-1"></div>');

                $.ajax({
                    url: 'https://api.ncla.me/match/' + matchID[0],
                    success: function(data) {
                        $wrapper.html(data);
                    },
                    error: function() {
                        $wrapper.html('<div class="ld-match-info-error"><span class="ld-btn-icon"></span> LoungeDestroyer failed to load information for this match. <b>Try again later.</b></div>');
                    }
                });
            }

        }

        if (document.URL.indexOf('/addtrade') != -1) {
            $('.tabholder .tab').click(function() {
                inventory.stopLoadingInventory();
            });
        }

        $ldContainer.find('#bet-time').val(LoungeUser.userSettings.autoDelay);
        $ldContainer.find('#accept-time').val(LoungeUser.userSettings.acceptDelayv2);

        if (LoungeUser.userSettings.showExtraMatchInfo === '2') {
            $('.matchmain').each(function(i, v) {
                var match = matchObject(v);
                if(!match.closedMatch && !match.matchIsFiltered && isScrolledIntoView(v)) {
                    match.loadExtraMatchInfo();
                }
            });
        }

        initiateItemObjectForElementList($('body .oitm'), useCachedPricesOnly);

        if (appID === '730') {
            $bettableItemsLink = $('<a href="#">Bettable items</a>');

            $bettableItemsLink.click(function() {
                chrome.runtime.sendMessage({tab: chrome.extension.getURL('settings/index.html#bettableitems')}, function(data) {
                    console.log('Opened tab for bettable items');
                })
            });

            $('#submenu nav').append($bettableItemsLink);
        }

        var eventId = generateUUID();

        document.addEventListener(eventId, function(event) {
            if(typeof event.detail === 'object') {
                siteAjaxReqObj.push(event.detail);
            }

            if (event.detail.hasOwnProperty('url') && ['ajax/postBetOffer.php', 'ajax/postBet.php'].indexOf(event.detail.url) !== -1) {
                console.log('AUTOBET :: THIS IS COMPLETELY NORMAL THAT THIS REQUEST GETS CANCELLED, THAT\'S HOW THE EXTENSION WORKS');
            }
        });

        var injFunc = function() {
            $.ajaxPrefilter(function(UNIQUE_LD_OPT_ARG, UNIQUE_LD_ORIGOPT_ARG) {
                document.dispatchEvent(new CustomEvent('UNIQUE_LD_EVENT_ID', {'detail': JSON.parse(JSON.stringify(UNIQUE_LD_ORIGOPT_ARG))}));
            });
        };

        var injectedScript = document.createElement('script');
        injectedScript.type = 'text/javascript';
        var scriptText = '('+injFunc+')();';
        scriptText = scriptText.replace(/UNIQUE_LD_EVENT_ID/g, eventId)
            .replace(/UNIQUE_LD_OPT_ARG/g, generateArgName)
            .replace(/UNIQUE_LD_ORIGOPT_ARG/g, generateArgName());

        injectedScript.text = scriptText;
        (document.body || document.head).appendChild(injectedScript);
        injectedScript.parentNode.removeChild(injectedScript);

    });
}
/*
    Code that does not rely heavily on Chrome storage data
 */
$(document).ready(function() {
    isHomepage = ($('.title[style*="/img/trades.png"]').length > 0);
    // listen for additions to items
    itemObs.observe(document.body, {
        childList: true,
        subtree: true
    });

    // TODO: Check if this is relevant
    document.addEventListener('click', function(ev) {
        if (ev.srcElement) {
            if (ev.srcElement.id !== 'preview' && !$('#preview').find(ev.srcElement).length) {

                $('#preview').hide();
                $('#preview').attr('data-index', '-1');
            }

            if (ev.srcElement.id !== 'modalPreview'
                && !$('#modalPreview').find(ev.srcElement).length
                && document.getElementById('modalPreview')
                && document.getElementById('modalPreview').style.opacity !== '0') {
                $('#modalPreview').fadeOut('fast');
            }
        }
    });
});

// postToFreezeReturn overwrite
function newFreezeReturn(tries) {
    if (typeof tries !== 'number') {
        tries = 1;
    }

    freezingItems = true;

    if (tries == 1) {
        betStatus.type = 'autoFreeze';
        betStatus.autoBetting = true;
        betStatus.lastError = 'No response received yet.';
        betStatus.lastBetTime = Date.now();

        updateAutobetInfo();

        $('.destroyer.auto-info').removeClass('hidden');
    }

    // Be aware, this was changed from ['toreturn'] to .toreturn
    var toreturn = retrieveWindowVariables('toreturn').toreturn;
    if (toreturn === 'true') {
        freezingItems = false;
        $.ajax({
            url: 'ajax/postToReturn.php',
            success: function(data) {
                // The reason why this should never happen is because we cancel out this request from bg/bet.js
                console.error('Whoops, this shouldn\'t happen: ', data);
            },
            error: function() {
                console.log('AUTOBET :: THIS IS COMPLETELY NORMAL THAT THIS REQUEST GETS CANCELLED, THAT\'S HOW THE EXTENSION WORKS');
            }
        });
    } else {
        $.ajax({
            url: 'ajax/postToFreeze.php',
            data: $('#freeze').serialize(),
            type: 'POST',
            success: function(data) {
                betStatus.lastError = data;

                if (data) {
                    console.log('AUTOBET :: Retrying freeze for the ', tries, '. time - ', data);
                } else {
                    // TODO: Update autofreeze with success messages
                    betStatus.lastError = 'Item freezing was successful, starting auto-returning..';
                    setWindowVariables({toreturn: true});
                }
            },
            error: function(xhr) {
                betStatus.lastError = 'HTTP Error (#' + xhr.status + ') while autoing. Retrying';
            },
            timeout: 10000
        }).always(function(data) {
            console.log('ALWAYS');
            betStatus.lastBetTime = Date.now();
            betStatus.numTries = tries;
            updateAutobetInfo();
            setTimeout(function() {
                newFreezeReturn(tries + 1);
            }, 5000);
        });
    }
}

/*
    Mouseover action for items
 */
$(document).on('mouseenter', '.oitm', function(e) {
    e.stopPropagation();

    var LoungeItem = itemObject($(this));
    LoungeItem.appendHoverElements();

    var settingMarketPrices = LoungeUser.userSettings.itemMarketPricesv2;
    if (settingMarketPrices == '1' || settingMarketPrices == '2') {
        LoungeItem.getMarketPrice();
    }
});

$(document).on('click', 'a.refreshPriceMarket', function(e) {
    e.stopPropagation();
    var LoungeItem = itemObject($(this).parents('.oitm'));
    LoungeItem.unloadMarketPrice();
    $(LoungeItem.item).find('.rarity').html('');
    LoungeItem.fetchSteamMarketPrice();
});

$(document).on('mouseover', '.matchmain', function() {
    if (LoungeUser.userSettings.showExtraMatchInfo != '0') {
        var match = matchObject(this);
        match.loadExtraMatchInfo();
    }
});

$(document).on('mouseover', '.tradepoll:not(.notavailable)', function() {
    if (LoungeUser.userSettings.tradeLoadExtra === '5' || (isHomepage && ['1', '4'].indexOf(LoungeUser.userSettings.tradeLoadExtra) !== -1)) {
        var trade = tradeObject(this);
        trade.getExtraData();
    }
});

$(window).scrolled(function() {
    if (LoungeUser.userSettings.tradeLoadExtra === '3' || (LoungeUser.userSettings.tradeLoadExtra === '4' && !isHomepage)) {
        $('.tradepoll:not(.notavailable)').each(function(index, value) {
            var trade = tradeObject(value);
            if (isScrolledIntoView(trade.tradeElement)) {
                trade.getExtraData();
            }
        });
    }

    if (LoungeUser.userSettings.showExtraMatchInfo === '2') {
        $('.matchmain').each(function(i, v) {
            var match = matchObject(v);
            if(!match.closedMatch && !match.matchIsFiltered && isScrolledIntoView(v)) {
                match.loadExtraMatchInfo();
            }
        });
    }

    if (LoungeUser.userSettings.itemMarketPricesv2 === '2' && LoungeUser.userSettings.useCachedPriceList === '0') {
        $('.oitm').each(function(i, v) {
            if(isScrolledIntoView(v)) {
                var item = itemObject(v);
                if(!item.marketPriced) {
                    item.getMarketPrice();
                }
            }
        });
    }
});

// auto-magically add market prices to newly added items, currently only for trade list
var itemObs = new MutationObserver(function(records) {
    for (var i = 0, j = records.length; i < j; ++i) {
        if (records[i].addedNodes && records[i].addedNodes.length && records[i].target.id == 'tradelist') {
            var hasTradeNodes = false;
            for (var k = 0, l = records[i].addedNodes.length; k < l; ++k) {
                var elm = records[i].addedNodes[k];
                if (elm.classList) {
                    if (elm.classList.contains('tradepoll') && !elm.classList.contains('notavailable')) {
                        hasTradeNodes = true;
                        var trade = tradeObject(elm);
                        
                        if (LoungeUser.userSettings.tradeLoadExtra === '3' || (LoungeUser.userSettings.tradeLoadExtra === '4' && !isHomepage)) {
                            if (isScrolledIntoView(trade.tradeElement)) {
                                trade.getExtraData();
                            }
                        }

                        if (LoungeUser.userSettings.tradeLoadExtra === '2' || (LoungeUser.userSettings.tradeLoadExtra === '1' && !isHomepage)) {
                            trade.getExtraData();
                        }
                    }
                }
            }

            if (hasTradeNodes) {
                if (LoungeUser.userSettings.itemMarketPricesv2 === '2') {
                    initiateItemObjectForElementList($(records[i].addedNodes).find('.oitm'), useCachedPricesOnly);
                }
            }
        }
        if(records[i].addedNodes && records[i].addedNodes.length && records[i].target.id == 'ajaxCont' && records[i].target.className == 'full') {
            initiateItemObjectForElementList($('#ajaxCont.full .oitm'), true);

            var betHistoryColSett = LoungeUser.userSettings.betHistoryTotalColumn;
            if(['1', '2'].indexOf(betHistoryColSett) !== -1) {
                $('table tbody tr:visible').each(function(i, v) {
                    var total = 0;

                    // Won items
                    $(v).next().next().find('.oitm').each(function(itemId, itemValue) {
                        var item = itemObject(itemValue);
                        total = total + parseFloat((betHistoryColSett === '1') ? (item.loungeValue || 0) : (item.marketValue || 0));
                    });

                    if(total === 0 && $('.lost', v).length) {
                        // Placed items, deduct from Total if there were no items won
                        $(v).next().find('.oitm').each(function(itemId, itemValue) {
                            var item = itemObject(itemValue);
                            total = total - parseFloat((betHistoryColSett === '1') ? (item.loungeValue || 0) : (item.marketValue || 0));
                        });
                    }

                    if(total > 0) {
                        text = '+ ' + convertPrice(total, true);
                    } else if(total < 0) {
                        text = '- ' + convertPrice(Math.abs(total), true);
                    } else {
                        text = convertPrice(0, true);
                    }

                    var newTd = $('<td></td>').text(text);

                    if(total === 0 && ($('.lost', v).length || $('.won', v).length)) {
                        $(newTd).append('<small class="small-note-ld" title="You are seeing ' + convertPrice(0, true) + ' as a total because you have not ' +
                            'set LoungeDestroyer settings to use cached price list and to load prices automatically. If you do have ' +
                            'both enabled, then it might be possible that the item does not have a betting/market value."> (?)</small>');
                    }

                    $('td:eq(5)', v).after(newTd);
                });

                // Adjust the column width because we added another column
                $('table td[colspan=5]').attr('colspan', '6');
            }

        }
    }
});

function convertLoungeTime(loungeTimeString) {
    if (LoungeUser.userSettings.changeTimeToLocal !== '0') {
        // I am no timezone expert, but I assume moment.js treats CET/CEST automatically
        var trimmedTime = loungeTimeString.replace('CET', '').replace('CEST', '').trim();

        if (moment.tz.zone(timezoneName)) {
            var format = (LoungeUser.userSettings.americanosTime === '0' ? 'HH:mm' : 'h:mm A');
            format = (LoungeUser.userSettings.displayTzAbbr === '0' ? format : format + ' z');
            return moment.tz(trimmedTime, 'HH:mm', 'CET').tz(timezoneName).format(format);
        }

        return loungeTimeString;
    }

    return loungeTimeString;
}
