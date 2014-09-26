var appID = (window.location.hostname == "dota2lounge.com" ? "570" : "730");
$("body").addClass("appID" + appID);

if(document.URL.indexOf("/mytrades") != -1 || $("a:contains('Clean messages')").length) {
    $("body").addClass("mytrades");
}

/*
 Wrap the init code here, because for this to function properly, we need user settings to be loaded first
 */
function init() {
    /*
     When bot status changes (detected by background.js), a message gets send from background script to content script (here).
     TODO: Pass bot status through listener.
     */
    var inv = new Inventory();
    chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
        if(msg.action == "updateBotStatus") {
            chrome.storage.local.get('botsOnline', function(result) {
                BotStatus.updateStatus(result.botsOnline);
            });
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
        inv.getMarketPrices(false);
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
    if(document.URL.indexOf("/match?m=") != -1) {
        if(LoungeUser.userSettings["streamRemove"] == "1") {
            $("#stream object, #stream iframe").remove();
        }
        var tabWrapper = $("div[style='float: left; width: 96%;margin: 0 2%;height: 26px;border-radius: 5px;position: relative;overflow: hidden;']");
        $(tabWrapper).append('<a class="tab" id="ld_cache" onclick="returns = false;">Cached inventory</div>');
        $(tabWrapper).find(".tab").width("33%").click(function() {
            inv.stopLoadingInventory();
        });
        $("#ld_cache", tabWrapper).click(function() {
            $(".left").html("");
            document.getElementById("backpack").innerHTML = '<div id="LDloading" class="spin-1"></div>';
            inv.getCachedInventory("bettingInventory" + appID + "_" + readCookie("id"), function(bpHTML) {
                document.getElementById("backpack").innerHTML = bpHTML;
                // Move appID check to epicStuff method instead
                if(appID == "730") {
                    epicStuff();
                }
                inv.getMarketPrices(true);
            });
        });
    }
    if(document.URL.indexOf("/addtrade") != -1) {
        $(".tabholder .tab").click(function() {
            inv.stopLoadingInventory();
        });
    }
}

/*
 Asynchronous bullshit. Load settings from storage, merge new settings, then start script
 */
var LoungeUser = new User();
LoungeUser.loadUserSettings(function() {
    console.log("User settings have been loaded in content script!");
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
/*
    Credit goes to /u/ekim43
    Might want to refactor this with Item class, but at the moment just don't touch it because it looks dirty
 */
function epicStuff() {
    var total = covert = classified = restricted = milspec = consumer = industrial = other = 0;
    $("#backpack")[0] ? ($("#backpack > .item").each(function () {
        var t = $(this).children("div.rarity")[0].classList[1],
            e = $(this).children("div.value")[0].innerHTML;
        switch (e = parseFloat(e.replace("$ ", "")), total += e, t) {
            case "Covert":
                covert += e;
                break;
            case "Classified":
                classified += e;
                break;
            case "Restricted":
                restricted += e;
                break;
            case "Mil-Spec":
                milspec += e;
                break;
            case "Consumer":
                consumer += e;
                break;
            case "Industrial":
                industrial += e;
                break;
            default:
                other += e
        }
    }), total = total.toFixed(2), covert = covert.toFixed(2), classified = classified.toFixed(2), restricted = restricted.toFixed(2), milspec = milspec.toFixed(2), industrial = industrial.toFixed(2), consumer = consumer.toFixed(2), other = other.toFixed(2), small = .05 * total, small = small.toFixed(2), medium = .1 * total, medium = medium.toFixed(2), large = .2 * total, large = large.toFixed(2), $(".bpheader").prepend("<div class='winsorloses' style='padding: 10px;width:95%;'><table align=center><tr><td>Your items are worth: <strong>" + total + "</strong></td></tr></table><table style='margin-top:20px;' width='60%' align=center><tr><td style='padding:5px 20px'><span style='color:#EB4B4B;font-weight:700;'>Covert</span>: " + covert + "</td><td style='padding:5px 20px'><span style='color:#5E98D9;font-weight:700'>Industrial</span>: " + industrial + "</td></tr><tr><td style='padding:5px 20px'><span style='color:#D32CE6;font-weight:700'>Classified</span>: " + classified + "</td><td style='padding:5px 20px'><span style='color:#5E98D9;font-weight:700'>Consumer</span>: " + consumer + "</td></tr><tr><td style='padding:5px 20px'><span style='color:#8847FF;font-weight:700'>Restricted</span>: " + restricted + "</td><td style='padding:5px 20px'><span style='font-weight:700'>Other</span>: " + other + "</td></tr><td style='padding:5px 20px' colspan=2><span style='color:#4B69FF;font-weight:700'>Mil-Spec</span>: " + milspec + "</td></tr></table><table style='font-size: 10px;margin-top:15px;' align=center><tr><td style='padding:5px 20px'>Small bet: " + small + "</td><td style='padding:5px 20px'>Medium Bet: " + medium + "</td><td style='padding:5px 20px'>Large Bet: " + large + "</td></tr></table></div>")) : $(".bpheader").prepend("<p style='color:red'>Could not find items.  Please re-load backback</p>");
}