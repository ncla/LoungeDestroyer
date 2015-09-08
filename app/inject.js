console.log('LoungeDestroyer content script has started..', +new Date());
var appID = (window.location.hostname == 'dota2lounge.com' ? '570' : '730');

var LoungeUser = new User();

var storageMarketItems;
var currencies = {};
var themes = {};
var matchInfoCachev2 = {};
var streamPlaying = false;
var inventory = new Inventory();
var lastAccept = 0;
var blacklistedItemList = {};
var earlyBackpackLoad = false;
var tradeShowFilter;
var tradeHideFilter;
var tradeMarkFilter;
var timezoneName = (LoungeUser.userSettings.timezone == 'auto' ? jstz.determine().name() : LoungeUser.userSettings.timezone);
var tradesFiltered = 0;

var container = document.createElement('div');

chrome.storage.local.get(['marketPriceList', 'currencyConversionRates', 'themes', 'matchInfoCachev2', 'lastAutoAccept', 'blacklistedItemList', 'csglBettingValues', 'userSettings'], function(result) {
    blacklistedItemList = result.blacklistedItemList || {};
    storageMarketItems = result.marketPriceList || {};
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
if(window.location.href.indexOf('/api/') === -1) {
    chrome.runtime.sendMessage({injectCSSTheme: true});
}

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
    // if non-empty, calls sendResponse with arguments at end
    var args = {};

    if (msg.inventory) {
        console.log('Backpack AJAX request detected from background script with URL ', msg.inventory.url, +new Date());
        if (LoungeUser.userSettingsLoaded) {
            if (msg.inventory.url.indexOf('tradeCsRight') != -1 || msg.inventory.url.indexOf('tradeWhatRight') != -1) {
                initiateItemObjectForElementList($('#itemlist .oitm:not(.marketPriced)'), true);
                //getMarketPricesForElementList($('#itemlist .oitm:not(.marketPriced)'), true);
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
        console.log('Serializing: ', msg);
        args.serialize = $(msg.serialize).serialize();
    }

    if (msg.hasOwnProperty('cookies')) {
        args.cookies = document.cookie;
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
    /*
     When bot status changes (detected by background.js), a message gets send from background script to content script (here).
     TODO: Pass bot status through listener.
     */
    if (earlyBackpackLoad) {
        inventory.onInventoryLoaded(earlyBackpackLoad);
    }

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
                if (theme.collapsibleColumns) {
                    var collapsibleElms = document.querySelectorAll('#submenu, .box');
                    for (var i = 0, j = collapsibleElms.length; i < j; ++i) {
                        var hideToggle = document.createElement('div');
                        var parentFirst = collapsibleElms[i].firstChild;

                        hideToggle.className = 'ld-collapse-toggle';

                        // TODO: birjolaxew get rid of this anonymous self-execution function bs
                        // jscs: disable
                        hideToggle.addEventListener('click', (function(elm) {
                            return function() {
                                elm.classList.toggle('ld-collapsed');
                            }
                        })(collapsibleElms[i]));
                        // jscs: enable
                        collapsibleElms[i].insertBefore(hideToggle, parentFirst);
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
    var tradeItemsHaveArr = LoungeUser.userSettings.hideTradesItemsHave || [];
    var tradeItemsWantArr = LoungeUser.userSettings.hideTradesItemsWant || [];
    tradeShowFilter = createKeywordRegexp(tradeShowArr);
    tradeHideFilter = createKeywordRegexp(tradeHideArr);

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

        // cannot check if actually playing, unfortunately
        // only if it's been clicked while on the page
        (function() {
            var container = document.getElementById('mainstream');
            var flash = document.getElementById('live_embed_player_flash');

            if (!flash) { // it's a hitbox stream
                flash = document.querySelector('#mainstream iframe:first-child');
                if (!flash) {
                    return;
                }

                flash.contentWindow.document.addEventListener('click', function() {
                    streamPlaying = true
                });

                return
            }

            if (!container) {
                return;
            }

            flash = flash.document || flash;

            if (!flash) {
                return;
            }

            // onclick/onmousedown doesn't fire on flash objects
            container.addEventListener('mousedown', function() {
                streamPlaying = true;
            });

            // onmousedown won't fire unless wmode=transparent, don't ask me why
            flash.setAttribute('wmode', 'transparent');
        })();

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

            $freezeBtn = $('#freezebutton');

            $freezeBtn.css('text-transform', 'uppercase');

            if (LoungeUser.userSettings.renameButtons2 === '1') {
                $freezeBtn.text('Fucking ' + $('#placebut').text());
            }

            if (['2', '1'].indexOf(LoungeUser.userSettings.enableAuto) !== -1) {
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
                            $(this).text('Are you sure').on('click', newFreezeReturn);
                        }
                    });
                }

                // return items if we've enabled auto-accept
                if (LoungeUser.userSettings.enableAuto === '1') {
                    // and if we have frozen items
                    if (document.querySelector('#freeze .item') && !document.getElementById('queue')) {
                        // and if we've just accepted an earlier offer
                        if (Date.now() - lastAccept < 60000) {
                            chrome.storage.local.set({lastAutoAccept: 0});
                            console.log('Returning items');
                            newFreezeReturn();
                        }
                    }
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

        var isHomepage = ($('.title a[href="/trades"]').length > 0);

        if (isHomepage || document.URL.indexOf('/result?') !== -1 || document.URL.indexOf('/trades') !== -1) {
            if(LoungeUser.userSettings.showTradeFilterBox === '1') {
                $('div.title:eq(0)').after('<div class="ld-trade-filters">' +
                    '<div class="ld-trade-filters-buttons">' +
                        //'<button class="buttonright">Hide this</button>' +
                    '<a href="#" class="buttonright" id="changefilters">Change filters</a>' +
                    '<button class="buttonright" id="showtrades">Show trades</button></div>' +
                    '<div class="ld-trade-filters-info"><span class="ld-filtered-amount">0 trades were</span> filtered <br>by your <a href="#"><b>trade settings</b></a>' +
                    '</div> </div>');

                $('.ld-trade-filters #changefilters, .ld-trade-filters .ld-trade-filters-info a').click(function() {
                    chrome.runtime.sendMessage({openSettings: true}, function(data) {
                        console.log('Message sent for opening settings page');
                    });
                });

                $('.ld-trade-filters #showtrades').click(function() {
                    $('.tradepoll').each(function(index, value) {
                        var trade = tradeObject(value);
                        $(trade.tradeElement).show();
                    });
                });
            }

            $('.tradepoll:not(.notavailable)').each(function(index, value) {
                var trade = tradeObject(value);
                if((LoungeUser.userSettings.tradeLoadExtra === '1' && isHomepage) || LoungeUser.userSettings.tradeLoadExtra === '2') {
                    if(isScrolledIntoView(trade.tradeElement)) {
                        trade.fetchExtraData(function() {});
                    }
                }
                if(LoungeUser.userSettings.tradeLoadExtra === '1' && !isHomepage) {
                    trade.fetchExtraData(function() {});
                }
            });

        }

        if (document.URL.indexOf('/match?m=') != -1 || document.URL.indexOf('/predict') != -1) {
            $betBtn = $('#placebut');
            $betBtn.css('text-transform', 'uppercase');

            if (LoungeUser.userSettings.renameButtons2 === '1') {
                $betBtn.text('Fucking ' + $('#placebut').text());
            }

            // convert time to local time
            var timeElm = document.querySelector('main > .box:first-child > div:first-child > div:first-child .half:nth-child(3)');
            if (timeElm) {
                var newTime = convertLoungeTime(timeElm.textContent, true);
                if (newTime) {
                    timeElm.textContent = timeElm.textContent + (newTime ? ', ' + newTime : newTime);
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
        }

        if (document.URL.indexOf('/addtrade') != -1) {
            $('.tabholder .tab').click(function() {
                inventory.stopLoadingInventory();
            });
        }

        // add custom 'Preview' buttons to trades that don't have it
        // first create preview element if it doesn't exist
        //(function() {
        //    if (LoungeUser.userSettings.addTradePreviews === '0') {
        //        return;
        //    }
        //
        //    if (!document.getElementById('logout')) {
        //        return;
        //    }
        //
        //    var previewElm = document.getElementById('preview');
        //
        //    if (previewElm) {
        //        return;
        //    }
        //
        //    if (document.querySelector('.tradepoll')) {
        //        previewElm = document.createElement('section');
        //        previewElm.id = 'preview';
        //        previewElm.className = 'destroyer';
        //        document.body.appendChild(previewElm);
        //        customPreview = true;
        //    }
        //
        //    previewElm = $(previewElm);
        //
        //    $('.tradepoll').each(function(ind, elm) {
        //        if (!elm.querySelector('.tradeheader a.button[onclick^="livePreview"]')) {
        //            var header = elm.querySelector('.tradeheader');
        //            var span = (header && header.querySelector('span[style*="float: right"]')) || false;
        //            var btn = document.createElement('a');
        //
        //            btn.className = 'button destroyer live-preview';
        //            btn.innerHTML = 'Preview';
        //            btn.style.float = 'none';
        //
        //            if (!header) {
        //                return;
        //            }
        //
        //            if (!span) {
        //                // if buttons already exist in header, don't place within span
        //                if (elm.querySelector('.tradeheader > a.button')) {
        //                    span = header;
        //                    btn.className = 'buttonright';
        //                    btn.style.float = 'right';
        //                } else {
        //                    span = document.createElement('span');
        //                    span.style.float = 'right';
        //                    header.appendChild(span);
        //                }
        //            }
        //
        //            var tradeId = elm.querySelector('a[href^="trade?"]');
        //            var self = this instanceof $ ? this : $(this);
        //            if (tradeId) {
        //                tradeId = tradeId.getAttribute('href').replace('trade?t=', '');
        //            } else {
        //                return;
        //            }
        //
        //            // magic happens here
        //            btn.addEventListener('click', function() {
        //                if (previewElm.attr('data-index') == ind) {
        //                    previewElm.hide();
        //                    previewElm.attr('data-index', '-1');
        //                    return;
        //                }
        //
        //                previewElm.show();
        //                previewElm.html('<img src="../img/load.gif" id="loading" style="margin: 0.75em 2%">');
        //
        //                var offset = self.offset();
        //                if ($(document).width() > offset.left + self.outerWidth() + Math.max(410, $(document).width() * 0.5)) {
        //                    offset.top = Math.floor(offset.top - 20);
        //                    offset.left = Math.floor(offset.left + self.outerWidth() + 10);
        //                } else {
        //                    // position below if not enough space on right
        //                    offset.top = Math.floor(offset.top + self.height() + 10);
        //                    offset.left = Math.floor(offset.left);
        //                }
        //
        //                previewElm.offset(offset);
        //
        //                $.ajax({
        //                    url: 'ajax/livePreview.php',
        //                    type: 'POST',
        //                    data: 't=' + tradeId,
        //                    success: function(d) {
        //                        previewElm.html(d).slideDown('fast');
        //                        previewElm.attr('data-index', ind);
        //                    }
        //                })
        //            });
        //
        //            span.appendChild(btn);
        //        }
        //    });
        //})();

        container.querySelector('input').value = LoungeUser.userSettings.autoDelay || 5;

        if (LoungeUser.userSettings.showExtraMatchInfo === '2') {
            $('.matchmain').each(function(i, v) {
                if (!$(v).find('.notavailable').length) {
                    loadExtraMatchInfo(v);
                }
            });
        }

        //if (LoungeUser.userSettings.itemMarketPricesv2 === '2') {
            initiateItemObjectForElementList();
            //getMarketPricesForElementList();
        //}
    });
}
/*
    Code that does not rely heavily on Chrome storage data
 */
$(document).ready(function() {
    // listen for additions to items
    itemObs.observe(document.body, {
        childList: true,
        subtree: true
    });

    // create info box in top-right
    container.className = 'destroyer auto-info hidden';
    container.innerHTML = '<p>Auto-<span class="type">betting</span> items<span class="worth-container"> on match <a class="match-link"></a></span>. <span class="type capitalize">Betting</span> for the <span class="num-tries">0th</span> time.</p>' +
    '<button class="red">Disable auto-bet</button>' +
    '<p class="destroyer error-title">Last error (<span class="destroyer time-since">0s</span>):</p><p class="destroyer error-text"></p>' +
    '<label>Seconds between retries:</label><input id="bet-time" type="number" min="2" max="60" step="1">' +
    '<hr><p class="support">Support LoungeDestroyer development <br/><b style="color: red;">by donating</b></p> <a href="https://www.patreon.com/loungedestroyer" target="_blank" class="patreon"><button>Patreon support</button></a>' +
    '<a href="https://steamcommunity.com/tradeoffer/new/?partner=106750833&token=eYnKX2Un" target="_blank" class="steam"><button>Steam donations</button></a>';

    container.querySelector('button').addEventListener('click', function() {
        chrome.runtime.sendMessage({type: 'autoBet', autoBet: false});
    });

    container.querySelector('input').addEventListener('blur', function() {
        var newVal = Math.max(2, this.valueAsNumber);
        if (newVal) {
            this.valueAsNumber = newVal;
            chrome.runtime.sendMessage({'set': {bet: {autoDelay: newVal * 1000}},
                'saveSetting': {autoDelay: newVal}});
        }
    });

    document.body.appendChild(container);

    $('.destroyer.auto-info a.steam').on('click', function() {
        return confirm('You are about to open a trade with LoungeDestroyer donation account. \n\nTHIS TRADE OFFER IS NOT RELATED TO CSGOLOUNGE.COM NOR DOTA2LOUNGE.COM IN ANY WAY. \n\nAre you sure?');
    });

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

    // Be aware, this was changed from ['toreturn'] to .toreturn
    var toreturn = retrieveWindowVariables('toreturn').toreturn;
    if (toreturn === 'true') {
        // hacky hacky UI stuff
        var toHide = document.querySelectorAll('.destroyer.auto-info > *:not(:first-child)');
        for (var i = 0, j = toHide.length; i < j; ++i) {
            if (toHide[i].classList)
                toHide[i].classList.remove('hidden');
        }

        // The reason why this should never happen is because we cancel out this request from bg/bet.js
        $.ajax({
            url: 'ajax/postToReturn.php',
            success: function(data) {
                if (data) {
                    console.error('Whoops, this shouldn\'t happen: ', data);
                    alert(data);
                } else {
                    console.error('This shouldn\'t happen.');
                }
            }
        });
    } else {
        // hacky hacky UI stuff
        document.querySelector('.destroyer.auto-info').classList.remove('hidden');
        var ordinalEnding = ((tries || 0) + '').slice(-1);
        ordinalEnding = (tries % 100 < 20 &&
                        tries % 100 > 10) ? 'th' :
                        ordinalEnding === '1' ? 'st' :
                        ordinalEnding === '2' ? 'nd' :
                        ordinalEnding === '3' ? 'rd' :
                        'th';
        document.querySelector('.destroyer.auto-info .num-tries').textContent = (tries || 0) + ordinalEnding;
        var toHide = document.querySelectorAll('.destroyer.auto-info > *:not(:first-child):not(.error-text)');
        for (var i = 0, j = toHide.length; i < j; ++i) {
            if (toHide[i].classList) {
                toHide[i].classList.add('hidden');
            }
        }

        var typeSpans = document.querySelectorAll('.destroyer.auto-info .type');
        for (var i = 0, j = typeSpans.length; i < j; ++i) {
            typeSpans[i].textContent = 'freezing';
        }

        // end hacky hacky UI stuff

        $.ajax({
            url: 'ajax/postToFreeze.php',
            data: $('#freeze').serialize(),
            type: 'POST',
            success: function(data) {
                if (data) {
                    console.error(data);
                    document.querySelector('.destroyer.auto-info .error-text').textContent = data;
                    setTimeout(function() {
                        console.log('Retrying freeze for the ', tries, '. time - ', data);
                        newFreezeReturn(tries + 1);
                    }, 2000);
                } else {
                    setWindowVariables({toreturn: true});
                    newFreezeReturn(tries + 1);
                }
            }
        });
    }
}

/*
    Mouseover action for items
 */
$(document).on('mouseenter', '.oitm', function(e) {
    // We do not have to do any of the stuff below anymore
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
        loadExtraMatchInfo(this);
    }
});

$(document).on('mouseover', '.tradepoll:not(.notavailable)', function() {
    if(LoungeUser.userSettings.tradeLoadExtra === '3') {
        var trade = tradeObject(this);
        trade.fetchExtraData(function(){});
    }
});

$(window).scrolled(function() {
    console.log('Scrolled');
    $('.tradepoll:not(.notavailable)').each(function(index, value) {
        if(isScrolledIntoView(value) && ['1', '2'].indexOf(LoungeUser.userSettings.tradeLoadExtra) !== -1) {
            var trade = tradeObject(value);
            trade.fetchExtraData(function(){});
        }
    });
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
                    }
                }
            }

            if (hasTradeNodes) {
                if (LoungeUser.userSettings.itemMarketPricesv2 === '2') {
                    //getMarketPricesForElementList($(records[i].addedNodes).find('.oitm'));
                    initiateItemObjectForElementList($(records[i].addedNodes).find('.oitm'));
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
                        total = total + ((betHistoryColSett === '1') ? (item.loungeValue || 0) : (item.marketValue || 0));
                    });

                    if(total === 0 && $('.lost', v).length) {
                        // Placed items, deduct from Total if there were no items won
                        $(v).next().find('.oitm').each(function(itemId, itemValue) {
                            var item = itemObject(itemValue);
                            total = total - ((betHistoryColSett === '1') ? (item.loungeValue || 0) : (item.marketValue || 0));
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
    if (LoungeUser.userSettings.changeTimeToLocal != '0') {
        // I am no timezone expert, but I assume moment.js treats CET/CEST automatically
        var trimmedTime = loungeTimeString.replace('CET', '').replace('CEST', '').trim();

        // Intl.DateTimeFormat().resolved.timeZone, might be derpy in other browsers

        if (moment.tz.zone(timezoneName)) {
            var format = (LoungeUser.userSettings.americanosTime == '0' ? 'HH:mm' : 'h:mm A');
            format = (LoungeUser.userSettings.displayTzAbbr == '0' ? format : format + ' z');
            return moment.tz(trimmedTime, 'HH:mm', 'CET').tz(timezoneName).format(format);
        }
    }

    return false;
}
