var itemName = $("div.market_listing_nav:eq(0) a:last-child").text().trim() || false;

var LoungeUser = new User();
chrome.storage.local.get(['currencyConversionRates', 'ajaxCache'], function(result) {
    currencies = result.currencyConversionRates || {};
    ajaxCache = result.ajaxCache || {};
    LoungeUser.loadUserSettings(function() {
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