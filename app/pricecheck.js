var itemName = false;

// This is basically to get original item name from g_rgAssets variable, if all goes well the itemName should be appended
// to the body element with attribute 'data-itemname-ld'
function scriptInject () {
    try {
        for(var prop in g_rgAssets) {
            var appIDprop = g_rgAssets[prop];
            break;
        }
        for(var inventory in appIDprop) {
            var inventoryProp = appIDprop[inventory];
            break;
        }
        for(var asset in inventoryProp) {
            var firstAsset = inventoryProp[asset];
            if(firstAsset.hasOwnProperty('market_hash_name')) {
                var marketHashName = firstAsset['market_hash_name'];
                document.body.setAttribute('data-itemname-ld', marketHashName);
            }
            break;
        }
    } catch(e) {}
}
// Injecting script
addJS_Node(null, null, scriptInject, null);

function getItemName() {
    return $("body").attr("data-itemname-ld") || $("div.market_listing_nav:eq(0) a:last-child").text() || false;
}

var LoungeUser = new User();
chrome.storage.local.get(['currencyConversionRates', 'ajaxCache'], function(result) {
    currencies = result.currencyConversionRates || {};
    ajaxCache = result.ajaxCache || {};
    LoungeUser.loadUserSettings(function() {
        itemName = getItemName();
        if(itemName) {
            $("#largeiteminfo_item_actions").append('<span class="btn_small btn_grey_white_innerfade" id="csglpricecheck">' +
                '<span>Check CSGOLounge.com item betting value</span>' +
                '</span>');
        }

        $("#csglpricecheck").click(function() {
            var itemFound = false;
            $.ajax({
                url: "http://csgolounge.com/api/schema.php",
                type: "GET",
                success: function(data){
                    $.each(data, function(i, v) {
                        if(v.name == itemName) {
                            var worth = parseFloat(v.worth).toFixed(2);
                            itemFound = true;
                            if(worth > 0) {
                                alert(itemName + ' is worth ' + convertPrice(worth, true) + ' on CSGOLounge.com');
                            } else {
                                alert(itemName + ' is not available for betting on CSGOLounge.com');
                            }
                            return false;
                        }
                    });
                    if(!itemFound) {
                        alert(itemName + ' was not found in CSGOLounge.com database');
                    }
                }
            });
        });
    });
});