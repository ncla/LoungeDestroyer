function saveError(err) {
    chrome.storage.local.get("appErrors", function(result) {
        var errObj = result.appErrors || [];
        errObj.push(err);
        chrome.storage.local.set({"appErrors": errObj});
    })
}

window.onerror = function (msg, url, num) {
    if(url.length > 0 && msg != "Script error.") {
        saveError(msg + ", URL: " + url + ", Line: " + num);
    }
    return false;
};