console.log("Injected prefilter script");
// urls to hook - displays response as error
var HOOK_URLS = {
	"ajax/postBetOffer.php": handleBetReturn, 
	"ajax/betReturns.php": handleBetReturn,
	"ajax/betHistory.php": handleBetReturn
};

/**
 * Hook AJAX requests if needed
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
	// for debugging purposes
	// TO-DO: remove before release
	var obj;
	try {
		obj = JSON.parse(window.localStorage.requestCache);
	} catch(e) {
		obj = {};
	}
	obj[original.url] = {type: original.type || null, 
		                 data: original.data || null,
		                 time: Date.now()};
	window.localStorage.requestCache = JSON.stringify(obj);

	// if in HOOK_URLS, create error from response
	if (HOOK_URLS[original.url] instanceof Function) {
		var origCallback = original.success;
		options.success = function(data){HOOK_URLS[original.url](data,original.url,original,origCallback)};
	}
});

// called instead of original callback on a hooked request
function handleBetReturn(data, url, origOptions, origCallback) {
	var title = "Betting error",
	    button;

	// generate auto-bet button
	button = document.createElement("button");
	button.className = "destroyer green auto-bet";
	button.textContent = "Enable auto-bet";
	// save request data to DOM
	origOptions.url && button.setAttribute("data-url", origOptions.url);
	origOptions.type && button.setAttribute("data-type", origOptions.type);
	origOptions.data && button.setAttribute("data-data", origOptions.data);
	// click listener is added in bet.js

	if (data)
		displayError(title, data.length > 250 ? data.substr(0,247)+"..." : data, button);
	else
		origCallback(data);
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
var errorElm = document.querySelector(".destroyer.error-container");
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