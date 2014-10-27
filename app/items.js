var marketedItems = [];
var loadingItems = [];
var nonMarketItems = ["Dota Items", "Any Offers", "Knife", "Gift", "TF2 Items", "Real Money", "Offers", "Any Common", "Any Uncommon", "Any Rare", "Any Mythical", "Any Legendary",
    "Any Ancient", "Any Immortal", "Real Money", "+ More", "Any Set", "Any Key", "Undefined / Not Tradeable"];
var uniqueItemsFetched = 0;

var Item = function(item) {
    var self = this;
    this.item = item;
    this.itemName = $(".smallimg", this.item).attr("alt");
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
                var currData = currencyData[LoungeUser.userSettings["marketCurrency"]];
                var conversionRate = currencies[currData["name"]];
                var convertedPrice = (storageMarketItems[appID][this.itemName]["value"] * conversionRate).toFixed(2);
                var priceHtml = (currData["symbolBeforeValue"] === true ? currData["htmlSymbol"] + " " + convertedPrice : convertedPrice + " " + currData["htmlSymbol"]);
                return this.insertMarketValue(priceHtml);
            }
        }
    }

    if(marketedItems.hasOwnProperty(this.itemName)) {
        // Not sure if I am genius for returning something and calling a function at the same time
        return this.insertMarketValue(marketedItems[this.itemName]);
    }

    if(nonMarketItems.indexOf(self.itemName) == -1 && !nonMarketItems.hasOwnProperty($(".rarity", this.item).text()) && !loadingItems.hasOwnProperty(this.itemName)) {
        this.fetchSteamMarketPrice();
    }
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
        error: function() {
            console.log("Error getting response for item " + self.itemName);
        }
    }).done(function() {
            delete loadingItems[self.itemName];
        });
};

Item.prototype.generateMarketURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    return 'http://steamcommunity.com/market/listings/' + appID + '/' + this.itemName;
};
Item.prototype.generateMarketSearchURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    return 'http://steamcommunity.com/market/search?q=' + this.itemName;
};
Item.prototype.generateMarketApiURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    return "http://steamcommunity.com/market/priceoverview/?country=US&currency=" + LoungeUser.userSettings["marketCurrency"] + "&appid=" + appID + "&market_hash_name=" + encodeURI(this.itemName);
};
Item.prototype.generateSteamStoreURL = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    return "http://store.steampowered.com/search/?term=" + encodeURI(this.itemName);
};