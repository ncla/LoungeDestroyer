var betStatus = {
	enabled: false,
	type: "autoBet", // autoBet || autoReturn
	betTime: 0,
	rebetDelay: 5000
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

	$(document).ready(function(){
	    enableAuto(data.worth, data.matchId, data.numTries, data.error);
	});
});

// listen for auto-betting updates
chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
	var data = request[request.hasOwnProperty("autoBet") ? "autoBet" : "autoReturn"];
	/*console.log("Received message:");
	console.log(request);
	console.log(data);*/

	if (data === false) { // autobetting has stopped
		betStatus.enabled = false;
        $(document).ready(function() {
            document.querySelector(".destroyer.auto-info").className = "destroyer auto-info hidden";
        });
		return;
	}

	if (data === true) { // bet succeeded
		console.log("Success.");
		betStatus.enabled = false;
        $(document).ready(function() {
            document.querySelector(".destroyer.auto-info").className = "destroyer auto-info hidden";
        });
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
            $(document).ready(function(){
                enableAuto(data.worth, data.matchId, data.numTries, data.error);
            });
			return;
		}

		// autobetting has received an error from Lounge
		if (data.time && data.error) {
            $(document).ready(function() {
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
            });

			return;
		}
	}
});