var matchesFiltered = 0;

var Match = function(matchElement) {
    if (matchElement !== undefined) {
        this.matchElement = matchElement;
        this.matchIsFiltered = false;
        this.extraMatchInfoLoaded = false;
        this.parsedMatchElement = false;

        this.parseMatchElement(matchElement);

        this.addCachedMatchInfo();
        this.appendExtraMatchInfo(this.matchElement);

        // Not interested in filtering when on my bets page
        // TODO: Maybe move this out of constructor and place within inject.js instead?
        if (window.location.pathname !== '/mybets' && LoungeUser.userSettings.globalMatchFilters === '1') {
            this.testMatchFilters();
        }
    }
};
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
        dataType: 'html',
        type: 'GET',
        success: function(data) {
            callback(data);
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
    this.matchID = parseInt($('a[href]:first', elm).attr('href').replace(/\D/g, '')) || undefined;
    this.teamA = $('.teamtext:eq(0) b', elm).text().trim() || $('.changeteam:eq(0)', elm).text().trim() || undefined;
    this.teamB = $('.teamtext:eq(1) b', elm).text().trim() || $('.changeteam:eq(1)', elm).text().trim() || undefined;
    this.bestOf = parseInt($('span.format', elm).text().trim().replace( /^\D+/g, '')) || 0;
    this.teamOddsA = parseInt($('.teamtext:eq(0) i', elm).text().trim().replace( /^\D+/g, '')) || undefined;
    this.teamOddsB = parseInt($('.teamtext:eq(1) i', elm).text().trim().replace( /^\D+/g, '')) || undefined;
    this.closedMatch = $('.match.notavailable', elm).length === 1;
    this.parsedMatchElement = true;
};
/**
 * Parses the page element and sets all information gathered into properties
 * @param elm The body/page element of match page
 */
Match.prototype.parseMatchPage = function(response) {
    var _this = this;

    var doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = response;

    var matchHeader = $('section.box:eq(0) .box-shiny-alt div[style="display: flex"]', doc);
    this.timeFromNow = $('.half:eq(0)', matchHeader).text().trim();
    this.matchFormat = $('.half:eq(1)', matchHeader).text().trim();
    this.exactTime = $('.half:eq(2)', matchHeader).text().trim();
    this.userBetted = !!$('.box-shiny-alt .winsorloses', doc).length;

    this.amountOfBetsPlaced = 0;
    this.amountOfItemsPlaced = 0;

    if (LoungeUser.userSettings.displayAmountsPlaced !== '0') {
        var matchStats = $('section.box:eq(1) .box-shiny-alt .full', doc);
        var matchStatsRegex = $(matchStats).text().match(/\d+/g);

        if (matchStatsRegex !== null) {
            this.amountOfBetsPlaced = parseFloat(matchStatsRegex[0]) || 0;

            if (matchStatsRegex[1]) {
                this.amountOfItemsPlaced = parseFloat(matchStatsRegex[1]) || 0;
            }
        }
    }

    this.teamBetOn = -1;

    $matchSection = $('section.box:eq(0) .box-shiny-alt', doc);
    if ($('a:eq(0)', $matchSection).hasClass('active')) {
        this.teamBetOn = 0;
    }
    if ($('a:eq(1)', $matchSection).hasClass('active')) {
        this.teamBetOn = 1;
    }

    this.totalBet = 0;

    if (this.teamBetOn !== -1) {
        $('.box-shiny-alt .winsorloses .oitm', doc).each(function(itemIndex, itemValue) {
            var item = itemObject(itemValue);
            _this.totalBet = _this.totalBet + item.loungeValue;
        });
    }

    var textValueForOneA = $($('div[style="float: left; margin: 0.25em 2%;"]', doc).contents()[2]).text().replace(',', '.');
    var textValueForOneB = $($('div[style="float: right; margin: 0.25em 2%;"]', doc).contents()[2]).text().replace(',', '.');

    var regexValueTeamA = textValueForOneA.match(new RegExp('[-+]?\\d*\\.\\d+|\\d+', 'g'));
    var regexValueTeamB = textValueForOneB.match(new RegExp('[-+]?\\d*\\.\\d+|\\d+', 'g'));

    if(regexValueTeamA !== null && regexValueTeamB !== null) {
        this.valueForOneTeamA = (regexValueTeamA.length === 3 ? regexValueTeamA[1] : regexValueTeamA[0]);
        this.valueForOneTeamB = (regexValueTeamB.length === 3 ? regexValueTeamB[1] : regexValueTeamB[0]);
    } else {
        this.valueForOneTeamA = this.valueForOneTeamB = undefined;
    }
};

Match.prototype.testMatchFilters = function() {
    if(LoungeUser.userSettings.matchHideLive === '1' && this.timeFromNow.indexOf('ago') !== -1 && !this.closedMatch) {
        console.log('MATCHES :: Hiding match #' + this.matchID + ' because it has already started');
        return this.hide();
    }

    var maxOdds = parseInt(LoungeUser.userSettings.matchFilterMaxOdds) || 100;

    if(this.teamOddsA > maxOdds || this.teamOddsB > maxOdds) {
        console.log('MATCHES :: Hiding match #' + this.matchID + ' because heavy favorite');
        return this.hide();
    }

    if(LoungeUser.userSettings.matchTournamentFiltersArray.indexOf(this.tournamentName) !== -1) {
        console.log('MATCHES :: Hiding match #' + this.matchID + ' because tournament is blacklisted');
        return this.hide();
    }

    var teamsHideArray = LoungeUser.userSettings.matchTeamFiltersArray;

    if(teamsHideArray.indexOf(this.teamA) !== -1 || teamsHideArray.indexOf(this.teamB) !== -1) {
        console.log('MATCHES :: Hiding match #' + this.matchID + ' because team is blacklisted');
        return this.hide();
    }
};

Match.prototype.hide = function() {
    if(hideFilteredMatches === true) {
        $(this.matchElement).hide();
    }

    this.matchIsFiltered = true;
    $(this.matchElement).addClass('ld-filtered');
    updateFilteredMatchCount();

    return true;
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

    if (this.userBetted === false && ['1', '3'].indexOf(LoungeUser.userSettings.showBettedIndicatorv2) !== -1) {
        $(matchHeaderBlock).prepend('<span class="bettedIndicator">✘</span> ');
    }

    if (this.userBetted === true && ['2', '3'].indexOf(LoungeUser.userSettings.showBettedIndicatorv2) !== -1) {
        $(matchHeaderBlock).prepend('<span class="bettedIndicator">✔</span> ');
    }

    if (this.exactTime) {
        var time = this.exactTimeConverted = (LoungeUser.userSettings.changeTimeToLocal === '1' ? convertLoungeTime(this.exactTime) : this.exactTime);

        if (time) {
            $(matchHeaderBlock).append('<span class="matchExactTime"> <span class="seperator">|</span> ' + time + '</span>');
        }
    }

    if (this.matchFormat) {
        $matchFormat = $('<span class="bestoftype"></span>');
        $matchFormat.text(this.matchFormat);

        $(matchHeaderBlock)
            .append(' <span class="seperator">|</span> ')
            .append($matchFormat);
    }

    if (LoungeUser.userSettings.displayAmountsPlaced !== '0') {
        if (LoungeUser.userSettings.displayAmountsPlaced === '1' && this.amountOfItemsPlaced) {
            $itemsPlaced = $('<span class="ld-totalitems"></span>');
            $itemsPlaced.text(this.amountOfItemsPlaced + ' items placed');

            $(matchHeaderBlock)
                .append(' <span class="seperator">|</span> ')
                .append($itemsPlaced);
        }

        if (LoungeUser.userSettings.displayAmountsPlaced === '2' && this.amountOfBetsPlaced) {
            $betsPlaced = $('<span class="ld-totalbets"></span>');
            $betsPlaced.text(this.amountOfBetsPlaced + ' bets placed');

            $(matchHeaderBlock)
                .append(' <span class="seperator">|</span> ')
                .append($betsPlaced);
        }
    }

    if (LoungeUser.userSettings.showValueForOneIndicator === '1' && this.valueForOneTeamA && this.valueForOneTeamB) {
        $('.teamtext:eq(0) i', this.matchElement).append(' <span class="ld-valueForOne">(' + parseFloat(this.valueForOneTeamA) + ' for 1)</span>');
        $('.teamtext:eq(1) i', this.matchElement).append(' <span class="ld-valueForOne">(' + parseFloat(this.valueForOneTeamB) + ' for 1)</span>');
    }

    if (LoungeUser.userSettings.underlineTeamUserBetOn === '1' && this.teamBetOn !== undefined && this.teamBetOn > -1) {
        $(this.matchElement).addClass((this.teamBetOn === 0 ? 'ld-bet-teamleft' : 'ld-bet-teamright'));
        $('.teamtext:eq("' + this.teamBetOn + '") b', this.matchElement).addClass('ld-teambeton');
    }

    if (this.teamBetOn !== -1 && this.totalBet > 0) {
        $('.teamtext:eq("' + this.teamBetOn + '")', this.matchElement).parent().attr('title', 'You placed ' + convertPrice(this.totalBet, true) + ' on this match');
    }

    // trim the unneeded spaces
    if (matchHeaderBlock.length) {
        var redInfo = $('span[style*="#D12121"]', matchHeaderBlock);
        if (redInfo.length) {
            if (!redInfo.text().trim().length) {
                redInfo.remove();
            }
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
        userBetted: this.userBetted,
        valueForOneTeamA: this.valueForOneTeamA,
        valueForOneTeamB: this.valueForOneTeamB,
        amountOfBetsPlaced: this.amountOfBetsPlaced,
        amountOfItemsPlaced: this.amountOfItemsPlaced,
        teamBetOn: this.teamBetOn,
        totalBet: this.totalBet
    };
    chrome.storage.local.set({matchInfoCachev2: matchInfoCachev2});
    return true;
};

Match.prototype.addCachedMatchInfo = function() {
    var _this = this;

    if (matchInfoCachev2[appID].hasOwnProperty(this.matchID) &&
        Date.now() - matchInfoCachev2[appID][this.matchID].time < (parseInt(LoungeUser.userSettings.cacheTimeMatchExtra) * 60 * 1000))
    {
        // Loop through every cache property and set them within the Match object
        $.each(matchInfoCachev2[appID][this.matchID], function(i, v) {
            _this[i] = v;
        });
        _this.extraMatchInfoLoaded = true;
    }

    return this;
};

Match.prototype.loadExtraMatchInfo = function() {
    var _this = this;

    // Simple check to see if we have the extra match info already
    if(this.extraMatchInfoLoaded === true || this.loading === true) return false;

    this.loading = true;
    this.fetchMatchPage(function(response) {
        _this.parseMatchPage(response);
        _this.cacheMatchExtraInfo();
        _this.appendExtraMatchInfo(_this.matchElement);
        _this.loading = false;
        _this.extraMatchInfoLoaded = true;
    });

    return this;
};

function matchObject(domObj) {
    var $match = $(domObj);
    if (!$match.data('match-data')) {
        $match.data('match-data', new Match($match));
    }

    return $match.data('match-data');
}

function updateFilteredMatchCount() {
    matchesFiltered++;
    if(LoungeUser.userSettings.showMatchFilterBox === '1') {
        $('.ld-match-filters span.ld-filtered-amount').text(matchesFiltered + (matchesFiltered === 1 ? ' match was' : ' matches were'));
        $('.ld-match-filters .ld-match-filters-buttons .ld-matches-show').show();
    }
}

function toggleFilteredMatches(button) {
    hideFilteredMatches = !hideFilteredMatches;

    $('.matchmain.ld-filtered').each(function(index, value) {
        var match = matchObject(value);
        if(hideFilteredMatches) {
            $(match.matchElement).hide()
        } else {
            $(match.matchElement).show();
        }
    });

    $(button).text(hideFilteredMatches ? 'Show filtered matches' : 'Hide filtered matches');
}