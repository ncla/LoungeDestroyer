var User = function() {
    var self = this;

    this.profileNumber = ($("#logout").length ? readCookie("id") : null);

    /* Default settings */
    this.defaultSettings =
    {
        marketCurrency: "1",
        itemMarketPrices: "1",
        redirect: "1",
        streamRemove: "1",
        delayBotsOff: "30000",
        delayBotsOn: "5000",
        delayRelogError: "15000",
        notifyBots: "1",
        notifyMatches: "3"
    };
    /* User settings */
    this.userSettings = self.defaultSettings;

    /*
        Load settings and execute a callback function
     */
    this.loadUserSettings = function(callback) {
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

    this.saveSetting = function(settingName, settingValue) {
        self.userSettings[settingName] = settingValue;
        chrome.storage.local.set({"userSettings": JSON.stringify(self.userSettings)});
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
}