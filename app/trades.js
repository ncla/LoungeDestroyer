/**
 * Trade object
 * --
 * Code representation of a specific trade
 * Includes a reference to its representation in DOM,
 * as well as its trade ID and methods for getting
 * and displaying its trade description
 */
var Trade = function(tradeElement) {
    var self = this;
    this.tradeElement = tradeElement;

    var tradeAnchor = $("a[href^=\"trade?\"]:eq(0)", self.tradeElement);
    if($(tradeAnchor).length) {
        this.tradeID = tradeAnchor.attr("href").match(/\d+$/)[0] || false;
    } else {
        console.log("Anchor not found");
    }

    // check if matches hide/mark trade filter
    this.getTradeDescriptionFromHTML();
    this.testFilters();
};
// test self against filters set by user
Trade.prototype.testFilters = function() {
    if (!this.tradeDescription) return;

    if (tradeHideFilter && tradeHideFilter.test(this.tradeDescription)) {
        this.hideSelf();
        return -1;
    }
    if (tradeMarkFilter && tradeMarkFilter.test(this.tradeDescription)) {
        this.tradeElement.classList.add("ld-marked");
        return 0;
    }
    return 1;
}
// hide self
// possibly expand later so that it replaces self with a new trade?
Trade.prototype.hideSelf = function() {
    this.tradeElement.setAttribute("style", "display: none !important;");
}
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
            var desc = $(doc).find(".standard.msgtxt").text().trim();
            self.tradeDescription = desc;
            self.descriptionExtended = true;
            callback(desc);
        }
    });
};
Trade.prototype.addTradeDescription = function() {
    if (LoungeUser.userSettings.showDescriptions === "0") return;

    var self = this;
    if(self.tradeDescription.length > 0) {
        $(self.tradeElement).find(".tradecnt").after('<div class="trade-description"><p>' + removeTags($.trim(self.tradeDescription)) + (self.tradeDescription.length > 240 ? "..." : "") + '</p></div>');
        var tradeDescription = $(".trade-description", self.tradeElement);
        if(self.tradeDescription.length > 240) {
            self.getExtendedTradeDescription(
                function(tradeDescriptionExtended) {
                    $(".trade-description p", self.tradeElement).html(textToUrl(removeTags(tradeDescriptionExtended)));
                    self.testFilters();
                }
            );
        } else {
            $(".trade-description p", self.tradeElement).html(
                textToUrl(removeTags($(".trade-description p", self.tradeElement).text()))
            );
        }
    }
};

/**
 * Uses Lounge's API for getting trades
 * Calls callback with array of Trade instances or error
 *
 * @param int after - timestamp to get trades since
 * @param function callback - function to call with trades
 */
/*function getTrades(callback, after) {
    var strAfter = moment(after||Date.now()).format("YYYY-MM-DD HH:mm:ss");

    $.ajax({
        url: "/ajax/liveTrades",
        type: "POST",
        data: "last="+strAfter+"&",
        success: function(data){
            var doc = document.implementation.createHTMLDocument("");
            doc.body.innerHTML = data;

            // loop through each trade
            var trades = doc.querySelectorAll(".tradepoll"),
                outp = [];

            for (var i = 0, j = trades.length; i < j; ++i) {
                outp.push(new Trade(trades[i]));
            }

            callback(outp);
        },
        error: function(jqXHR, errStatus, errText) {
            callback([], jqXHR, errStatus, errText);
        }
    });
}*/