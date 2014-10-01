var inventory = new Inventory();

// If on match page, add "FUCKING PLACE A BET" button
(function(){
	if (window.location.pathname === "/match") {
		var placebut;
		if ((placebut = document.getElementById("placebut"))) {
			var newBtn = document.createElement("a");
			newBtn.id = "realbetbutton";
			newBtn.className = "buttonright";
			newBtn.textContent = "For real";
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

function enableAuto(worth) {
	console.log("Enabling auto");
	betStatus.enabled = true;

	// update info-box in top-right
    document.querySelector(".destroyer.auto-info").className = "destroyer auto-info";
    document.querySelector(".destroyer.auto-info .worth").textContent = "$"+(worth || 0).toFixed(2);
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
	console.log("Auto bet is currently:");
	console.log(data);
	if (!data.enabled)
		return;

	betStatus.betTime = data.time;
	betStatus.rebetDelay = data.rebetDelay;
	betStatus.enabled = true;
	enableAuto(data.worth);
});

// listen for auto-betting updates
chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
	console.log("Received message");
	console.log("Received autobet update:");
	console.log(request);

	if (request.autoBet === false) { // autobetting has stopped
		betStatus.enabled = false;
		document.querySelector(".destroyer.auto-info").className = "destroyer auto-info hidden";
		document.location.reload();
		return;
	}

	if (request.autoBet === true) { // bet succeeded
		betStatus.enabled = false;
		document.querySelector(".destroyer.auto-info").className = "destroyer auto-info hidden";
		if (request.navigate) { // and we're the chosen tab
			localStorage.playedbet = false;
			window.location.href = request.navigate;
		}
		return;
	}

	if (request.autoBet) {
		if (request.autoBet.worth && request.autoBet.time && request.autoBet.rebetDelay) { // autobetting has started
			betStatus.enabled = true;
			betStatus.betTime = request.autoBet.time;
			betStatus.rebetDelay = request.autoBet.rebetDelay;

			enableAuto(request.autoBet.worth);
			return;
		}

		if (request.autoBet.time && request.autoBet.error) { // autobetting has received an error from Lounge
			document.querySelector(".destroyer.auto-info .error-text").textContent = request.autoBet.error;
			betStatus.betTime = request.autoBet.time;
			return;
		}
	}
});

// when the auto-bet button is clicked
function onAutobetClicked() {
	console.log("Autobet clicked");

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

		if (inventory.determineBackpackType() === "returns") {
			url = "http://csgolounge.com/ajax/postBet.php";
		} else if (inventory.determineBackpackType() === "inventory") {
			url = "http://csgolounge.com/ajax/postBetOffer.php"
		} else {
			console.log("Couldn't determine backpack type");
			return;
		}

		console.log("Data: " + data);
		console.log("URL: " + url);

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
	betTime.addEventListener("change", function(){
		chrome.runtime.sendMessage({"set": {bet: {autoDelay: this.valueAsNumber * 1000}}});
	}); // TO-DO: save setting

	paragraphs[0].appendChild(worthSpan);

	container.appendChild(paragraphs[0]);
	container.appendChild(btn);
	container.appendChild(paragraphs[1]);
	container.appendChild(paragraphs[2]);
	container.appendChild(label);
	container.appendChild(betTime);

	document.body.appendChild(container);
})();