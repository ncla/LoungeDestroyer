var Inventory = function() {
    this.inventoryIsLoading = false; // LD loading it, not site loading it
    this.backpackAjaxURL = null;
    var self = this;
    this.lastElementInBackpack = null; // only used for trade pages
    /*
        Construct for backpack
     */
    if(document.URL.indexOf("/match?m=") != -1 || document.URL.indexOf("/predict") != -1 || document.URL.indexOf("/search") != -1 || document.URL.indexOf("/addtrade") != -1) {
        this.backpackElement = $("#backpack");
    } else if(document.URL.indexOf("/trade?t=") != -1) {
        this.backpackElement = $("#offer");
        this.lastElementInBackpack = $(self.backpackElement).children().last();
    } else {
        this.backpackElement = false;
    }
};
/*
    Goes into a loop and stops when the response is acceptable
 */
Inventory.prototype.loadInventory = function() {
    var self = this;
    var theURL = self.backpackAjaxURL;

    this.ajaxRequest = $.ajax({
        url: theURL,
        success: function(data) {
            if($(data).text().indexOf("Can't get items.") == -1 && data.length != 0) {
                if(document.URL.indexOf("/trade?t=") != -1) {
                    self.removeBackpackElements();
                    self.addElementsToBackpack(data);
                } else {
                    /*
                     Ok, before you ask questions, jQuery's html() method doesn't execute scripts inside script tags
                     from HTML string, but this dirty workaround works. If you know less dirtier solution, go ahead and fix it.
                     */
                    var hax = document.getElementById($(self.backpackElement).attr("id"));
                    hax.innerHTML = null;
                    hax.innerHTML = data;
                }
                self.inventoryIsLoading = false;
            }
            else {
                document.getElementById("LDerr").innerHTML = $(data).text();
                self.loadInventory();
            }
        },
        error: function (xhr, text_status, error_thrown) {
            if (text_status != "abort") {
                setTimeout(function() {
                    self.loadInventory();
                }, 5000);
            }
        }
    });
};
/*
    Performance friendly version of loading market prices on huge backpacks
    @param onlyForBackpack true or false, either load market prices for the backpack or the whole page
 */
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
    Used for caching betting inventories
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
/*
    @param type The name of the inventory we are caching
    @param callback Callback function, first parameter used for passing HTML string
 */
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
/*
    Stops loading inventory and aborts current AJAX request
 */
Inventory.prototype.stopLoadingInventory = function() {
    if(this.inventoryIsLoading) {
        this.ajaxRequest.abort();
        this.inventoryIsLoading = false;
    }
};
/*
    Gets called every time the inventory has loaded (except sometimes manually fired on match page)
    @param url AJAX request URL, necessary for loading inventory through this extension
 */
Inventory.prototype.onInventoryLoaded = function(url) {
    if(!this.backpackElement || this.inventoryIsLoading) {
        return false;
    }
    console.log("onInventoryLoaded has been fired");
    this.backpackAjaxURL = url;

    var whereToLookAt = $("#backpack");
    /*
        Special care for trade page backpacks, since backpack is appended and not replaced on trade page,
        we have to wrap all elements and then check against that
     */
    if(document.URL.indexOf("/trade?t=") != -1) {
        whereToLookAt = $(this.lastElementInBackpack).nextAll();
        var testFake = $("<div/>");
        $(whereToLookAt).each(function(i, v) {
            var theClone = $(v).clone();
            $(testFake).append(theClone);
        });

        whereToLookAt = testFake;
    }

    if($(whereToLookAt).text().indexOf("Can't get items.") != -1) {
        console.log("Failure to get items!");
        this.addInventoryLoadButton(this.backpackElement);
    } else if($(whereToLookAt).text().trim().length == 0) {
        console.log("Empty response!");
        this.addInventoryLoadButton(this.backpackElement);
    } else {
        console.log("Assuming the backpack has loaded!");
        $("#loading", this.backpackElement).hide();
        if(document.URL.indexOf("/match?m=") != -1) {
            // At the moment caching only betting inventories
            if($(".bpheader", self.backpackElement).text().indexOf("CS:GO Inventory") != -1 || $(".bpheader .title", self.backpackElement).text().indexOf("Armory") != -1) {
                this.cacheInventory("bettingInventory" + appID + "_" + readCookie("id"), $("#backpack").html());
            }
            addInventoryStatistics();
        }
        this.getMarketPrices(true);
        this.determineBackpackType();
    }
};
Inventory.prototype.determineBackpackType = function() {
    var isInventory = ($(".bpheader", self.backpackElement).text().indexOf("CS:GO Inventory") != -1 || $(".bpheader .title", self.backpackElement).text().indexOf("Armory") != -1);
    var isReturns = ($(".bpheader", self.backpackElement).text().indexOf("Returns") != -1);
    if(isReturns) {
        this.bettingInventoryType = "returns";
    } else if(isInventory) {
        this.bettingInventoryType = "inventory";
    } else {
        this.bettingInventoryType = -1;
    }
    return this.bettingInventoryType;
};
/*
    Adds LD `load inventory` button
 */
Inventory.prototype.addInventoryLoadButton = function(element) {
    var self = this;
        var btn = $('<a class="button">Initiate backpack loading</a>');
        $(btn).click(function() {
            self.loadInventory();
            $(btn).hide();

            var invLoadingHtml = '<div class="inventory-loading-wrapper"><div id="LDloading" class="spin-1"></div><div id="LDerr"></div><div><a class="button" id="stopLD">Stop loading inventory</a></div></div>';
            self.removeBackpackElements();
            self.addElementsToBackpack(invLoadingHtml);

            $("#stopLD").click(function() {
                self.stopLoadingInventory();
                self.removeBackpackElements();
            });
            self.inventoryIsLoading = true;
        });
        $(element).append(btn);
};
/*
    Adds elements to backpack element
 */
Inventory.prototype.addElementsToBackpack = function(elements) {
    if(document.URL.indexOf("/trade?t=") != -1) {
        $(this.backpackElement).append(elements);
    } else {
        $(this.backpackElement).html(elements);
    }
};
/*
    Clears elements added by LoungeDestroyer and also clears backpack errors
 */
Inventory.prototype.removeBackpackElements = function() {
    if(document.URL.indexOf("/trade?t=") != -1) {
        $("#loading", self.backpackElement).nextAll().remove();
    } else {
        $(this.backpackElement).html('');
    }
};
/*
 Originally created by /u/ekim43, code cleaned up by us
 */
function addInventoryStatistics() {
    var total = 0,
        itemValues = {},
        betSizes = {};
    $("#backpack .item").each(function () {
        var rarity = $(this).children("div.rarity")[0].classList[1],
            e = $(this).children("div.value")[0].innerHTML;
        var itemPrice = parseFloat(e.replace("$ ", ""));
        rarity = (rarity === undefined ? "base" : rarity.toLowerCase());
        if(itemValues.hasOwnProperty(rarity)) {
            itemValues[rarity] = itemValues[rarity] + itemPrice;
        } else {
            itemValues[rarity] = itemPrice;
        }
        total += itemPrice;
    });
    for (var key in itemValues) {
        if (itemValues.hasOwnProperty(key)) {
            itemValues[key] = itemValues[key].toFixed(2);
        }
    }
    betSizes.small = (.05 * total).toFixed(2);
    betSizes.medium = (.1 * total).toFixed(2);
    betSizes.large = (.2 * total).toFixed(2);
    if(total > 0) {
        $("#backpack").prepend('<div class="inventoryStatisticsBox">' +
            '<div id="totalInvValue">Your items are worth: <span>' + total.toFixed(2) + '</span></div>' +
            '<div id="rarityValuesWrapper"><div id="rarityValues"></div></div>' +
            '<div id="betSizeValues">' +
            '<span>Small bet: ' + betSizes.small + '</span>' +
            '<span>Medium bet: ' + betSizes.medium + '</span>' +
            '<span>Large bet: ' + betSizes.large + '</span>' +
            '</div>' +
            '</div>');
        $.each(itemValues, function(i, v) {
            $("#rarityValues").append('<div class="rarityContainer"><div><span class="' + i + '">' + capitaliseFirstLetter(i) + '</span>: ' + v + '</div></div>');
        });
    }
}