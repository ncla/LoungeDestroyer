var backpackAjaxURLs = ['tradeBackpack', 'betBackpack'];

var Inventory = function() {
    // Extension loading the inventory, not the site
    this.inventoryIsLoading = false;

    // newest inventory AJAX request URL
    this.backpackAjaxURL = null;

    // this property is only used on individual trade pages
    this.lastElementInBackpack = null;
};
/**
 * Determining where the backpack element is located in DOM
 */
Inventory.prototype.determineBackpackElement = function() {
    if (document.URL.indexOf('/match?m=') != -1 || document.URL.indexOf('/predict') != -1 ||
        document.URL.indexOf('/search') != -1 || document.URL.indexOf('/addtrade') != -1) {
        this.backpackElement = $('#backpack');
    } else if (document.URL.indexOf('/trade?t=') != -1) {
        this.backpackElement = $('#offer');
        this.lastElementInBackpack = $(self.backpackElement).children().last();
    } else if ($('#backpack').length) {
        this.backpackElement = $('#backpack');
    } else {
        this.backpackElement = false;
    }

    return this.backpackElement
};

/*
    Goes into a loop and stops when the response is acceptable
 */
Inventory.prototype.loadInventory = function() {
    var _this = this;

    // We get rid of the .php extension, the AJAX requests work anyway without it
    _this.backpackAjaxData.url = _this.backpackAjaxData.url.replace('.php', '');

    // This will be default URL if none of the conditions below are met
    var theURL = _this.backpackAjaxData.url;

    // Don't bother with force refresh requests
    if (_this.backpackAjaxData.url.indexOf('?refresh=1') == -1) {
        // There are two APIs for inventory loading, we want to switch back and forth between two of them
        // By adding and remove Api at the end of AJAX request URL
        if (_this.backpackAjaxData.url.indexOf('Api') != -1) {
            theURL = _this.backpackAjaxData.url.replace('Api', '');
        } else {
            // Loop through all the Lounge requests that support 'Api' at the end of request
            $.each(backpackAjaxURLs, function(i, v) {
                if (_this.backpackAjaxData.url.indexOf(v) != -1) {
                    theURL = _this.backpackAjaxData.url + 'Api';
                    return false;
                }
            });
        }
    }

    console.log('Loading inventory with URL ', theURL);

    _this.backpackAjaxData.url = theURL;

    // Send AJAX request, necessary to be set as a property because user may need to abort the request
    var ajaxDetails = {
        url: theURL,
        type: _this.backpackAjaxData.method,
        success: function(data) {
            // All inventory requests usually throw this string if the backpack loading was successful, or return nothing at all
            if ($(data).text().indexOf('Can\'t get items.') == -1 && data.length != 0) {
                // Backpack behavior is a bit different on individual trade pages
                if (document.URL.indexOf('/trade?t=') != -1) {
                    _this.removeBackpackElements();
                    _this.addElementsToBackpack(data);
                } else {
                    /*
                     Ok, before you ask questions, jQuery's html() method doesn't execute scripts inside script tags
                     from HTML string, but this dirty workaround works. If you know less dirtier solution, go ahead and fix it.
                     */
                    var hax = document.getElementById($(_this.backpackElement).attr('id'));
                    hax.innerHTML = null;
                    hax.innerHTML = data;
                }

                _this.inventoryIsLoading = false;
            } else {
                // Show the received error to the user and continue loading the inventory
                document.getElementById('LDerr').innerHTML = $(data).text();
                setTimeout(function() {
                    _this.loadInventory();
                }, (1000 + Math.random() * 2000 - 500));
            }
        },

        error: function(xhr, textStatus) {
            // If the request error status is not 'abort', continue loading inventory
            if (textStatus != 'abort') {
                setTimeout(function() {
                    _this.loadInventory();
                }, 5000);
            }
        }
    };

    // Add post data if necessary
    if (_this.backpackAjaxData.method === 'POST' && _this.backpackAjaxData.data !== null) {
        ajaxDetails.data = _this.backpackAjaxData.data;
    }

    this.ajaxRequest = $.ajax(ajaxDetails);
};

/*
    Performance friendly version of loading market prices on huge backpacks
    @param onlyForBackpack true or false, either load market prices for the backpack or the whole page
 */
Inventory.prototype.getMarketPrices = function() {
    // TODO: PHPStorm keeps screaming about ineffiecient jQuery selector usage :(
    initiateItemObjectForElementList($('#backpack .oitm:not(.marketPriced)'));
    //getMarketPricesForElementList($('#backpack .oitm:not(.marketPriced)'));
};

/*
    Used for caching betting inventories
    @param type This is backpack cache identifier, usually it is combination of profileID and inventory type
    @param backpackHTML Backpack's HTML code
 */
Inventory.prototype.cacheInventory = function(type, backpackHTML) {
    console.log('Caching inventory ' + type);
    var storeBp = {};
    storeBp[type] = {
        html: backpackHTML,
        timestamp: new Date().toLocaleString()
    };
    chrome.storage.local.set(storeBp);
};
/*
    Gets cached inventory
     @param type The identifier
     @param callback Callback function, first parameter used for passing HTML string which will be appended to #backpack
 */
Inventory.prototype.getCachedInventory = function(type, callback) {
    if (!(this instanceof Inventory)) {
        throw new TypeError('\'this\' must be instance of Inventory');
    }

    chrome.storage.local.get(type, function(result) {
        if (jQuery.isEmptyObject(result)) {
            console.log('Cached inventory is empty!');
            callback('<div style="text-align: center;"><small>Inventory has not been cached yet, inventory will automatically cache itself when inventory successfully loads.</small></div>');
        }
        else {
            callback(result[type].html);
        }
    });
};
/*
    Stops loading inventory and aborts current AJAX request
 */
Inventory.prototype.stopLoadingInventory = function() {
    if (this.inventoryIsLoading) {
        this.ajaxRequest.abort();
        this.inventoryIsLoading = false;
    }
};
/*
    Gets called every time the inventory has loaded (except sometimes manually fired on match page)
    @param url AJAX request URL, necessary for loading inventory through this extension
 */
Inventory.prototype.onInventoryLoaded = function(requestData) {
    // Determining where the backpack is
    this.determineBackpackElement();
    if (!this.backpackElement || this.inventoryIsLoading) {
        return false;
    }

    console.log('onInventoryLoaded has been fired');
    this.backpackAjaxData = requestData;

    var whereToLookAt = $('#backpack');
    /*
        Special care for trade page backpacks, since backpack is appended and not replaced on trade page,
        we have to wrap all elements and then check against that
     */
    if (document.URL.indexOf('/trade?t=') != -1) {
        whereToLookAt = $(this.lastElementInBackpack).nextAll();
        var testFake = $('<div/>');
        $(whereToLookAt).each(function(i, v) {
            var theClone = $(v).clone();
            $(testFake).append(theClone);
        });

        whereToLookAt = testFake;
    }

    if ($(whereToLookAt).text().indexOf('Can\'t get items.') !== -1) {
        console.log('Failure to get items!');
        this.addInventoryLoadButton(this.backpackElement);
    } else if ($(whereToLookAt).text().trim().length === 0) {
        console.log('Empty response!');
        this.addInventoryLoadButton(this.backpackElement);
    } else {
        console.log('Assuming the backpack has loaded!');
        this.determineBackpackType();
        $('#loading', this.backpackElement).hide();
        if (document.URL.indexOf('/match?m=') !== -1) {
            // We only need to cache the betting inventories
            if (this.bettingInventoryType == 'inventory') {
                this.cacheInventory('bettingInventory' + appID + '_' + readCookie('id'), $('#backpack').html());
            }

            this.grouped = false;
            this.group();

            // limit the inventory statistics to the groups the user has chosen
            var statsSetting = LoungeUser.userSettings.inventoryStatisticsGroup[appID];
            if (statsSetting.indexOf('0') === -1) {
                if (LoungeUser.userSettings.groupInventory == '1' && statsSetting.indexOf('1') === -1) {
                    var groups = [];
                    var bp = $('#backpack');

                    for (var i = 0; i < statsSetting.length; ++i) {
                        var elm = document.querySelector('.ld-item-group[data-group-name=\'' + statsSetting[i] + '\']');
                        if (elm) {
                            groups.push(elm);
                        } else {
                            console.error('Could not find a group with id ', statsSetting[i]);
                        }
                    }

                    // if one or more groups are found, add stats for them
                    if (groups.length > 0) {
                        console.log('Adding statistics for ', groups);
                        var names = [];
                        var items;

                        // merge all item groups into jQuery object, and store titles in names
                        for (var i = 0, j = groups.length; i < j; ++i) {
                            var groupTitle = statsSetting[i];
                            var itemGroups = LoungeUser.userSettings.itemGroups[appID];

                            if (itemGroups.hasOwnProperty(statsSetting[i])) {
                                names.push(itemGroups[statsSetting[i]].title);
                            } else if (groupTitle === 'default') {
                                names.push('Default')
                            }

                            if (!items) {
                                items = $(groups[i]);
                            } else {
                                items = items.add(groups[i]);
                            }
                        }

                        addInventoryStatistics(items, bp, names.join('+'));
                    } else {
                        console.log('Adding all statistics');
                        addInventoryStatistics();
                    }
                } else {
                    console.log('Adding statistics to everything #2');
                    addInventoryStatistics();
                }
            }
        }

        initiateItemObjectForElementList($('#backpack .oitm:not(.marketPriced)'));
    }
};

Inventory.prototype.determineBackpackType = function() {
    var isInventory = ($('.bpheader', self.backpackElement).text().indexOf('CS:GO Inventory') != -1 || $('.bpheader .title', self.backpackElement).text().indexOf('Armory') != -1);
    var isReturns = ($('.bpheader', self.backpackElement).text().indexOf('Returns') != -1);
    if (isReturns) {
        this.bettingInventoryType = 'returns';
    } else if (isInventory) {
        this.bettingInventoryType = 'inventory';
    } else {
        this.bettingInventoryType = -1;
    }

    return this.bettingInventoryType;
};
/*
    Adds LD `load inventory` button
    @param element Where to append
 */
Inventory.prototype.addInventoryLoadButton = function(element) {
    var _this = this;
    var btn = $('<a class="button">Initiate backpack loading</a>');

    $(btn).click(function() {
        _this.loadInventory();
        $(btn).hide();

        var invLoadingHtml = '<div class="inventory-loading-wrapper"><div id="LDloading" class="spin-1"></div><div id="LDerr"></div><div><a class="button" id="stopLD">Stop loading inventory</a></div></div>';
        _this.removeBackpackElements();
        _this.addElementsToBackpack(invLoadingHtml);

        $('#stopLD').click(function() {
            _this.stopLoadingInventory();
            _this.removeBackpackElements();
        });

        _this.inventoryIsLoading = true;
    });

    $(element).append(btn);
};
/*
    Adds elements to backpack element
 */
Inventory.prototype.addElementsToBackpack = function(elements) {
    // Again special care for individual tradep ages
    if (document.URL.indexOf('/trade?t=') !== -1) {
        $(this.backpackElement).append(elements);
    } else {
        $(this.backpackElement).html(elements);
    }
};

/*
    Groupify inventory
 */
Inventory.prototype.group = function() {
    if (this.grouped || this.inventoryIsLoading || LoungeUser.userSettings.groupInventory !== '1') {
        return;
    }

    this.grouped = true;
    this.groups = LoungeUser.userSettings.itemGroups[appID];

    // {"name": ["group-1","group-2"], ...}
    this.itemToGroup = {};

    // {"group-1": <elm>, ...}
    this.groupElms = {};

    // ["group-1", "group-2", ...]
    this.sortedGroups = [];

    var bp = $(this.backpackElement.selector);
    var defaultGroup = document.createElement('div');
    var mainWrapper = document.createElement('div');
    var _this = this;

    if (!bp) {
        return;
    }

    this.groupElms['default'] = defaultGroup;
    defaultGroup.className = 'ld-item-group';
    defaultGroup.setAttribute('data-group-name', 'default');
    mainWrapper.className = 'ld-item-groups-main-wrapper';
    bp.append(defaultGroup);
    bp.append(mainWrapper);

    // setup itemToGroup/groupElms variables and create group elements
    $.each(this.groups, function(groupName, group) {
        $(group.items).each(function(i, name) {
            if (!_this.itemToGroup.hasOwnProperty(name)) {
                _this.itemToGroup[name] = [];
            }

            _this.itemToGroup[name].push(groupName);
        });

        _this.createGroupElm(groupName);
    });

    // sort groups in order of priority
    this.sortedGroups.sort(function(a, b) {
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
    var addGroupWrapper = $('<div></div>').
        addClass('ld-add-item-group-wrapper').
        html('<input class="ld-add-item-group-name selectbox" type="text" placeholder="Group name"><a class="button ld-add-item-group-btn">Add item group</a>');
    bp.append(addGroupWrapper);

    addGroupWrapper.find('a.ld-add-item-group-btn').click(function() {
        var title = addGroupWrapper.find('.ld-add-item-group-name').val();
        var name = 'item-group-';
        var i = 0;

        if (!title) {
            alert('Group has to have a name');
            return;
        }

        while (_this.groups.hasOwnProperty(name + i)) {
            ++i;
        }

        name += i;

        var group = {
            items: [],
            priority: 99,
            title: title
        };
        _this.groups[name] = group;
        mainWrapper.appendChild(_this.createGroupElm(name));
        _this.makeItemsSortable();
        _this.saveGroups();
    });

    _this.makeItemsSortable();

    // make groups sortable between each-other
    $(mainWrapper).sortable({
        scroll: false,
        handle: '.ld-item-group-header',
        axis: 'y'
    }).on('sortupdate', function(e, jqElm) {
        var name = jqElm.item[0].getAttribute('data-group-name');
        var ind = jqElm.item.index();
        var elm = jqElm.item[0];
        var prevInd;

        // get the previous index
        $.each(_this.sortedGroups, function(ind, obj) {
            if (name === obj.name) {
                prevInd = ind;
            }
        });

        if (!name || prevInd == undefined) {
            return;
        }

        // move group in sortedGroups to its new index
        _this.sortedGroups.splice(ind, 0, _this.sortedGroups.splice(prevInd, 1)[0]);

        _this.saveGroups();
    });

    // catch items being added back to backpack
    var bpObserver = new MutationObserver(function(records) {
        for (var i = 0, j = records.length; i < j; ++i) {
            // stop self from messing shit up by disabling self when inv is unloaded
            if (records[i].removedNodes && records[i].removedNodes.length > 1) {
                var removed = records[i].removedNodes;
                for (var k = 0, l = removed.length; k < l; ++k) {
                    if (!removed[k] || !removed[k].classList) {
                        continue;
                    }

                    if (removed[k].classList.contains('full') || removed[k].id === 'trash') {
                        _this.grouped = false;
                        bpObserver.disconnect();
                        bpObserver = null;
                        return;
                    }
                }
            }

            // move added item to the group it belongs to
            if (records[i].addedNodes && records[i].addedNodes.length) {
                var added = records[i].addedNodes;
                for (var k = 0, l = added.length; k < l; ++k) {
                    // if an item has been added to backpack, place it in its group
                    if (added[k].classList && added[k].classList.contains('oitm')) {
                        _this.sortItems();
                        return;
                    }
                }
            }
        }
    });

    bpObserver.observe(bp[0], {childList: true});
};
/*
    Sort items into groups, if inventory is grouped
 */
Inventory.prototype.sortItems = function() {
    if (!this.grouped || this.inventoryIsLoading) {
        return;
    }

    var _this = this;

    $(this.backpackElement.selector + ' .oitm').each(function(ind, elm) {
        // move to default first, for testing for empty room later
        _this.groupElms['default'].appendChild(elm);

        var name = elm.querySelector('.name > b');

        if (!name) {
            return;
        }

        name = name.textContent;

        // loop through groups that contain this item
        for (var i in _this.itemToGroup[name]) {
            var group = _this.itemToGroup[name][i];

            // check if said group has empty space for this
            if (_this.groupElms[group]) {
                var numInGroup = $('.name > b:contains("' + name + '")', _this.groupElms[group]).length;
                var numInArr = 0;
                var ind = -1;

                // count number of times the group is in itemToGroup[name]
                while ((ind = _this.itemToGroup[name].indexOf(group, ind + 1)) !== -1) {
                    ++numInArr;
                }

                // if there's an empty space in the group
                if (numInGroup < numInArr) {
                    _this.groupElms[group].appendChild(elm);
                    break;
                }
            }
        }
    });
};
/*
    Save groups in the order they are currently in
 */
Inventory.prototype.saveGroups = function() {
    if (!this.grouped || this.inventoryIsLoading) {
        return;
    }

    var _this = this;
    var fullGroups = LoungeUser.userSettings.itemGroups;

    $.each(this.sortedGroups, function(ind, obj) {
        var name = obj.name;
        if (!name || !_this.groups[name]) {
            return;
        }

        _this.groups[name].priority = ind;
    });

    fullGroups[appID] = this.groups;

    console.log('Saving groups: ', fullGroups);

    LoungeUser.saveSetting('itemGroups', fullGroups);
};
/*
    Create group element - group must have data in LoungeUser.userSettings.itemGroups
 */
Inventory.prototype.createGroupElm = function(groupName) {
    var group = this.groups[groupName];
    var wrapper = document.createElement('div');
    var elm = document.createElement('div');
    var header = document.createElement('div');
    var _this = this;

    $(elm).addClass('ld-item-group')
        .attr('data-group-name', groupName);
    $(header).addClass('bpheader ld-item-group-header')
        .html('<div style="float: left;color: #999;">' + group.title + '</div><a class="ld-item-group-delete" style="float: right">x</a>');
    $(wrapper).addClass('ld-item-group-wrapper')
        .attr('data-group-name', groupName)
        .append(header, elm);

    this.groupElms[groupName] = elm;
    this.sortedGroups.push({name: groupName, priority: group.priority, elm: wrapper});

    this.groupElms[groupName] = elm;

    header.querySelector('.ld-item-group-delete').addEventListener('click', function() {
        var groupElm = this.parentNode.parentNode;
        var groupName = groupElm.getAttribute('data-group-name');

        if (!groupName || !_this.groups.hasOwnProperty(groupName)) {
            return;
        }

        // remove from sortedGroups
        $.each(_this.sortedGroups, function(ind, obj) {
            if (obj.name === groupName) {
                _this.sortedGroups.splice(ind, 1);
            }
        });

        // move items to default
        $.each(_this.groups[groupName].items, function(ind, name) {
            var i = _this.itemToGroup[name].indexOf(groupName);
            if (i !== -1) {
                _this.itemToGroup[name].splice(i, 1);
            }
        });

        // remove from groups
        delete _this.groups[groupName];

        _this.sortItems();
        groupElm.parentNode.removeChild(groupElm);
        _this.saveGroups();
    });

    return wrapper;
};
/*
    Make items sortable between themselves and groups
 */
Inventory.prototype.makeItemsSortable = function() {
    if (!this.grouped || this.inventoryIsLoading) {
        return;
    }

    var _this = this;
    $('.ld-item-group').sortable({
        connectWith: '.ld-item-group',
        scroll: false,
        distance: 10
    }).on('sortreceive', function(e, jqElm) {
        var name = $('.name > b', jqElm.item).text();
        var groupName = jqElm.sender[0].getAttribute('data-group-name');
        var thisGroupName = this.getAttribute('data-group-name');

        if (!name) {
            return;
        }

        // if we moved it from an existing group (and not default)
        if (groupName !== 'default') {
            var ind = _this.itemToGroup[name].indexOf(groupName);
            var indGroup = _this.groups[groupName].items.indexOf(name);

            if (ind !== -1) {
                _this.itemToGroup[name].splice(ind, 1);
            }

            if (indGroup !== -1) {
                _this.groups[groupName].items.splice(indGroup, 1);
            }
        }

        // if we moved it to an existing group (and not default)
        if (thisGroupName) {
            _this.groups[thisGroupName].items.push(name);
            if (_this.itemToGroup[name]) {
                _this.itemToGroup[name].push(thisGroupName);
            } else {
                _this.itemToGroup[name] = [thisGroupName];
            }
        }

        var fullGroups = LoungeUser.userSettings.itemGroups;
        fullGroups[appID] = _this.groups;

        LoungeUser.saveSetting('itemGroups', fullGroups);
    });
};
/*
    Clears elements added by LoungeDestroyer and also clears backpack errors
 */
Inventory.prototype.removeBackpackElements = function() {
    if (document.URL.indexOf('/trade?t=') != -1) {
        $('#loading', self.backpackElement).nextAll().remove();
    } else {
        $(this.backpackElement).html('');
    }
};
/*
 Originally created by /u/ekim43, code cleaned up by us
 */
function addInventoryStatistics(targetItems, targetBackpack, groupName) {
    if (!targetItems) {
        targetItems = targetBackpack = $('#backpack');
    }

    if (groupName && groupName.length > 18) {
        groupName = groupName.substr(0, 15) + '...';
    }

    var total = 0;
    var itemValues = {};
    var itemQualities = {
        730: ['exotic', 'remarkable', 'contraband', 'high', 'covert', 'classified', 'restricted', 'industrial', 'mil-spec', 'consumer', 'base'],
        570: ['arcana', 'immortal', 'legendary', 'mythical', 'rare', 'uncommon', 'common', 'base']
    };

    $('.item', targetItems).each(function() {
        // Lounge provides item rarities in the classnames
        var rarity = ($('div.rarity', this).attr('class').split(' ')[1] || 'base').toLowerCase();
        var itemValue = parseFloat($('div.value', this).text().replace('$ ', '')) || parseFloat($('input[name="worth"]').val()) || undefined;

        // Make sure we have both rarity and item value
        if (rarity && itemValue) {
            // If there is already a rarity index set, if not just add up the numbers for that rarity
            if (itemValues.hasOwnProperty(rarity)) {
                itemValues[rarity] = itemValues[rarity] + itemValue;
            } else {
                itemValues[rarity] = itemValue;
            }

            total += itemValue;
        }
    });

    var itemValuesTemp = {};

    // Derp solution for sorting by highest rarities
    $.each(itemQualities[appID], function(i, v) {
        if (itemValues.hasOwnProperty(v)) {
            itemValuesTemp[v] = itemValues[v]
        }
    });

    var itemValues = itemValuesTemp;
    var groupString = groupName ? 'in <span class="stats-group-names">' + groupName + '</span> ' : '';

    if (total > 0) {
        $(targetBackpack).prepend('<div class="inventoryStatisticsBox">' +
            '<div id="totalInvValue">Your items ' + groupString + 'are worth: <span>' + convertPrice(total, true) + '</span></div>' +
            '<div id="rarityValuesWrapper"><div id="rarityValues"></div></div>' +
            '<div id="betSizeValues">' +
            '<span>Small bet: ' + convertPrice(((LoungeUser.userSettings.smallBetPercentage / 100) * total), true) + '</span>' +
            '<span>Medium bet: ' + convertPrice(((LoungeUser.userSettings.mediumBetPercentage / 100) * total), true) + '</span>' +
            '<span>Large bet: ' + convertPrice(((LoungeUser.userSettings.largeBetPercentage / 100) * total), true) + '</span>' +
            '</div>' +
            '</div>');
        $.each(itemValues, function(i, v) {
            $('#rarityValues').append('<div class="rarityContainer"><div><span class="' + i + '">' + capitaliseFirstLetter(i) + '</span>: ' + convertPrice(v, true) + '</div></div>');
        });
    } else {
        $(targetBackpack).prepend('<div class="inventoryStatisticsBox">' +
            '<div id="totalInvValue">No items ' + groupString + 'to add statistics for.</div></div>');
    }
}
