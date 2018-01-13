var itemName = false;
var priceIsLoading = false;
var appID = parseInt(window.location.pathname.replace('/market/listings/', '')) || undefined;

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
            var contextId = assetProp.contextid || '';
            document.body.setAttribute('data-itemname-ld', marketHashName);
            document.body.setAttribute('data-contextid-ld', contextId);
        }
    } catch (e) {
        console.error(e);
    }
}

// jscs: enable

function getItemName() {
    if (appID === 753) {
        return $('div.market_listing_nav:eq(0) a:last-child').text() || false;
    }

    return $('body').attr('data-itemname-ld') || $('div.market_listing_nav:eq(0) a:last-child').text() || false;
}

function getContextId() {
    return $('body').attr('data-contextid-ld') || undefined;
}

var LoungeUser = new User();
chrome.storage.local.get(['currencyConversionRates', 'ajaxCache', 'userSettings'], function(result) {
    currencies = result.currencyConversionRates || {};
    ajaxCache = result.ajaxCache || {};
    userSettings = result.userSettings || null;
    LoungeUser.loadUserSettings(function() {
        $(document).ready(function() {
            // Injecting script
            addJS_Node(null, null, scriptInject, null);

            // TODO: Ugly, need a timeout because of the addJSNode and script timings
            setTimeout(function() {
                var itemObj = new Item();
                itemObj.itemName = getItemName();
                if (itemObj.itemName !== false) {
                    if(LoungeUser.userSettings.opskins === '1' && appID !== undefined && appIDcontextIDs.hasOwnProperty(appID)) {
                        var item = new Item();
                        item.itemName = itemObj.itemName;

                        $('#largeiteminfo_item_actions').show().append('<a href="' + itemObj.generateOPSkinsURL(appID, getContextId()) + '" class="btn_small btn_grey_white_innerfade" id="buyOnOpskins" target="_blank">' +
                            '<span>Buy on OPSKINS.com</span></a>');
                    }
                }

                var successCallback = errorCallback = function(response) {
                    priceIsLoading = false;

                    $('#csglpricecheck').removeClass('btn_disabled');

                    if (!isNaN(response)) {
                        alert(itemObj.itemName + ' is worth ' + convertPrice(response, true) + ' on CSGOLounge.com');
                    } else {
                        alert(response);
                    }
                };

                $('#csglpricecheck').click(function() {
                    if (priceIsLoading) {
                        return false;
                    }

                    priceIsLoading = true;
                    $(this).addClass('btn_disabled');
                    itemObj.fetchLoungeValueFromAPI(successCallback, errorCallback);
                });
            }, 250);
        });
    }, userSettings);
});
