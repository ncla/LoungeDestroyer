var Match = function() {};
/**
 * Creates a request to a match page, property matchID has be set before hand on the Match object
 * @param callback Success callback, returns with document object received from the request
 * @param game '730' or '570'
 */
Match.prototype.fetchMatchPage = function(callback, game) {
    if (!game) {
        this.game = appID || '730';
    }

    var _this = this;
    $.ajax({
        url: _this.generateMatchURL(appID),
        type: 'GET',
        success: function(data) {
            var doc = document.implementation.createHTMLDocument('');
            doc.body.innerHTML = data;
            _this.matchPage = data;
            callback(doc);
        }
    });
};
/**
 * Parses the element and sets all information gathered into properties
 * @param elm .matchmain element, exists on home page and on My Bets page
 */
Match.prototype.parseMatchElement = function(elm) {
    // Because the timeFromNow is not wrapped around an element and is a text node, we need to do this..
    var timeFromNow = $('.matchheader > *:eq(0)', elm).contents();
    this.timeFromNow = $(timeFromNow[0]).text() || 'in near future..';

    // This somehow works..
    this.tournamentName = $('.matchheader .eventm', elm).text().trim() || undefined;
    this.matchURL = $('a[href]:first', elm)[0].href;

    // Does not work if it's not run in page context
    this.matchID = $('a[href]:first', elm).attr('href').replace(/\D/g, '');
    this.teamA = $('.teamtext:eq(0) b', elm).text().trim() || $('.changeteam:eq(0)', elm).text().trim() || undefined;
    this.teamB = $('.teamtext:eq(1) b', elm).text().trim() || $('.changeteam:eq(1)', elm).text().trim() || undefined;
    this.bestOf = $('span.format', elm).text().trim().replace('BO', 'Best of ') || undefined;
    this.parsedMatchElement = true;
};
/**
 * Parses the page element and sets all information gathered into properties
 * @param elm The body/page element of match page
 */
Match.prototype.parseMatchPage = function(elm) {
    var matchHeader = $('section.box:eq(0) .box-shiny-alt div[style="display: flex"]', elm);
    this.timeFromNow = $('.half:eq(0)', matchHeader).text().trim();
    this.matchFormat = $('.half:eq(1)', matchHeader).text().trim();
    this.exactTime = $('.half:eq(2)', matchHeader).text().trim();
    this.userBetted = !!$('.box-shiny-alt .winsorloses', elm).length;
};
/**
 *
 * @param appID optional Application ID of the game, 570 for Dota2, anything else is assumed to be CS:GO
 * @requires matchID to be set for the object
 * @returns {string} Match URL
 */
Match.prototype.generateMatchURL = function(appID) {
    return (window.location.protocol != 'chrome-extension:' ? window.location.protocol : 'http:') + '//' + (appID == '570' ? 'dota2lounge.com' : 'csgolounge.com') + '/match?m=' + this.matchID;
};
/**
 * Appends gathered extra match info (best of x, exact time) to targetElement
 * @param targetElement .matchmain element on site
 */
Match.prototype.appendExtraMatchInfo = function(targetElement) {
    var matchHeaderBlock = $('.matchheader .whenm:eq(0)', targetElement);

    // this.userBetted is never === '-'
    if (this.userBetted !== undefined && this.userBetted === ['-', false, true][LoungeUser.userSettings.showBettedIndicator]) {
        $(matchHeaderBlock).prepend('<span class="bettedIndicator">•</span> ');
    }

    if (this.exactTime) {
        var convertedTime = convertLoungeTime(this.exactTime);
        if (convertedTime) {
            this.exactTimeConverted = convertedTime;
        }

        $(matchHeaderBlock).append('<span class="matchExactTime"> <span class="seperator">|</span> ' + this.exactTimeConverted + '</span>');
    }

    if (this.matchFormat) {
        $(matchHeaderBlock).append(' <span class="seperator">|</span> <span class="bestoftype">' + this.matchFormat + '</span>');
    }

    // trim the unneeded spaces
    var redInfo = matchHeaderBlock[0].querySelector('span[style*="#D12121"]');
    if (redInfo) {
        if (!redInfo.textContent.trim().length) {
            matchHeaderBlock[0].removeChild(redInfo);
        }
    }

    this.extraInfoAdded = true;
};
/**
 * Caches the extra match info properties (exactTime, exactTimeConverted, matchFormat)
 */
Match.prototype.cacheMatchExtraInfo = function() {
    if (!this.matchID || !this.matchFormat || !this.exactTime || !this.game) {
        return false;
    }

    matchInfoCachev2[this.game][this.matchID] = {
        time: Date.now(),
        matchFormat: this.matchFormat,
        exactTime: this.exactTime,
        userBetted: this.userBetted
    };
    chrome.storage.local.set({matchInfoCachev2: matchInfoCachev2});
    return true;
};
/**
 * Loads extra match info for .matchmain element and appends it
 * @param targetElement .matchmain element on site
 */
function loadExtraMatchInfo(targetElement) {
    if (!targetElement.matchObj) targetElement.matchObj = new Match();
    var Matchik = targetElement.matchObj;
    if (!Matchik.loading && !Matchik.extraInfoAdded) {
        Matchik.parseMatchElement(targetElement);
        if (matchInfoCachev2[appID].hasOwnProperty(Matchik.matchID) && Date.now() - matchInfoCachev2[appID][Matchik.matchID].time < (5 * 60 * 1000)) {
            // Loop through every cache property and set them within the Match object
            $.each(matchInfoCachev2[appID][Matchik.matchID], function(i, v) {
                Matchik[i] = v;
            });

            Matchik.appendExtraMatchInfo(targetElement);
        } else {
            Matchik.loading = true;
            Matchik.fetchMatchPage(function(document) {
                Matchik.parseMatchPage(document);
                Matchik.cacheMatchExtraInfo();
                Matchik.appendExtraMatchInfo(targetElement);
                Matchik.loading = false;
            })
        }

    }
}
