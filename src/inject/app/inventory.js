var Inventory = function() {
    this.inventoryIsLoading = false; // LD loading it, not site loading it
    this.backpackAjaxURL = null;
    this.isRetryLinkAvailable = null;
    var self = this;
    /*
        Construct for backpack
     */
    if(document.URL.indexOf("/match?m=") != -1 || document.URL.indexOf("/search") != -1 || document.URL.indexOf("/addtrade") != -1) {
        this.backpackElement = $("#backpack");
        if($("#backpack #loading").length == 0) {
            chrome.runtime.sendMessage({giveMeBackpackURL: "pls"}, function(response) {
                self.onInventoryLoaded(response);
            });
        }
    } else if(document.URL.indexOf("/trade?t=") != -1) {
        /*
            This backpack is like one of the twins, except this one is the retarded one.
            This backpack appends itself to #offer instead of replacing contents of #backpack
         */
        $unwantedChild = $("#offer");
        $unwantedChild.attr("id", "fakeBackpack"); // ehehheheh
        $unwantedChild.append('<div id="offer"></div>');
        this.backpackElement = $("#offer");
    } else {
        this.backpackElement = false;
    }
};

Inventory.prototype.loadInventory = function() {
    var self = this;
    var theURL = self.backpackAjaxURL;
    if(this.backpackAjaxURL.indexOf("tradeBackpack") != -1) {
        var theURL = (Math.random() < 0.5 ? "ajax/tradeBackpack.php": "ajax/tradeBackpackApi.php");
    }
    $.ajax({
        url: theURL,
        success: function(data) {
            if($(data).text().indexOf("Can't get items.") == -1 && data.length != 0) {
                console.log("yay");
                console.log(data);
                $(self.backpackElement).html(data);
                self.onInventoryLoaded(self.backpackAjaxURL);
                self.inventoryIsLoading = false;
            }
            else {
                document.getElementById("LDerr").innerHTML = $(data).text();
                self.loadInventory();
            }
        }
    });
};

Inventory.prototype.getMarketPrices = function(onlyForBackpack) {
    var selector = (onlyForBackpack ? $("#backpack .item") : $(".item"));
    var cachedItemList = [];
    $(selector).each(function(index, value) {
        var item = new Item(value);
        if(!cachedItemList.hasOwnProperty(item.itemName)) {
            cachedItemList[item.itemName] = [];
        }
        cachedItemList[item.itemName].push(item);
    });

    for (var index in cachedItemList) {
        var itemForScience = cachedItemList[index][0];
        //console.log(itemForScience);
        itemForScience.myFriends = cachedItemList[index];
        itemForScience.getMarketPrice();
    }
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
    if(!this.backpackElement || this.inventoryIsLoading) {
        return false;
    }
    this.backpackAjaxURL = url;
    var whereToLookAt = (document.URL.indexOf("/trade?t=") != -1 ? $("#offer") : $("#backpack"));
    //console.log(whereToLookAt);
    if($(whereToLookAt).text().indexOf("Can't get items.") != -1) {
        console.log("Failure to get items!");
        this.isRetryLinkAvailable = ($("a[onclick]", whereToLookAt).length ? true : false);
        this.addInventoryLoadButton(whereToLookAt);
    } else if($(whereToLookAt).text().trim().length == 0) {
        this.isRetryLinkAvailable = false;
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
            self.loadInventory();
            $(btn).hide();
            $(self.backpackElement).html('<div id="LDloading" class="spin-1"></div><div id="LDerr"></div>');
            //$(btn).html("Stop backpack loading");
            self.inventoryIsLoading = true;
        });
        $(element).append(btn);
};