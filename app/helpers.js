// jscs: disable
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

    $(document).ready(function(){
	    var targ = D.getElementsByTagName('head')[0] || D.body || D.documentElement;
	    targ.appendChild(scriptNode);
	});
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

function removeTags(text) {
    var doc = document.implementation.createHTMLDocument("");
    doc.body.innerHTML = text;
    return doc.body.textContent;
}

/**
 * Create a regexp that matches keywords (or symbols) using .test
 * @param {array} keywords - array of keyword strings to match
 */
function createKeywordRegexp(keywords) {
    var str = keywords.reduce(function(prev, cur){
        return prev+
               (prev?"|":"")+ // add "|" as separator
               cur.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); // escape special chars
    }, "");


    // create actual regexps
    // match any keyword surrounded by:
    // a word boundary, whitespace, the beginning/end of input, punctuation or itself
    var filterTempl = "(?:^|¤)(#)\\1*(?=$|¤)".replace(/¤/g, "\\b|\\s|^|\\.|,|!|\\?|\\-|\\+|~");
    return str ? new RegExp(filterTempl.replace(/#/g, str),"i") : undefined;
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
        if (headers.hasOwnProperty(h)) {
            xhr.setRequestHeader(h, headers[h]);
        }
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

// http://stackoverflow.com/a/24344154/645768
function retrieveWindowVariables(variables) {
    if (typeof variables === "string") {
        variables = [variables];
    }

    var ret = {},
        scriptContent = "";

    for (var i = 0; i < variables.length; i++) {
        var currVariable = variables[i];
        scriptContent += "if (typeof " + currVariable + " !== 'undefined') $('body').attr('tmp_" + currVariable + "', " + currVariable + ");\n"
    }

    var script = document.createElement('script');
    script.id = 'tmpScript';
    script.appendChild(document.createTextNode(scriptContent));
    (document.body || document.head || document.documentElement).appendChild(script);

    for (var i = 0; i < variables.length; i++) {
        var currVariable = variables[i];
        ret[currVariable] = $("body").attr("tmp_" + currVariable);
        $("body").removeAttr("tmp_" + currVariable);
    }

    $("#tmpScript").remove();

    return ret;
}

// only supports strings/numbers/booleans
function setWindowVariables(variables) {
    var scriptContent = "";
    for (var k in variables) {
        if (typeof variables[k] === "string") {
            variables[k] = "'"+variables[k]+"'";
        }

        scriptContent += k + " = "+variables[k];
    }

    var script = document.createElement('script');
    script.id = 'tmpScript';
    script.appendChild(document.createTextNode(scriptContent));
    (document.body || document.head || document.documentElement).appendChild(script);

    $("#tmpScript").remove();
}
// Based on Steam available currencies
var currencyData = {
    1: { naming: "USD", decimal: '.', id: 1, symbol: "$", symbolBefore: true },
    2: { naming: "GBP", decimal: '.', id: 2, symbol: "£", symbolBefore: true },
    3: { naming: "EUR", decimal: ',', id: 3, symbol: "€", symbolBefore: false },
    5: { naming: "RUB", decimal: ',', id: 5, symbol: "pуб.", symbolBefore: false },
    7: { naming: "BRL", decimal: ',', id: 7, symbol: "R$", symbolBefore: true },
    8: { naming: "JPY", decimal: '.', id: 8, symbol: "¥", symbolBefore: true },
    9: { naming: "NOK", decimal: ',', id: 9, symbol: "kr", symbolBefore: false },
    10: { naming: "IDR", decimal: '.', id: 10, symbol: "Rp", symbolBefore: true },
    11: { naming: "MYR", decimal: '.', id: 11, symbol: "RM", symbolBefore: true },
    12: { naming: "PHP", decimal: '.', id: 12, symbol: "P", symbolBefore: true },
    13: { naming: "SGD", decimal: '.', id: 13, symbol: "S$", symbolBefore: true },
    14: { naming: "THB", decimal: '.', id: 14, symbol: "฿", symbolBefore: true },
    15: { naming: "VND", decimal: '.', id: 15, symbol: "₫", symbolBefore: false },
    16: { naming: "KRW", decimal: '.', id: 16, symbol: "₩", symbolBefore: true },
    17: { naming: "TRY", decimal: ',', id: 17, symbol: "TL", symbolBefore: false },
    18: { naming: "UAH", decimal: ',', id: 18, symbol: "₴", symbolBefore: false },
    19: { naming: "MXN", decimal: '.', id: 19, symbol: "Mex$", symbolBefore: true },
    20: { naming: "CAD", decimal: '.', id: 20, symbol: "C$", symbolBefore: true },
    21: { naming: "AUD", decimal: '.', id: 21, symbol: "A$", symbolBefore: true },
    22: { naming: "NZD", decimal: '.', id: 22, symbol: "NZ$", symbolBefore: true }
};
// http://stackoverflow.com/a/488073
function isScrolledIntoView(elem) {
    var $elem = $(elem);
    var $window = $(window);

    var docViewTop = $window.scrollTop();
    var docViewBottom = docViewTop + ($window.height() * 1.5);

    var elemTop = $elem.offset().top;
    var elemBottom = elemTop + $elem.height();

    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
}
// http://stackoverflow.com/a/7392655
(function($) {
    var uniqueCntr = 0;
    $.fn.scrolled = function (waitTime, fn) {
        if (typeof waitTime === "function") {
            fn = waitTime;
            waitTime = 250;
        }
        var tag = "scrollTimer" + uniqueCntr++;
        this.scroll(function () {
            var self = $(this);
            var timer = self.data(tag);
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                self.removeData(tag);
                fn.call(self[0]);
            }, waitTime);
            self.data(tag, timer);
        });
    }
})(jQuery);