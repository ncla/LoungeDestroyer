var Inventory = function() {
    var inventoryIsLoading = false;
    var backpackAjaxURL = null;
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
Inventory.prototype.stopLoadingInventory = function() {

};
Inventory.prototype.onInventoryLoaded = function(url) {
//        if(document.URL.indexOf("/match?m=") != -1) {
//            if($(".bpheader").text().indexOf("CS:GO Inventory") != -1) {
//                inv.cacheInventory("bettingInventory" + appID + "_" + readCookie("id"), $("#backpack").html());
//            }
//            if($(".bpheader .title").text().indexOf("Armory") != -1) {
//                inv.cacheInventory("bettingInventory" + appID + "_" + readCookie("id"), $("#backpack").html());
//            }
//        }
    backpackAjaxURL = url;
    var whereToLookAt = (document.URL.indexOf("/trade?t=") != -1 ? $("#offer") : $("#backpack"));
    console.log(whereToLookAt);
    if($(whereToLookAt).text().indexOf("Can't get items.") != -1) {
        console.log("Failure to get items!");
        this.addInventoryLoadButton(whereToLookAt);
    } else if($(whereToLookAt).text().trim().length == 0) {
        console.log("Empty response!");
    } else {
        console.log("Assuming the backpack has loaded!");
        $("#loading", whereToLookAt).hide();
        this.getMarketPrices(true);
        if(appID == "730" && document.URL.indexOf("/match?m=") != -1) {
            epicStuff();
        }
    }
};
Inventory.prototype.addInventoryLoadButton = function(element) {
    var self = this;
        var btn = $('<a class="button">Initiate backpack loading</a>');
        $(btn).click(function() {
            if(inventoryIsLoading) {
                self.stopLoadingInventory();
                $(btn).html("Initiate backpack loading");
                inventoryIsLoading = false;
            }
            else {
                self.loadInventory();
                $(btn).html("Stop backpack loading");
                inventoryIsLoading = true;
            }
        });
        $(element).append(btn);
};