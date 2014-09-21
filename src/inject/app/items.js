var Item = function(item) {
    var self = this;
    this.itemName = $(".smallimg", item).attr("alt");

    this.getMarketPrice = function() {
        if(marketedItems.hasOwnProperty(self.itemName)) {
            // Not sure if I am genius for returning something and calling a function at the same time
            return self.insertMarketValue(marketedItems[self.itemName]);
        }
        if(!$(item).hasClass("marketPriced") && nonMarketItems.indexOf(this.itemName) == -1 && nonMarketItems.indexOf($(".rarity", item).text()) == -1 && !$(item).hasClass("loadingPrice")) {
            $(item).addClass("loadingPrice");
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
                        $(item).find('.rarity').html('Not Found');
                    }
                },
                error: function() {
                    console.log("Error getting response for item " + this.itemName);
                }
            }).done(function() {
                    $(item).removeClass("loadingPrice");
                });
        }
    };
    this.insertMarketValue = function(lowestPrice) {
        $(".rarity", item).html(lowestPrice);
        $(item).addClass("marketPriced");
        // Need to rethink/rewrite this so it doesnt cause performance issues. Necessary for same items to have market value
//        $(".item").each(function() {
//            if ($(this).find('img.smallimg').attr("alt") == self.itemName && !$(this).hasClass('marketPriced')) {
//                $(this).find('.rarity').html(lowestPrice);
//                $(this).addClass('marketPriced');
//            }
//        });
    };
    this.generateMarketURL = function() {
        return 'http://steamcommunity.com/market/listings/' + appID + '/' + this.itemName;
    };
    this.generateMarketSearchURL = function() {
        return 'http://steamcommunity.com/market/search?q=' + this.itemName;
    };
    this.generateMarketApiURL = function() {
        return "http://steamcommunity.com/market/priceoverview/?country=US&currency=" + LoungeUser.userSettings["marketCurrency"] + "&appid=" + appID + "&market_hash_name=" + encodeURI(this.itemName);
    };
    this.generateSteamStoreURL = function() {
        return "http://store.steampowered.com/search/?term=" + encodeURI(this.itemName);
    }
};