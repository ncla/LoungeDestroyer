$(document).ready(function(){
    $(".ld-setting a").tooltip({
        placement : 'right'
    });
});

var defaultUser = new User();
var Settings = defaultUser.defaultSettings;

function restore_options() {
    var manifesto = chrome.runtime.getManifest();
    document.getElementById("version").innerHTML = manifesto.version;
    chrome.storage.local.get("userSettings", function(result) {
        var storageSettings = JSON.parse(result.userSettings);
        $.each(storageSettings, function(index, value) {
            Settings[index] = value;
        });
        $.each(Settings, function(index, value) {
            $(".ld-settings #" + index + " option[value=" + value + "]").prop('selected', true);
        });
    });
}

document.addEventListener('DOMContentLoaded', restore_options);

$(".ld-settings select").on('change', function() {
    defaultUser.saveSetting(this.id, this.value);
});