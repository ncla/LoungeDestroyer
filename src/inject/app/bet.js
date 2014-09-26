/* Bet-a-tron 9000 */
var bet = { // not a class - don't instantiate
	
};

// inject script to prefilter AJAX, saving latest request (by type) to localstorage
// TODO: write prefilter script
addJS_Node(null, "src/inject/app/prefilter.js", null, null, true);