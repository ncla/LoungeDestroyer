var marketedItems = [],
    loadingItems = [],
    nonMarketItems = ["Dota Items", "Any Offers", "Any Knife", "Knife", "Gift", "TF2 Items", "Real Money", "Offers", "Any Common", "Any Uncommon", "Any Rare", "Any Mythical", "Any Legendary",
    "Any Ancient", "Any Immortal", "Real Money", "+ More", "Any Set", "Any Key", "Undefined / Not Tradeable", "Card", "Background", "Icon", "Gift", "DLC"],
    csgoSkinQualities = {'Factory New': 'FN', 'Minimal Wear': 'MW', 'Well-Worn': 'WW', 'Battle-Scarred': 'BS', 'Field-Tested': 'FT'};

var Item = function(item) {
    var self = this;
    // This allows us to use the object functions as static functions without constructing the object
    if(item !== undefined) {
        this.item = item;
        this.itemName = $(".smallimg", this.item).attr("alt");
        if(appID == "730") {
            $.each(csgoSkinQualities, function(i, v) {
                if(self.itemName.indexOf(i) != -1) {
                    self.weaponQuality = i;
                    self.weaponQualityAbbrevation = v;
                    return false;
                }
            });
        }
        this.convertLoungeValue();
    }
};

Item.prototype.insertMarketValue = function(lowestPrice) {
	var self = this;
    // This is set by getMarketPricesForElementList function in order to avoid performance issues
    // when creating requetsts for market prices on Steam
    if(this.myFriends) {
        for (var index in self.myFriends) {
            var $myLittleItem = $(self.myFriends[index]["item"]);
            $myLittleItem.addClass('marketPriced');
            $myLittleItem.find(".rarity").html(lowestPrice);
            self.myFriends[index].displayWeaponQuality();
        }
    }
    else {
        $(".oitm:not(.marketPriced)").each(function() {
            if ($(this).find("img.smallimg").attr("alt") == self.itemName) {
                var $theItem = $(this);
                var itemObj = new Item($theItem);
                $theItem.find(".rarity").html(lowestPrice);
                $theItem.addClass('marketPriced');
                itemObj.displayWeaponQuality();
            }
        });
    }
};

Item.prototype.displayWeaponQuality = function() {
    if(appID != "730" || LoungeUser.userSettings.displayCsgoWeaponQuality != "1" || typeof this.weaponQuality == 'undefined') {
        return false;
    }
    $(".rarity", this.item).append('<span class="weaponWear"> | ' + this.weaponQualityAbbrevation + '</span>')
};

Item.prototype.getMarketPrice = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    var self = this;

    // Check if we can append a cached item price
    if(LoungeUser.userSettings["useCachedPriceList"] == "1") {
        if(storageMarketItems.hasOwnProperty(appID)) {
            if(storageMarketItems[appID].hasOwnProperty(this.itemName)) {
                var priceHtml = convertPrice(storageMarketItems[appID][this.itemName]["value"], true);
                return this.insertMarketValue(priceHtml);
            }
        }
    }

    // Check if we even have to fetch a price
    if(blacklistedItemList.hasOwnProperty(this.itemName)) {
        console.log("Item " + self.itemName.trim() + " is blacklisted, not fetching market price");
        return false;
    }

    // Check if the itemName has not been already marketed before
    if(marketedItems.hasOwnProperty(this.itemName)) {
        // Not sure if I am genius for returning something and calling a function at the same time
        return this.insertMarketValue(marketedItems[this.itemName]);
    }

    if(nonMarketItems.indexOf(self.itemName) == -1 && nonMarketItems.indexOf($(".rarity", this.item).text()) == -1 && !loadingItems.hasOwnProperty(this.itemName)) {
        this.fetchSteamMarketPrice();
    }
};
Item.prototype.unloadMarketPrice = function() {
    var self = this;
    $(".oitm.marketPriced").each(function(i, v) {
        $theItem = $(v);
        if($theItem.hasClass('marketPriced') && $theItem.find("img.smallimg").attr("alt") == self.itemName) {
            $theItem.find(".rarity").html("Fetching...");
            $theItem.removeClass('marketPriced');
        }
    });
};
Item.prototype.fetchSteamMarketPrice = function() {
    var self = this;
    loadingItems[this.itemName] = true;
    $.ajax({
        url: this.generateMarketApiURL(),
        type: "GET",
        success: function(data) {
            if(data.success == true && data.hasOwnProperty("lowest_price")) {
                var lowestPrice = data["lowest_price"].replace("&#36;", "&#36; ");
                marketedItems[self.itemName] = lowestPrice;
                self.insertMarketValue(lowestPrice);
            }
            else {
                $(self.item).find('.rarity').html('Not Found');
            }
        },
        error: function(jqXHR) {
            if(LoungeUser.userSettings.blacklistNonExistingItems == "1" && jqXHR.status == 500) {
                console.log("Error getting response for item " + self.itemName);
                self.blacklistItem();
            }
        }
    }).done(function() {
            delete loadingItems[self.itemName];
        });
};

Item.prototype.generateMarketURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    return window.location.protocol + '//steamcommunity.com/market/listings/' + appID + '/' + this.itemName;
};
Item.prototype.generateMarketSearchURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    return window.location.protocol + '://steamcommunity.com/market/search?q=' + this.itemName;
};
Item.prototype.generateMarketApiURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    return window.location.protocol + "//steamcommunity.com/market/priceoverview/?country=US&currency=" + LoungeUser.userSettings["marketCurrency"] + "&appid=" + appID + "&market_hash_name=" + encodeURI(this.itemName);
};
Item.prototype.generateSteamStoreURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    return window.location.protocol + "//store.steampowered.com/search/?term=" + encodeURI(this.itemName);
};
Item.prototype.convertLoungeValue = function() {
    if (LoungeUser.userSettings["convertLoungePrices"] == "1") {
        var valElm = $(".value", this.item);
        if (valElm.length) {
            if (!$(this.item).hasClass("loungeConverted")) {
                $(this.item).addClass("loungeConverted");

                var loungeValue = parseFloat(valElm.text().match(/[0-9.]+/));

                // If the the value is parsable as a number, convert the lounge's price
                if (!isNaN(loungeValue)) {
                    $(".value", this.item).text(convertPrice(loungeValue, true));
                }
            }
        }
    }
};
Item.prototype.blacklistItem = function() {
    blacklistedItemList[this.itemName] = null;
    chrome.storage.local.set({'blacklistedItemList': blacklistedItemList});
};
Item.prototype.appendHoverElements = function() {
    var self = this;
    if(!$(self.item).hasClass("ld-appended")) {
        if(nonMarketItems.indexOf(self.itemName) == -1) {
            if($("a:contains('Market')", self.item).length) {
                $("a:contains('Market')", self.item).html("Market Listings");
            } else {
                $(".name", self.item).append('<br/><a href="' + self.generateMarketURL() + '" target="_blank">Market Listings</a>');
            }

            $(".name", self.item).append('<br/><a href="' + self.generateMarketSearchURL() + '" target="_blank">Market Search</a>' +
                '<br/><br/><small><a class="refreshPriceMarket">Show Steam market price</a></small>');
        }

        $(self.item).addClass("ld-appended");
    }
};
/**
 * Get market prices for an element list in a performance friendly way
 * @param {Array} elmList - list of jQuery element objects (optional)
 */
function getMarketPricesForElementList(elmList) {
    if(!elmList) {
        elmList = $("body .oitm");
    }
    var cachedItemList = [];

    // Loop through all the items and push them in an array if we found duplicates
    for (var i = 0, j = elmList.length; i < j; ++i) {
        var item = new Item(elmList[i]);
        if (!cachedItemList.hasOwnProperty(item.itemName)) {
            cachedItemList[item.itemName] = [];
        }
        cachedItemList[item.itemName].push(item);
    }
    // Then we fetch market prices only for unique, non-duplicate items
    for (var index in cachedItemList) {
        var itemForScience = cachedItemList[index][0];
        itemForScience.myFriends = cachedItemList[index];
        itemForScience.getMarketPrice();
    }
}

/**
 * Converts Lounge value (assuming it is USD by default) to users currency
 * @param {float} usd - Value in USD
 * @param {boolean} toString - true if you want the function to return the value in string
 */
function convertPrice(usd, toString) {
    var currData = currencyData[LoungeUser.userSettings["marketCurrency"]],
        conversionRate = currencies[("USD" + currData["naming"])],
        convertedPrice = (usd * conversionRate).toFixed(2);

    if (isNaN(convertedPrice))
        return NaN;

    if (!toString)
        return convertedPrice;

    var outp = currData["symbolBefore"] ? currData["symbol"]+" "+convertedPrice : convertedPrice+" "+currData["symbol"];
    return outp;
}