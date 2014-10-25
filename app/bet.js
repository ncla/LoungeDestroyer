var inventory;

/*(function(){
	// If on match page, add "FUCKING PLACE BET" button
	if (window.location.pathname === "/match" || document.URL.indexOf("/predict") != -1) {
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

	// If on bets page, add "FUCKING REQUEST RETURNS" button 
	if (window.location.pathname === "/mybets") {
		var freezebtn;
		if ((freezebtn = document.getElementById("freezebutton"))) {
			var newBtn = document.createElement("a");
			newBtn.id = "realreturnbutton";
			newBtn.className = "button";
			newBtn.textContent = "FUCKING REQUEST RETURNS";
			newBtn.addEventListener("click", function self(){
				var toreturn = !document.querySelector(".tofreeze"),
				    msg = {
						autoReturn: {
							url: window.location.origin+"/ajax/postToReturn.php"
						}
					};

				if (!toreturn) {
					$.ajax({
						url: "ajax/postToFreeze.php",
						type: "POST",
						data: $("#freeze").serialize(),
						success: function(data) {
							if (data) window.alert(data);
							else {
								chrome.runtime.sendMessage(msg);
								betStatus.type = "autoReturn";
								enableAuto();
							}
						}
					});
				} else {
					chrome.runtime.sendMessage(msg);
					betStatus.type = "autoReturn";
					enableAuto();
				}
			});

			freezebtn.parentNode.appendChild(newBtn);
		}
	}
})();*/

var betStatus = {
	enabled: false,
	type: "autoBet", // autoBet || autoReturn
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

	if (betStatus.type === "autoBet") {
		var worth = worth === -1 ? "key(s)" :
		                      "$"+(worth || 0).toFixed(2);

		document.querySelector(".destroyer.auto-info .worth-container").className = "worth-container";
   		//document.querySelector(".destroyer.auto-info .worth").textContent = worth;
	    document.querySelector(".destroyer.auto-info .match-link").textContent = match;
	    document.querySelector(".destroyer.auto-info .match-link").href = "match?m="+match;
	    document.querySelector(".destroyer.auto-info button").textContent = "Disable auto-bet";

	    var typeSpans = document.querySelectorAll(".destroyer.auto-info .type");
		for (var i = 0; i < typeSpans.length; ++i) {
			typeSpans[i].textContent = "betting";
		}
	} else {
		document.querySelector(".destroyer.auto-info .worth-container").className = "worth-container hidden";
		document.querySelector(".destroyer.auto-info button").textContent = "Disable auto-return";

		var typeSpans = document.querySelectorAll(".destroyer.auto-info .type");
		for (var i = 0; i < typeSpans.length; ++i) {
			typeSpans[i].textContent = "returning";
		}
	}

	// update info-box in top-right
    document.querySelector(".destroyer.auto-info").className = "destroyer auto-info";
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
	betStatus.type = data.type;

	enableAuto(data.worth, data.matchId, data.numTries, data.error);
});

// listen for auto-betting updates
chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
	var data = request[request.hasOwnProperty("autoBet") ? "autoBet" : "autoReturn"];
	console.log("Received message:");
	console.log(request);
	console.log(data);

	if (data === false) { // autobetting has stopped
		betStatus.enabled = false;
		document.querySelector(".destroyer.auto-info").className = "destroyer auto-info hidden";
		return;
	}

	if (data === true) { // bet succeeded
		console.log("Success.");
		betStatus.enabled = false;
		document.querySelector(".destroyer.auto-info").className = "destroyer auto-info hidden";
		if (!streamPlaying) {
			localStorage.playedbet = false;
			localStorage.playedreturn = false;
			document.location.reload();
		}
		return;
	}

	if (data) {
		betStatus.type = request.autoBet ? "autoBet" : "autoReturn";

		// autobetting has started
		if (data.time && data.rebetDelay) {
			betStatus.enabled = true;
			betStatus.time = data.time;
			betStatus.rebetDelay = data.rebetDelay;

			enableAuto(data.worth, data.matchId, data.numTries, data.error);
			return;
		}

		// autobetting has received an error from Lounge
		if (data.time && data.error) {
			document.querySelector(".destroyer.auto-info .error-text").textContent = data.error;
			
			var ordinalEnding = ((data.numTries||0)+"").slice(-1);
			ordinalEnding = (data.numTries%100 < 20 &&
							data.numTries%100 > 10) ? "th" : // if a "teen" number, end in th
							ordinalEnding === "1" ? "st":
				            ordinalEnding === "2" ? "nd":
				            ordinalEnding === "3" ? "rd":
				            "th";
			document.querySelector(".destroyer.auto-info .num-tries").textContent = (data.numTries||0) + ordinalEnding;

			betStatus.betTime = data.time;
			return;
		}
	}
});

// when the auto-bet button is clicked
function onAutobetClicked() {
	// if no team was selected, error out
    if (window.location.pathname === "/match") {
        if (!document.getElementById("on").value) {
            alert("You didn't select a team.");
            return;
        }
    }
    if (window.location.pathname === "/predict") {
        console.log("Predict");
        if (!$("#betpoll input[name=on]:checked").val()) {
            alert("You didn't select a team.");
            return;
        }
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
	var container = document.createElement("div");
	container.className = "destroyer auto-info hidden";
	container.innerHTML = '<p>Auto-<span class="type">betting</span> items<span class="worth-container"> on match <a class="match-link"></a></span>. <span class="type capitalize">Betting</span> for the <span class="num-tries">0th</span> time.</p><button class="red">Disable auto-bet</button><p class="destroyer error-title">Last error (<span class="destroyer time-since">0s</span>):</p><p class="destroyer error-text"></p><label>Seconds between retries:</label><input id="bet-time" type="number" min="5" max="60" step="1">';

	container.querySelector("button").addEventListener("click", function(){
	        chrome.runtime.sendMessage({type: "autoBet", autoBet: false});
	});
	container.querySelector("input").value = LoungeUser.userSettings.autoDelay || 5;
	container.querySelector("input").addEventListener("input", function(){
	        if (this.valueAsNumber) {
                chrome.runtime.sendMessage({"set": {bet: {autoDelay: this.valueAsNumber * 1000}},
                                            "saveSetting": {autoDelay: this.valueAsNumber}});
            }
	}); // TO-DO: save setting

	document.body.appendChild(container);
})();