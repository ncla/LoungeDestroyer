var User = function() {
    this.profileNumber = readCookie("id");

    /* User settings */
    this.userSettings = this.defaultSettings;
};

/* Default settings */
User.prototype.defaultSettings =
{
    marketCurrency: "1",
    itemMarketPricesv2: "1",
    redirect: "1",
    delayBotsOff: "30000",
    delayBotsOn: "5000",
    delayRelogError: "15000",
    notifyBots: "1",
    notifyMatches: "3",
    notifyTrades: "1",
    autoDelay: "5",
    enableAuto: "1",
    renameButtons: "1",
    useCachedPriceList: "1",
    notifyExpiredItems: "1",
    addTradePreviews: "1",
    notifyTradeOffer: "1",
    currentTheme: "",
    showExtraMatchInfo: "2",
    autoBump: "0",
    acceptDelay: 30,
    changeTimeToLocal: "1",
    timezone: "auto",
    americanosTime: "0",
    displayTzAbbr: "1",
    convertLoungePrices: "1",
    blacklistNonExistingItems: "0",
    groupInventory: "1",
    itemGroups: {730: {}, 570: {}},
    displayCsgoWeaponQuality: "1"
};

User.prototype.loadUserSettings = function(callback) {
	if (!(this instanceof User)) {
		throw new TypeError("'this' must be instance of User");
	}

	var self = this;

    chrome.storage.local.get("userSettings", function(result) {
        if(jQuery.isEmptyObject(result)) {
            console.log("No settings have been set, setting default ones");
            console.log(self.defaultSettings);
            chrome.storage.local.set({"userSettings": JSON.stringify(self.defaultSettings)});
        }
        else {
            var storageUserSettings = JSON.parse(result.userSettings);

            $.extend(self.userSettings, storageUserSettings);

            // restrict options
            self.userSettings.autoDelay = Math.max(2, self.userSettings.autoDelay);
        }
        /* Start the scripterino */
        callback();
    });
};

User.prototype.saveSetting = function(settingName, settingValue) {
	if (!(this instanceof User)) {
		throw new TypeError("'this' must be instance of User");
	}

    this.userSettings[settingName] = settingValue;
    chrome.storage.local.set({"userSettings": JSON.stringify(this.userSettings)});
    /*
        Inform background page and content script about setting changes here
    */
    var theSetting = {};
    theSetting[settingName] = settingValue; // just pass this to sendMessage
    // if currently in background script
    if (chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window) {
        chrome.tabs.query({}, function(tabs) {
            for (var i=0; i<tabs.length; ++i) {
                chrome.tabs.sendMessage(tabs[i].id, {changeSetting: theSetting}); // sending it to content scripts
            }
        });
    } else {
        chrome.runtime.sendMessage({changeSetting: theSetting}); // sending it to background.js
    }
    console.log("Saving user setting [" + settingName +"] to " +settingValue);
};