/**
 * Trade object
 * --
 * Code representation of a specific trade
 * Includes a reference to its representation in DOM,
 * as well as its trade ID and methods for getting
 * and displaying information
 */
var Trade = function(tradeElement) {
    var _this = this;

    this.fetchingExtraData = false;
    this.extraDataFetched = false;
    this.tradeIsFiltered = false;
    this.tradeDescriptionIsExtended = false;

    // This allows us to use the object functions as static functions without constructing the object
    if (tradeElement !== undefined) {
        this.tradeElement = tradeElement;

        var tradeAnchor = $('a[href^="trade?"]:eq(0)', _this.tradeElement);
        if ($(tradeAnchor).length) {
            this.tradeID = tradeAnchor.attr('href').match(/\d+$/)[0] || false;
        }

        this.getTradeDescriptionFromHTML();
        if(LoungeUser.userSettings.globalTradeFilters === '1' && !this.tradeIsFiltered) {
            this.filterByTradeData();
        }
    }

    return this;
};

Trade.prototype.getExtraData = function() {
    var _this = this;

    if(!this.tradeID || this.fetchingExtraData || this.extraDataFetched || this.tradeIsFiltered) {
        return;
    }

    // Basic trade/user data from site trade page
    this.fetchTradeData(function() {
        // Filter by this acquired trade data
        if(LoungeUser.userSettings.globalTradeFilters === '1') {
            _this.filterByExtendedTradeData();
        }

        _this.appendTradeData();

        // If we need Steam user data, we fetch that as well
        if(!_this.tradeIsFiltered && LoungeUser.userSettings.tradeLoadSteamData === '1' && _this.profileId) {
            _this.getExtraSteamData(_this.profileId, function() {

                if(LoungeUser.userSettings.globalTradeFilters === '1') {
                    _this.filterBySteamData();
                }

                _this.appendSteamData();
            });

        }

    });

    return this;
};

Trade.prototype.fetchTradeData = function(callback) {
    var _this = this;

    this.fetchingExtraData = true;

    $.ajax({
        url: _this.generateTradeURL(appID),
        type: 'GET',
        success: function(data) {
            var doc = document.implementation.createHTMLDocument('');
            doc.body.innerHTML = data;

            var desc = $(doc).find('.standard.msgtxt').text().trim();
            _this.tradeDescriptionIsExtended = true;
            _this.tradeDescription = desc;

            var $profileLink = $('.profilesmallheader a', doc);
            if($profileLink.length) {
                _this.profileId = $profileLink.attr('href').match(/\d+/)[0];
            } else {
                this.profileId = null;
            }

            _this.avatarMediumUrl = $('.profilesmall img:eq(0)', doc).attr('src') || null;
            // Some users don't have a trade URL
            _this.tradeurl = $('#offer a[href*="/tradeoffer/new/?partner="]', doc).attr('href') || null;

            var steamlevel = parseInt($('.profilesmall .slvl', doc).text());
            _this.steamlevel = (steamlevel >= 0 ? steamlevel : null);

            _this.extraDataFetched = true;

            callback();
        },
        error: function() {
            callback();
        }
    });

    return this;
};

Trade.prototype.getExtraSteamData = function(profileId, callback) {
    var _this = this;

    this.steamUser = {};

    $.ajax({
        url: (window.location.protocol + '//steamcommunity.com/profiles/' + profileId + '?xml=1'),
        type: 'GET',
        success: function(data) {
            _this.steamUser.isPublicProfile = $(data).find('privacyState').text() !== 'private';

            _this.steamUser.vacBannedCount = parseInt($(data).find('vacBanned').text());

            _this.steamUser.onlineState = (_this.steamUser.isPublicProfile) ? $(data).find('onlineState').text() : 'private';

            _this.steamUser.creationMoment = moment($(data).find('memberSince').text(), "MMMM DD YYYY");

            if(_this.steamUser.isPublicProfile) {
                var nowMoment = moment();
                _this.steamUser.memberSince = _this.steamUser.creationMoment.unix();
                _this.steamUser.accAgeInDays = nowMoment.diff(_this.steamUser.creationMoment, 'days');
            } else {
                _this.steamUser.memberSince = null;
                _this.steamUser.accAgeInDays = 0;
            }

            // There are some rare cases where Lounge does not want to output avatar/Steam level in the source code of trade page
            if (_this.avatarMediumUrl === null) {
                _this.avatarMediumUrl = $(data).find('avatarMedium:eq(0)').text();
            }

            var hoursPlayed2w = 0;
            var hoursPlayedTotal = 0;

            $(data).find('mostPlayedGames > mostPlayedGame').each(function(i, v) {
                var hours2w = parseFloat($(v).find('hoursPlayed').text()) || 0;
                var hoursAll = parseFloat($(v).find('hoursOnRecord').text().replace(',', '')) || 0;
                hoursPlayed2w = hoursPlayed2w + hours2w;
                hoursPlayedTotal = hoursPlayedTotal + hoursAll;
            });

            _this.steamUser.hoursPlayed2w = hoursPlayed2w;
            _this.steamUser.hoursPlayedTotal = hoursPlayedTotal;

            callback();
        },
        error: function() {
            callback();
        }
    });

    return this;
};

Trade.prototype.appendTradeData = function() {
    var _this = this;

    if(!$('span[style*="float: right"]', _this.tradeElement).length) {
        $(_this.tradeElement).find('.tradeheader').append('<span style="float: right"></span>');
    }

    $tradeHeader = $(_this.tradeElement).find('.tradeheader span[style*="float: right"]');

    if(_this.profileId) {
        var profileBtn = $('<a class="button destroyer steam-profile" style="float: none;" href="https://steamcommunity.com/profiles/' + _this.profileId + '" target="_blank">Steam profile</a>').hide();
        $tradeHeader.append(profileBtn);
        profileBtn.fadeIn();
    }

    if(_this.tradeurl) {
        var tradeOfferBtn = $('<a class="button destroyer trade-offer" style="float: none;" href="' + _this.tradeurl + '" target="_blank">Trade offer</a>').hide();
        $tradeHeader.append(tradeOfferBtn);
        tradeOfferBtn.fadeIn();
    }

    if(LoungeUser.userSettings.tradeLoadSteamData === '0' && this.steamlevel >= 0) {
        var steamLvlElm = $('<span> (Level ' + _this.steamlevel + ')</span>').hide();
        $('a[href^="trade?"]:eq(0)', _this.tradeElement).append(steamLvlElm);
        $(steamLvlElm).fadeIn();
    }

    if (LoungeUser.userSettings.showTradeDescriptions === '1' && _this.tradeDescription.length > 0) {
        var tradeDescriptionElm = $('<div class="trade-description"><p></p></div>').hide();
        $(_this.tradeElement).find('.tradecnt').after(tradeDescriptionElm);
        $('p', tradeDescriptionElm).html(textToUrl(removeTags(_this.tradeDescription)));
        $(tradeDescriptionElm).slideDown();
    }

    return this;
};

Trade.prototype.appendSteamData = function() {
    var _this = this;

    var $steamExtraElm = $('<div class="ld-steam-extra-wrapper"><div class="ld-steam-extra"></div></div>');

    $('.tradeheader', _this.tradeElement).after($steamExtraElm);

    var $steamExtra = $('.ld-steam-extra', _this.tradeElement);

    $steamExtra.append(
        '<div class="ld-steam-info">' +
        '<a class="ld-steam-img" href="https://steamcommunity.com/profiles/' + _this.profileId + '"><img src="' + _this.avatarMediumUrl + '"/></a>' +
        '<div class="ld-steam-status">' + _this.steamUser.onlineState + '</div>' +
        '</div>'
    );

    if (_this.steamUser.memberSince) {
        $steamExtra.append('<div class="ld-steam-info"><div class="ld-info-label">Date joined:</div> <div class="ld-info-val">' + moment.unix(_this.steamUser.memberSince).format('MMM Do, YYYY') + '</div></div>');
    }

    $steamExtra.append('<div class="ld-steam-info"><div class="ld-info-label">VAC bans:</div> <div class="ld-info-val">' + _this.steamUser.vacBannedCount + '</div></div>');

    var steamlevel = (_this.steamlevel !== null ? _this.steamlevel : 'Not found');
    $steamExtra.append('<div class="ld-steam-info"><div class="ld-info-label">Steam level:</div> <div class="ld-info-val">' + steamlevel + '</div></div>');

    $steamExtra.append('<div class="ld-steam-info" title="Calculated from only three recently played games, this is done to save on extra, not so necessary API requests"><div class="ld-info-label">Game time all time:</div> <div class="ld-info-val">' + _this.steamUser.hoursPlayedTotal.toFixed(1) + 'h</div></div>');

    // http://stackoverflow.com/q/7069167
    setTimeout(function() {
        $('.ld-steam-extra-wrapper', _this.tradeElement).addClass('ld-slidedown');
    }, 5);

    return this;
};

Trade.prototype.filterByTradeData = function() {
    var _this = this;

    if(LoungeUser.userSettings.hideDonatorTrades === '1') {
        $tradeLinkJumbo = $('.tradeheader a[href^="trade?"]:eq(0) span:eq(0)', this.tradeElement);

        if ($tradeLinkJumbo.length && $tradeLinkJumbo.attr('class') !== undefined && $tradeLinkJumbo.attr('class').indexOf('donor') !== -1) {
            console.log('TRADES :: Hiding trade #' + this.tradeID + ' because user is donator');
            return this.hide();
        }
    }

    this.filterByTradeDescription();

    if(this.tradeIsFiltered) return true;

    var haveItemsFiltered = false;

    $('.tradecnt .left .oitm.notavailable', this.tradeElement).each(function(i, v) {
        var item = itemObject(v);
        if(tradeItemsHaveArr.indexOf(item.itemName) !== -1) {
            console.log('TRADES :: Hiding trade #' + this.tradeID + ' because the item is in the have list filter');
            haveItemsFiltered = true;
            return false;
        }
    });

    if(haveItemsFiltered) return _this.hide();

    var wantItemsFiltered = false;

    $('.tradecnt .right .oitm.notavailable', this.tradeElement).each(function(i, v) {
        var item = itemObject(v);
        if(tradeItemsWantArr.indexOf(item.itemName) !== -1) {
            console.log('TRADES :: Hiding trade #' + this.tradeID + ' because the item is in the want list filter');
            wantItemsFiltered = true;
            return false;
        }
    });

    if(wantItemsFiltered) return _this.hide();

    return false;
};

Trade.prototype.filterByTradeDescription = function() {
    if (!this.tradeDescription) return;

    if (tradeShowFilter) {
        if(this.tradeDescriptionIsExtended && !tradeShowFilter.test(this.tradeDescription)) {
            console.log('TRADES :: Hiding trade #' + this.tradeID + ' because it did not match Show trade filter');
            return this.hide();
        }
    }

    // Hide filters
    if (tradeHideFilter && tradeHideFilter.test(this.tradeDescription)) {
        console.log('TRADES :: Hiding trade #' + this.tradeID + ' because it matched Hide trade filter');
        return this.hide();
    }

    return false;
};

Trade.prototype.filterByExtendedTradeData = function() {
    this.filterByTradeDescription();

    if(this.steamlevel !== null && this.steamlevel < parseInt(LoungeUser.userSettings.minSteamLevel)) {
        console.log('TRADES :: Hiding trade #' + this.tradeID + ' because Steam level did not match');
        return this.hide();
    }

    if(this.tradeurl == null && this.profileId && LoungeUser.userSettings.hideNoTradeofferTrades === '1') {
        console.log('TRADES :: Hiding trade #' + this.tradeID + ' because no trade offer link');
        return this.hide();
    }

    return false;
};

Trade.prototype.filterBySteamData = function() {
    if(!this.steamUser) return false;

    if(this.steamUser.accAgeInDays < parseInt(LoungeUser.userSettings.minAccAgeDays)) {
        console.log('TRADES :: Hiding trade #' + this.tradeID + ' because account age did not match');
        return this.hide();
    }

    if(this.steamUser.hoursPlayedTotal < parseInt(LoungeUser.userSettings.minAlltimePlaytime)) {
        console.log('TRADES :: Hiding trade #' + this.tradeID + ' because min. game time did not match');
        return this.hide();
    }

    if(LoungeUser.userSettings.hideTradesPrivateProfile === '1' && this.steamUser.isPublicProfile === false) {
        console.log('TRADES :: Hiding trade #' + this.tradeID + ' because profile is private');
        return this.hide();
    }

    if(this.steamUser.vacBannedCount > LoungeUser.userSettings.maxVacBans) {
        console.log('TRADES :: Hiding trade #' + this.tradeID + ' because user has VAC bans');
        return this.hide();
    }

    return false;
};

Trade.prototype.hide = function() {
    var _this = this;

    if(hideFilteredTrades === true) {
        $(this.tradeElement).hide();
    }
    $(this.tradeElement).addClass('ld-filtered');

    this.tradeIsFiltered = true;
    updateFilteredTradeCount();

    return true;
};

Trade.prototype.generateTradeURL = function(appID) {
    if(typeof appID === 'undefined') {
        appID = '730';
    }

    if(!this.tradeID) {
        return;
    }
    return window.location.protocol + '//' + (appID == '730' ? 'csgolounge.com' : 'dota2lounge.com') + '/trade?t=' + this.tradeID;
};

Trade.prototype.getTradeDescriptionFromHTML = function() {
    this.tradeDescription = $(this.tradeElement).find('.tradeheader').attr('title');
    return this.tradeDescription;
};

function tradeObject(domObj) {
    var $trade = $(domObj);
    if (!$trade.data('trade-data')) {
        $trade.data('trade-data', new Trade($trade));
    }

    return $trade.data('trade-data');
}


function updateFilteredTradeCount() {
    tradesFiltered++;
    if(LoungeUser.userSettings.showTradeFilterBox === '1') {
        $('.ld-trade-filters span.ld-filtered-amount').text(tradesFiltered + (tradesFiltered === 1 ? ' trade was' : ' trades were'));
        $('.ld-trade-filters .ld-trade-filters-buttons .ld-trades-show').show();
    }

    if (LoungeUser.userSettings.tradeLoadExtra === '3' || (LoungeUser.userSettings.tradeLoadExtra === '4' && !isHomepage)) {
        console.log('TRADES :: A trade was filtered, checking new trades in view');

        $(document).ready(function() {
            $('.tradepoll:not(.notavailable)').each(function(index, value) {
                var trade = tradeObject(value);
                if(isScrolledIntoView(trade.tradeElement)) {
                    trade.getExtraData();
                }
            });
        });
    }
}

function toggleFilteredTrades(button) {
    hideFilteredTrades = !hideFilteredTrades;

    $('.tradepoll.ld-filtered').each(function(index, value) {
        var trade = tradeObject(value);
        if(hideFilteredTrades) {
            $(trade.tradeElement).hide()
        } else {
            $(trade.tradeElement).show();
        }
    });

    $(button).text(hideFilteredTrades ? 'Show filtered trades' : 'Hide filtered trades');
}