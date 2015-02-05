var backpackAjaxURLs = ['tradeBackpack', 'betBackpack'];

var Inventory = function() {
    this.inventoryIsLoading = false; // Extension loading the inventory, not the site
    this.backpackAjaxURL = null; // newest inventory AJAX request URL
    this.lastElementInBackpack = null; // this property is only used on individual trade pages
};
/**
 * Determining where the backpack element is located in DOM
 */
Inventory.prototype.determineBackpackElement = function() {
    if(document.URL.indexOf("/match?m=") != -1 || document.URL.indexOf("/predict") != -1 || document.URL.indexOf("/search") != -1 || document.URL.indexOf("/addtrade") != -1) {
        this.backpackElement = $("#backpack");
    } else if(document.URL.indexOf("/trade?t=") != -1) {
        this.backpackElement = $("#offer");
        this.lastElementInBackpack = $(self.backpackElement).children().last();
    } else {
        this.backpackElement = false;
    }
    return this.backpackElement
};

/*
    Goes into a loop and stops when the response is acceptable
 */
Inventory.prototype.loadInventory = function() {
    var self = this;

    // We get rid of the .php extension, the AJAX requests work anyway without it
    self.backpackAjaxURL = self.backpackAjaxURL.replace('.php', '');

    // This will be default URL if none of the conditions below are met
    var theURL = self.backpackAjaxURL;

    // Don't bother with force refresh requests
    if(self.backpackAjaxURL.indexOf('?refresh=1') == -1) {
        // There are two APIs for inventory loading, we want to switch back and forth between two of them
        // By adding and remove Api at the end of AJAX request URL
        if(self.backpackAjaxURL.indexOf('Api') != -1) {
            theURL = self.backpackAjaxURL.replace('Api', '');
        } else {
            // Loop through all the Lounge requests that support 'Api' at the end of request
            $.each(backpackAjaxURLs, function(i, v) {
                if(self.backpackAjaxURL.indexOf(v) != -1) {
                    theURL = self.backpackAjaxURL + 'Api';
                    return false;
                }
            });
        }
    }

    console.log("Loading inventory with URL " , theURL);

    self.backpackAjaxURL = theURL;

    // Send AJAX request, necessary to be set as a property because user may need to abort the request
    this.ajaxRequest = $.ajax({
        url: theURL,
        success: function(data) {
            // All inventory requests usually throw this string if the backpack loading was successful, or return nothing at all
            if($(data).text().indexOf("Can't get items.") == -1 && data.length != 0) {
                // Backpack behavior is a bit different on individual trade pages
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
                // Show the received error to the user and continue loading the inventory
                document.getElementById("LDerr").innerHTML = $(data).text();
                setTimeout(function() {
                    self.loadInventory();
                }, 1000);
            }
        },
        error: function (xhr, text_status, error_thrown) {
            // If the request error status is not 'abort', continue loading inventory
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
Inventory.prototype.getMarketPrices = function() {
    getMarketPricesForElementList($("#backpack .oitm:not(.marketPriced)"));
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
    // Determining where the backpack is
    this.determineBackpackElement();
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
        this.determineBackpackType();
        $("#loading", this.backpackElement).hide();
        if(document.URL.indexOf("/match?m=") != -1) {
            // We only need to cache the betting inventories
            if(this.bettingInventoryType == "inventory") {
                this.cacheInventory("bettingInventory" + appID + "_" + readCookie("id"), $("#backpack").html());
            }
            addInventoryStatistics();
            this.group();
        }
        if(LoungeUser.userSettings["itemMarketPricesv2"] == "2") {
            this.getMarketPrices(true);
        }
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
    var self = this,
        btn = $('<a class="button">Initiate backpack loading</a>');

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
    // Again special care for individual tradep ages
    if(document.URL.indexOf("/trade?t=") != -1) {
        $(this.backpackElement).append(elements);
    } else {
        $(this.backpackElement).html(elements);
    }
};

/*
    Groupify inventory
 */
Inventory.prototype.group = function() {
    if (this.grouped || this.inventoryIsLoading || LoungeUser.userSettings.groupInventory !== "1") {
        return;
    }
    this.grouped = true;
    this.groups = LoungeUser.userSettings.itemGroups[appID];
    this.itemToGroup = {},
    this.groupElms = {},
    this.sortedGroups = [];

    var bp = $(this.backpackElement.selector),
        defaultGroup = document.createElement("div"),
        mainWrapper = document.createElement("div"),
        self = this;

    if (!bp) {
        return;
    }

    this.groupElms["default"] = defaultGroup;
    defaultGroup.className = "ld-item-group";
    mainWrapper.className = "ld-item-groups-main-wrapper";
    bp.append(defaultGroup);
    bp.append(mainWrapper);

    // setup itemToGroup/groupElms variables and create group elements
    $.each(this.groups,function(groupName, group){
        $(group.items).each(function(i, name){
            self.itemToGroup[name] = groupName;
        });

        self.createGroupElm(groupName);
    });

    // sort groups in order of priority
    this.sortedGroups.sort(function(a,b){
        return a.priority - b.priority || 0;
    });

    // add groups to DOM
    $.each(this.sortedGroups, function(ind, groupObj) {
        if (groupObj.elm) {
            mainWrapper.appendChild(groupObj.elm);
        }
    });

    this.sortItems();


    // create user interface for groups
    var addGroupWrapper = $("<div></div>").
                            addClass("ld-add-item-group-wrapper").
                            html("<input class='ld-add-item-group-name selectbox' type='text' placeholder='Group name'><a class='button ld-add-item-group-btn'>Add item group</a>");
    bp.append(addGroupWrapper);

    addGroupWrapper.find("a.ld-add-item-group-btn").click(function(){
        var title = addGroupWrapper.find(".ld-add-item-group-name").val(),
            name = "item-group-",
            i = 0;

        if (!title) {
            alert("Group has to have a name");
            return;
        }

        while (self.groups.hasOwnProperty(name+i)) {
            ++i;
        }
        name += i;

        var group = {
            items: [],
            priority: 99,
            title: title
        };
        self.groups[name] = group;
        mainWrapper.appendChild(self.createGroupElm(name));
        self.makeItemsSortable();
        self.saveGroups();
    });

    self.makeItemsSortable();

    // make groups sortable between each-other
    $(mainWrapper).sortable({
        scroll: false,
        handle: ".ld-item-group-header",
        axis: "y"
    }).on("sortupdate", function(e,jqElm){
        var name = jqElm.item[0].getAttribute("data-group-name"),
            ind = jqElm.item.index(),
            elm = jqElm.item[0],
            prevInd;

        // get the previous index
        $.each(self.sortedGroups, function(ind,obj){
            if (name === obj.name) {
                prevInd = ind;
            }
        });

        if (!name || prevInd==undefined) {
            return;
        }

        // move group in sortedGroups to its new index
        self.sortedGroups.splice(ind,0,self.sortedGroups.splice(prevInd,1)[0]);
        
        self.saveGroups();
    });


    // catch items being added back to backpack
    var bpObserver = new MutationObserver(function(records){
        for (var i = 0, j = records.length; i < j; ++i) {
            // stop self from messing shit up by disabling self when inv is unloaded
            if (records[i].removedNodes && records[i].removedNodes.length > 1) {
                var removed = records[i].removedNodes;
                for (var k = 0, l = removed.length; k < l; ++k) {
                    if (removed[k].classList.contains("full") || removed[k].id === "trash") {
                        self.grouped = false;
                        bpObserver.disconnect();
                        bpObserver = null;
                        return;
                    }
                }
            }
            if (records[i].addedNodes && records[i].addedNodes.length) {
                var added = records[i].addedNodes;
                for (var k = 0, l = added.length; k < l; ++k) {
                    // if an item has been added to backpack, place it in its group
                    if (added[k].classList && added[k].classList.contains("oitm")) {
                        self.sortItems();
                        return;
                    }
                }
            }
        }
    });
    bpObserver.observe(bp[0], {childList: true});
}
/*
    Sort items into groups, if inventory is grouped
 */
Inventory.prototype.sortItems = function(){
    if (!this.grouped || this.inventoryIsLoading) {
        return;
    }

    var self = this;

    $(this.backpackElement.selector+" .oitm").each(function(ind, elm){
        var name = elm.querySelector(".name > b");
        if (!name) {
            return;
        }
        name = name.textContent;
        var group = self.itemToGroup[name] || "default";
        
        self.groupElms[group].appendChild(elm);
    });
};
/*
    Save groups in the order they are currently in
 */
Inventory.prototype.saveGroups = function(){
    if (!this.grouped || this.inventoryIsLoading) {
        return;
    }

    var self = this,
        fullGroups = LoungeUser.userSettings.itemGroups;

    $.each(this.sortedGroups, function(ind,obj){
        var name = obj.name;
        if (!name || !self.groups[name]) {
            return;
        }

        self.groups[name].priority = ind;
    });

    fullGroups[appID] = this.groups;

    console.log("Saving groups: ",fullGroups);

    LoungeUser.saveSetting("itemGroups", fullGroups);
};
/*
    Create group element - group must have data in LoungeUser.userSettings.itemGroups
 */
Inventory.prototype.createGroupElm = function(groupName) {
    var group = this.groups[groupName],
        wrapper = document.createElement("div"),
        elm = document.createElement("div"),
        header = document.createElement("div"),
        self = this;

    $(elm).addClass("ld-item-group")
        .attr("data-group-name",groupName);
    $(header).addClass("bpheader ld-item-group-header")
        .html("<div style='float: left;color: #999;'>"+group.title+"</div><a class='ld-item-group-delete' style='float: right'>x</a>");
    $(wrapper).addClass("ld-item-group-wrapper")
        .attr("data-group-name",groupName)
        .append(header,elm);

    this.groupElms[groupName] = elm;
    this.sortedGroups.push({name: groupName, priority: group.priority, elm: wrapper});

    this.groupElms[groupName] = elm;

    header.querySelector(".ld-item-group-delete").addEventListener("click", function(){
        var groupElm = this.parentNode.parentNode,
            groupName = groupElm.getAttribute("data-group-name");

        if (!groupName || !self.groups.hasOwnProperty(groupName)) {
            return;
        }

        // remove from sortedGroups
        $.each(self.sortedGroups, function(ind, obj){
            if (obj.name === groupName) {
                self.sortedGroups.splice(ind, 1);
            }
        });

        // move items to default
        $.each(self.groups[groupName].items, function(ind,name){
            delete self.itemToGroup[name];
        });

        // remove from groups
        delete self.groups[groupName];

        self.sortItems();
        groupElm.parentNode.removeChild(groupElm);
        self.saveGroups();
    });

    return wrapper;
};
/*
    Make items sortable between themselves and groups
 */
Inventory.prototype.makeItemsSortable = function(){
    if (!this.grouped || this.inventoryIsLoading) {
        return;
    }

    var self = this;
    $(".ld-item-group").sortable({
        connectWith: ".ld-item-group",
        scroll: false,
        distance: 10
    }).on("sortreceive", function(e,jqElm){
        var name = $(".name > b", jqElm.item).text(),
            groupName = jqElm.sender[0].getAttribute("data-group-name"),
            thisGroupName = this.getAttribute("data-group-name");

        if (!name) {
            return;
        }

        // if we moved it from an existing group (and not default)
        if (groupName) {
            self.groups[groupName].items.splice(self.groups[groupName].items.indexOf(name),1);
        }
        // if we moved it to an existing group (and not default)
        if (thisGroupName) {
            if (self.groups[thisGroupName].items.indexOf(name) === -1) {
                self.groups[thisGroupName].items.push(name);
            }
            self.itemToGroup[name] = thisGroupName;
        } else {
            delete self.itemToGroup[name];
        }

        var fullGroups = LoungeUser.userSettings.itemGroups;
        fullGroups[appID] = self.groups;

        LoungeUser.saveSetting("itemGroups", fullGroups);
    });
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
        betSizes = {},
        itemQualities = {
            730: ['exotic', 'remarkable', 'contraband', 'high', 'base', 'covert', 'classified', 'restricted', 'industrial', 'mil-spec', 'consumer', 'base'],
            570: ['arcana', 'immortal', 'legendary', 'mythical', 'rare', 'uncommon', 'common', 'base']
        };

    $("#backpack .item").each(function () {
        // Lounge provides item rarities in the classnames
        var rarity = $(this).children("div.rarity")[0].classList[1],
            e = $(this).children("div.value")[0].innerHTML;
        var itemPrice = parseFloat(e.replace("$ ", ""));
        rarity = (rarity === undefined ? "base" : rarity.toLowerCase());
        // If there is already a rarity index set, if not just add up the numbers for that rarity
        if(itemValues.hasOwnProperty(rarity)) {
            itemValues[rarity] = itemValues[rarity] + itemPrice;
        } else {
            itemValues[rarity] = itemPrice;
        }
        total += itemPrice;
    });

    var itemValuesTemp = {};
    // Derp solution for sorting by highest rarities
    $.each(itemQualities[appID], function(i, v) {
        if(itemValues.hasOwnProperty(v)) {
            itemValuesTemp[v] = itemValues[v]
        }
    });
    var itemValues = itemValuesTemp;

    if(total > 0) {
        $("#backpack").prepend('<div class="inventoryStatisticsBox">' +
            '<div id="totalInvValue">Your items are worth: <span>' + total.toFixed(2) + '</span></div>' +
            '<div id="rarityValuesWrapper"><div id="rarityValues"></div></div>' +
            '<div id="betSizeValues">' +
            '<span>Small bet: ' + (.05 * total).toFixed(2) + '</span>' +
            '<span>Medium bet: ' + (.1 * total).toFixed(2) + '</span>' +
            '<span>Large bet: ' + (.2 * total).toFixed(2) + '</span>' +
            '</div>' +
            '</div>');
        $.each(itemValues, function(i, v) {
            $("#rarityValues").append('<div class="rarityContainer"><div><span class="' + i + '">' + capitaliseFirstLetter(i) + '</span>: ' + v.toFixed(2) + '</div></div>');
        });
    }
}