var autoAccepting,
    timer;

chrome.storage.local.get("queue", function(data){
    // load previously saved accept delay
    chrome.runtime.sendMessage({"getSetting": ["acceptDelay", "enableAuto"]}, function(resp){
    	console.log("Settings: ",resp);
    	if (["2","0"].indexOf(resp.enableAuto) !== -1) {
    		return;
    	}

    	data = data.queue;

		if (!data) {
			console.log("No queue object");
			return;
		}
		var code = /Protection code: ([0-9A-Z]{4})/.exec(document.querySelector(".quote").textContent)[1],
		    urlRegex = /https?:\/\/(.*)/;
		
		if (!code || code !== data.protectionCode) {
			console.log("Protection code does not match: ",code,"!==",data.protectionCode);
			return;
		}
		if (!document.URL || urlRegex.exec(document.URL)[1] !== urlRegex.exec(data.offer)[1]) {
			console.log("URL does not match: ",urlRegex.exec(document.URL)[1],"!==",urlRegex.exec(data.offer)[1]);
			return;
		}

		console.log("Enabling");
		autoAccepting = true;

		// create UI
		var container = document.createElement("div");
	    container.className = "destroyer info";
	    container.innerHTML = '<p>LoungeDestroyer would like to accept this offer.</p><button class="red">Don\'t accept</button><p>Accepting in <b class="time-left"></b> seconds.</p><label for="accept-time">Wait before accepting: </label><input id="accept-time" type="number" min="10" max="60" step="1" value="30">';

	    container.querySelector("button").addEventListener("click", function(){
	        clearTimeout(timer);
	        container.className = "destroyer info hidden";
	    });

	    container.querySelector("#accept-time").addEventListener("input", function(){
			if (this.valueAsNumber) {
	            chrome.runtime.sendMessage({"saveSetting": {acceptDelay: this.valueAsNumber}});
	        }
	    });

    	container.querySelector("#accept-time").valueAsNumber = resp.acceptDelay || 30;

	    var now = Date.now(),
	        acceptTime = Math.min(data.time, now+(resp.acceptDelay || 30)*1000);
	    
	    if (!data.time || acceptTime-now < 10000) { // won't accept offers with <10 sec left
			console.log("Too little time left: ",(acceptTime-Date.now())/1000);
			return;
		}

	    timer = setTimeout(acceptOffer, acceptTime-Date.now());

	    // update timer
	    (function timerLoop(){
	    	if (!autoAccepting) {
	    		return;
	    	}

	        var span = container.querySelector(".destroyer.info .time-left");
	        span.textContent = ((acceptTime - Date.now())/1000).toFixed(2) + "s";

	        requestAnimationFrame(timerLoop);
	    })();

	    document.body.appendChild(container);
    });
});

function acceptOffer(){
	document.querySelector(".destroyer.info").className = "destroyer info hidden";

	// ask returns page to keep returning
	chrome.storage.local.set({lastAutoAccept: Date.now()});

	// if trade is suspicious, accept it anyway
	var obs = new MutationObserver(function(records){
		for (var i = 0; i < records.length; ++i) {
			var record = records[i];
			if (!record.type === "childList" || !record.addedNodes) {
				continue;
			}

			// loop through every added node
			for (var j = 0, k = record.addedNodes.length; j < k; ++j) {
				var elm = record.addedNodes[j];
				if (elm.className !== "newmodal") {
					continue;
				}

				elm.querySelector(".btn_green_white_innerfade").click();
				document.getElementById("trade_confirmbtn").click()
			}
		}
		clearTimeout(timer);
	});
	obs.observe(document.body, {childList: true});

	document.getElementById("you_notready").click();
	// if trade isn't suspicious, accept it
	timer = setTimeout(function(){document.getElementById("trade_confirmbtn").click()}, 1000);
}