/**
 * Bet-a-tron 9000 
 * Based on oldshit.js
 * Could be moved to page context to avoid using DOM for communication, but meh
 *
 * More or less future-proof. Workflow is:
 * - AJAX requests are filtered (prefilter.js)
 * - If request fails, add button.auto-bet with data-<data> attr to error (prefilter.js)
 * - If button.auto-bet is added to error, enable auto-bet (bet.js)
 * - Request data and url is saved, hash is extracted (bet.js)
 * - Re-bet every 5 seconds (bet.js)
 */
var bet = { // not a class - don't instantiate
	autoDelay: 15000,
	autoBetting: false,
	betData: {}
};

// example data:
// ldef_index%5B%5D=2682&lquality%5B%5D=0&id%5B%5D=711923886&worth=0.11&on=a&match=1522&tlss=2e7877e8d42fb969c5f6f517243c2d19
bet.enableAuto = function(url, data) {
	console.log("Auto-betting");
	if (this.autoBetting)
		return false;
	if (!url || !data)
		return false;

	this.autoBetting = true;

	// extract data
	var hash = /tlss=([0-9a-z]*)/.exec(data)[1],
	    data = data.replace("tlss="+hash,""),
	    worthArr = data.match(/worth=[0-9.0-9]*/g),
	    worth = 0;

	for (var i = 0, j = worthArr.length; i < j; i++) {
		var parsed = parseFloat(worthArr[i].substr(6));
		if (!isNaN(parsed))
			worth += parsed;
	}

	bet.betData = {
		hash: hash,
		data: data,
		url: url,
		worth: worth
	};

	// start looping
	return bet.autoLoop();
};
bet.disableAuto = function() {
	console.log("Disabling auto-bet");
	this.autoBetting = false;
};
bet.autoLoop = function() {
	if (bet.betData.data.indexOf("&on=") === -1) // if not a betting request
		return false;
	if (!bet.autoBetting) // if no longer auto-betting, for some reason
		return false;

	// repeat request
	console.log("Performing request:");
	console.log({url: url, data: bet.betData.data + "tlss="+bet.betData.hash});
	$.ajax({
		url: bet.betData.url,
		type: "POST",
		data: bet.betData.data + "tlss="+bet.betData.hash,
		success: function(data) {
			// Lounge returns nothing if success
			if (data) {
				console.log("Received error from auto:");
				console.log(data.substr(0,500));
				if (data.indexOf("You have to relog in order to place a bet.") !== -1) {
					bet.renewHash();
				}
				setTimeout(bet.autoLoop, bet.autoDelay); // recall
			} else {
				// happy times
				console.log("Bet was succesfully placed");
				bet.autoBetting = false;
				localStorage.playedbet = "false";
				window.location.href = "mybets";
			}
		},
		error: function() {
			console.log("Error while autoing. Retrying");
			setTimeout(bet.autoLoop, bet.autoDelay);
		}
	});
	return true;
};
bet.checkRequirements = function() { // not used
	if (!document.querySelectorAll(".betpoll .item").length > 0) {
		displayError("User error", "No items added!");
		return false;
	}
	if (!document.getElementById("on").value.length > 0) {
		displayError("User error", "No team selected");
		return false;
	}
	return true;
};
bet.renewHash = function() {
	console.log("Renewing hash");
	$.ajax({
		url: document.URL,
		type: "GET",
		async: false,
		success: function(data) {
			// don't parse HTML, just extract from text
			var startInd = data.indexOf('id="placebut'),
			    endInd = data.indexOf(">Place Bet<"),
			    elmText = data.substring(startInd, endInd),
			    hash = /[0-9]{4}['", ]*([0-9a-z]*)/.exec(elmText)[1]; // optionally replace second * with {32}

			if (startInd === -1) {
				console.log("Failed to get button element, re-attempting in 5s");
				setTimeout(function(){bet.renewHash()}, 5000);
			} else {
				console.log("Elm text: "+elmText);
				console.log("Found a hash: "+hash);
				bet.betData.hash = hash;
			}
		},
		error: function() {
			console.log("Error while renewing hash, re-attempting in 5s");
			setTimeout(function(){bet.renewHash()}, 5000);
		}
	});
};

// inject script to prefilter AJAX
addJS_Node(null, "src/inject/app/prefilter.js", null, null, true);

// look for auto-bet button
// messy as fuck
(function initLoop(){
	if (!errorElm) { // wait until error elm has created
		setTimeout(initLoop, 50);
		return;
	}
	var obs = new MutationObserver(function(records){
		// called when error message changes
		// look for button.auto-bet, and add click listener
		console.log("Observer:");
		console.log(records);
		for (var i = 0, j = records.length; i < j; i++) {
			// if no elements have been added
			if (!records[i].type === "childList" || !records[i].addedNodes.length)
				continue;
			var container = records[i].addedNodes[0];
			// if not button container
			if (!container.className.indexOf("destroyer button-container") === -1)
				continue;
			// if no children
			if (!container.children || !container.children.length)
				continue;

			// loop through children
			for (var k = 0, l = container.children.length; k < l; k++) {
				// if auto-bet button
				var btn = container.children[k];
				// if auto-bet button
				if (btn.localName === "button" && btn.className.indexOf("auto-bet") !== -1) {
					// set to appropriate color
					if (bet.autoBetting) {
						btn.className = btn.className.replace("green", "red");
						btn.textContent = "Disable auto-bet";
					}

					btn.addEventListener("click", function(e){
						// called when auto-bet button is clicked
						console.log("Toggling auto-bet");
						// if we should enable
						if (this.className.indexOf("green") !== -1) {
							var url = this.getAttribute("data-url"),
							    data = this.getAttribute("data-data");

							if (bet.enableAuto(url, data)) {
								this.className = this.className.replace("green", "red");
								this.textContent = "Disable auto-bet";
							}
						} else {
							this.className = this.className.replace("red", "green");
							this.textContent = "Enable auto-bet";
							bet.disableAuto();
						}
					});
				}
			}
		}
	});
	obs.observe(errorElm, {childList: true, subtree: true});
})();