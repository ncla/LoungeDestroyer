/*
    For those who don't know how to behave
 */
var bannedUsers = ["76561198141832677"];

var User = function() {
    this.profileNumber = readCookie("id");
    if(bannedUsers.indexOf(this.profileNumber) !== -1) {
        console.log("This user is in banned user list");
        window.location = "http://www.youareanidiot.org/";
        throw { name: 'FatalError', message: 'Stopping script because this user does not know how to behave' };
    }

    /* User settings */
    this.userSettings = this.defaultSettings;
};

/* Default settings */
User.prototype.defaultSettings =
{
    marketCurrency: "1",
    itemMarketPricesv2: "1",
    redirect: "1",
    removeStream: "0",
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
    easterEgg1: "1",
    changeTimeToLocal: "1",
    timezone: "auto",
    americanosTime: "0",
    displayTzAbbr: "1"
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

            $.each(storageUserSettings, function(index, value) {
                self.userSettings[index] = value;
            });

            $.each(self.defaultSettings, function(index, value) {
                if (typeof storageUserSettings[index] == 'undefined') {
                    console.log("New user setting missing in local storage, setting it now");
                    self.saveSetting(index, value);
                }
            });
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
    chrome.runtime.sendMessage({changeSetting: theSetting}); // sending it to background.js
    chrome.tabs.query({}, function(tabs) {
        for (var i=0; i<tabs.length; ++i) {
            chrome.tabs.sendMessage(tabs[i].id, {changeSetting: theSetting}); // sending it to content scripts
        }
    });
    console.log("Saving user setting [" + settingName +"] to " +settingValue);
};