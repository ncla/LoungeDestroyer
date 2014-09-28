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
    return text.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,"<a href='http://csgolounge.com/goto?url=$1'>$1</a>");
}

/**
 * Display error message
 * @param string title - title of error
 * @param string text - description of error
 * @param array/Element btns - optional array of elements, or single element, to be added as button
 */
function displayError(title, text, btns) {
    if (title) {
        var titleElm = document.createElement("h1");
        titleElm.textContent = title;
        errorElm.appendChild(titleElm);
    }
    if (text) {
        var textElm = document.createElement("p");
        textElm.textContent = text;
        errorElm.appendChild(textElm);
    }
    if (btns) {
        var containerElm = document.createElement("div");
        containerElm.className = "destroyer button-container";
        if (btns instanceof Array) {
            for (var i = 0, j = btns.length; i < j; i++) {
                containerElm.appendChild(btns[i]);
            }
        } else {
            containerElm.appendChild(btns);
        }
        errorElm.appendChild(containerElm);
    }

    // make error delete itself after 7.5 seconds
    errorElm.removeAble = true;
    setTimeout(function(){
        console.log("Removing self: "+errorElm.removeAble);
        if (errorElm && errorElm.firstChild)
            if (errorElm.removeAble) {
                while (errorElm.firstChild) {
                    errorElm.removeChild(errorElm.firstChild);
                }
            } else
                errorElm.removeQueued = true;
    }, 7500);
}

// add error element, so we don't have to recreate it every time we display a new error
var errorElm = document.createElement("div");
errorElm.className = "destroyer error-container";
document.body.appendChild(errorElm);

// hook up logic for removing error after N seconds
errorElm.addEventListener("mouseenter", function(e){
    console.log("Mouse entered - delaying remove");
    e.target.removeAble = false;
});
errorElm.addEventListener("mouseleave", function leaveHandler(e){
    console.log("Mouse left - enabling remove");
    e.target.removeAble = true;
    if (e.target.removeQueued)
        console.log("Queued for remove.");
        setTimeout((function(e){return function removeElm(){
                console.log("Checking if we should remove");
                if (e.target.removeAble && e.target.firstChild) {
                    while (e.target.firstChild) {
                        e.target.removeChild(e.target.firstChild);
                    }
                } else if (e.target.firstChild) {
                    setTimeout(removeElm, 1500);
                }
            }})(e), 1500);
});