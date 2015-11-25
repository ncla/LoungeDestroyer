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
            $('.destroyer.auto-info').removeClass('hidden');
        });
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
                var delay = (betStatus.type === 'autoAccept' ? 15 : 0);
                setTimeout(function() {
                    $autoBox = $('.destroyer.auto-info');
                    if ($autoBox.is(":visible")) {
                        $autoBox.fadeOut(350, function() {
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
        $('.destroyer.auto-info').removeClass('hidden');
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
    //betStatus.autoBetting = true;

    $('.destroyer.auto-info').removeClass('ld-autobet ld-autoreturn ld-autofreeze ld-autoaccept').addClass('ld-' + betStatus.type.toLowerCase());

    var ordinalEnding = determineOrdinalEnding(betStatus.numTries);

    if (betStatus.type === 'autoBet') {
        $('.destroyer.auto-info .match-link').text(betStatus.matchNum).attr('href', 'match?m=' + betStatus.matchNum);
    }

    // Update info-box
    $('.destroyer.auto-info .num-tries').text((betStatus.numTries || 0) + ordinalEnding);
    $('.destroyer.auto-info .error-text').text(betStatus.lastError);

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
            setTimeout(timerLoop, 250);
            return;
        }

        $('.destroyer.auto-info .time-since').text(((Date.now() - betTime) / 1000).toFixed(2) + 's');

        requestAnimationFrame(timerLoop);
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