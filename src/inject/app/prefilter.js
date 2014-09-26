console.log("Injected prefilter script");

// prefilter all AJAX requests
$.ajaxPrefilter(function(options, originalOptions, jqHXR) {
	console.log("AJAX request:");
	console.log(options);
	console.log(originalOptions);
	console.log(jqHXR);

	// TODO: save latest request (by type) to localstorage
});