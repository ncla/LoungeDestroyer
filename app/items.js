var marketedItems = [];
var loadingItems = [];
var notFoundListings = [];
var nonMarketItems = ['Dota Items', 'Any Offers', 'Any Knife', 'Knife', 'Gift', 'TF2 Items', 'Real Money', 'Offers',
    'Any Common', 'Any Uncommon', 'Any Rare', 'Any Mythical', 'Any Legendary', 'Any Ancient', 'Any Immortal',
    'Real Money', '+ More', 'Any Set', 'Any Key', 'Undefined / Not Tradeable', 'Card', 'Background',
    'Icon', 'Gift', 'DLC'];
var skinQualities = {'Factory New': 'FN', 'Minimal Wear': 'MW', 'Well-Worn': 'WW', 'Battle-Scarred': 'BS',
    'Field-Tested': 'FT', 'Common': 'C', 'Uncommon': 'UC', 'Rare': 'R', 'Mythical': 'M', 'Legendary': 'L',
    'Ancient': 'AN', 'Immortal': 'I', 'Arcana': 'AR'};
var appIDcontextIDs = {
    730: 2,
    440: 2,
    570: 2,
    295110: 1, // H1Z1:JS
    433850: 1, // H1Z1:KOTK
    218620: 2, // Payday 2
    753: 6
};

var Item = function(item) {
    var _this = this;

    // This allows us to use the object functions as static functions without constructing the object
    if (item !== undefined) {

        this.item = item;
        this.itemName = $('.smallimg', this.item).attr('alt').trim();

        this.loungeValue = null;
        this.loungeValueFromSite = false;

        var $valElm = $('.value', this.item);
        if($valElm.length) {
            var bettingValue = parseFloat($valElm.text().match(/[0-9.]+/));
            if (!isNaN(bettingValue)) {
                this.loungeValue = bettingValue;
                this.loungeValueFromSite = true;
            }
        }

        var quality = $('.rarity', this.item).text().trim();
        $.each(skinQualities, function(i, v) {
            if (quality.indexOf(i) !== -1) {
                _this.weaponQuality = i;
                _this.weaponQualityAbbrevation = v;
                return false;
            }
        });

        this.convertLoungeValue();
        this.addLoungeValue();
    }
};
/**
 * Replaces text of .rarity element with the market price for every item that has the same item name
 * TODO: This is too DRY
 * @param lowestPrice float Market price in USD
 * @returns {Item}
 */
Item.prototype.insertMarketValue = function(marketValue) {
    var _this = this;

    var marketValueHTML = convertPrice(marketValue, true);

    // This is set by getMarketPricesForElementList function in order to avoid performance issues
    // when creating requetsts for market prices on Steam
    if (this.myFriends) {
        for (var index in _this.myFriends) {
            var $myLittleItem = $(_this.myFriends[index].item);
            _this.myFriends[index].marketPriced = true;
            _this.myFriends[index].marketValue = marketValue;
            $myLittleItem.addClass('marketPriced').find('.rarity').text(marketValueHTML);
            _this.myFriends[index].displayWeaponQuality().displayMaxPriceWarning().calculateMarketDifference().calculateMarketOverprice();
        }
    }
    else {
        // For the item we just called getMarketPrice method from
        this.marketPriced = true;
        this.marketValue = marketValue;
        $(this.item).addClass('marketPriced').find('.rarity').html(marketValueHTML);
        this.displayWeaponQuality().displayMaxPriceWarning().calculateMarketDifference().calculateMarketOverprice();

        // All other items
        $('.oitm:not(.marketPriced)').each(function() {
            if ($(this).find('img.smallimg').attr('alt').trim() === _this.itemName) {
                var itemObj = itemObject(this);
                $(itemObj.item).addClass('marketPriced').find('.rarity').text(marketValueHTML);
                itemObj.marketPriced = true;
                itemObj.marketValue = marketValue;
                itemObj.displayWeaponQuality().displayMaxPriceWarning().calculateMarketDifference().calculateMarketOverprice();
            }
        });
    }

    return this;
};
/**
 * Appends item rarity next to market price while respecting user settings
 * @returns {Item}
 */
Item.prototype.displayWeaponQuality = function() {
    if (LoungeUser.userSettings.displayCsgoWeaponQuality === '1' && typeof this.weaponQuality !== 'undefined') {
        $('.rarity', this.item).append('<span class="weaponWear"> | ' + this.weaponQualityAbbrevation + '</span>');
    }

    return this;
};

Item.prototype.displayMaxPriceWarning = function() {
    if (this.marketValue > 375) {
        $(this.item).addClass('ld-price-max');
    } else {
        $(this.item).removeClass('ld-price-max');
    }

    return this;
};

/**
 * Gets market price for the item, it goes through our cached item list, blacklisted item list, already marketed items
 * list, and then finally if price still hasn't been found, request it via Steam API
 * @param cachedOnly If true, function will only rely on cached information and will not request prices from Steam API
 * @returns {Item}
 */
Item.prototype.getMarketPrice = function(cachedOnly) {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    if (this.marketPriced) {
        return this;
    }

    if (!cachedOnly) {
        cachedOnly = false;
    }

    var _this = this;

    // Check if we even have to fetch a price
    if (blacklistedItemList.hasOwnProperty(this.itemName)) {
        console.log('Item ' + _this.itemName.trim() + ' is blacklisted, not fetching market price');
        return this;
    }

    // Check if the itemName has not been already marketed before
    if (marketedItems.hasOwnProperty(this.itemName)) {
        console.log(this.itemName + ' has been already marketed by the API, appending price now.');

        // Not sure if I am genius for returning something and calling a function at the same time
        return this.insertMarketValue(marketedItems[this.itemName]);
    }

    // Check if we can append a cached item price
    if (LoungeUser.userSettings.useCachedPriceList === '1') {
        if (storageMarketItems.hasOwnProperty(appID) && storageMarketItems[appID].hasOwnProperty(this.itemName)) {
            // Backwards compability with old api.ncla.me response, just in case the user still has old price list
            if (storageMarketItems[appID][this.itemName].hasOwnProperty('value')) {
                return this.insertMarketValue(storageMarketItems[appID][this.itemName].value);
            } else {
                return this.insertMarketValue(storageMarketItems[appID][this.itemName]);
            }
        }
    }

    if (cachedOnly) {
        return this;
    }

    if (nonMarketItems.indexOf(_this.itemName) === -1 && nonMarketItems.indexOf($('.rarity', this.item).text()) === -1 &&
        !loadingItems.hasOwnProperty(this.itemName) && notFoundListings.indexOf(_this.itemName) === -1) {

        if (isScrolledIntoView(this.item)) {
            this.fetchSteamMarketPrice();
        }

        return this;
    }
};
/**
 * Calculates market difference, positive value if it's overpriced, negative if it's underpriced
 * @returns {Item}
 */
Item.prototype.calculateMarketDifference = function() {
    if (this.marketValue && this.loungeValue) {
        this.marketDifference = parseFloat((this.loungeValue - this.marketValue).toFixed(2));
    }

    return this;
};
/**
 * Calculates the overprice percentage of the item
 * @returns {Item}
 */
Item.prototype.calculateMarketOverprice = function() {
    if (this.marketValue && this.loungeValue) {
        this.marketOverprice = Math.round(((this.loungeValue / this.marketValue) * 100));
    }

    return this;
};

/**
 * Used by 'Show Steam market price' button in item pop-up
 * @returns {Item}
 */
Item.prototype.unloadMarketPrice = function() {
    var _this = this;
    $('.oitm.marketPriced').each(function(i, v) {
        $theItem = $(v);
        if ($theItem.hasClass('marketPriced') && $theItem.find('img.smallimg').attr('alt').trim() === _this.itemName) {
            $theItem.removeClass('marketPriced');
        }

        var itemObj = itemObject($theItem);
        itemObj.marketPriced = false;
        itemObj.marketValue = null;
    });

    return this;
};

Item.prototype.fetchSteamMarketPrice = function(steamOnly) {
    var _this = this;

    loadingItems[this.itemName] = true;

    var successHandling = function (priceInUsd) {
        marketedItems[_this.itemName] = priceInUsd;
        _this.insertMarketValue(priceInUsd);
        delete loadingItems[_this.itemName];
    };

    var notFoundHandling = function () {
        $(_this.item).find('.rarity').html('Not found');
        notFoundListings.push(_this.itemName);
        delete loadingItems[_this.itemName];
    };

    var fetchFromSteam = function () {
        _this.fetchSteamMarketPriceFromSteam(function(priceInUsd) {
            successHandling(priceInUsd);
        }, function(errorMessage) {
            $(_this.item).find('.rarity').text(errorMessage);
            delete loadingItems[_this.itemName];
        }, notFoundHandling);
    };

    if (steamOnly === true) {
        fetchFromSteam();
        return;
    }

    _this.fetchSteamMarketPriceFromSE(function(priceInUsd) {
        successHandling(priceInUsd);
    }, notFoundHandling, function() {
       fetchFromSteam();
    });
};

/**
 * Fetches Steam market price from unofficial Steam API in USD currency (converts if necessary)
 */
Item.prototype.fetchSteamMarketPriceFromSteam = function(successCallback, errorCallback, notFoundCallback) {
    var _this = this;

    var xmlhttp = new XMLHttpRequest();

    // https://bugzilla.mozilla.org/show_bug.cgi?id=1205886
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (xmlhttp.status == 200) {
                var data = JSON.parse(xmlhttp.responseText);

                if (data.success === true && data.total_count > 0 && data.results_html) {
                    var doc = document.implementation.createHTMLDocument('');
                    doc.body.innerHTML = data.results_html;

                    var priceString = null;

                    if (data.total_count === 1) {
                        // Much easier to got after first and only market result
                        priceString = $(doc).find('.market_listing_row_link:eq(0) .market_listing_their_price .market_table_value span:eq(0)').text();
                    } else {
                        $(doc).find('.market_listing_row_link').each(function(listingIndex, listingValue) {
                            // Extract item name from the URL, because this is only thing that does not get translated if user is using different language on Steam
                            var itemNameFromURL = decodeURI($(listingValue)[0].pathname.replace('/market/listings/730/', ''));

                            var listingItemNameHtml = $(listingValue).find('.market_listing_item_name').text();

                            // Compare if the item name matches with item name on Lounge
                            if (listingItemNameHtml === _this.itemName || itemNameFromURL === _this.itemName) {
                                var priceTxt = $(listingValue).find('.market_listing_their_price .market_table_value span:eq(0)').text();

                                if (priceTxt) {
                                    priceString = priceTxt;
                                    return false;
                                }
                            }
                        });
                    }

                    // If no price was not found, we assume there are no listings for the item
                    if (priceString === null) {
                        notFoundCallback();
                        return false;
                    }

                    var extractedData = detectCurrencyAndValueFromString(priceString);

                    // This might fail if we don't support the currency
                    if (extractedData.currencyId !== null) {
                        // Here we pray, hoping that nothing will fail
                        var fromUsdConv = currencies['USD' + g_rgCurrencyData[extractedData.currencyId].strCode];
                        var fromDetectedCurrToUsd = 1 / fromUsdConv;
                        var priceFloated = extractedData.value;
                        var priceInUsd = priceFloated * fromDetectedCurrToUsd;

                        successCallback(priceInUsd);

                    } else {
                        errorCallback('CURRENCY ERR');
                    }
                } else {
                    notFoundCallback();
                }
            } else {
                errorCallback('STEAM ERR');
            }
        }
    };

    xmlhttp.open('GET', _this.generateMarketSearchRender(), true);
    xmlhttp.send();

    //var ajaxOptions =  {
    //    url: _this.generateMarketSearchRender(),
    //    method: 'GET',
    //    dataType: 'json',
    //    success: function(data) {
    //        if (data.success === true && data.total_count > 0 && data.results_html) {
    //            var doc = document.implementation.createHTMLDocument('');
    //            doc.body.innerHTML = data.results_html;
    //
    //            var priceString = null;
    //
    //            if (data.total_count === 1) {
    //                // Much easier to got after first and only market result
    //                priceString = $(doc).find('.market_listing_row_link:eq(0) .market_listing_their_price .market_table_value span:eq(0)').text();
    //            } else {
    //                $(doc).find('.market_listing_row_link').each(function(listingIndex, listingValue) {
    //                    // Extract item name from the URL, because this is only thing that does not get translated if user is using different language on Steam
    //                    var itemNameFromURL = decodeURI($(listingValue)[0].pathname.replace('/market/listings/730/', ''));
    //
    //                    var listingItemNameHtml = $(listingValue).find('.market_listing_item_name').text();
    //
    //                    // Compare if the item name matches with item name on Lounge
    //                    if (listingItemNameHtml === _this.itemName || itemNameFromURL === _this.itemName) {
    //                        var priceTxt = $(listingValue).find('.market_listing_their_price .market_table_value span:eq(0)').text();
    //
    //                        if (priceTxt) {
    //                            priceString = priceTxt;
    //                            return false;
    //                        }
    //                    }
    //                });
    //            }
    //
    //            // If no price was not found, we assume there are no listings for the item
    //            if (priceString === null) {
    //                notFoundCallback();
    //                return false;
    //            }
    //
    //            var extractedData = detectCurrencyAndValueFromString(priceString);
    //
    //            // This might fail if we don't support the currency
    //            if (extractedData.currencyId !== null) {
    //                // Here we pray, hoping that nothing will fail
    //                var fromUsdConv = currencies['USD' + g_rgCurrencyData[extractedData.currencyId].strCode];
    //                var fromDetectedCurrToUsd = 1 / fromUsdConv;
    //                var priceFloated = extractedData.value;
    //                var priceInUsd = priceFloated * fromDetectedCurrToUsd;
    //
    //                successCallback(priceInUsd);
    //
    //            } else {
    //                errorCallback('CURRENCY ERR');
    //            }
    //        } else {
    //            notFoundCallback();
    //        }
    //    },
    //    error: function () {
    //        errorCallback('STEAM ERR');
    //    }
    //};
    //
    //(LoungeUser.userSettings.itemMarketPricesv2 === '2' ? $.ajaxq('fuckoffsteam', ajaxOptions) : $.ajax(ajaxOptions));
};

Item.prototype.fetchSteamMarketPriceFromSE = function(successCallback, notFoundCallback, everythingIsBadCallback) {
    var _this = this;

    $.ajax({
        url: 'https://steam.expert/api/items/name/' + encodeURI(this.itemName) + '/price?appid=' + appID,
        type: 'GET',
        dataType: 'json',
        success: function(data) {
            if (data.hasOwnProperty('data') && data.data.hasOwnProperty('price') && !isNaN(data.data.price)) {
                var priceInUsd = parseFloat(data.data.price);
                successCallback(priceInUsd);
            } else {
                notFoundCallback();
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 404) {
                notFoundCallback();
            } else {
                everythingIsBadCallback();
            }
        }
    });
};

Item.prototype.fetchLoungeValueFromAPI = function(success, error) {
    var _this = this;

    var xmlhttp = new XMLHttpRequest();

    // https://bugzilla.mozilla.org/show_bug.cgi?id=1205886
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (xmlhttp.status == 200) {
                var itemFound = false;

                var data = JSON.parse(xmlhttp.responseText);

                $.each(data, function(itemID, item) {
                    if (item.name == _this.itemName) {
                        itemFound = true;
                        var worth = parseFloat(item.worth).toFixed(2);
                        if (worth > 0) {
                            success(worth);
                        } else {
                            error(_this.itemName + ' is not available for betting on CSGOLounge.com');
                        }

                        return false;
                    }
                });

                if (!itemFound) {
                    error(_this.itemName + ' was not found in CSGOLounge.com database');
                }
            } else {
                error('Could not fetch CSGOLounge betting price, HTTP error #' + xmlhttp.status);
            }
        }
    };

    xmlhttp.open('GET', 'http://csgolounge.com/api/schema.php?_=' + new Date().getTime(), true);
    xmlhttp.send();

    //$.ajax({
    //    url: 'http://csgolounge.com/api/schema.php',
    //    type: 'GET',
    //    dataType: 'json',
    //    success: function(data) {
    //        var itemFound = false;
    //        $.each(data, function(itemID, item) {
    //            if (item.name == _this.itemName) {
    //                itemFound = true;
    //                var worth = parseFloat(item.worth).toFixed(2);
    //                if (worth > 0) {
    //                    success(worth);
    //                } else {
    //                    error(_this.itemName + ' is not available for betting on CSGOLounge.com');
    //                }
    //
    //                return false;
    //            }
    //        });
    //
    //        if (!itemFound) {
    //            error(_this.itemName + ' was not found in CSGOLounge.com database');
    //        }
    //    },
    //    cache: false
    //});

    return this;
};

Item.prototype.generateMarketURL = function(app) {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    if (app !== undefined) {
        appID = app;
    }

    return 'https://steamcommunity.com/market/listings/' + appID + '/' + encodeURIComponent(this.itemName);
};

Item.prototype.generateMarketSearchRender = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    return 'https://steamcommunity.com/market/search/render/?query=' + encodeURIComponent(this.itemName) + '&start=0&count=100&search_descriptions=0&sort_column=default&appid=' + appID;
};

Item.prototype.generateMarketSearchURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    return 'https://steamcommunity.com/market/search?q=' + encodeURIComponent(this.itemName);
};

Item.prototype.generateMarketApiURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    return 'https://steamcommunity.com/market/priceoverview/?country=US&currency=1&appid=' +
        appID + '&market_hash_name=' + encodeURIComponent(this.itemName);
};

Item.prototype.generateSteamStoreURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    return 'https://store.steampowered.com/search/?term=' + encodeURIComponent(this.itemName);
};

/**
 * Generates link to OPSkins market place
 * @param appID int required
 * @param contextId optional
 * @returns {string} URL to OPSkins marketplace
 */
Item.prototype.generateOPSkinsURL = function(appID, contextId) {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    appID = parseInt(appID);

    if (contextId === undefined) {
        contextId = (appIDcontextIDs.hasOwnProperty(appID) ? appIDcontextIDs[appID] : undefined);
    }

    var appIDUrl = (appID !== undefined && contextId !== undefined && appIDcontextIDs.hasOwnProperty(appID)
        ? ('&app=' + appID + '_' + appIDcontextIDs[appID]) : '');

    return 'https://opskins.com/?loc=shop_search&ref=destroyer&aid=91' + appIDUrl + '&search_item=' + encodeURIComponent(this.itemName) + '&sort=lh';
};

Item.prototype.generateBitskinsURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    var stattrak = (this.itemName.indexOf('StatTrak™ ') !== -1) ? 1 : 0;

    return 'https://bitskins.com/?referred_by=76561198043770492&market_hash_name=' + encodeURIComponent(this.itemName) + '&is_stattrak=' + stattrak + '&sort_by=price&order=asc';
};

Item.prototype.convertLoungeValue = function() {
    if (LoungeUser.userSettings.convertLoungePrices === '1' && !this.loungeValueConverted) {
        var $valElm = $('.value', this.item);
        if ($valElm.length && this.loungeValue > 0) {
            var loungeValue = parseFloat($valElm.text().match(/[0-9.]+/));

            // If the the value is parsable as a number, convert the lounge's price
            if (!isNaN(loungeValue)) {
                this.loungeValue = loungeValue;
                $valElm.text(convertPrice(loungeValue, true));
                this.loungeValueConverted = true;
            }
        }
    }

    return this;
};

Item.prototype.addLoungeValue = function() {
    if (appID === '730' && LoungeUser.userSettings.bettingValuesCsgo === '1') {
        if (this.loungeValue === null && csglBettingValues.hasOwnProperty(this.itemName)) {
            var newValElm = $('<div class="value"></div>');
            $(newValElm).text(convertPrice(csglBettingValues[this.itemName], true));
            $('.item', this.item).prepend(newValElm);
            this.loungeValue = csglBettingValues[this.itemName];
            this.loungeValueConverted = true;
        }
    }

    return this;
};

/**
 * Black-lists an item from ever creating requests to Steam API
 * @returns {Item}
 */
Item.prototype.blacklistItem = function() {
    blacklistedItemList[this.itemName] = null;
    chrome.storage.local.set({'blacklistedItemList': blacklistedItemList});
    return this;
};

Item.prototype.appendHoverElements = function() {
    var _this = this;
    if (!_this.extraAppended) {
        if (nonMarketItems.indexOf(_this.itemName) === -1) {
            $nameContainer = $('.name', _this.item);

            if (appID === '730' && LoungeUser.userSettings.convertToFloatValue === '1') {
                var nameContents = $nameContainer.contents();
                $(nameContents).each(function(contentsIndex, contentValue) {
                    if ($(contentValue).text().indexOf('Condition') !== -1 && $(contentValue).text().indexOf('%') !== -1) {
                        var condition = $(contentValue).text().match(new RegExp('[-+]?\\d*\\.\\d+|\\d+', 'g'));
                        if (condition !== null) {
                            var floatValue = Math.abs((parseFloat(condition[0]) - 100) / 100).toFixed(5);
                            $(contentValue)[0].textContent = 'Float value: ' + floatValue;
                        }

                        return false;
                    }
                });
            }

            if ($('a:contains("Market")', _this.item).length) {
                $('a:contains("Market")', _this.item).html('Market Listings');
            } else {
                $nameContainer.append('<br/>' +
                    '<a href="' + _this.generateMarketURL() + '" target="_blank">Market Listings</a>');
            }

            $nameContainer.append('<br/>' +
                '<a href="' + _this.generateMarketSearchURL() + '" target="_blank">Market Search</a>' +
                '<br/><br/><small><a class="refreshPriceMarket">Show Steam market price</a></small>');

            if(LoungeUser.userSettings.opskins === '1') {
                $nameContainer.append('<br/><p class="opskins-aff"><a href="' + _this.generateOPSkinsURL(appID) +'" target="_blank">Buy on OPSKINS.com</a>' +
                    '<small title="This affiliate link is added by LoungeDestroyer and supports the developers, you can remove this affiliate link in the settings if you wish."> (?)</small></p>');
            }

            if (LoungeUser.userSettings.showItemTimeCache === '1') {
                var appendMarketTime = (LoungeUser.userSettings.useCachedPriceList === '1' && marketPriceListUpdatedEpoch !== 0 && this.marketValue > 0);
                var appendBetTime = (LoungeUser.userSettings.bettingValuesCsgo === '1' && bettingItemListUpdatedEpoch !== 0 && this.loungeValueFromSite === false && this.loungeValueConverted === true);

                if (appendBetTime || appendMarketTime) {
                    $nameContainer.append('<br/>');
                }

                if (appendMarketTime) {
                    var lastListUpdatedString = moment(marketPriceListUpdatedEpoch).format('L LT');
                    $nameContainer.append('<p class="ld-info-market-last-updated" title="The time shown indicates when was the last time ' +
                        'LoungeDestroyer updated it\'s cached market price list"><span class="ld-label-market-date">Market price:</span> ' + lastListUpdatedString + '</p>');
                }

                if (appendBetTime) {
                    var lastBetValuesUpdatedString = moment(bettingItemListUpdatedEpoch).format('L LT');
                    $nameContainer.append('<p class="ld-info-bet-last-updated" title="The time shown indicates when was the last time LoungeDestroyer ' +
                        'updated the betting values for CSGOLounge items"><span class="ld-label-betting-date">Betting value:</span> ' + lastBetValuesUpdatedString + '</p>');
                }
            }

            $nameContainer.append('<p class="ld-market-max-warning"><br/>Any item prices that are above the maximum Steam market selling ' +
                'limit are estimates and should not be used as accurate price in trading.</p>')
        }
        _this.extraAppended = true;
    }

    return this;
};

/**
 *  Initiate item class for all items, that way we don't initiate it only on market price loading.
 *  This allow us to use the item class in other cases, for example, when converting betting values
 *  @param {Array} elmList - list of jQuery element objects (optional)
 *  @param {Boolean} cachedOnly - If true, append market prices only from the price list cache
 */
function initiateItemObjectForElementList(elmList, cachedOnly) {
    if (!elmList) {
        elmList = $('body .oitm');
    }

    var cachedItemList = [];

    // Loop through all the items and push them in an array if we found duplicates
    // We also initiate item class on the element
    for (var i = 0, j = elmList.length; i < j; ++i) {
        var item = itemObject(elmList[i]);

        if(LoungeUser.userSettings.itemMarketPricesv2 === '2') {
            if (!cachedItemList.hasOwnProperty(item.itemName)) {
                cachedItemList[item.itemName] = [];
            }

            cachedItemList[item.itemName].push(item);
        }
    }

    // Then we fetch market prices only for unique, non-duplicate items
    if(LoungeUser.userSettings.itemMarketPricesv2 === '2') {
        for (var index in cachedItemList) {
            var itemForScience = cachedItemList[index][0];
            itemForScience.myFriends = cachedItemList[index];
            itemForScience.getMarketPrice(cachedOnly);
        }
    }
}


/**
 * Converts Lounge value (assuming it is USD by default) to users currency
 * @param {float} usd - Value in USD
 * @param {boolean} toString - true if you want the function to return the value in string
 */
function convertPrice(usd, toString) {
    var currData = g_rgCurrencyData[LoungeUser.userSettings.marketCurrency];
    var conversionRate = currencies[('USD' + currData.strCode)];
    var convertedPrice = (usd * conversionRate).toFixed(2);

    if (isNaN(convertedPrice)) return NaN;

    if (!toString) return convertedPrice;

    if (currData.bSymbolIsPrefix) {
        return currData.strSymbol + ' ' + convertedPrice;
    } else {
        return convertedPrice + ' ' + currData.strSymbol;
    }
}

function detectCurrencyAndValueFromString(str) {
    var currencyName = null;
    var value = null;

    // http://www.regexr.com/3cf69
    var valueAlmostRemoved = str.replace('--', '00').replace(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g, '').trim();
    var valueExtracted = str.replace('--', '00').replace(',', '.').match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g);

    if (valueAlmostRemoved.length > 0) {
        var currSymb = valueAlmostRemoved.split(' ');

        $.each(g_rgCurrencyData, function(currId, currInfo) {
            // Check against each split
            for (var i = 0; i < currSymb.length; i++) {
                if (currSymb[i] === currInfo.strSymbol) {
                    currencyName = currId;
                    break;
                }
            }

            if (currencyName !== null) {
                return false;
            }
        });
    }

    if (valueExtracted !== null) {
        var combinedValue = '';
        for (var i = 0; i < valueExtracted.length; i++) {
            combinedValue = combinedValue + valueExtracted[i];
        }

        var last = combinedValue.lastIndexOf('.');
        var butLast = combinedValue.substring(0, last).replace(/\./g, '');
        var valueWithLastDot = butLast + combinedValue.substring(last);

        var priceFloatParsed = parseFloat(valueWithLastDot);

        if (!isNaN(priceFloatParsed)) {
            value = priceFloatParsed;
        }
    }

    return {
        currencyId: currencyName,
        value: value
    };
}

/**
 * Gets Items object for an .oitm element, if the object is not appended, it will append a new one instead
 * @param {object} domObj - .oitm element
 */
function itemObject(domObj) {
    var $item = $(domObj);
    if (!$item.data('item-data')) {
        $item.data('item-data', new Item($item));
    }

    return $item.data('item-data');
}
