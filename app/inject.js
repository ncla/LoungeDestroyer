var appID = (window.location.hostname == "dota2lounge.com" ? "570" : "730");
$("body").addClass("appID" + appID);

if(document.URL.indexOf("/mytrades") != -1 || $("a:contains('Clean messages')").length) {
    $("body").addClass("mytrades");
}

// cannot check if actually playing, unfortunately
// only if it's been clicked while on the page
var streamPlaying = false;

(function(){
    var container = document.getElementById("mainstream"),
        flash = document.getElementById("live_embed_player_flash");

    if (!flash) { // it's a hitbox stream
        flash = document.querySelector("#mainstream iframe:first-child");
        if (!flash)
            return;

        flash.contentWindow.document.addEventListener("click", function(){
            streamPlaying = true
        });

        return
    }

    if (!container)
        return;

    flash = flash.document || flash;
    
    if (!flash)
        return;

    // onclick/onmousedown doesn't fire on flash objects
    container.addEventListener("mousedown", function(){
        streamPlaying = true;
    });

    // onmousedown won't fire unless wmode=transparent, don't ask me why
    flash.setAttribute("wmode", "transparent");
})();
/*
    Based on Steam market API
 */
var currencyData = {
    1: {
        "name": "USDUSD",
        "htmlSymbol": "&#36;",
        symbolBeforeValue: true
    },
    2: {
        "name": "USDGBP",
        "htmlSymbol": "&#163;",
        symbolBeforeValue: true
    },
    3: {
        "name": "USDEUR",
        "htmlSymbol": "&#8364;",
        symbolBeforeValue: false
    },
    5: {
        "name": "USDRUB",
        "htmlSymbol": "p&#1091;&#1073;.",
        symbolBeforeValue: false
    },
    20: {
        "name": "USDCAD",
        "htmlSymbol": "CDN&#36;",
        symbolBeforeValue: true
    },
    21: {
        "name": "USDAUD",
        "htmlSymbol": "A&#36;",
        symbolBeforeValue: true
    }
};

var storageMarketItems,
    currencies = {};

chrome.storage.local.get(['marketPriceList', 'currencyConversionRates'], function(result) {
    storageMarketItems = result.marketPriceList || {};
    currencies = result.currencyConversionRates || {};
});

/*
 Wrap the init code here, because for this to function properly, we need user settings to be loaded first
 */
function init() {
    /*
     When bot status changes (detected by background.js), a message gets send from background script to content script (here).
     TODO: Pass bot status through listener.
     */
    var inv = inventory;
    chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
        if(msg.action == "updateBotStatus") {
            BotStatus.updateStatus(msg.status);
        }
        if(msg.inventory) {
            inv.onInventoryLoaded(msg.inventory);
        }
        if(msg.hasOwnProperty("changeSetting")) {
            for(var name in msg.changeSetting) {
                LoungeUser.userSettings[name] = msg.changeSetting[name];
            }
        }
    });

    if((document.URL.indexOf("/mytrades") != -1 || document.URL.indexOf("/trade?t=") != -1 || document.URL.indexOf("/mybets") != -1) && (LoungeUser.userSettings["itemMarketPrices"] == "1")) {
        inventory.getMarketPrices(false);
    }
    if(document.URL.indexOf("/mybets") != -1) {
        $(".matchmain").each(function(index, value) {
            var total = 0;
            $(".item", value).each(function(itemIndex, itemValue) {
                var betItemValue = parseFloat($(".value", itemValue).text().replace("$ ", ""));
                total = total + betItemValue;
            });
            $(value).addClass("custom-my-bets-margin");
            $(".match .full:eq(0)", value).after('<div class="full total-bet"><span style="float: left; margin-right: 0.5em">Total value bet:</span><div class="potwin Value"><b>'+total.toFixed(2)+'</b> Value</div></div>');
        });
    }
    if($('a[href="/trades"]').length || document.URL.indexOf("/result?") != -1 || document.URL.indexOf("/trades") != -1) {
        if (LoungeUser.userSettings.showDescriptions !== "0") {
            // On infinite scrolling trade page, new trades wont have expanded description
            $(".tradepoll").each(function(index, value) {
                var description = $(value).find(".tradeheader").attr("title");
                var descriptionTextLength = description.length;
                if(descriptionTextLength > 0) {
                    $(value).find(".tradecnt").after('<div class="trade-description"><p>' + $.trim(description) + (descriptionTextLength > 240 ? "..." : "") + '</p></div>');
                    var tradeDescription = $(".trade-description", value);
                    if(descriptionTextLength > 240) {
                        $.ajax({
                            url: $(value).find("a:eq(1)").attr("href"),
                            type: "GET",
                            success: function(data) {
                                $(".trade-description p", value).html(textToUrl($.trim($(data).find(".standard.msgtxt").text())));
                            }
                        });
                    } else {
                        $(".trade-description p", value).html(
                            textToUrl($(".trade-description p", value).text())
                        );
                    }
                }
            });
        }
    }
    if(document.URL.indexOf("/match?m=") != -1 || document.URL.indexOf("/predict") != -1) {
        if(LoungeUser.userSettings["streamRemove"] == "1") {
            $("#stream object, #stream iframe").remove();
        }
        var tabWrapper = $("div[style='float: left; width: 96%;margin: 0 2%;height: 26px;border-radius: 5px;position: relative;overflow: hidden;']");
        $(tabWrapper).append('<a class="tab" id="ld_cache" onclick="returns = false;">Cached inventory</div>');
        $(tabWrapper).find(".tab").width("33%").click(function() {
            inventory.stopLoadingInventory();
        });
        $("#ld_cache", tabWrapper).click(function() {
            $(".left").html("");
            document.getElementById("backpack").innerHTML = '<div id="LDloading" class="spin-1"></div>';
            inventory.getCachedInventory("bettingInventory" + appID + "_" + readCookie("id"), function(bpHTML) {
                document.getElementById("backpack").innerHTML = bpHTML;
                this.bettingInventoryType = "inventory";
                addInventoryStatistics();
                inventory.getMarketPrices(true);
            });
        });
    }
    if(document.URL.indexOf("/addtrade") != -1) {
        $(".tabholder .tab").click(function() {
            inventory.stopLoadingInventory();
        });
    }
}

/*
 Asynchronous bullshit. Load settings from storage, merge new settings, then start script
 */
var LoungeUser = new User();
LoungeUser.loadUserSettings(function() {
    console.log("User settings have been loaded in content script!");
    inventory = new Inventory();
    init();
});

/*
    Mouseover action for items
 */
$(document).on("mouseover", ".item", function() {
    var LoungeItem = new Item($(this));
    if(LoungeUser.userSettings["itemMarketPrices"] == "1") {
        LoungeItem.getMarketPrice();
    }
    if($(this).find(".steamMarketURL").length == 0) {
        var itemName = encodeURI($(this).find(".smallimg").attr("alt"));
        $("a:contains('Market')", this).remove();
        try {
            $("a:contains('Preview')", this)[0].nextSibling.remove();
        } catch(e) {} // Shut the fuck up :)

        var elementToAppendAfter = ($(this).find("a.button").length ? $(this).find("b:eq(0)") : $(this).find('.name a[onclick="previewItem($(this))"]'));

        $(this).find(elementToAppendAfter).after('<br/>' +
            '<br/><a class="steamMarketURL" href="' + LoungeItem.generateMarketURL() + '" target="_blank">Market Listings</a><br/>' +
            '<a href="' + LoungeItem.generateMarketSearchURL() + '" target="_blank">Market Search</a>');
        $("a", this).click(function(e) {
            e.stopPropagation();
        });
    }
});
