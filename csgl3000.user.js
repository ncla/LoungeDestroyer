// ==UserScript==
// @name       CS:GO Lounge Destroyer
// @namespace  http://csgolounge.com/
// @version    0.6
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

var Bet3000 = function(matchID) {
    /* Construct */
    var self = this;

    var version = "0.6";

    Loge("LoungeDestroyer " + version + " started");

    this.betAttempts = 0;
    this.inventoryAttempts = 0;
    this.returnAttempts = 0;

    // for handling maintainance errors http://csgolounge.com/break and wait.html page
    if(document.URL.indexOf("/wait.html") != -1 || document.URL.indexOf("/break") != -1 || document.title == "The page is temporarily unavailable") {
        window.location = GM_getValue("intendedVisitURL", location.host);
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

    GM_addStyle(".marketPriced .rarity { background: rgba(255, 255, 255, 0.7) !important; text-shadow: 0px 0px 1px rgba(255, 255, 255, 1); }");

    this.placeBet = function() {
        // to do: add exceptions for "you have too many items in your returns"
        // You have too many items in returns, you have to reclaim it to be able to queue.
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
        var name = $(".smallimg", item).attr("alt");
        if(!$(item).hasClass("marketPriced") && nonMarketItems.indexOf(name) == -1 && nonMarketItems.indexOf($(".rarity", item).text()) == -1 && !$(item).hasClass("loadingPrice")) {
            $(item).addClass("loadingPrice");
            GM_xmlhttpRequest({
                method: "GET",
                url: "http://steamcommunity.com/market/priceoverview/?country=US&currency=1&appid=" + self.appID + "&market_hash_name=" + encodeURI(name),
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
    $("#stream object, #stream iframe").remove();
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