// ==UserScript==
// @name       CS:GO Lounge 3000 Destroyer
// @namespace  http://csgolounge.com/
// @version    0.1
// @description  Spam the fuck out of the CS:GL queue system, because it's absolute crap
// @match      http://csgolounge.com/*
// @match      http://dota2lounge.com/*
// @copyright  iamncla @ GitHub.com
// ==/UserScript==
var Bet3000 = function(matchID) {
    /* Construct */
    var self = this;
    
    this.attempts = 0;
    
    this.itemsInReturn = returns;
    
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
                        self.attempts = self.attempts + 1;
                        console.log("Try Nr." + self.attempts + ", server denied our bet: " + data);
                        self.placeBet();
                    } else {
                        alert("It seems we successfully placed a bet! It took" + self.attempts + " tries to place the bet.");
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
                console.log("Attempting to get your Steam inventory!");
            }, 2000); // A little more gentle on bashing servers, because it's Volvo, not CS:GL
        }
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