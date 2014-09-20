var Inventory = function() {
    this.loadInventory = function() {

    };
    this.getMarketPrices = function() {
        $(".item").each(function(index, value) {
            var item = new Item(value);
            item.getMarketPrice();
        });
    };
    /*
     Caching betting/trading inventories incase API is broken
     */
    this.cacheInventory = function(type) {

    };
    this.getCachedInventory = function(type) {

    };
};