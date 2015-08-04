var itemName = false;

// This is basically to get original item name from g_rgAssets variable, if all goes well the itemName should be appended
// to the body element with attribute 'data-itemname-ld'
function scriptInject() {
    try {
        // jscs: disable
        var prop = g_rgAssets[Object.keys(g_rgAssets)[0]];
        var inventoryProp = prop[Object.keys(prop)[0]];
        var assetProp = inventoryProp[Object.keys(inventoryProp)[0]];

        if (assetProp.hasOwnProperty('market_hash_name')) {
            var marketHashName = assetProp.market_hash_name;
            document.body.setAttribute('data-itemname-ld', marketHashName);
        }
    } catch (e) {
    }
}

// Injecting script
addJS_Node(null, null, scriptInject, null);
// jscs: enable

function getItemName() {
    return $('body').attr('data-itemname-ld') || $('div.market_listing_nav:eq(0) a:last-child').text() || false;
}

var LoungeUser = new User();
chrome.storage.local.get(['currencyConversionRates', 'ajaxCache', 'userSettings'], function(result) {
    currencies = result.currencyConversionRates || {};
    ajaxCache = result.ajaxCache || {};
    userSettings = result.userSettings || null;
    LoungeUser.loadUserSettings(function() {
        var itemObj = new Item();
        itemObj.itemName = getItemName();
        if (itemObj.hasOwnProperty('itemName')) {
            $('#largeiteminfo_item_actions').show().append('<span class="btn_small btn_grey_white_innerfade" id="csglpricecheck">' +
            '<span>Check CSGOLounge.com item betting value</span>' +
            '</span>');

            if(LoungeUser.userSettings.opskins == '1') {
                var isStattrak = (itemObj.itemName.indexOf('StatTrak™ ') !== -1) ? 1 : 0;

                $('#largeiteminfo_item_actions').append('<a href="' + itemObj.generateOPSkinsURL(itemObj.itemName, isStattrak) + '" class="btn_small btn_grey_white_innerfade" id="buyOnOpskins" target="_blank">' +
                '<span>Buy on OPSKINS.com without 7 day trade ban <small title="This affiliate link is added by LoungeDestroyer and ' +
                'supports the developers, you can remove this affiliate link in the settings if you wish."> (?)</small></span></a>');
            }
        }

        var successCallback = errorCallback = function(response) {
            if (!isNaN(response)) {
                alert(itemObj.itemName + ' is worth ' + convertPrice(response, true) + ' on CSGOLounge.com');
            } else {
                alert(response);
            }
        };

        $('#csglpricecheck').click(function() {
            itemObj.fetchLoungeValueFromAPI(successCallback, errorCallback);
        });
    }, userSettings);
});
