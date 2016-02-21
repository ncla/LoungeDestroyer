safeResponse = function(){

    var validAttrs = [ "class", "id", "href", "style", "colspan" ];

    this.__removeInvalidAttributes = function(target) {
        var attrs = target.attributes, currentAttr;

        for (var i = attrs.length - 1; i >= 0; i--) {
            currentAttr = attrs[i].name;

            if (attrs[i].specified && validAttrs.indexOf(currentAttr) === -1) {
                target.removeAttribute(currentAttr);
            }

            if (
                currentAttr === "href" &&
                /^(#|javascript[:])/gi.test(target.getAttribute("href"))
            ) {
                target.parentNode.removeChild(currentAttr);
            }
        }
    }

    this.__cleanDomString = function(data) {
        var parser = new DOMParser;
        var tmpDom = parser.parseFromString(data, "text/html").body;

        var list, current, currentHref;

        list = tmpDom.querySelectorAll("script,img");

        for (var i = list.length - 1; i >= 0; i--) {
            current = list[i];
            current.parentNode.removeChild(current);
        }

        list = tmpDom.getElementsByTagName("*");

        for (i = list.length - 1; i >= 0; i--) {
            parent.__removeInvalidAttributes(list[i]);
        }

        return tmpDom.innerHTML;
    }

    return{
        cleanDomString: function(html){
            return parent.__cleanDomString(html)
        }
    }
}();