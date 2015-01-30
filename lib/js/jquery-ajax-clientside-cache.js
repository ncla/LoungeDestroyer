// Based on, modified to chrome.storage and Chrome extension needs
// http://github.com/paulirish/jquery-ajax-localstorage-cache

// Because chrome.storage is async, you need to populate this variable
var ajaxCache = {};

function deleteCache(cacheKey) {
    ajaxCache[cacheKey] = undefined;
    chrome.storage.local.set({"ajaxCache": ajaxCache});
}

$.ajaxPrefilter(function (options, originalOptions, jqXHR) {
    // Cache it ?
    if (!options.localCache) return;

    var hourstl = options.cacheTTL || 5;

    var cacheKey = options.cacheKey ||
        options.url.replace(/jQuery.*/, '') + options.type + (options.data || '');

    console.log("Cache key: ", cacheKey);
    //console.log(ajaxCache);

    // isCacheValid is a function to validate cache
    if (options.isCacheValid && !options.isCacheValid()) {
        console.log("not valid");
        deleteCache(cacheKey);
    }
    // if there's a TTL that's expired, flush this item
    var ttl = (ajaxCache.hasOwnProperty(cacheKey) ? ajaxCache[cacheKey]["expires"] : false);
    if (ttl && ttl < +new Date()) {
        console.log("deleting because TTL expired");
        deleteCache(cacheKey);
        ttl = false;
    }

    if (ttl) {
        console.log("Cacherino data have!");
        //In the cache? So get it, apply success callback & abort the XHR request
        var value = ajaxCache[cacheKey]["requestData"];
        // parse back to JSON if we can.
        if (options.isJson) {
            console.log("json stringify 1");
            value = JSON.parse(value);
        }
        options.success(value);
        // Abort is broken on JQ 1.5 :(
        jqXHR.abort();
    } else {
        //If it not in the cache, we change the success callback, just put data on localstorage and after that apply the initial callback
        if (options.success) {
            options.realsuccess = options.success;
        }
        options.success = function (data) {
            var strdata = data;
            if (options.isJson) {
                console.log("json stringify 2");
                strdata = JSON.stringify(data);
            }

            ajaxCache[cacheKey] = {
                requestData: strdata,
                expires: +new Date() + 1000 * 60 * 60 * hourstl
            };
            chrome.storage.local.set({"ajaxCache": ajaxCache});

            if (options.realsuccess) options.realsuccess(data);
        };
    }
});