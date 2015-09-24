function onload() {
    var manifesto = chrome.runtime.getManifest();
    document.getElementById("version").innerHTML = manifesto.version;
    $("#open-options").click(function() {
        chrome.runtime.sendMessage({openSettings: true}, function(data) {
            console.log('Message sent for opening settings page');
        });
    });
    $("#close-btn").click(function(){
        window.open(location, '_self').close();
    });
}

document.addEventListener('DOMContentLoaded', onload);