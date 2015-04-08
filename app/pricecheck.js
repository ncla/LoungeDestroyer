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
chrome.storage.local.get(['currencyConversionRates', 'ajaxCache'], function(result) {
    currencies = result.currencyConversionRates || {};
    ajaxCache = result.ajaxCache || {};
    LoungeUser.loadUserSettings(function() {
        var itemObj = new Item();
        itemObj.itemName = getItemName();
        if (itemObj.hasOwnProperty('itemName')) {
            $('#largeiteminfo_item_actions').show().append('<span class="btn_small btn_grey_white_innerfade" id="csglpricecheck">' +
            '<span>Check CSGOLounge.com item betting value</span>' +
            '</span>');
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
    });
});
