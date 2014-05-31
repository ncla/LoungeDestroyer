// ==UserScript==
// @name       CS:GO Lounge 3000 Destroyer
// @namespace  http://csgolounge.com/
// @version    0.1
// @description  Spam the fuck out of the CS:GL queue system, because it's absolute crap
// @match      http://csgolounge.com/match?m=*
// @copyright  iamncla @ GitHub.com
// ==/UserScript==
var Bet3000 = function(matchID) {
    /* Construct */
    var self = this;
    
    this.ID = matchID;
    this.attempts = 0;
    
    this.itemsInReturn = returns;
    
    this.placeBet = function() {
        if(!this.checkRequirements()) return false;
        // returns variable is created by CS:GL page, true if you are using return items.
        var url = (returns == true ? "ajax/postBet.php" : "ajax/postBetOffer.php");
        $.ajax({
                type: "POST",
                url: url,
                data: $("#betpoll").serialize() + "&match=" + self.ID,
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
    this.checkRequirements = function() {
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
}
if($("#placebut").length) {
    $("#placebut").before("<a class='buttonright' id='realbetbutton'>FUCKING PLACE A BET</a>");
    var Bet = new Bet3000(gup("m"));
    $("#realbetbutton").click(function() {
        Bet.placeBet();
    });
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