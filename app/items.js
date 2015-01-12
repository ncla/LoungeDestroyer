var marketedItems = [],
    loadingItems = [],
    nonMarketItems = ["Dota Items", "Any Offers", "Any Knife", "Knife", "Gift", "TF2 Items", "Real Money", "Offers", "Any Common", "Any Uncommon", "Any Rare", "Any Mythical", "Any Legendary",
    "Any Ancient", "Any Immortal", "Real Money", "+ More", "Any Set", "Any Key", "Undefined / Not Tradeable", "Card", "Background", "Icon", "Gift", "DLC"];

var Item = function(item) {
    var self = this;
    this.item = item;
    this.itemName = $(".smallimg", this.item).attr("alt");
    this.convertLoungeValue();
};

Item.prototype.insertMarketValue = function(lowestPrice) {
	var self = this;
    if(this.myFriends) {
        for (var index in self.myFriends) {
            var $myLittleItem = $(self.myFriends[index]["item"]);
            $myLittleItem.addClass('marketPriced');
            $myLittleItem.find(".rarity").html(lowestPrice);
        }
    }
    else {
        $(".item").each(function() {
            var $theItem = $(this);
            if(!$theItem.hasClass('marketPriced')) {
                if ($theItem.find("img.smallimg").attr("alt") == self.itemName) {
                    $theItem.find(".rarity").html(lowestPrice);
                    $theItem.addClass('marketPriced');
                }
            }
        });
    }
};

Item.prototype.getMarketPrice = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    var self = this;

    if(LoungeUser.userSettings["useCachedPriceList"] == "1") {
        if(storageMarketItems.hasOwnProperty(appID)) {
            if(storageMarketItems[appID].hasOwnProperty(this.itemName)) {
                var priceHtml = convertPrice(storageMarketItems[appID][this.itemName]["value"], true);
                return this.insertMarketValue(priceHtml);
            }
        }
    }
    if(blacklistedItemList.hasOwnProperty(this.itemName)) {
        console.log("Item " + self.itemName.trim() + " is blacklisted, not fetching market price");
        return false;
    }

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
    $(".item.marketPriced").each(function(i, v) {
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

                // convert lounge's price
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
/**
 * Get market prices for an element list in a performance friendly way
 * @param {Array} elmList - list of jQuery element objects
 */
function getMarketPricesForElementList(elmList) {
    if(!elmList) {
        elmList = $("body .oitm");
    }
    var cachedItemList = [];

    for (var i = 0, j = elmList.length; i < j; ++i) {
        var item = new Item(elmList[i]);
        if (!cachedItemList.hasOwnProperty(item.itemName)) {
            cachedItemList[item.itemName] = [];
        }
        cachedItemList[item.itemName].push(item);
    }

    for (var index in cachedItemList) {
        var itemForScience = cachedItemList[index][0];
        itemForScience.myFriends = cachedItemList[index];
        itemForScience.getMarketPrice();
    }
}

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