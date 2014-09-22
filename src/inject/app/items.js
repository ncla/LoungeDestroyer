var Item = function(item) {
    var self = this;
    this.itemName = $(".smallimg", item).attr("alt");
    this.item = item;
};

Item.prototype.insertMarketValue = function(lowestPrice) {
    $(".rarity", this.item).html(lowestPrice);
    $(this.item).addClass("marketPriced");
    // TODO: Need to rethink/rewrite this so it doesnt cause performance issues. Necessary for same items to have market value
//        $(".item").each(function() {
//            if ($(this).find('img.smallimg').attr("alt") == self.itemName && !$(this).hasClass('marketPriced')) {
//                $(this).find('.rarity').html(lowestPrice);
//                $(this).addClass('marketPriced');
//            }
//        });
};

Item.prototype.getMarketPrice = function() {
    if (!(this instanceof Item)) {
        throw new TypeError("'this' must be instance of Item");
    }

    var self = this;

    if(marketedItems.hasOwnProperty(this.itemName)) {
        // Not sure if I am genius for returning something and calling a function at the same time
        return this.insertMarketValue(marketedItems[this.itemName]);
    }
    if(!$(this.item).hasClass("marketPriced") && nonMarketItems.indexOf(this.itemName) == -1 && nonMarketItems.indexOf($(".rarity", this.item).text()) == -1 && !$(this.item).hasClass("loadingPrice")) {
        $(this.item).addClass("loadingPrice");
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
                $(self.item).removeClass("loadingPrice");
            });
    }
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
}