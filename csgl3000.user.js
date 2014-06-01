// ==UserScript==
// @name       CS:GO Lounge 3000 Destroyer
// @namespace  http://csgolounge.com/
// @version    0.3
// @description  Spam the fuck out of the CS:GL queue system, because it's absolute crap
// @match      http://csgolounge.com/*
// @match      http://dota2lounge.com/*
// @updateURL   http://ncla.me/csgl3000/csgl3000.meta.js
// @downloadURL http://ncla.me/csgl3000/csgl3000.user.js
// @copyright  iamncla @ GitHub.com
// ==/UserScript==
/*
    Chaos is order yet undeciphered.
 */
var Bet3000 = function(matchID) {
    /* Construct */
    var self = this;
    
    this.betAttempts = 0;
    this.inventoryAttempts = 0;
    this.returnAttempts = 0;

    if(document.URL.indexOf("wait.html") != -1) {
        window.location = GM_getValue("intendedVisitURL", location.host);
    }

    $("a").click(function(e) {
        if (e.which === 1) {
            e.preventDefault();
            if($(this).attr("href").length > 0) {
                var url = $(this).attr("href");
                GM_setValue("intendedVisitURL", url);
                window.location = url;
            }
        }
    });

    this.placeBet = function() {
        if(!this.checkBetRequirements()) return false;
        // returns variable is created by CS:GL page, true if you are using return items.
        var url = (returns == true ? "ajax/postBet.php" : "ajax/postBetOffer.php");
        $.ajax({
                type: "POST",
                url: url,
                data: $("#betpoll").serialize() + "&match=" + self.matchID,
                success: function(data) {
                    if (data) {
                        self.betAttempts = self.betAttempts + 1;
                        console.log("Try Nr." + self.betAttempts + ", server denied our bet: " + data);
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
        if (typeof ChoseInventoryReturns == 'function') {
            var basher = setInterval(function() {
                if($("#backpack .standard").text().indexOf("Can't get items.") == -1) {
                    clearInterval(basher);
                    $("#showinventorypls").hide();
                    return true;
                }
                var steamAPI = ((Math.floor(Math.random() * (1 - 0 + 1)) + 0) == 0 ? "betBackpackApi" : "betBackpack");
                ChoseInventoryReturns(steamAPI);
                self.inventoryAttempts = self.inventoryAttempts + 1;
                console.log("Attempting to get your Steam inventory, try Nr." + self.inventoryAttempts);
            }, 2000); // A little more gentle on bashing servers, because it's Volvo, not CS:GL
        }
    }
    this.requestReturns = function() {
        // Try Nr.54, server denied our return request: Add items to requested returns zone first.
        // if FALSE, then the items need to be frozen
        // if TRUE, then the items need to be requested for the actual trade
        var ajaxProperties = { url: (toreturn ? "ajax/postToReturn.php" : "ajax/postToFreeze.php") };
        if(toreturn) {
            ajaxProperties.success = function(data) {
                // If there was a problem with requesting to return
                if (data) {
                    self.returnAttempts = self.returnAttempts + 1;
                    console.log("Try Nr." + self.returnAttempts + ", server denied our return request: " + data);
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
                    window.alert(data);
                }
                else {
                    toreturn = true;
                    self.requestReturns();
                }
            }
        }
        $.ajax(ajaxProperties);
    }
}
var Bet = new Bet3000();

if($("#placebut").length) {
    $("#placebut").before("<a class='buttonright' id='realbetbutton'>FUCKING PLACE A BET</a>");
    Bet.matchID = gup("m");
    $("#realbetbutton").click(function() {
        Bet.placeBet();
    });
}
if($("#backpack").length) {
    if($("#backpack #loading").length) {
        // DOMSubtreeModified might have poor support
        $("#backpack").bind("DOMSubtreeModified", function(event) {
            if($("#backpack .standard").text().indexOf("Can't get items.") != -1) {
                $("#backpack").unbind();
                $("#backpack").before("<a class='buttonright' id='showinventorypls'>FUCKING GET MY INVENTORY</a>");
                $("#showinventorypls").click(function() {
                    Bet.getInventoryItems();
                })
            }
        })
    }
}
if($("#freezebutton").length) {
    $("#freezebutton").after("<a class='buttonright' id='returnitemspls'>RETURN MY FUCKING ITEMS</a>");
    $("#returnitemspls").click(function() {
        Bet.requestReturns();
    })
}

function gup(name) {
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( results == null )
        return null;
    else
        return results[1];
}