var Trade = function(tradeElement) {
    var self = this;
    this.tradeElement = tradeElement;

    var tradeAnchor = $("a[href^=\"trade?\"]:eq(0)", self.tradeElement);
    if($(tradeAnchor).length) {
        this.tradeID = tradeAnchor.attr("href").match(/\d+$/)[0] || false;
    } else {
        console.log("Anchor not found");
    }
};
Trade.prototype.generateTradeURL = function() {
    return;
};
Trade.prototype.getTradeDescriptionFromHTML = function() {
    var self = this;
    this.tradeDescription = $(self.tradeElement).find(".tradeheader").attr("title");
    return this.tradeDescription;
};
Trade.prototype.getExtendedTradeDescription = function(callback) {
    var self = this;
    console.log("Fetching extended trade description for " + window.location.origin + "/trade?t=" + self.tradeID);
    $.ajax({
        url: window.location.origin + "/trade?t=" + self.tradeID,
        type: "GET",
        success: function(data) {
            var doc = document.implementation.createHTMLDocument("");
            doc.body.innerHTML = data;
            callback(
                $.trim($(doc).find(".standard.msgtxt").text())
            );
        }
    });
};
Trade.prototype.addTradeDescription = function() {
    var self = this;
    self.getTradeDescriptionFromHTML();
    if(self.tradeDescription.length > 0) {
        $(self.tradeElement).find(".tradecnt").after('<div class="trade-description"><p>' + $.trim(self.tradeDescription) + (self.tradeDescription.length > 240 ? "..." : "") + '</p></div>');
        var tradeDescription = $(".trade-description", self.tradeElement);
        if(self.tradeDescription.length > 240) {
            self.getExtendedTradeDescription(
                function(tradeDescriptionExtended) {
                    $(".trade-description p", self.tradeElement).text(textToUrl(tradeDescriptionExtended));
                }
            );
        } else {
            $(".trade-description p", self.tradeElement).text(
                textToUrl($(".trade-description p", self.tradeElement).text())
            );
        }
    }
};