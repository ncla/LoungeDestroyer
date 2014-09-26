console.log("Injected prefilter script");
// urls to hook - displays response as error
var HOOK_URLS = {
	"ajax/postBetOffer.php": handleBetReturn, 
	"ajax/betReturns.php": handleBetReturn,
};

/**
 * Save all AJAX requests to window.localStorage.requestCache, in format:
 * {
 *     <url>: [<type>, <data>],
 *     ...
 * }
 */
$.ajaxPrefilter(function(options, original, jqXHR) {
	console.log("AJAX request:");
	console.log(options);
	console.log(original);
	console.log(jqXHR);
	console.log(this);

	if (!original.url)
		return;

	// update item in localstorage
	var obj;
	try {
		obj = JSON.parse(window.localStorage.requestCache);
	} catch(e) {
		obj = {};
	}
	obj[original.url] = [original.type || null, original.data || null];
	window.localStorage.requestCache = JSON.stringify(obj);

	// if in HOOK_URLS, create error from response
	if (HOOK_URLS[original.url] instanceof Function) {
		var origCallback = original.success;
		options.success = function(data){HOOK_URLS[original.url](data,original.url,origCallback)};
	}
});

// called instead of original callback on a hooked request
function handleBetReturn(data, url, origCallback) {
	var title,
	    button;
	/*switch(url) {
		case "ajax/postBetOffer.php":
		case "ajax/betReturns.php":*/
			title = "Betting error";
			// generate auto-bet button
			button = document.createElement("button");
			button.className = "destroyer green";
			button.textContent = "Enable auto-bet";
			// event listener is added in bet.js
			/*break;
	}*/
	displayError(title, data.length > 250 ? data.substr(0,247)+"..." : data, button);
}

/**
 * Copy-pastarinoed from helpers.js, for page-context
 * @param string title - title of error
 * @param string text - description of error
 * @param array/Element btns - array of elements, or single element, to be added as button
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
            if (errorElm && errorElm.firstChild)
                if (errorElm.removeAble) {
                    while (errorElm.firstChild) {
                        errorElm.removeChild(errorElm.firstChild);
                    }
                } else
                    errorElm.removeQueued = true;
        }, 7500);
}
var errorElm = document.querySelector(".destroyer.error-container");