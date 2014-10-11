var inventory;

// If on match page, add "FUCKING PLACE BET" button
(function(){
	if (window.location.pathname === "/match") {
		var placebut;
		if ((placebut = document.getElementById("placebut")) &&
			placebut.getAttribute("onclick").indexOf("placeBetNew") !== -1) {
			var newBtn = document.createElement("a");
			newBtn.id = "realbetbutton";
			newBtn.className = "buttonright";
			newBtn.textContent = "FUCKING PLACE BET";
			newBtn.setAttribute("data-tlss", placebut.getAttribute("onclick").match(/\('[0-9]+', '([0-9A-Za-z]+)/)[1]);
			newBtn.addEventListener("click", onAutobetClicked);
			placebut.parentNode.insertBefore(newBtn, placebut);
		}
	}
})();

var betStatus = {
	enabled: false,
	betTime: 0,
	rebetDelay: 10000
};

function enableAuto(worth, match, tries, error) {
	betStatus.enabled = true;

	var ordinalEnding = ((tries||0)+"").slice(-1);
	ordinalEnding = (tries%100 < 20 &&
					tries%100 > 10) ? "th" : // if a "teen" number, end in th
					ordinalEnding === "1" ? "st":
		            ordinalEnding === "2" ? "nd":
		            ordinalEnding === "3" ? "rd":
		            "th";

	var worth = worth === -1 ? "key(s)" :
	                      "$"+(worth || 0).toFixed(2);

	// update info-box in top-right
    document.querySelector(".destroyer.auto-info").className = "destroyer auto-info";
    document.querySelector(".destroyer.auto-info .worth").textContent = worth;
    document.querySelector(".destroyer.auto-info .match-link").textContent = match;
    document.querySelector(".destroyer.auto-info .match-link").href = "match?m="+match;
    document.querySelector(".destroyer.auto-info .num-tries").textContent = (tries||0) + ordinalEnding;
    document.querySelector(".destroyer.auto-info .error-text").textContent = error;
    document.getElementById("bet-time").valueAsNumber = betStatus.rebetDelay / 1000;

    // update timer
    (function timerLoop(){
        if (!betStatus.enabled)
            return;
        if (!betStatus.betTime) {
        	setTimeout(timerLoop, 250);
        	return;
        }

        var span = document.querySelector(".destroyer.auto-info .time-since");
        span.textContent = ((Date.now() - betStatus.betTime) / 1000).toFixed(2) + "s";

        requestAnimationFrame(timerLoop);
    })();
}

// load data if auto-betting
chrome.runtime.sendMessage({get: "autoBet"}, function(data){
	if (!data.enabled)
		return;

	betStatus.betTime = data.time;
	betStatus.rebetDelay = data.rebetDelay;
	betStatus.enabled = true;
	enableAuto(data.worth, data.matchId, data.numTries, data.error);
});

// listen for auto-betting updates
chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
	if (request.autoBet === false) { // autobetting has stopped
		betStatus.enabled = false;
		document.querySelector(".destroyer.auto-info").className = "destroyer auto-info hidden";
		return;
	}

	if (request.autoBet === true) { // bet succeeded
		betStatus.enabled = false;
		document.querySelector(".destroyer.auto-info").className = "destroyer auto-info hidden";
		if (!streamPlaying) {
			localStorage.playedbet = false;
			document.location.reload();
		}
		return;
	}

	if (request.autoBet) {
		// autobetting has started
		if (request.autoBet.worth && request.autoBet.time && request.autoBet.rebetDelay) {
			betStatus.enabled = true;
			betStatus.betTime = request.autoBet.time;
			betStatus.rebetDelay = request.autoBet.rebetDelay;

			enableAuto(request.autoBet.worth, request.autoBet.matchId, request.autoBet.numTries, request.autoBet.error);
			return;
		}

		// autobetting has received an error from Lounge
		if (request.autoBet.time && request.autoBet.error) {
			document.querySelector(".destroyer.auto-info .error-text").textContent = request.autoBet.error;
			
			var ordinalEnding = ((request.autoBet.numTries||0)+"").slice(-1);
			ordinalEnding = (request.autoBet.numTries%100 < 20 &&
							request.autoBet.numTries%100 > 10) ? "th" : // if a "teen" number, end in th
							ordinalEnding === "1" ? "st":
				            ordinalEnding === "2" ? "nd":
				            ordinalEnding === "3" ? "rd":
				            "th";
			document.querySelector(".destroyer.auto-info .num-tries").textContent = (request.autoBet.numTries||0) + ordinalEnding;

			betStatus.betTime = request.autoBet.time;
			return;
		}
	}
});

// when the auto-bet button is clicked
function onAutobetClicked() {
	// if no team was selected, error out
	if (!document.getElementById("on").value) {
		alert("You didn't select a team.");
		return;
	}

	// if items have been added to the bet
	if (document.querySelector(".left").children.length > 0) {
		document.getElementById("realbetbutton").style.display = "none";
		var data = $("#betpoll").serialize()+"&match="+window.location.search.substr(3)+"&tlss="+this.getAttribute("data-tlss"),
			url;
        // TODO: Rewrite this.
		if (inventory.determineBackpackType() === "returns") {
			url = window.location.origin+"/ajax/postBet.php";
		} else if (inventory.determineBackpackType() === "inventory") {
			url = window.location.origin+"/ajax/postBetOffer.php";
		} else {
			return;
		}

		// enable auto-betting
		chrome.runtime.sendMessage({
			autoBet: {
				url: url,
				data: data,
				matchNum: window.location.search.substr(3)
			}
		});
	} else {
		alert("You didn't pick any item.");
	}
}

// create info box in top-right
(function(){
	var container = document.createElement("div"),
	    paragraphs = [document.createElement("p"),document.createElement("p"),document.createElement("p")],
	    worthSpan = document.createElement("span"),
	    matchLink = document.createElement("a"),
	    triesSpan = document.createElement("span"),
	    btn = document.createElement("button"),
	    timeSpan = document.createElement("span"),
	    label = document.createElement("label"),
	    betTime = document.createElement("input");

	container.className = "destroyer auto-info hidden";
	paragraphs[0].textContent = "Auto-betting items worth ";
	paragraphs[1].textContent = "Last error (";
	timeSpan.className = "destroyer time-since";
	timeSpan.textContent = "0s";
	paragraphs[1].appendChild(timeSpan);
	paragraphs[1].appendChild(document.createTextNode("):"));
	paragraphs[1].className = "destroyer error-title";
	paragraphs[2].className = "destroyer error-text";
	worthSpan.className = "worth";
	matchLink.className = "match-link";
	triesSpan.className = "num-tries";
	triesSpan.textContent = "0th"
	btn.className = "red";
	btn.textContent = "Disable auto-bet";
	label.textContent = "Seconds between retries:";
	betTime.id = "bet-time";
	betTime.type = "number";
	betTime.min = "5";
	betTime.max = "60";
	betTime.step = "1";

	btn.addEventListener("click", function(){
		chrome.runtime.sendMessage({"autoBet": false});
	});
	betTime.addEventListener("input", function(){
		if (this.valueAsNumber)
			chrome.runtime.sendMessage({"set": {bet: {autoDelay: this.valueAsNumber * 1000}}});
	}); // TO-DO: save setting

	paragraphs[0].appendChild(worthSpan);
	paragraphs[0].appendChild(document.createTextNode(" on match "));
	paragraphs[0].appendChild(matchLink);
	paragraphs[0].appendChild(document.createTextNode(". Betting for the "));
	paragraphs[0].appendChild(triesSpan);
	paragraphs[0].appendChild(document.createTextNode(" time."));

	container.appendChild(paragraphs[0]);
	container.appendChild(btn);
	container.appendChild(paragraphs[1]);
	container.appendChild(paragraphs[2]);
	container.appendChild(label);
	container.appendChild(betTime);

	document.body.appendChild(container);
})();
