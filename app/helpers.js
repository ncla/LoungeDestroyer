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

function addScript(template, silent) {
    if (silent === undefined) {
        silent = false;
    }

    var s = document.createElement("script");
    if (template.src) {
        s.src = template.src;
    }

    if (template.textContent) {
        s.textContent = template.textContent;
    }

    document.documentElement.appendChild(s);

    if (silent) {
        document.documentElement.removeChild(s);
    }
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

var g_rgCurrencyData = {
    "1": {
        "strCode": "USD",
        "eCurrencyCode": 1,
        "strSymbol": "$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "2": {
        "strCode": "GBP",
        "eCurrencyCode": 2,
        "strSymbol": "\u00a3",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "3": {
        "strCode": "EUR",
        "eCurrencyCode": 3,
        "strSymbol": "\u20ac",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": false
    },
    "4": {
        "strCode": "CHF", //
        "eCurrencyCode": 4,
        "strSymbol": "CHF",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "5": {
        "strCode": "RUB",
        "eCurrencyCode": 5,
        "strSymbol": "p\u0443\u0431.",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": true
    },
    "7": {
        "strCode": "BRL",
        "eCurrencyCode": 7,
        "strSymbol": "R$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "8": {
        "strCode": "JPY",
        "eCurrencyCode": 8,
        "strSymbol": "\u00a5",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": true
    },
    "9": {
        "strCode": "NOK",
        "eCurrencyCode": 9,
        "strSymbol": "kr",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": false
    },
    "10": {
        "strCode": "IDR",
        "eCurrencyCode": 10,
        "strSymbol": "Rp",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": true
    },
    "11": {
        "strCode": "MYR",
        "eCurrencyCode": 11,
        "strSymbol": "RM",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "12": {
        "strCode": "PHP",
        "eCurrencyCode": 12,
        "strSymbol": "P",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "13": {
        "strCode": "SGD",
        "eCurrencyCode": 13,
        "strSymbol": "S$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "14": {
        "strCode": "THB",
        "eCurrencyCode": 14,
        "strSymbol": "\u0e3f",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "15": {
        "strCode": "VND",
        "eCurrencyCode": 15,
        "strSymbol": "\u20ab",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": true
    },
    "16": {
        "strCode": "KRW",
        "eCurrencyCode": 16,
        "strSymbol": "\u20a9",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": true
    },
    "17": {
        "strCode": "TRY",
        "eCurrencyCode": 17,
        "strSymbol": "TL",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": false
    },
    "18": {
        "strCode": "UAH",
        "eCurrencyCode": 18,
        "strSymbol": "\u20b4",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": true
    },
    "19": {
        "strCode": "MXN",
        "eCurrencyCode": 19,
        "strSymbol": "Mex$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "20": {
        "strCode": "CAD",
        "eCurrencyCode": 20,
        "strSymbol": "CDN$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "21": {
        "strCode": "AUD",
        "eCurrencyCode": 21,
        "strSymbol": "A$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "22": {
        "strCode": "NZD",
        "eCurrencyCode": 22,
        "strSymbol": "NZ$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "6": {
        "strCode": "PLN", //
        "eCurrencyCode": 6,
        "strSymbol": "z\u0142",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": false
    },
    "23": {
        "strCode": "CNY", //
        "eCurrencyCode": 23,
        "strSymbol": "\u00a5",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": true
    },
    "24": {
        "strCode": "INR", //
        "eCurrencyCode": 24,
        "strSymbol": "\u20b9",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": true
    },
    "25": {
        "strCode": "CLP", //
        "eCurrencyCode": 25,
        "strSymbol": "CLP$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": true
    },
    "26": {
        "strCode": "PEN", //
        "eCurrencyCode": 26,
        "strSymbol": "S\/.",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "27": {
        "strCode": "COP", //
        "eCurrencyCode": 27,
        "strSymbol": "COL$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": true
    },
    "28": {
        "strCode": "ZAR", //
        "eCurrencyCode": 28,
        "strSymbol": "R",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "29": {
        "strCode": "HKD", //
        "eCurrencyCode": 29,
        "strSymbol": "HK$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": false
    },
    "30": {
        "strCode": "TWD", //
        "eCurrencyCode": 30,
        "strSymbol": "NT$",
        "bSymbolIsPrefix": true,
        "bWholeUnitsOnly": true
    },
    "31": {
        "strCode": "SAR", //
        "eCurrencyCode": 31,
        "strSymbol": "SR",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": false
    },
    "32": {
        "strCode": "AED", //
        "eCurrencyCode": 32,
        "strSymbol": "AED",
        "bSymbolIsPrefix": false,
        "bWholeUnitsOnly": false
    }
    //, // UNSUPPORTED CURRENCIES
    //"9000": {
    //    "strCode": "RMB", //
    //    "eCurrencyCode": 9000,
    //    "strSymbol": "\u5200\u5e01",
    //    "bSymbolIsPrefix": false,
    //    "bWholeUnitsOnly": true
    //},
    //"9001": {
    //    "strCode": "NXP", //
    //    "eCurrencyCode": 9001,
    //    "strSymbol": "\uc6d0",
    //    "bSymbolIsPrefix": false,
    //    "bWholeUnitsOnly": true
    //}
};

// http://stackoverflow.com/a/22480938/757587
function isScrolledIntoView(el) {
    // Checks if the element is being passed as jQuery object
    var el = (el instanceof jQuery ? el[0] : el);

    var elemTop = el.getBoundingClientRect().top;
    var elemBottom = el.getBoundingClientRect().bottom;

    var isVisible = (elemTop >= 0) && (elemBottom <= window.innerHeight);
    return isVisible;
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

function generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
}

function generateArgName() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    var randomLength = Math.floor(Math.random() * 16) + 3;

    for(var i=0; i < randomLength; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}
/**
 * Determines game type
 * @param url string
 * @returns {number} -1 if no game, 0 if CSGOLounge, 1 if DOTA2Lounge
 */
function determineGameByURL(url) {
    return url.indexOf('://csgolounge.com/') !== -1 ? 0 :
        url.indexOf('://dota2lounge.com/') !== -1 ? 1 :
            -1;
}

function getChromeVersion () {
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    return raw ? parseInt(raw[2], 10) : false;
}