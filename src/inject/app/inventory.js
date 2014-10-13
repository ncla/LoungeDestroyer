var Inventory = function() {
    this.inventoryIsLoading = false; // LD loading it, not site loading it
    this.backpackAjaxURL = null;
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
        this.backpackElement = $("#offer");
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
                if(document.URL.indexOf("/trade?t=") != -1) {
                    $("#loading", self.backpackElement).nextAll().remove();
                    $(self.backpackElement).append(data);
                } else {
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
        error: function() {
            setTimeout(function() {
                self.loadInventory();
            }, 5000);
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
    console.log("onInventoryLoaded fired");
    this.backpackAjaxURL = url;
    var whereToLookAt;
    if(document.URL.indexOf("/trade?t=") != -1) {
        whereToLookAt = $("#loading", this.backpackElement).nextAll();

        var testFake = $("<div/>");
        $(whereToLookAt).each(function(i, v) {
            var theClone = $(v).clone();
            $(testFake).append(theClone);
        });

        whereToLookAt = testFake;

    } else {
        whereToLookAt = $("#backpack");
    }

    if($(whereToLookAt).text().indexOf("Can't get items.") != -1) {
        console.log("Failure to get items!");
        this.addInventoryLoadButton(this.backpackElement);
    } else if($(whereToLookAt).text().trim().length == 0) {
        console.log("Empty response!");
        this.addInventoryLoadButton(this.backpackElement);
    } else {
        console.log("Assuming the backpack has loaded!");
        $("#loading", whereToLookAt).hide();
        if(document.URL.indexOf("/match?m=") != -1) {
            // At the moment caching only betting inventories
            if($(".bpheader", self.backpackElement).text().indexOf("CS:GO Inventory") != -1 || $(".bpheader .title", self.backpackElement).text().indexOf("Armory") != -1) {
                this.cacheInventory("bettingInventory" + appID + "_" + readCookie("id"), $("#backpack").html());
            }
            if(appID == 730) {
                addInventoryStatistics();
            }
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
            if(document.URL.indexOf("/trade?t=") != -1) {
                $("#loading", self.backpackElement).nextAll().remove();
                $(self.backpackElement).append(invLoadingHtml);
            } else {
                $(self.backpackElement).html(invLoadingHtml);
            }
            $("#stopLD").click(function() {
                self.stopLoadingInventory();
                if(document.URL.indexOf("/trade?t=") != -1) {
                    $("#loading", self.backpackElement).nextAll().remove();
                } else {
                    $(self.backpackElement).html('');
                }
            });
            self.inventoryIsLoading = true;
        });
        $(element).append(btn);
};
/*
 Originally created by /u/ekim43, code cleaned up by us
 */
function addInventoryStatistics() {
    var total = 0,
        itemValues = {
            covert: 0,
            classified: 0,
            restricted: 0,
            milspec: 0,
            consumer: 0,
            industrial: 0,
            other: 0
        },
        betSizes = {};
    $("#backpack > .item").each(function () {
        var t = $(this).children("div.rarity")[0].classList[1],
            e = $(this).children("div.value")[0].innerHTML;
        switch (e = parseFloat(e.replace("$ ", "")), total += e, t) {
            case "Covert":
                itemValues.covert += e;
                break;
            case "Classified":
                itemValues.classified += e;
                break;
            case "Restricted":
                itemValues.restricted += e;
                break;
            case "Mil-Spec":
                itemValues.milspec += e;
                break;
            case "Consumer":
                itemValues.consumer += e;
                break;
            case "Industrial":
                itemValues.industrial += e;
                break;
            default:
                itemValues.other += e
        }
    });
    for (var key in itemValues) {
        if (itemValues.hasOwnProperty(key)) {
            itemValues[key] = itemValues[key].toFixed(2);
        }
    }
    betSizes.small = (.05 * total).toFixed(2);
    betSizes.medium = (.1 * total).toFixed(2);
    betSizes.large = (.2 * total).toFixed(2);
    $(".bpheader").prepend("<div class='winsorloses' style='padding: 10px;width:95%;'>" +
        "<table align=center>" +
        "<tr><td>Your items are worth: <strong>" + total.toFixed(2) + "</strong></td></tr></table>" +
        "<table align=center id='itemValuesTable'>" +
        "<tr><td><span class='covert'>Covert</span>: " + itemValues.covert + "</td>" +
        "<td><span class='industrial'>Industrial</span>: " + itemValues.industrial + "</td></tr>" +
        "<tr><td><span class='classified'>Classified</span>: " + itemValues.classified + "</td>" +
        "<td><span class='consumer'>Consumer</span>: " + itemValues.consumer + "</td></tr>" +
        "<tr><td><span class='restricted'>Restricted</span>: " + itemValues.restricted + "</td>" +
        "<td><span>Other</span>: " + itemValues.other + "</td></tr>" +
        "<td colspan=2><span class='milspec'>Mil-Spec</span>: " + itemValues.milspec + "</td></tr></table>" +
        "<table id='betSize' align=center>" +
        "<tr><td>Small bet: " + betSizes.small + "</td>" +
        "<td>Medium Bet: " + betSizes.medium + "</td>" +
        "<td>Large Bet: " + betSizes.large + "</td></tr></table></div>");
}