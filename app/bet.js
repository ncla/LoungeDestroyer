var $ldContainer;
var $ldContainerMatchLink;
var $ldContainerNumTries;
var $ldContainerErrText;
var $ldContainerTimeSince;

var timeoutStore;

var betStatus = {
    enabled: false,

    // autoBet || autoReturn
    type: 'autoBet',
    betTime: 0,
    rebetDelay: 5000
};

// On page refresh, check immediately if we have auto-betting in progress
chrome.runtime.sendMessage({autoBet: 'status'}, function(data) {
    console.log('AUTOBET :: status', data);
    betStatus = data;
    if (betStatus.autoBetting === true) {
        $(document).ready(function() {
            updateAutobetInfo();
            $ldContainer.removeClass('hidden');
        });
    } else {
        if (document.URL.indexOf('/mybets') !== -1) {
            // return items if we've enabled auto-accept
            if (LoungeUser.userSettings.enableAuto === '1') {
                // and if we have frozen items
                $(document).ready(function() {
                    if ($('#freeze .item').length && $('#queue').length === 0) {
                        chrome.runtime.sendMessage({autoBet: 'continueAutoReturn'}, function(data) {
                            console.log('AUTOBET :: Continuing auto-returning', data);

                            if (data === true) {
                                newFreezeReturn();
                            }
                        });
                    }
                });
            }
        }
    }
});

// listen for auto-betting updates
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!request.hasOwnProperty('autoBet')) {
        return;
    }

    var autoBetData = request.autoBet;

    betStatus = autoBetData;

    // If auto-betting has been stopped by user / successful bet
    if (autoBetData.autoBetting === false && autoBetData.hasOwnProperty('action') && autoBetData.action.hasOwnProperty('disableAuto')) {
        betStatus.autoBetting = false;

        // TODO: true and false has same logic almost, rewrite so it is less DRY
        if (autoBetData.action.disableAuto === true || autoBetData.action.disableAuto === false) {
            console.log('AUTOBET :: Successful');
            $(document).ready(function() {
                var delay = (betStatus.type === 'autoAccept' ? 30 : 0);
                setTimeout(function() {
                    if ($ldContainer.is(":visible")) {
                        $ldContainer.fadeOut(350, function() {
                            $(this).addClass('hidden');
                        });
                    }

                }, (delay * 1000));
            });

            if (autoBetData.action.disableAuto === false) {
                if (betStatus.type === 'autoBet') {
                    localStorage.playedbet = false;
                }
                if (betStatus.type === 'autoReturn') {
                    localStorage.playedreturn = false;
                }
            }
        }

        if (autoBetData.action.disableAuto === false) {
            console.log('AUTOBET :: Failure, cancelled by user');
            if (betStatus.type === 'autoBet') {
                $(document).ready(function() {
                    $('#placebut').show();
                });
            }
        }
    }

    // TODO: If not betting and message does not have action disableAuto

    if (betStatus.autoBetting === true) {
        $(document).ready(function() {
            $ldContainer.removeClass('hidden');
        });
    }


    // Started autobetting / update autobetting
    // NOTE: Don't really need to limit this to just autoBetting true property I think
    $(document).ready(function() {
        updateAutobetInfo();
    });

    console.log('AUTOBET :: Update received', autoBetData);
});

/**
 * Updates the auto-betting box with information
 */
function updateAutobetInfo() {
    if (!document.hidden) {

        $(document).ready(function() {
            $ldContainer.removeClass('ld-autobet ld-autoreturn ld-autofreeze ld-autoaccept').addClass('ld-' + betStatus.type.toLowerCase());
        });

        var ordinalEnding = determineOrdinalEnding(betStatus.numTries);

        if (betStatus.type === 'autoBet') {
            $(document).ready(function() {
                $ldContainerMatchLink.text(betStatus.matchNum).attr('href', 'match?m=' + betStatus.matchNum);
            });
        }

        if (betStatus.type === 'autoAccept') {
            determineIfShowAcceptWarning();
        }

        // Update info-box
        $(document).ready(function() {
            $ldContainerNumTries.text((betStatus.numTries || 0) + ordinalEnding);
            $ldContainerErrText.text(betStatus.lastError);
        });
    }

    // Update timer
    (function timerLoop() {
        if (!betStatus.autoBetting) {
            return;
        }

        var betTime = (betStatus.type === 'autoAccept' ? betStatus.acceptStart : betStatus.lastBetTime);

        if (betTime === 0) {
            return;
        }

        if (!betStatus.lastBetTime) {
            setTimeout(timerLoop, 500);
            return;
        }

        if (!document.hidden) {
            $(document).ready(function() {
                $ldContainerTimeSince.text(((Date.now() - betTime) / 1000).toFixed(2) + 's');
            });
        }

        clearTimeout(timeoutStore);
        timeoutStore = setTimeout(timerLoop, 66);
    })();
}


function determineOrdinalEnding(number) {
    var ordinalEnding = ((number || 0) + '').slice(-1);

    return (number % 100 < 20 &&
        number % 100 > 10) ? 'th' :
            ordinalEnding === '1' ? 'st' :
                ordinalEnding === '2' ? 'nd' :
                    ordinalEnding === '3' ? 'rd' :
                        'th';
}

function determineIfShowAcceptWarning() {
    $(document).ready(function() {
        if (parseFloat(LoungeUser.userSettings.acceptDelayv2) < 10) {
            $ldContainer.addClass('ld-accept-issue');
        } else {
            $ldContainer.removeClass('ld-accept-issue');
        }
    });
}

$(document).ready(function() {
    $ldContainer = $('<div class="destroyer auto-info hidden">' +
        '<p class="ld-autobet-info">Auto-betting</span> items on match <a class="match-link"></a>. ' +
        '<span class="type capitalize">Betting</span> for the <span class="num-tries">0th</span> time.</p>' +

        '<p class="ld-autoreturn-info">Auto-returning</span> items for the <span class="num-tries">0th</span> time.</p>' +

        '<p class="ld-autofreeze-info">Auto-freezing</span> items for the <span class="num-tries">0th</span> time.</p>' +

        '<p class="ld-autoaccept-info">Auto-accepting</span> trade offer.</p>' +

        '<button class="red ld-disable-auto">Disable</button>' +

        '<p class="destroyer error-title">Last message (<span class="destroyer time-since">0s</span>):</p><p class="destroyer error-text"></p>' +

        '<label class="ld-autobetreturn-label">Seconds between retries:</label><input id="bet-time" type="number" min="2" max="60" step="1">' +
        '<label class="ld-autoaccept-label">Delay before accepting:</label><input id="accept-time" type="number" min="0" max="60" step="1">' +
        '<p class="ld-accept-warning"><span class="warning-symbol">!</span>Delay less than 10 seconds may cause issues accepting trade offers.</p>');

    $ldContainer.find('button.ld-disable-auto').click(function() {
        chrome.runtime.sendMessage({autoBet: 'disable'});
        $('.destroyer.auto-info').addClass('hidden');
    });

    $ldContainer.find('#bet-time').change(function() {
        var newVal = Math.max(2, this.valueAsNumber);
        if (newVal) {
            this.valueAsNumber = newVal;
            LoungeUser.saveSetting('autoDelay', newVal);
        }
    });

    $ldContainer.find('#accept-time').change(function() {
        LoungeUser.saveSetting('acceptDelayv2', this.valueAsNumber);
        determineIfShowAcceptWarning();
    });
    

    $('body').append($ldContainer);

    $ldContainerMatchLink = $('.destroyer.auto-info .match-link');
    $ldContainerNumTries = $('.destroyer.auto-info .num-tries');
    $ldContainerErrText = $('.destroyer.auto-info .error-text');
    $ldContainerTimeSince = $('.destroyer.auto-info .time-since');
});

window.onfocus = function() {
    updateAutobetInfo();
};