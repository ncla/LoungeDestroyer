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
    renameButtons: '1',
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
    focusOnTradeofferTab: '0'
};

// defaultSettings get modified when changing settings?
User.prototype.defaults = $.extend({}, User.prototype.defaultSettings);

User.prototype.loadUserSettings = function(callback) {
    if (!(this instanceof User)) {
        throw new TypeError('\'this\' must be instance of User');
    }

    var _this = this;

    chrome.storage.local.get('userSettings', function(result) {
        if (jQuery.isEmptyObject(result)) {
            console.log('No settings have been set, setting default ones');
            console.log(_this.defaultSettings);
            chrome.storage.local.set({'userSettings': JSON.stringify(_this.defaultSettings)});
        }
        else {
            var storageUserSettings = JSON.parse(result.userSettings);

            $.extend(_this.userSettings, storageUserSettings);

            // restrict options
            _this.userSettings.autoDelay = Math.max(2, _this.userSettings.autoDelay);
            _this.userSettings.acceptDelay = Math.max(10, _this.userSettings.acceptDelay);
        }
        /* Start the scripterino */
        _this.userSettingsLoaded = true;
        callback();
    });
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
};

User.prototype.restoreDefaults = function() {
    if (!(this instanceof User)) {
        throw new TypeError('\'this\' must be instance of User');
    }

    for (var k in User.prototype.defaults) {
        this.saveSetting(k, User.prototype.defaults[k]);
    }
};
