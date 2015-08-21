var User = function() {
    this.profileNumber = readCookie('id');

    /* User settings */
    this.userSettings = this.defaultSettings;
    this.userSettingsLoaded = false;
};

/* Default settings */
User.prototype.defaultSettings =
{
    marketCurrency: '1',
    itemMarketPricesv2: '1',
    redirect: '1',
    delayBotsOff: '30000',
    delayBotsOn: '5000',
    delayRelogError: '15000',
    notifyBots: '1',
    notifyMatches: '3',
    notifyTrades: '1',
    autoDelay: '5',
    enableAuto: '1',
    renameButtons2: '0',
    useCachedPriceList: '0',
    notifyExpiredItems: '1',
    addTradePreviews: '1',
    notifyTradeOffer: '1',
    currentTheme: '',
    showExtraMatchInfo: '2',
    autoBump: '0',
    acceptDelay: 30,
    changeTimeToLocal: '1',
    timezone: 'auto',
    americanosTime: '0',
    displayTzAbbr: '1',
    convertLoungePrices: '1',
    blacklistNonExistingItems: '0',
    groupInventory: '1',
    itemGroups: {730: {}, 570: {}},
    displayCsgoWeaponQuality: '1',
    inventoryStatisticsGroup: {730: ['1'], 570: ['1']},
    smallBetPercentage: '5',
    mediumBetPercentage: '10',
    largeBetPercentage: '20',
    showBettedIndicator: '1',
    beepSoundDisable: '0',
    customTradeOfferSound: '',
    focusOnTradeofferTab: '0',
    opskins: '1',
    bettingValuesCsgo: '0',
    betHistoryTotalColumn: '2',
    disableStylesheetLoading: '0',

    globalTradeFilters: '1',
    showTradeFilterBox: '1',
    tradeLoadExtra: '1',
    tradeLoadSteamData: '1',
    hideFilteredTrades: '1',
    showTradeDescriptions: '1',

    hideDonatorTrades: '0',
    hideNoTradeofferTrades: '0',
    hideTradesPrivateProfile: '0',
    maxVacBans: '0',
    minSteamLevel: '0',
    minAccAgeDays: '0',
    minAlltimePlaytime: '0'
};

// defaultSettings get modified when changing settings?
User.prototype.defaults = $.extend({}, User.prototype.defaultSettings);

/**
 * Loads user settings from the storage. You can pass existing storage to avoid unnecessary chrome.storage calls
 * @param function callback
 * @param mixed settingsStorage Undefined if not passed, Null if no settings, Object if settings
 */
User.prototype.loadUserSettings = function(callback, settingsStorage) {
    if (!(this instanceof User)) {
        throw new TypeError('\'this\' must be instance of User');
    }

    var _this = this;

    if (typeof settingsStorage !== 'undefined') {
        if (settingsStorage === null) {
            _this.restoreDefaults();
        } else {
            var storageUserSettings = JSON.parse(settingsStorage);

            $.extend(_this.userSettings, storageUserSettings);
            _this.restrictOptions();
        }

        _this.userSettingsLoaded = true;
        callback();
    } else {
        chrome.storage.local.get('userSettings', function(result) {
            // result is an object because we are not accessing the result properties directly
            if (jQuery.isEmptyObject(result)) {
                _this.restoreDefaults();
            }
            else {
                var storageUserSettings = JSON.parse(result.userSettings);

                $.extend(_this.userSettings, storageUserSettings);
                _this.restrictOptions();
            }

            _this.userSettingsLoaded = true;
            callback();
        });
    }
};

User.prototype.saveSetting = function(settingName, settingValue) {
    if (!(this instanceof User)) {
        throw new TypeError('\'this\' must be instance of User');
    }

    this.userSettings[settingName] = settingValue;
    chrome.storage.local.set({'userSettings': JSON.stringify(this.userSettings)});

    // Inform background page and content script about setting changes here
    var theSetting = {};

    // just pass this to sendMessage
    theSetting[settingName] = settingValue;

    // if currently in background script
    if (chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window) {
        chrome.tabs.query({}, function(tabs) {
            for (var i = 0; i < tabs.length; ++i) {
                // sending it to content scripts
                chrome.tabs.sendMessage(tabs[i].id, {changeSetting: theSetting});
            }
        });
    } else {
        // sending it to background.js
        chrome.runtime.sendMessage({changeSetting: theSetting});
    }

    console.log('Saving user setting [' + settingName + '] to ', settingValue);
    return this;
};

/**
 * TODO: Optimize this to use only one chrome.storage.set call
 */
User.prototype.restoreDefaults = function() {
    if (!(this instanceof User)) {
        throw new TypeError('\'this\' must be instance of User');
    }

    console.log('Reseting to default user settings');

    for (var k in User.prototype.defaults) {
        this.saveSetting(k, User.prototype.defaults[k]);
    }

    return this;
};

/**
 * Necessary so users don't set low or 0 delay
 */
User.prototype.restrictOptions = function() {
    this.userSettings.autoDelay = Math.max(2, this.userSettings.autoDelay);
    this.userSettings.acceptDelay = Math.max(10, this.userSettings.acceptDelay);

    return this;
};