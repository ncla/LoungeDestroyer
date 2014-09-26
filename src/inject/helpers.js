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