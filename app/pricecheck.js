var itemName = document.title.split("Listings for ")[1];

var LoungeUser = new User();
chrome.storage.local.get(['currencyConversionRates'], function(result) {
    currencies = result.currencyConversionRates || {};
    LoungeUser.loadUserSettings(function() {
        console.log("User settings have been loaded in content script!");
        $("#largeiteminfo_item_actions").append('<span class="btn_small btn_grey_white_innerfade" id="csglpricecheck">' +
            '<span>Check CSGOLounge.com item value</span>' +
            '</span>');

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