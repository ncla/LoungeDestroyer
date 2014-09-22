var Inventory = function() {
    // TODO: should this be a class?
};

Inventory.prototype.loadInventory = function() {
    // TODO: create logic
};

Inventory.prototype.getMarketPrices = function(onlyForBackpack) {
    var selector = (onlyForBackpack ? $("#backpack .item") : $(".item"));
    $(selector).each(function(index, value) {
        var item = new Item(value);
        item.getMarketPrice();
    });
};

/*
 Caching betting/trading inventories
 */
Inventory.prototype.cacheInventory = function(type, backpackHTML) {
    console.log("Caching inventory " + type);
    var storeBp = {};
    storeBp[type] = {
        html: backpackHTML,
        timestamp: new Date().toLocaleString()
    };
    chrome.storage.local.set(storeBp);
};
Inventory.prototype.getCachedInventory = function(type, callback) {
    if (!(this instanceof Inventory)) {
        throw new TypeError("'this' must be instance of Inventory");
    }

    chrome.storage.local.get(type, function(result) {
        if(jQuery.isEmptyObject(result)) {
            console.log("Cached inventory is empty!");
            callback("<div style='text-align: center;'><small>Inventory has not been cached yet, inventory will automatically cache itself when inventory successfully loads.</small></div>");
        }
        else {
            callback(result[type]["html"]);
        }
    });
};