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
    this.tradeisFiltered = false;
    this.tradeDescriptionIsExtended = false;

    // This allows us to use the object functions as static functions without constructing the object
    if (tradeElement !== undefined) {
        this.tradeElement = tradeElement;

        var tradeAnchor = $('a[href^="trade?"]:eq(0)', _this.tradeElement);
        if ($(tradeAnchor).length) {
            this.tradeID = tradeAnchor.attr('href').match(/\d+$/)[0] || false;
        } else {
            console.log('Anchor not found');
        }

        // check if matches hide/mark trade filter
        this.getTradeDescriptionFromHTML();
        if(LoungeUser.userSettings.globalTradeFilters === '1') {
            this.filterByTradeData();
        }
    }
};

Trade.prototype.fetchExtraData = function(callback) {
    var _this = this;

    if(!this.tradeID || this.fetchingExtraData || this.extraDataFetched || this.tradeIsFiltered) {
        return;
    }

    this.fetchingExtraData = true;

    $.ajax({
        url: _this.generateTradeURL(),
        type: 'GET',
        success: function(data) {
            console.time('fetchExtraData init');
            var doc = document.implementation.createHTMLDocument('');
            doc.body.innerHTML = data;

            var desc = $(doc).find('.standard.msgtxt').text().trim();
            _this.tradeDescriptionExtended = true;
            _this.tradeDescription = desc;

            _this.profileId = $('.profilesmallheader a', doc).attr('href').match(/\d+/)[0] || null;
            _this.avatarMediumUrl = $('.profilesmall img:eq(0)', doc).attr('src') || null;
            // Some users don't have a trade URL
            _this.tradeurl = $('#offer a[href*="/tradeoffer/new/?partner="]', doc).attr('href') || null;
            _this.steamlevel = parseInt($('.profilesmall .slvl', doc).text().match(/\d+/)[0]) || null; // Maybe better handling?
            //console.log(_this.steamlevel);
            var steamLevelCssClass = $('.profilesmall .slvl', doc).attr('class').split(' ')[1] || null;

            console.timeEnd('fetchExtraData init');

            //console.log('slvl class', steamLevelCssClass);

            //console.log(_this.profileId, _this.avatarMediumUrl, _this.tradeurl, _this.steamlevel, _this.tradeID);
            //console.log(_this.tradeDescription);

            console.time('fetchExtraData append');

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

            if(LoungeUser.userSettings.tradeLoadSteamData === '0') {
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

            _this.extraDataFetched = true;

            var $steamExtraElm = $('<div class="ld-steam-extra-wrapper"><div class="ld-steam-extra"></div></div>');

            $('.tradeheader', _this.tradeElement).after($steamExtraElm);

            console.timeEnd('fetchExtraData append');

            //$('.ld-steam-extra', _this.tradeElement).hide();
            if(LoungeUser.userSettings.globalTradeFilters === '1') {
                _this.filterByExtendedTradeData();
            }

            if(!_this.tradeIsFiltered && LoungeUser.userSettings.tradeLoadSteamData === '1') {
                _this.getExtraSteamData(_this.profileId, function(info) {
                    //console.log(info);

                    _this.steamData = info;

                    if(LoungeUser.userSettings.globalTradeFilters === '1') {
                        _this.filterBySteamData();
                    }
                    console.time('steamextra append');
                    $steamExtra = $('.ld-steam-extra', _this.tradeElement);
                    $steamExtra.append(
                        '<div class="ld-steam-info">' +
                        '<a class="ld-steam-img" href="https://steamcommunity.com/profiles/' + _this.profileId + '"><img src="' + _this.avatarMediumUrl + '"/></a>' +
                        '<div class="ld-steam-status">' + info.onlineState + '</div>' +
                        '</div>'
                    );
                    $steamExtra.append('<div class="ld-steam-info"><div class="ld-info-label">Date joined:</div> <div class="ld-info-val">' + moment.unix(info.joinDate).format('MMM Do, YYYY') + '</div></div>');
                    $steamExtra.append('<div class="ld-steam-info"><div class="ld-info-label">VAC bans:</div> <div class="ld-info-val">' + info.vacBans + '</div></div>');
                    $steamExtra.append('<div class="ld-steam-info"><div class="ld-info-label">Steam level:</div> <div class="ld-info-val">' + _this.steamlevel + '</div></div>');
                    //$steamExtra.append('<div class="ld-steam-info" title="Calculated from only three recently played games, this is done to save on extra, not so necessary API requests"><div class="ld-info-label">Game time 2 weeks:</div> <div class="ld-info-val">' + info.gametime_2weeks.toFixed(1) + 'h</div></div>');
                    $steamExtra.append('<div class="ld-steam-info" title="Calculated from only three recently played games, this is done to save on extra, not so necessary API requests"><div class="ld-info-label">Game time all time:</div> <div class="ld-info-val">' + info.gametime_total.toFixed(1) + 'h</div></div>');
                    $('.ld-steam-extra-wrapper', _this.tradeElement).addClass('ld-slidedown');
                    console.timeEnd('steamextra append');
                });
            }

            callback();
        },
        error: function() {
            callback();
        }
    });
};

Trade.prototype.getExtraSteamData = function(profileId, callback) {
    console.log((window.location.protocol + '//steamcommunity.com/profiles/' + profileId + '?xml=1'));
    $.ajax({
        url: (window.location.protocol + '//steamcommunity.com/profiles/' + profileId + '?xml=1'),
        type: 'GET',
        success: function(data) {
            //console.log(data);
            //console.log(this.url);

            console.time('steamextra fetch');

            var isPublicProfile = $(data).find('privacyState').text() !== 'private';

            //console.log('vacbans', $(data).find('vacBanned').text());
            var vacBannedCount = parseInt($(data).find('vacBanned').text());

            //console.log('online state', $(data).find('onlineState').text());
            var onlineState = (isPublicProfile) ? $(data).find('onlineState').text() : 'private';

            //console.log('trade ban', $(data).find('tradeBanState').text());
            //var isTradeBanned = $(data).find('tradeBanState').text();

            //console.log('limited account', $(data).find('isLimitedAccount').text());
            //var isLimited = $(data).find('isLimitedAccount').text();

            //console.log('member since', $(data).find('memberSince').text());

            var creationMoment = moment($(data).find('memberSince').text(), "MMMM DD YYYY");

            if(isPublicProfile) {
                var nowMoment = moment();
                memberSince = creationMoment.unix();
                accAgeInDays = nowMoment.diff(creationMoment, 'days');
            } else {
                memberSince = null;
                accAgeInDays = 0;
            }


            var hoursPlayed2w = 0;
            var hoursPlayedTotal = 0;

            $(data).find('mostPlayedGames > mostPlayedGame').each(function(i, v) {
                //console.log($(v).find('gameName').text());
                var hours2w = parseFloat($(v).find('hoursPlayed').text()) || 0;
                var hoursAll = parseFloat($(v).find('hoursOnRecord').text().replace(',', '')) || 0;
                hoursPlayed2w = hoursPlayed2w + hours2w;
                hoursPlayedTotal = hoursPlayedTotal + hoursAll;
            });

            console.timeEnd('steamextra fetch');

            callback({
                isPublicProfile: isPublicProfile,
                onlineState: onlineState,
                joinDate: memberSince, // Epoch
                daysSinceJoinDate: accAgeInDays,
                vacBans: vacBannedCount,
                //limited: isLimited,
                //isTradeBanned: isTradeBanned,
                gametime_2weeks: hoursPlayed2w,
                gametime_total: hoursPlayedTotal
            });
        },
        error: function() {
            callback(null);
        }
    })
};

Trade.prototype.filterByTradeData = function() {
    var _this = this;

    if(LoungeUser.userSettings.hideDonatorTrades === '1' && $('.tradeheader span.donor', this.tradeElement).length) {
        console.log('hiding trade because user is donator');
        return this.hide();
    }

    this.filterByTradeDescription();

    if(this.tradeIsFiltered) return true;

    //var testItemsHave = ["Any Offers", "Falchion Case Key"];
    var haveItemsFiltered = false;

    $('.tradecnt .left .oitm.notavailable', this.tradeElement).each(function(i, v) {
        var item = itemObject(v);
        if(tradeItemsHaveArr.indexOf(item.itemName) !== -1) {
            console.log('hiding because the item is in the have list filter');
            haveItemsFiltered = true;
            return false;
        }
    });

    if(haveItemsFiltered) return _this.hide();

    //var testItemsWant = ["Any Knife", "Falchion Case Key"];
    var wantItemsFiltered = false;

    $('.tradecnt .right .oitm.notavailable', this.tradeElement).each(function(i, v) {
        var item = itemObject(v);
        if(tradeItemsWantArr.indexOf(item.itemName) !== -1) {
            console.log('hiding because the item is in the want list filter');
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
            console.log('Hiding because it did not match Show trade filter');
            return this.hide();
        }
    }

    // Hide filters
    if (tradeHideFilter && tradeHideFilter.test(this.tradeDescription)) {
        console.log('Hiding because it matched Hide trade filter');
        return this.hide();
    }

    return false;
};

Trade.prototype.filterByExtendedTradeData = function() {
    this.filterByTradeDescription();

    if(this.steamlevel < parseInt(LoungeUser.userSettings.minSteamLevel)) {
        console.log('hiding because steam level did not match');
        return this.hide();
    }

    if(this.tradeurl == null && LoungeUser.userSettings.hideNoTradeofferTrades === '1') {
        console.log('hiding because no trade offer link');
        return this.hide();
    }

    return false;
};

Trade.prototype.filterBySteamData = function() {
    var minDaysSinceJoined = 100;
    var minPlaytimeAll = 250;
    var onlyPublicProfile = true;
    var maxVacbanCount = 1;

    if(!this.steamData) return false;

    if(this.steamData.daysSinceJoinDate < parseInt(LoungeUser.userSettings.minAccAgeDays)) {
        console.log('hiding because account age not match');
        return this.hide();
    }

    if(this.steamData.gametime_total < parseInt(LoungeUser.userSettings.minAlltimePlaytime)) {
        console.log('hiding because min. gametime all time did not match');
        return this.hide();
    }

    if(LoungeUser.userSettings.hideTradesPrivateProfile === '1' && this.steamData.isPublicProfile === false) {
        console.log('hiding because profile was private');
        return this.hide();
    }

    if(this.steamData.vacBans > LoungeUser.userSettings.maxVacBans) {
        console.log('hiding because account has vac bans');
        return this.hide();
    }

    return false;
};

Trade.prototype.hide = function() {
    console.log('Hiding', this.tradeID);

    if(LoungeUser.userSettings.hideFilteredTrades === '1') {
        $(this.tradeElement).fadeOut();
    }

    $(this.tradeElement).addClass('ld-filtered');
    this.tradeIsFiltered = true;
    updateFilteredCount();

    return true;
};

/**
 * Runs all filter testing
 */
Trade.prototype.testFilters = function() {

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

function updateFilteredCount() {
    tradesFiltered++;
    if(LoungeUser.userSettings.showTradeFilterBox === '1') {
        $('span.ld-filtered-amount').text(tradesFiltered + (tradesFiltered === 1 ? ' trade was' : ' trades were'));
    }
}

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
