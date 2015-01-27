var itemName = document.title.split("Listings for ")[1];
var LoungeUser = new User();

chrome.storage.local.get(['currencyConversionRates'], function(result) {

    var GetCSGLSchemaUrl = 'http://csgolounge.com/api/schema.php';
    var CheckCSGLHtml = '<span class="btn_small btn_grey_white_innerfade" id="csglpricecheck"><span>Check CSGOLounge.com item value</span></span>';

    currencies = result.currencyConversionRates || {};
    LoungeUser.loadUserSettings(renderAndBindGetPrice);

    function renderAndBindGetPrice(){
        console.log("User settings have been loaded in content script!");
        $("#largeiteminfo_item_actions").append(CheckCSGLHtml);
        $("#csglpricecheck").click($.ajax({url: GetCSGLSchemaUrl, type: "GET", success: onGetPriceSuccess, error: onGetPriceFailure}));
    }

    function onGetPriceSuccess(itemSet){
        if(itemName){
            feedbackWithItemValue(findItemValueByItemName(itemSet, itemName));
        }else{
            alert('No item name set, unable to lookup value.');
        }
    }

    function onGetPriceFailure(){
        alert('CSGOLounge.com data is unavailable.');
    }

    function feedbackWithItemValue(itemValue){
        if(itemValue && itemValue > 0){
            alert(itemName + ' is worth ' + convertPrice(itemValue, true) + ' on CSGOLounge.com');
        }else if(itemValue && itemValue <= 0){
            alert(itemName + ' is not available for betting on CSGOLounge.com');
        }else{
            alert(itemName + ' was not found in CSGOLounge.com schema');
        }
    }

    function findItemValueByItemName(itemSet, itemName){
        if(!itemSet){ return undefined; }
        itemSet.forEach(function(item){
            if(item && item.name && item.name == itemName && item.worth) {
                return parseFloat(item.worth).toFixed(2);
            }
        });
        return undefined;
    }

});