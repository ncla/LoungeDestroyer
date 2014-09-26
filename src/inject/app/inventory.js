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
    if(this.backpackAjaxURL.indexOf("Backpack") != -1) {
        theURL = (Math.random() < 0.5 ? theURL.replace("BackpackApi", "Backpack"): theURL);
    }

    this.ajaxRequest = $.ajax({
        url: theURL,
        success: function(data) {
            if($(data).text().indexOf("Can't get items.") == -1 && data.length != 0) {
                /*
                    Ok, before you ask questions, jQuery's html() method doesn't execute scripts inside script tags
                    from HTML string, but this dirty workaround works. If you know less dirtier solution, go ahead and fix it.
                 */
                var hax = document.getElementById($(self.backpackElement).attr("id"));
                hax.innerHTML = null;
                hax.innerHTML = data;

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
    if(this.inventoryIsLoading) {
        this.ajaxRequest.abort();
        this.inventoryIsLoading = false;
    }
};
Inventory.prototype.onInventoryLoaded = function(url) {
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
        if(document.URL.indexOf("/match?m=") != -1) {
            // At the moment caching only betting inventories
            if($(".bpheader", self.backpackElement).text().indexOf("CS:GO Inventory") != -1 || $(".bpheader .title", self.backpackElement).text().indexOf("Armory") != -1) {
                this.cacheInventory("bettingInventory" + appID + "_" + readCookie("id"), $("#backpack").html());
            }
            if(appID == 730) {
                epicStuff();
            }
        }
        if(document.URL.indexOf("/trade?t=") != -1) {
            $("#fakeBackpack .left").show();
            $("#loading").hide();
        }
        this.getMarketPrices(true);
    }
};
Inventory.prototype.addInventoryLoadButton = function(element) {
    var self = this;
        var btn = $('<a class="button">Initiate backpack loading</a>');
        $(btn).click(function() {
            self.loadInventory();
            $(btn).hide();
            $(self.backpackElement).html('<div class="inventory-loading-wrapper"><div id="LDloading" class="spin-1"></div><div id="LDerr"></div><div><a class="button" id="stopLD">Stop loading inventory</a></div></div>');
            $("#stopLD").click(function() {
                self.stopLoadingInventory();
                $(self.backpackElement).html('');
            });
            self.inventoryIsLoading = true;
        });
        $(element).append(btn);
};