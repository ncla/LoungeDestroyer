function onload() {
    var manifesto = chrome.runtime.getManifest();
    document.getElementById("version").innerHTML = manifesto.version;
    $("#open-options").click(function() {
        var optionsUrl = chrome.extension.getURL('settings/options.html');

        chrome.tabs.query({url: optionsUrl}, function(tabs) {
            if (tabs.length) {
                chrome.tabs.update(tabs[0].id, {active: true});
            } else {
                chrome.tabs.create({url: optionsUrl});
            }
        });
    });
    $("#close-btn").click(function(){
        window.close();
    });
}

document.addEventListener('DOMContentLoaded', onload);