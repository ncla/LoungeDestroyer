var Trade = function(tradeElement) {
    var self = this;
    this.tradeElement = tradeElement;

    var tradeAnchor = $("a[href^=\"trade?\"]:eq(0)", self.tradeElement);
    if($(tradeAnchor).length) {
        console.log("Anchor found");
        this.tradeID = tradeAnchor.attr("href").match(/\d+$/)[0] || false;
    } else {
        console.log("Anchor not found");
    }
};
Trade.prototype.generateTradeURL = function() {
    return;
};
//$(document).ready(function() {
//    $(".tradepoll").each(function(i, v) {
//        var derpTest = new Trade($(v));
//        console.log(derpTest);
//    });
//});