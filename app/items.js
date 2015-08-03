var marketedItems = [];
var loadingItems = [];
var nonMarketItems = ['Dota Items', 'Any Offers', 'Any Knife', 'Knife', 'Gift', 'TF2 Items', 'Real Money', 'Offers',
    'Any Common', 'Any Uncommon', 'Any Rare', 'Any Mythical', 'Any Legendary', 'Any Ancient', 'Any Immortal',
    'Real Money', '+ More', 'Any Set', 'Any Key', 'Undefined / Not Tradeable', 'Card', 'Background',
    'Icon', 'Gift', 'DLC'];
var skinQualities = {'Factory New': 'FN', 'Minimal Wear': 'MW', 'Well-Worn': 'WW', 'Battle-Scarred': 'BS',
    'Field-Tested': 'FT', 'Common': 'C', 'Uncommon': 'UC', 'Rare': 'R', 'Mythical': 'M', 'Legendary': 'L',
    'Ancient': 'AN', 'Immortal': 'I', 'Arcana': 'AR'};

var Item = function(item) {
    var _this = this;

    // This allows us to use the object functions as static functions without constructing the object
    if (item !== undefined) {

        this.item = item;
        this.itemName = $('.smallimg', this.item).attr('alt').trim();

        this.loungeValue = null;

        var $valElm = $('.value', this.item);
        if($valElm.length) {
            var bettingValue = parseFloat($valElm.text().match(/[0-9.]+/));
            if (!isNaN(bettingValue)) {
                this.loungeValue = bettingValue;
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
            $myLittleItem.addClass('marketPriced').find('.rarity').html(marketValueHTML);
            _this.myFriends[index].displayWeaponQuality().calculateMarketDifference().calculateMarketOverprice();
        }
    }
    else {
        // For the item we just called getMarketPrice method from
        this.marketPriced = true;
        this.marketValue = marketValue;
        $(this.item).addClass('marketPriced').find('.rarity').html(marketValueHTML);
        this.displayWeaponQuality().calculateMarketDifference().calculateMarketOverprice();

        // All other items
        $('.oitm:not(.marketPriced)').each(function() {
            if ($(this).find('img.smallimg').attr('alt').trim() === _this.itemName) {
                var itemObj = itemObject(this);
                $(itemObj.item).addClass('marketPriced').find('.rarity').html(marketValueHTML);
                itemObj.marketPriced = true;
                itemObj.marketValue = marketValue;
                itemObj.displayWeaponQuality().calculateMarketDifference().calculateMarketOverprice();
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
        console.log('Item ' + this.itemName + ' already marketed, not marketing it again');
        return this;
    }

    if (!cachedOnly) {
        cachedOnly = false;
    }

    var _this = this;

    // Check if we can append a cached item price
    if (LoungeUser.userSettings.useCachedPriceList === '1') {
        if (storageMarketItems.hasOwnProperty(appID)) {
            if (storageMarketItems[appID].hasOwnProperty(this.itemName)) {
                return this.insertMarketValue(storageMarketItems[appID][this.itemName].value);
            }
        }
    }

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

    if (cachedOnly) {
        return this;
    }

    if (nonMarketItems.indexOf(_this.itemName) === -1 && nonMarketItems.indexOf($('.rarity', this.item).text()) === -1 &&
        !loadingItems.hasOwnProperty(this.itemName)) {
        this.fetchSteamMarketPrice();
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
/**
 * Fetches Steam market price from unofficial Steam API in USD currency (converts if necessary)
 */
Item.prototype.fetchSteamMarketPrice = function() {
    var _this = this;
    loadingItems[this.itemName] = true;
    $.ajax({
        url: this.generateMarketApiURL(),
        type: 'GET',
        success: function(data) {
            if (data.success === true && data.hasOwnProperty('lowest_price')) {
                // jscs: disable
                var lowestPrice = parseFloat(data.lowest_price.replace('&#36;', '').match(/[0-9.]+/));
                // jscs: enable
                marketedItems[_this.itemName] = lowestPrice;
                _this.insertMarketValue(lowestPrice);
            }
            else {
                // TODO: Rewrite insertMarketValue method to handle no market price values
                $(_this.item).find('.rarity').html('Not Found');
            }
        },

        error: function(jqXHR) {
            if (LoungeUser.userSettings.blacklistNonExistingItems === '1' && jqXHR.status === 500) {
                console.log('Error getting response for item ' + _this.itemName);
                _this.blacklistItem();
            }
        }
    }).done(function() {
            delete loadingItems[_this.itemName];
        });
};

Item.prototype.fetchLoungeValueFromAPI = function(success, error) {
    var _this = this;
    $.ajax({
        url: 'http://csgolounge.com/api/schema.php',
        type: 'GET',
        success: function(data) {
            var itemFound = false;
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
        }
    });
    return this;
};

Item.prototype.generateMarketURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    return window.location.protocol + '//steamcommunity.com/market/listings/' + appID + '/' + this.itemName;
};

Item.prototype.generateMarketSearchURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    return window.location.protocol + '//steamcommunity.com/market/search?q=' + this.itemName;
};

Item.prototype.generateMarketApiURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    return window.location.protocol + '//steamcommunity.com/market/priceoverview/?country=US&currency=1&appid=' +
        appID + '&market_hash_name=' + encodeURI(this.itemName);
};

Item.prototype.generateSteamStoreURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    return window.location.protocol + '//store.steampowered.com/search/?term=' + encodeURI(this.itemName);
};

Item.prototype.generateOPSkinsURL = function(itemName, stattrak) {
    if (!(this instanceof Item)) {
        throw new TypeError('\'this\' must be instance of Item');
    }

    if(stattrak === undefined) {
        stattrak = 0;
    }

    return window.location.protocol + '//opskins.com/index.php?loc=shop_search&ref=destroyer&aid=91&search_item=' + encodeURI(itemName) +
        '&min=&max=&StatTrak=' + stattrak + '&inline=&grade=&inline=&type=&inline=&sort=lh';
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
        console.log('No extra elements appended to hover elm.');
        if (nonMarketItems.indexOf(_this.itemName) === -1) {
            if ($('a:contains("Market")', _this.item).length) {
                $('a:contains("Market")', _this.item).html('Market Listings');
            } else {
                $('.name', _this.item).append('<br/>' +
                '<a href="' + _this.generateMarketURL() + '" target="_blank">Market Listings</a>');
            }

            $('.name', _this.item).append('<br/>' +
            '<a href="' + _this.generateMarketSearchURL() + '" target="_blank">Market Search</a>' +
            '<br/><br/><small><a class="refreshPriceMarket">Show Steam market price</a></small>');

            if(appID == '730' && LoungeUser.userSettings.opskins == '1') {
                var isStattrak = (_this.itemName.indexOf('StatTrak™ ') !== -1) ? 1 : 0;
                $('.name', _this.item).append('<br/><p class="opskins-aff"><a href="' + _this.generateOPSkinsURL(_this.itemName, isStattrak) +'" target="_blank">Buy on OPSKINS.com</a>' +
                '<small title="This affiliate link is added by LoungeDestroyer and supports the developers, you can remove this affiliate link in the settings if you wish."> (?)</small></p>');
            }
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
    var currData = currencyData[LoungeUser.userSettings.marketCurrency];
    var conversionRate = currencies[('USD' + currData.naming)];
    var convertedPrice = (usd * conversionRate).toFixed(2);

    if (isNaN(convertedPrice)) return NaN;

    if (!toString) return convertedPrice;

    if (currData.symbolBefore) {
        return currData.symbol + ' ' + convertedPrice;
    } else {
        return convertedPrice + ' ' + currData.symbol;
    }
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
