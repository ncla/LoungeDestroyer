var queue = {
	queued: false, // if currently in queue
	offer: false, // offer URL, or false if no offer
	time: 0, // timestamp of offer end, or 0 if no offer
	protectionCode: false, // protection code, or false if no offer
};

// init
$(document).ready(function(){
	var queueElm = document.getElementById("queue");
	if (!queueElm)
		return;

	queue.queued = true;

	// create observer for queue element
	var obs = new MutationObserver(function(records){
		console.log("Mutation record:");
		console.log(records);

		for (var i = 0; i < records.length; ++i) {
			var record = records[i];
			if (!record.type === "childList" || !record.addedNodes)
				continue;
			
			// loop through every added node
			for (var j = 0, k = record.addedNodes.length; j < k; ++j) {
				var elm = record.addedNodes[j];
				// protection code
				if(elm.nodeName === "B") {
					queue.protectionCode = elm.textContent || false;
					continue;
				}

				// other than protection code, we're only interested in links
				if (elm.nodeName !== "A")
					continue;

				// link to offer
				if (elm.className === "button") {
					queue.offer = elm.href || false;
					queue.time = parseInt(localStorage.whenbet) ?
					             parseInt(localStorage.whenbet) + 420000 :
					             0;
				}
			}
		}

		// save queue data to storage
		chrome.storage.local.set({queue: queue});
	});
	obs.observe(queueElm, {
		childList: true
	})
});

