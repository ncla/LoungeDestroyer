// Navigation variables
var navAnchor	= $('nav[role="navigation"] ul a');
var navList 	= $('nav[role="navigation"] ul li');
var navEnabled	= true;

// -----------------------------------------
// Add class 'active' to currently visible page
// -----------------------------------------

navAnchor.each( function() {
	// Variables
	var self 		= $(this);
	var parent 		= self.parent();
	var currentPage = $('section:visible').attr('id');

	// Remove every 'active' class
	parent.removeClass('active');
	
	// Add class 'active' to currently visible page's anchor
	if (self.attr('href').replace('#','') == currentPage)
		parent.not('.logo').addClass('active');
});

// -----------------------------------------
// Page switcher
// -----------------------------------------

navAnchor.click( function(e) {
	// Disable link
	e.preventDefault();

	if (navEnabled) {
		// Variables
		var self 			= $(this);
		var page 			= self.attr('href').replace('#','');
		
		// Add class 'active' for active page
		if (!self.parent().hasClass('active')) {
			navList.removeClass('active');
			navList.find('a[href*="#' + page + '"]').parent().not('.logo').addClass('active');

			// // Show / hide needed content
			$('section:visible').addClass('hidden');
			$('section#' + page).removeClass('hidden');

			// Clearing out text fields on page switch
			$('input, textarea').not('.btn').val('');

			// Removing class 'group-error' on page switch
			$('div.group-error').removeClass('group-error');
		}
	}
});

// -----------------------------------------
// Tooltips
// -----------------------------------------

$('[data-tooltip]').each( function(e) {
	// Variables
	var self 		= $(this);
	var content 	= self.data('tooltip');
	var tooltip 	= $('<div class="tooltip">' + content + '</div>').appendTo('body');

	// Show tooltip on hover
	self.hover( function() {
		var position 	= self.offset();
		var css 		= {
			top: 		Math.round(position.top + self.height()),
			left: 		Math.round(position.left - (tooltip.outerWidth() / 2 - 11))
		};

		// Positioning tooltip
		tooltip.css(css);

		// Show / hide tooltip
		tooltip.toggleClass('show');
	});
});

// -----------------------------------------
// Adding padding to the right for inline forms
// -----------------------------------------

$('form.form-inline').each( function() {
	// Variables
	var self 	= $(this);
	var button 	= self.find('.btn');
	var input 	= self.find('input').not('.btn');

	// Adding padding
	input.css({
		paddingRight: button.outerWidth() + 12
	});
});

// -----------------------------------------
// Input validation
// -----------------------------------------
 
function validateInput($elm, callback, ignoreEmpty) {
	var value	 = $elm.val();
	var classTarget = getClassTarget();

	// fail if no value is entered
	// or succeed if empty and should ignore empty
	if (!$elm.val().length) {
		if (ignoreEmpty) { return succeed(); }
		else { return fail(); }
	}

	// fail if this specific type doesn't validate
	var type = $elm.data("validation");
	if (validators.hasOwnProperty(type)) {
		// if validator is synchronous
		if (["url", "number"].indexOf(type) !== -1) {
			var result = validators[type](value);
			if (result) { return succeed(); }
			return fail();
		}

		// if not synchronous
		validators[type](value,  function(result){
			if (result) { return succeed(); }
			return fail();
		});
	}

	// helper functions
	function fail() {
		classTarget.addClass("group-error");
		$elm[0].valid = false;
		callback(false);
	}
	function succeed() {
		classTarget.removeClass("group-error");
		$elm[0].valid = true;
		callback(true);
	}
	function getClassTarget() {
		if ($elm.parent().hasClass("row")) {
			return $elm.parent().parent();
		}
		return $elm.parent();
	}
};
 
// VALIDATORS
var validators = {
	// Validates a URL
	url:  function(str) {
		var urlRegexp = /^(http(?:s)?\:\/\/[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,6}(?:\/?|(?:\/[\w\-]+)*)(?:\/?|\/\w+\.[a-zA-Z]{2,4}(?:\?[\w]+\=[\w\-]+)?)?(?:\&[\w]+\=[\w\-]+)*(?:\.([a-zA-Z0-9]+))?)$/i;
		return urlRegexp.test(str);
	},

	// Validates a number
	number:  function(str) {
		return !isNaN(parseInt(str));
	},

	// Validates an image URL
	image:  function(str, callback) {
		// if the string isn't a valid URL, fail
		if (!validators.url(str)) { callback(false); return; }

		// load the website, make sure the MIME type is supported
		$.ajax({
			type: "GET",
			url: str,
			success:  function(data,ev,xmlhttp){
				var mime = xmlhttp.getResponseHeader("content-type");

				/* if you only want to support a few image types
				var supported = ["image/png", "image/jpeg"];
				if (supported.indexOf(mime) === -1) { callback(false;) }
				*/

				// if you want to support all image types
				if (mime.indexOf("image/") !== 0) { callback(false); return; }
				callback(true);
			},
			error:  function(){
				callback(false);
			}
		});
	},
	// Validates a JSON URL
	json:  function(str, callback) {
		if (!validators.url(str)) { callback(false); return; }

		// load the website, make sure the response can be parsed as JSON
		$.ajax({
			type: "GET",
			url: str,
			success:  function(data,ev,xmlhttp){
				try {
					var x = JSON.parse(xmlhttp.responseText);
					callback(true);
				} catch (e) {
					// JSON failed to parse
					callback(false);
				}
			},
			error:  function(){
				callback(false);
			}
		});
	}
};
 
// Validate inputs when their data is changed
$("input[data-validation]")
	.on("input",  function(){
		var self = this;
		// if it's currently at an error, validate instantly
		if (self.valid === false) {
			clearTimeout(self.validateTimer);
			validateInput($(self),  function(){}, true);
			return;
		}

		// otherwise, wait until the user hasn't typed for 1 sec
		clearTimeout(self.validateTimer);
		self.validateTimer = setTimeout( function(){
			validateInput($(self),  function(){}, true);
		}, 1000);
	})
	// or when they lose focus
	.blur( function(){
		clearTimeout(self.validateTimer);
		validateInput(self,  function(){}, true);
	}
);
 
// Verify forms
$('form').each( function() {
	// Variables
	var form		= $(this);
	var submit		= form.find('input[type="submit"]');

	submit.click( function(e) {
		e.preventDefault();

		// Variables
		var self		= $(this);
		var fields		= form.find('input[data-validation], input[data-required], textarea[data-required]').not('.btn');
		var allFields 	= form.find('input, textarea').not('.btn');
		var valid 		= true;

		// create a function that continues when it's called the nth time
		var fieldValid =  function(result){
			var self = fieldValid;
			++self.curNum;

			// If a field failed to validate
			if (!result) {
				self =  function(){};
				return;
			}

			// do a certain action once every field has been validated
			if (self.curNum === self.targetNum) {
				allFields.val("");
			}
		};

		fieldValid.curNum = 0;
		fieldValid.targetNum = fields.length;

		// validate all fields
		fields.each( function() {
			var $self = $(this);
			// if it has validation, and is non-empty/should be non-empty
			if ($self.data("validation") && (typeof $self.data("required") !== "undefined" || $self.val().length)) {
				validateInput($self, fieldValid);
			// else if it has no validation, but is required
			} else if (typeof $self.data("required") !== "undefined") {
				fieldValid(!!$self.val().length);
			// if it has validation, but is non-empty (and allowed to be)
			} else {
				fieldValid(true);
			}
		});
	});
});

// -----------------------------------------
// Enabling only allowed characters to be inputted in text fields
// -----------------------------------------

$('input[data-validation="number"]').keypress( function(e) {
	// Allowed keycodes: 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57 (. and 0-9)
	if (!(e.keyCode == 46 || (e.keyCode >= 48 && e.keyCode <= 57)))
		e.preventDefault();
});

// -----------------------------------------
// Handy functions
// -----------------------------------------

function disableBtn(element, loading, loadingText) {
	// Variables
	var self 		= $(element);
	var loading		= loading ? loading : false;
	var loadingText	= loadingText ? loadingText : 'Loading...';

	// Add class 'btn-loading', if needed
	if (loading) {
		self.addClass('btn-loading');
		self.attr('data-loading', loadingText);
	}

	self.attr('disabled', 'disabled');
}

// -----------------------------------------
// Theme slider
// -----------------------------------------
var $themeSlider 		= $('#themes-slider');
var sliderNavsEnabled 	= true;
var cssEditorVisible 	= false;
var $cssEditor, $cssSave;

function initSlider() {
    $themeSlider.each( function() {
        // Variables
        var self			= $(this);
        var $allSettings 	= self.find('div.theme-settings');
        var $preview 		= self.find('div.theme-preview');
        var $slides 		= self.find('li[data-theme]');

        // Aligning settings box in the middle of the preview area
        $allSettings.each(function() {
            var $settings 	= $(this);
            var top 		= ($preview.height() - $settings.outerHeight()) / 2;
            var left 		= ($preview.width() - $settings.outerWidth()) / 2;

            $settings.css({
                top: top,
                left: left
            });
        });

        $slides.not('.current').addClass('hidden');

        // Carousel
        var currSlide 	= $slides.index($('.current')) + 1;
        var allSlides	= $slides.length;
        var $prev		= self.find('li.prev');
        var $next		= self.find('li.next');

        // Hide navs, if there are not enough slides
        if (allSlides < 2) {
            $themeSlider.addClass('slider-hide-navs');
            sliderNavsEnabled = false;
        }

        if (sliderNavsEnabled) {
            // Switch to previous slide by clicking on the arrow "left"
            $prev.click(function() {
                prevSlide();
            });

            // Switch to next slide by clicking on the arrow "right"
            $next.click(function() {
                nextSlide();
            });

            // Switch between slides by using "left" / "right" arrow keys
            $('body').keydown(function(e) {
                if (e.keyCode == 37)
                    prevSlide();
                else if (e.keyCode == 39)
                    nextSlide();
            });
        }

        // Previous slide function
        function prevSlide() {
            if (currSlide == 1) {
                $slides.removeClass('current').addClass('hidden');
                $slides.last('li[data-theme]').removeClass('hidden').addClass('current');

                currSlide = allSlides;
            } else {
                $slides.removeClass('current').addClass('hidden');
                $slides.prev('li[data-theme]').removeClass('hidden').addClass('current');

                currSlide--;
            }
        }

        // Next slide function
        function nextSlide() {
            if (currSlide == allSlides) {
                $slides.removeClass('current').addClass('hidden');
                $slides.first('li[data-theme]').removeClass('hidden').addClass('current');

                currSlide = 1;
            } else {
                $slides.removeClass('current').addClass('hidden');
                $slides.next('li[data-theme]').removeClass('hidden').addClass('current');

                currSlide++;
            }
        }
    });
}

$('button.btn[data-theme-action]').click( function() {
	var self = $(this);
	var data = self.data('theme-action');
	var current = $('li[data-theme].current');

	if (data == 'edit') {
		cssEditorVisible 	= true;
		$cssEditor 			= current.find('.css-edit');
		$cssSave 			= current.find('.btn-save');

		$cssEditor.addClass('css-edit-show');
		$cssSave.addClass('btn-save-show');

		setTimeout(function() {
			current.find('textarea').focus();
		}, 320);
	} else if (data == 'delete') {
		alert('LOL U MAD?! [436th line @ main.js]');
	}
});

$('button.btn[data-theme-settings]').click( function() {
	var self 	= $(this);
	var data 	= self.data('theme-settings');

	$themeSlider.each( function() {
		var self 	= $(this);
		var $preview = self.find('li.current div.theme-preview');

		if (data == 'open') {
			if (sliderNavsEnabled)
				self.addClass('slider-hide-navs');

			$preview.addClass('theme-settings-open');
		} else if (data == 'close') {
			if (sliderNavsEnabled)
				self.removeClass('slider-hide-navs');

			$preview.removeClass('theme-settings-open');

			if (cssEditorVisible) {
				$cssEditor.removeClass('css-edit-show');
				$cssSave.removeClass('btn-save-show');
			}
		}
	});
});

// ----------------------------------------
// Modals
// ----------------------------------------

// $.fn.ldModal =  function(options) {
// 	var self 		= $(this);
// 	var defaults 	= {
// 		visible: false
// 	};
// 	var settings 	= $.extend({}, defaults, options);

// 	// Looping through every element
// 	return self.each( function() {
// 		// Variables
// 		var container 		= $(self.find('> div'));
// 		var containerTop	= Math.round(container.outerHeight() / 2);
// 		var containerLeft 	= Math.round(container.outerWidth() / 2);
// 		var closeEls		= $(self.find('*[data-modal]'));
// 		var delayedEffect 	= false;
// 		var toggleModal 	=  function(state) {
// 			if (state == 'on') {
// 				self.hide();
// 				self.stop().fadeIn(250);

// 				clearTimeout(delayedEffect);
// 				delayedEffect = setTimeout( function() {
// 					container.stop().fadeIn(250)
// 						.css('marginTop', -(containerTop - 15));
// 				}, 170);

// 				settings.visible = true;
// 			} else if (state == 'off') {
// 				container.fadeOut(250)
// 						.css('marginTop', -(containerTop + 15));

// 				clearTimeout(delayedEffect);
// 				delayedEffect = setTimeout( function() {
// 					self.fadeOut(250);
// 				}, 170);

// 				settings.visible = false;
// 			}
// 		}

// 		// Aligning the container in the middle of the screen
// 		container.css({
// 			marginLeft: -containerLeft,
// 			marginTop: -(containerTop + 15)
// 		}).hide();

// 		// Show / hide modal by default
// 		if (settings.visible == false) {
// 			self.hide();
// 		} else {
// 			toggleModal('on');
// 		}

// 		// Disable page scrolling, when modal is visible
// 		self.on('mousewheel',  function(e) {
// 			e.preventDefault();
// 			e.stopPropagation();
// 		});

// 		// Hide modal, if closing button was clicked
// 		closeEls.click( function() {
// 			toggleModal('off');
// 		});
// 	});
// }

// $.fn.modal = function(options) {
// 	var defaults = $.extend({

// 	}, options);
// 	var settings 	= $.extend({}, defaults, options);

// 	var $window 	= $(window);
// 	var $modal 		= $(this);
// 	var $modals 	= $('div.modal');
// 	var $container 	= $(this).find('> div');
// 	var top, left, delayedEffect;

// 	function show() {
// 		$modal.stop().fadeIn(250);

// 		clearTimeout(delayedEffect);
// 		delayedEffect = setTimeout(function() {
// 			$container.stop().fadeIn(250).css('marginTop', + 15);
// 		}, 250);
// 	}

// 	function hide() {
// 		$container.fadeOut(250).css('marginTop', 0);

// 		clearTimeout(delayedEffect);
// 		delayedEffect = setTimeout(function() {
// 			$modal.fadeOut(250);
// 		}, 250);
// 	}

// 	return $modal.each( function() {
// 		// Disable page scrolling, when modal is visible
// 		$modal.on('mousewheel', function(e) {
// 			e.preventDefault();
// 			e.stopPropagation();
// 		});

// 		// Center the modal in the viewport
// 		top 	= Math.max($window.height() - $container.outerHeight(), 0) / 2;
// 		left 	= Math.max($window.width() - $container.outerWidth(), 0) / 2;

// 		$container.css({
// 			top: 	top,
// 			left: 	left
// 		}).hide();

// 		// Hide every modal
// 		$modals.hide();
// 	});

// 	return this;
// }

var element = $('div.modal#tour');
