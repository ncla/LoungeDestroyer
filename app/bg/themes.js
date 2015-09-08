var themes = {};
var themeCSS = '';
var themeListOriginal = {
    cleanlounge: {
        url: 'http://api.ncla.me/themes/CleanLounge/data.json',
        remote: true
    },
    cleanlounge2: {
        url: 'http://api.ncla.me/themes/CleanLounge/data.json',
        remote: true
    }
};

var Themes = function() {
    return this;
};

Themes.prototype.init = function() {
    console.log('Themes init');

    chrome.storage.local.get('themes', function(result) {
        themes = result.themes || {};
        console.log('t1');
        // If we have a selected theme, add theme CSS to the variable
        if (LoungeUser.userSettings.currentTheme) {
            console.log('t2');
            var name = LoungeUser.userSettings.currentTheme;
            if (themes.hasOwnProperty(name)) {
                console.log('t3');
                themeCSS = themes[name].cachedCSS || '';
            }
        }

        // if we don't have any themes
        if (!Object.keys(themes).length) {
            console.log('Resetting to bundled themes!');

            // add bundled themes
            themes = themeListOriginal;
            chrome.storage.local.set({themes: themes}, function() {
                updateThemes()
            });
        }
    });
};

Themes.prototype.updateThemes = function(callback) {
    console.log('Updating themes!');
    chrome.storage.local.get('themes', function(result) {
        var themes = result.themes;
        for (var theme in themes) {
            if (themes[theme].remote) {
                console.log('Updating theme ' + theme);

                // get JSON
                var url = themes[theme].url + '?cachebreak=' + Date.now();
                if (!url) {
                    continue;
                }

                get(url, (function(theme) {
                    return function() {
                        try {
                            var data = this.responseText;
                            var json = JSON.parse(data);
                            var err = '';
                            required = ['name', 'title', 'author', 'version', 'css', 'bg'];

                            for (var i = 0; i < required.length; ++i) {
                                if (!json[required[i]]) {
                                    if (!err) {
                                        err = 'The following information is missing from the JSON: ';
                                    }

                                    err += required[i] + ' ';
                                }
                            }

                            if (err) {
                                console.error(err);
                                return;
                            }

                            if (themes[theme].version == json.version) {
                                console.log('Version hasn\'t changed, no need to update');
                                return;
                            }

                            console.log('Everything looks good');

                            // merge new JSON into old, keeping options
                            if (json.options) {
                                for (var k in themes[theme].options) {
                                    if (json.options.hasOwnProperty(k)) {
                                        json.options[k].checked = themes[theme].options[k].checked;
                                    } else {
                                        delete themes[theme].options[k];
                                    }
                                }
                            }

                            // merge obj and json
                            $.extend(true, themes[theme], json);
                            chrome.storage.local.set({themes: themes});
                        } catch (err) {
                            console.error('[' + theme + '] Failed to update: ', err);
                        }

                        // cache CSS so we can inject instantly
                        get(themes[theme].css + '?cachebreak=' + Date.now(), function() {
                            if (!this.status) {
                                console.error('[' + theme + '] Failed to retrieve CSS');
                                return;
                            }

                            var css = importantifyCSS(this.responseText);
                            if (css) {
                                if (theme === LoungeUser.userSettings.currentTheme) {
                                    themeCSS = css;
                                }

                                themes[theme].cachedCSS = css;
                                chrome.storage.local.set({themes: themes});
                            }
                        });
                    }
                })(theme));
            }
        }

        if (callback) {
            // fake a delay so users don't get worried, yo
            setTimeout(callback, 750);
        }
    });
};

Themes.prototype.selectTheme = function(themeId) {
    console.log('selecting theme with id' , themeId);
    LoungeUser.saveSetting("currentTheme", themeId);

    if (themes.hasOwnProperty(themeId)) {
        themeCSS = themes[themeId].cachedCSS || '';
    } else {
        themeCSS = '';
    }

    return this;
};

Themes.prototype.saveThemeSetting = function(themeId, settingId, settingValue) {
    themes[themeId].options[settingId].checked = settingValue;
    console.log('Saving theme setting', settingId, 'for theme', themeId, 'value', settingValue);
    this.syncThemesObject(themes);
    return this;
};

Themes.prototype.syncThemesObject = function(themeObj) {
    chrome.storage.local.set({themes: themes});
    return this;
};

var themesBg = new Themes();
themesBg.init();

/**
 * themes.init
 * Run when extension has loaded, check if themes object in storage matches the hardcoded themes list,
 * updating and readying up the themeCSS variable
 *
 * themes.update
 * Update themes from remote
 *
 * themes.selectTheme
 * Select a theme and sets it active
 *
 * themes.injectTheme
 *
 *
 * theme.returnThemesObj
 *
 */

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    // Inject CSS file to specific tab
    if (request.hasOwnProperty('injectCSS')) {
        console.log('Injecting CSS (' + request.injectCSS + ') into tab ' + sender.tab.id);
        chrome.tabs.insertCSS(sender.tab.id, {file: request.injectCSS, runAt: 'document_start'}, function(x) {
            console.log(x)
        });
    }

    // Inject CSS code to specific tab
    if (request.hasOwnProperty('injectCSSCode')) {
        // put !important on *everything* because Chrome is fucking retarded
        console.log('Injected CSS code into tab ' + sender.tab.id);
        chrome.tabs.insertCSS(sender.tab.id, {
            code: importantifyCSS(request.injectCSSCode),
            runAt: 'document_start'
        }, function(x) {
            console.log(x)
        });
    }

    // Inject theme CSS (in bg for speed purposes)
    if (request.hasOwnProperty('injectCSSTheme')) {
        (function loop(id, tries) {
            if (tries > 200) {
                return;
            }

            chrome.tabs.insertCSS(id, {code: themeCSS, runAt: 'document_start'}, function(x) {
                // retry if it's called before tab exists (dah fuck chrome?)
                var e = chrome.runtime.lastError;
                if (e) {
                    console.error('Error while inserting theme CSS: ', e);
                    setTimeout(loop.bind(this, id, tries + 1), 5);
                }
            });
        })(sender.tab.id, 0);
    }

    if (request.hasOwnProperty('updateThemes')) {
        themesBg.updateThemes(sendResponse);
        if (sendResponse) {
            return true;
        }
    }

    if (request.hasOwnProperty('setCurrentTheme')) {
        console.log('setting theme current');
        themesBg.selectTheme(request.setCurrentTheme);
    }

    if(request.hasOwnProperty('changeThemeSetting')) {
        var themeSetting = request.changeThemeSetting;
        if(themeSetting.themeId && themeSetting.settingId) {
            themesBg.saveThemeSetting(themeSetting.themeId, themeSetting.settingId, themeSetting.settingValue);
        }
    }

});

chrome.webRequest.onBeforeRequest.addListener(function(details) {
        if(LoungeUser.userSettings.disableStylesheetLoading === '1') {
            return {cancel: true}
        }
    },
    {
        urls: ['*://csgolounge.com/css/*', '*://dota2lounge.com/css/*'],
        types: ['stylesheet']
    },
    ['blocking']
);

chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name == 'remoteThemesUpdate') {
        //updateThemes();
        themesBg.updateThemes();
    }
});

chrome.runtime.onInstalled.addListener(function(details) {
    //updateThemes();
    console.log(themes);
    themesBg.updateThemes();
});

function updateThemes(callback) {

}

function importantifyCSS(css) {
    if (css) {
        try {
            var cssTree = parseCSS(css);
            var rules = cssTree.stylesheet.rules;

            for (var i = 0; i < rules.length; ++i) {
                var rule = rules[i];
                var decls = rule.declarations;

                if (!decls) {
                    continue;
                }

                for (var l = 0; l < decls.length; ++l) {
                    if (!decls[l].value) {
                        continue;
                    }

                    decls[l].value = decls[l].value.replace('!important', '').trim() + ' !important';
                }
            }

            css = stringifyCSS(cssTree, {compress: true});
        } catch (err) {
            console.error('Tried to parse CSS, failed: ', err);
            return '';
        }
    }

    return css;
}