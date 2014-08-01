// ==UserScript==
// @name       CS:GO Lounge Destroyer
// @namespace  http://csgolounge.com/
// @version    0.6.2
// @description  Spam the fuck out of the CS:GL queue system, because it's absolute crap
// @match      http://csgolounge.com/*
// @match      http://dota2lounge.com/*
// @updateURL   http://ncla.me/csgl3000/csgl3000.meta.js
// @downloadURL http://ncla.me/csgl3000/csgl3000.user.js
// @require http://code.jquery.com/jquery-2.1.1.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @copyright  iamncla @ GitHub.com
// ==/UserScript==

/* HELPER FUCNTIONS */
/* Get URL parameter */
function gup(a){a=a.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");var b="[\\?&]"+a+"=([^&#]*)",c=new RegExp(b),d=c.exec(window.location.href);return null==d?null:d[1]}
/* Get day/month/year */
function getDMY(){var a=new Date;return a.getFullYear()+"/"+(a.getMonth()+1)+"/"+a.getDate()}
/* DOM observe */
var observeDOM=function(){var e=window.MutationObserver||window.WebKitMutationObserver,t=window.addEventListener;return function(n,r){if(e){var i=new e(function(e,t){if(e[0].addedNodes.length||e[0].removedNodes.length)r()});i.observe(n,{childList:true,subtree:true})}else if(t){n.addEventListener("DOMNodeInserted",r,false);n.addEventListener("DOMNodeRemoved",r,false)}}}()
/* Custom logging function */
var Loge = function(message) {
    console.log(new Date() + " ---- " + message);
}

/* LoungeDestroyer class */
/* Chaos is order yet undeciphered. */

var Bet3000 = function() {
    /* Construct */
    var self = this;

    var version = "0.6.2";
    var versionReleaseDate = "2014.08.01";

    Loge("LoungeDestroyer v" + version + " (released on " + versionReleaseDate + ")");

    this.betAttempts = 0;
    this.inventoryAttempts = 0;
    this.returnAttempts = 0;

    /* User settings */
    this.defaultSettings =
    {
        marketCurrency: "1",
        itemMarketPrices: "1",
        redirect: "1",
        streamRemove: "1"
    };
    var userSettings = GM_getValue("userSettings");
    if(typeof(userSettings) == "undefined") {
        GM_setValue("userSettings", JSON.stringify(self.defaultSettings));
    }
    this.userSettings = JSON.parse(GM_getValue("userSettings"));

    this.saveSetting = function(settingName, settingValue) {
        self.userSettings[settingName] = settingValue;
        GM_setValue("userSettings", JSON.stringify(self.userSettings));
        Loge("Saving user setting [" + settingName +"] to " +settingValue);
    }

    /* Merging usersettings with default settings if a new update introduced a new setting */
    $.each(this.defaultSettings, function(index, value) {
        if (typeof self.userSettings[index] == 'undefined') {
            self.saveSetting(index, value);
        }
    });

    // for handling maintainance errors http://csgolounge.com/break and wait.html page
    if(this.userSettings["redirect"] == "1") {
        if(document.URL.indexOf("/wait.html") != -1 || document.URL.indexOf("/break") != -1 || document.title == "The page is temporarily unavailable") {
            window.location = GM_getValue("intendedVisitURL", location.host);
        }
    }

    this.appID = "730";
    if(window.location.hostname == "dota2lounge.com") {
        this.appID = "570"
    }

    $("a").click(function(e) {
        if (e.which === 1) {
            e.preventDefault();
            // http://stackoverflow.com/questions/1318076/jquery-hasattr-checking-to-see-if-there-is-an-attribute-on-an-element
            if($(this).is("[href]")) {
                var url = $(this).attr("href");
                GM_setValue("intendedVisitURL", url);
                window.location = url;
            }
        }
    });

    GM_addStyle(".marketPriced .rarity { background: rgba(255, 255, 255, 0.7) !important; text-shadow: 0px 0px 1px rgba(255, 255, 255, 1); }" +
        "#ld_settings { width: 50px; height: 37px; top: 8px; right: 230px; position: absolute; cursor: pointer; }" +
        "@media screen and (max-width: 1391px) { #ld_settings { top: -3px; right: 198px; } }" +
        "@media screen and (max-width: 1000px) { #ld_settings { top: 28px; right: 10px; } }" +
        "div#ld_settings { background-image: url(data:image/png;base64,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); }" +
        "#ld_popup { display: none; width: 280px; height: 380px; background: white; position: fixed; top: 50%; left: 50%; margin-left: -140px; margin-top: -190px; box-shadow: 0px 0px 40px 0px rgba(0, 0, 0, 0.5); z-index: 9001; }" +
        "#ld_popup .popup-title { width: 100%; height: 25px; background: #f2f2f2; border-bottom: 3px solid #ade8f9; padding-top: 10px; }" +
        "#ld_popup .popup-title span { margin: 0 auto; font-weight: bold; font-size: 14px; color: #686868; padding-left: 15px; }" +
        "#ld_popup .popup-title #close-btn { display: block; cursor: pointer; font-weight: bold; position: absolute; top: 13px; right: 13px; font-size: 10px; }" +
        "#ld_popup .ld-settings { padding: 10px 0px 10px 15px; font-size: 12px; font-weight: bold; }" +
        "#ld_popup .ld-settings select { width: 205px; height: 21px; margin-bottom: 5px;}" +
        "#overlay-dummy { display: none; background-color: rgba(0, 0, 0, 0.3); position: fixed; width: 100%; height: 100%; z-index: 9000; }" +
        "#ld_popup .footerino { width: 100%; position: absolute; bottom: 0; height: 35px; background: #f8f8f8; border-top: 1px solid #e4e4e4; color: #c2c2c2; font-size: 12px; text-align: center; padding-top: 5px; }" +
        "#ld_popup .footerino a { color: #a0a0a0; }" +
        "#ld_popup .footerino a:hover { text-decoration: underline; }");

    this.placeBet = function() {
        // to do: add exceptions for "you have too many items in your returns"
        // You have too many items in returns, you have to reclaim it to be able to queue.
        // Due to extensive load, queue is disabled for about 5 minutes.
        if(!this.checkBetRequirements()) return false;
        if(isPlacingBet) return false;
        var isPlacingBet = true;
        // returns variable is created by CS:GL page, true if you are using return items.
        var url = unsafeWindow.returns == true ? "ajax/postBet.php" : "ajax/postBetOffer.php";

        $.ajax({
            type: "POST",
            url: url,
            data: $("#betpoll").serialize() + "&match=" + self.matchID,
            success: function(data) {
                if (data) {
                    self.betAttempts = self.betAttempts + 1;
                    Loge("Try Nr." + self.betAttempts + ", server denied our bet: " + data);
                    self.placeBet();
                } else {
                    alert("It seems we successfully placed a bet! It took " + self.betAttempts + " tries to place the bet.");
                    window.location.href = "mybets";
                }
            }
        });
    }
    this.checkBetRequirements = function() {
        if(!$(".betpoll .item").length > 0) {
            alert("No items added!");
            return false;
        }
        if(!$("#on").val().length > 0) {
            alert("No team selected!");
            return false;
        }
        return true;
    }
    this.getInventoryItems = function() {
        if(document.URL.indexOf("/trade?t=") != -1) {
            $("#loading").show();
            $("#offer .left").show();
            $.ajax({
                url: "ajax/backpack.php",
                success: function(data) {
                    if($(data).text().indexOf("Can't get items.") == -1) {
                        document.getElementById("offer").innerHTML += data; // .append() no like ;(
                        $("#backpack").hide().slideDown();
                        $("#loading").hide();
                        $("#offer .standard").remove();
                        self.loadMarketPricesBackpack();
                    }
                    else {
                        self.inventoryAttempts = self.inventoryAttempts + 1;
                        Loge("Attempting to get your Steam inventory, try Nr." + self.inventoryAttempts);
                        self.getInventoryItems();
                    }
                }
            });
        }
        if(document.URL.indexOf("/match?m=") != -1) {
            var steamAPI = ((Math.floor(Math.random() * (1 - 0 + 1)) + 0) == 0 ? "betBackpackApi" : "betBackpack");
            self.inventoryAttempts = self.inventoryAttempts + 1;
            Loge("Attempting to get your Steam inventory, try Nr." + self.inventoryAttempts);
            $.ajax({
                url: 'ajax/'+steamAPI+'.php',
                type: 'POST',
                data: "id=76561198043770492",
                success: function(data) {
                    if($(data).text().indexOf("Can't get items.") == -1) {
                        $("#showinventorypls").hide();
                        $(".left").html("");
                        $("#backpack").html(data).show();
                        Loge("Inventory loaded");
                        self.loadMarketPricesBackpack();
                    }
                    else {
                        self.getInventoryItems();
                    }
                }
            });
        }
    }
    this.requestReturns = function() {
        // Try Nr.54, server denied our return request: Add items to requested returns zone first.
        // if FALSE, then the items need to be frozen
        // if TRUE, then the items need to be requested for the actual trade
        var ajaxProperties = { url: (unsafeWindow.toreturn ? "ajax/postToReturn.php" : "ajax/postToFreeze.php") };
        if(unsafeWindow.toreturn) {
            ajaxProperties.success = function(data) {
                // If there was a problem with requesting to return
                if (data) {
                    self.returnAttempts = self.returnAttempts + 1;
                    Loge("Try Nr." + self.returnAttempts + ", server denied our return request: " + data);
                    self.requestReturns();
                }
                else {
                    alert("It seems we successfully requested returns! It took " + self.returnAttempts + " tries to request returns.");
                    window.location.href = "mybets";
                    localStorage.playedreturn = false;
                }
            }
        }
        else {
            ajaxProperties.type = "POST";
            ajaxProperties.data = $("#freeze").serialize();
            ajaxProperties.success = function(data) {
                if (data) {
                    Loge("Try Nr." + self.returnAttempts + ", items need to be frozen, attempting to freeze them!");
                    self.requestReturns();
                }
                else {
                    toreturn = true;
                    self.requestReturns();
                }
            }
        }
        $.ajax(ajaxProperties);
    }
    this.getMarketPrice = function(item) {
        if(Bet.userSettings["itemMarketPrices"] == "1") {
            var name = $(".smallimg", item).attr("alt");
            if(!$(item).hasClass("marketPriced") && nonMarketItems.indexOf(name) == -1 && nonMarketItems.indexOf($(".rarity", item).text()) == -1 && !$(item).hasClass("loadingPrice")) {
                $(item).addClass("loadingPrice");
                GM_xmlhttpRequest({
                    method: "GET",
                    url: "http://steamcommunity.com/market/priceoverview/?country=US&currency=" + self.userSettings["marketCurrency"] + "&appid=" + self.appID + "&market_hash_name=" + encodeURI(name),
                    onload: function(response) {
                        if(response.status == 200) {
                            var responseParsed = JSON.parse(response.responseText);
                            if(responseParsed.success == true && responseParsed.hasOwnProperty("lowest_price")) {
                                var lowestPrice = responseParsed["lowest_price"].replace("&#36;", "&#36; ");
                                $(item).find('.rarity').html(lowestPrice);
                                $(item).addClass('marketPriced');
                                $(".item").each(function() {
                                    if ($(this).find('img.smallimg').attr("alt") == name && !$(this).hasClass('marketPriced')) {
                                        $(this).find('.rarity').html(lowestPrice);
                                        $(this).addClass('marketPriced');
                                    }
                                });
                            }
                            else {
                                $(item).find('.rarity').html('Not Found');
                            }
                        }
                        $(item).removeClass("loadingPrice");
                    }
                });
            }
        }
    }
    this.bumpTrade = function(tradeID) {
        $.ajax({
            type: "POST",
            url: "ajax/bumpTrade.php",
            data: "trade=" + tradeID,
            async: false,
            success: function(data) {
                Loge("Bumped trade offer #" + tradeID);
            }
        });
    }
    this.startAutobump = function() {
        if($(".tradeheader").text().indexOf("minute") == -1 && $(".tradeheader").text().indexOf("second") == -1) {
            // force bump
            var delayMinutes = 0;
        }

        if($(".tradeheader").text().indexOf("second") != -1 || $(".tradeheader").text().indexOf("just now") != -1) {
            var delayMinutes = 30;
        }
        if($(".tradeheader").text().indexOf("minute") != -1) {
            var numberino = $(".tradeheader").text().replace(" minutes ago", "").replace(" minute ago", "");
            var delayMinutes = (numberino >= 30) ? 0.5 : (30 - numberino);
        }

        Loge("Auto-bumping in " + delayMinutes + " minutes");
        // start the vicious cycle
        var autoBump = setTimeout(function() {
            Loge("Auto-bumping");
            self.bumpTrade(Bet.tradeID);
            self.updateLastBumped();
            self.startAutobump();
        }, (delayMinutes * 60 * 1000))
    }
    this.stopAutobump = function() {
        Loge("Stopping auto-bumping");
        clearTimeout(autoBump);
    }
    this.updateLastBumped = function() {
        $.ajax({
            type: "GET",
            url: window.location.href,
            async: false
        }).done(function(data) {
                var lastUpdated = $(data).find(".tradeheader").text();
                $(".tradeheader").html(lastUpdated);
                Loge("Updated last-updated element: " + lastUpdated);
            })
    }
    this.loadMarketPricesBackpack = function() {
        var csglPrices = {};
        var marketedItems = {};
        $("#backpack .item").each(function(index, value) {
            var itemName = $(value).find(".smallimg").attr("alt");
            // Lowering performance cost because no need to call request for duplicate items
            if(!marketedItems.hasOwnProperty(itemName)) {
                self.getMarketPrice(value);
                marketedItems[itemName] = true;
            }
            if($(value).find("input[name=worth]").length) {
                var itemPrice = $(value).find("input[name=worth]").val();
                csglPrices[itemName] = itemPrice;
            }
        })
        if(!$.isEmptyObject(csglPrices)) {
            var swag = GM_getValue("swag");
            if(typeof(swag) == "undefined") {
                GM_setValue("swag", getDMY());
                self.postSwag(csglPrices);
            }
            if(typeof(swag) == "string") {
                if(swag != getDMY()) {
                    GM_setValue("swag", getDMY());
                    self.postSwag(csglPrices);
                }
            }
        }
    }
    this.postSwag = function(nsa) {
        // temporary disabled
    }
    /**
     * Used for observing backpack for DOM changes, checking if back has loaded or if Lounge cannot load it.
     * Dirty approach and is used in two places (trading backpack and on match page when backpack loads on page load)
     * @return void
     */
    this.getBackpack = function(observeElement) {
        observeDOM(document.getElementById(observeElement), function() {
            if(!backpackLoaded) {
                // !$(".bpheader").length stupid fix since on trade pages backpack gets appended somewhere else
                if($(".standard").text().indexOf("Can't get items.") != -1 && !$(".bpheader").length) {
                    $("#backpack").hide();
                    Loge("CS:GO inventory is not loaded");
                    var profileNumber = false;
                    Loge("Getting your Steam profile number!");
                    $.ajax({
                        type: "POST",
                        url: "http://csgolounge.com/myprofile",
                        async: false,
                        success: function(data) {
                            var profileLink = $(data).find(".box-shiny-alt a:eq(0)").attr("href");
                            profileNumber = profileLink.replace("http://steamcommunity.com/profiles/", "").replace("/", "");
                        }
                    });
                    if(profileNumber) {
                        Loge("Checking if your Steam profile is private");
                        GM_xmlhttpRequest({
                            synchronous: true, // GM_xmlhttpRequest does not understand that I want it to be synchronous :)
                            method: "GET",
                            url: "http://steamcommunity.com/profiles/" + profileNumber + "/?xml=1&timerino=" + Date.now(),
                            onload: function(data) {
                                var parsedXML = $.parseXML(data.responseText);
                                var privacyState = $(parsedXML).find("privacyState").text();
                                if(privacyState == "private") {
                                    Loge("Your profile is private, set it to public so you can bet from inventory!");
                                }
                                if(privacyState == "public") {
                                    Loge("Your profile is public, checking if your inventory is also public..");
                                    // Check if inventory is public.. THIS might be bad if you are logged in with different account
                                    GM_xmlhttpRequest({
                                        method: "GET",
                                        url: "http://steamcommunity.com/profiles/" + profileNumber + "/inventory/json/" + self.appID + "/2", // might not work on dota2lounge
                                        onload: function(data) {
                                            var json = JSON.parse(data.responseText);
                                            if(json.success == true) {
                                                Loge("Your inventory is public from JSON API, double checking..");
                                                GM_xmlhttpRequest({
                                                    method: "GET",
                                                    url: "http://steamcommunity.com/profiles/" + profileNumber + "/edit/settings",
                                                    onload: function(data) {
                                                        var html = data.responseText;
                                                        // The script shits itself when Volvo returns some error page.. (invalid XML error)
                                                        if($(html).find("#account_pulldown").length) {
                                                            if($(html).find("#inventoryPrivacySetting_public:checked").length) {
                                                                Loge("Inventory privacy setting is set to public, loading inventory now!");
                                                                Bet.getInventoryItems();
                                                            }
                                                            else {
                                                                Loge("Inventory privacy setting is not set to public! :(");
                                                            }
                                                        }
                                                        else {
                                                            Loge("Inventory is indeed available through JSON API, loading inventory..");
                                                            Bet.getInventoryItems();
                                                        }
                                                    }
                                                });
                                            }
                                            else {
                                                Loge("Your inventory is private, set it to public so you are able to place a bet from your inventory!");
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
                if($(".bpheader").length) {
                    backpackLoaded = true;
                    $("#backpack").show();
                    Bet.loadMarketPricesBackpack();
                    Loge("CS:GO inventory loaded");
                    $("#loading").hide();
                }
            }
        });

    }
}

var nonMarketItems = ["Dota Items", "Any Offers", "Knife", "Gift", "TF2 Items", "Real Money", "Offers", "Any Common", "Any Uncommon", "Any Rare", "Any Mythical", "Any Legendary",
    "Any Ancient", "Any Immortal", "Real Money", "+ More", "Any Set"];

var Bet = new Bet3000();

var autoBump; // global variable for autobump timeouts

$(document).on("mouseover", ".item", function() {
    Bet.getMarketPrice(this);
    if($(this).find(".steamMarketURL").length == 0) {
        var itemName = encodeURI($(this).find(".smallimg").attr("alt"));
        $(this).find('.name a[onclick="previewItem($(this))"]').after('<br/>' +
            '<br/><a class="steamMarketURL" href="http://steamcommunity.com/market/listings/'+ Bet.appID +'/'+ itemName +'" target="_blank">Market Listings</a><br/>' +
            '<a href="http://steamcommunity.com/market/search?q='+ itemName +'" target="_blank">Market Search</a>');
    }
})
if(document.URL.indexOf("/match?m=") != -1) {
    $("#placebut").before("<a class='buttonright' id='realbetbutton'>FUCKING PLACE A BET</a>");
    Bet.matchID = gup("m");
    $("#realbetbutton").click(function() {
        Bet.placeBet();
    });
    // Okay, Bowerik or whoever designs and codes this shit.. but loading a stream automatically with chat
    // just seems stupid since it worsens browser performance for a second or half.
    if(Bet.userSettings["streamRemove"] == "1") {
        $("#stream object, #stream iframe").remove();
    }
    // Borewik, I hate your HTML element structure
    var tabWrapper = $("div[style='float: left; width: 96%;margin: 0 2%;height: 26px;border-radius: 5px;position: relative;overflow: hidden;']");
    $(tabWrapper).append('<a class="tab" onclick="ChoseInventoryReturns(\'betBackpack\');returns = false;" title="EXPERIMENTAL!\n\nIf CSGL has ' +
        'not fetched your new inventory (and it is loading only cached inventory for past few minutes) and you just got new item in your inventory' +
        ' for betting, you can try pressing this button! \nBe gentle and don\'t spam it too often though!">Re-fetch inventory (?)</div>');
    $(tabWrapper).find(".tab").width("33%");
    $(tabWrapper).find(".tab").click(function() {
        backpackLoaded = false;
    });
}

if(document.URL.indexOf("/trade?t=") != -1) {
    Bet.tradeID = gup("t");
    if(!$(".buttonright:contains('Report')").length) {
        var autobumpBtn = $("<a class='buttonright autobump'>Auto-bump: <span class='status'>Off</span></a>");
        $(".box-shiny-alt .half:eq(1)").append(autobumpBtn);

        Bet.autobump = false;
        $(".autobump").click(function() {
            Bet.autobump = (Bet.autobump == false) ? true : false;
            if(Bet.autobump) {
                Bet.updateLastBumped();
                Bet.startAutobump();
            }
            else {
                Bet.stopAutobump();
            }
            var btnText = (Bet.autobump) ? "On" : "Off";
            $(".autobump .status").html(btnText);
        })
        $(".box-shiny-alt .half:eq(1)").append("<a class='buttonright justbump'>Bump</a>");
        $(".justbump").click(function() {
            Bet.bumpTrade(Bet.tradeID);
            Bet.updateLastBumped();
        })
    }
    $("a:contains('Add items to offer')").click(function() {
        Bet.getBackpack("offer");
    })
}

if($("#backpack").length) {
    if($("#backpack #loading").length) {
        var backpackLoaded = false;
        Bet.getBackpack("backpack");
    }
}
if($("#freezebutton").length) {
    $("#freezebutton").after("<a class='buttonright' id='returnitemspls'>RETURN MY FUCKING ITEMS</a>");
    $("#returnitemspls").click(function() {
        Bet.requestReturns();
    })
}
if($("#submenu").length) {
    $("#submenu div:eq(0)").append('<a href="http://steamcommunity.com/tradeoffer/new/?partner=106750833&token=CXFPs7ON" title="Support LoungeDestroyer further development">LoungeDestroyer &#x2764;</a>')
}
if($("#skin").length) {
    $("#skin").before('<div id="ld_settings"></div>');
    $("#ld_settings").click(function() {
        $("#ld_popup, #overlay-dummy").show();
    })
    $("body").append('<div id="overlay-dummy"></div>' +
        '<div id="ld_popup">' +
        '<div class="popup-title"><span>LoungeDestroyer settings</span><div id="close-btn">&#x2715;</div></div>' +
        '<div class="ld-settings">' +
        '<div>Market prices on items:</div><select id="itemMarketPrices"><option value="1">Enabled</option><option value="0">Disabled</option></select>' +
        '<div>Steam market currency:</div><select id="marketCurrency"><option value="1">USD</option><option value="2">GBP</option><option value="3">EUR</option><option value="5">RUB</option></select>' +
        '<div>Redirect from item draft page:</div><select id="redirect"><option value="1">Enabled</option><option value="0">Disabled</option></select>' +
        '<div>Remove stream from match page:</div><select id="streamRemove"><option value="1">Enabled</option><option value="0">Disabled</option></select>' +
        '</div>' +
        '<div class="footerino"><div>created by NCLA</div><div style="font-weight: bold;font-size:11px;"><a href="http://github.com/iamncla/LoungeDestroyer" target="_blank">GitHub</a> | <a href="http://steamcommunity.com/tradeoffer/new/?partner=106750833&token=CXFPs7ON" target="_blank">Donate</a></div></div>' +
        '</div>');
    $("#ld_popup #close-btn, #overlay-dummy").click(function() {
        $("#ld_popup, #overlay-dummy").hide();
    })
    $.each(Bet.userSettings, function(index, value) {
        $(".ld-settings #" + index + " option[value=" + value + "]").prop('selected', true);
    });

    $(".ld-settings select").on('change', function() {
        Bet.saveSetting(this.id, this.value);
    });
}