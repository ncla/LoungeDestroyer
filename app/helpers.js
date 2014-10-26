/* HELPER FUCNTIONS */
/* Get URL parameter */
function gup(a) {
    a = a.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var b = "[\\?&]" + a + "=([^&#]*)", c = new RegExp(b), d = c.exec(window.location.href);
    return null == d ? null : d[1]
}
/* Get a cookie by a name */
function readCookie(e) {
    var t = e + "=";
    var n = document.cookie.split(";");
    for (var r = 0; r < n.length; r++) {
        var i = n[r];
        while (i.charAt(0) == " ")i = i.substring(1, i.length);
        if (i.indexOf(t) == 0)return i.substring(t.length, i.length)
    }
    return null
}
/* Inject script node */
function addJS_Node(text, s_URL, funcToRun, funcName, local) {
    var D = document;
    var scriptNode = D.createElement('script');
    scriptNode.type = "text/javascript";
    if (text)       scriptNode.textContent = text;
    if (s_URL)      scriptNode.src = local ? chrome.extension.getURL(s_URL) : s_URL;
    if (funcToRun) {
        if (funcName) {
            // please forgive me for this horror
            scriptNode.textContent = funcToRun.toString().replace("function () {", "function " + funcName + "() {");
        }
        else {
            scriptNode.textContent = '(' + funcToRun.toString() + ')()';
        }
    }

    var targ = D.getElementsByTagName('head')[0] || D.body || D.documentElement;
    targ.appendChild(scriptNode);
}
/*
    CSGL horribleness, not mine
 */
function textToUrl(text) {
    return text.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,"<a href='https://steamcommunity.com/linkfilter/$1'>$1</a>");
}

function capitaliseFirstLetter(string)
{
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Perform a POST request to a url
 * @param {string} url - The URL to request to
 * @param {object} data - the POST data
 * @param {function} callback - The function to call once the request is performed
 * @param {object} headers - a header object in the format {header: value} 
 */
function post(url, data, callback, headers) {
    // create xmlhttprequest instance
    var xhr = new XMLHttpRequest(),
        formatted = [];

    if (typeof data === "object") {
        for (var k in data) {
            formatted.push(encodeURIComponent(k) + "=" + encodeURIComponent(data[k]));
        }
        formatted = formatted.join("&");
    } else {
        formatted = data;
    }

    // init
    xhr.addEventListener("load", callback);
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");

    // set headers
    for (var h in headers) {
        if (headers.hasOwnProperty(h))
            xhr.setRequestHeader(h, headers[h]);
    }

    // save lastRequest for later re-sending
    lastRequest = {
        url: url,
        data: data,
        headers: headers
    };

    // send
    xhr.send(formatted);
}

/**
 * Perform a GET request to a url
 * @param string url - The URL to request to
 * @param function callback - The function to call once the request is performed
 */
function get(url, callback) {
    // create xmlhttprequest instance
    // we assume all supported browsers have XMLHttpRequest
    var xhr = new XMLHttpRequest();

    // init
    xhr.addEventListener("load", callback);
    xhr.onerror = function(){
        callback.apply({status: 0, statusText: "Connection error"});
    }
    xhr.open("GET", url, true);

    // send
    xhr.send();
}
function isDevMode() {
    return !('update_url' in chrome.runtime.getManifest());
}