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

    this.saveSetting = function(settingName, settingValue) {
        self.userSettings[settingName] = settingValue;
        chrome.storage.local.set({"userSettings": JSON.stringify(self.userSettings)});
        /*
            Inform background page and content script about setting changes here
        */
        console.log("Saving user setting [" + settingName +"] to " +settingValue);
    };
}