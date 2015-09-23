var themes = {};
var themeCSS = '';
var themeListOriginal = {
    cleanlounge: {
        url: 'http://api.ncla.me/themes/CleanLounge/data.json',
        remote: true
    }
    , swagtheme: {
        url: 'http://127.0.0.1/themes/Swag/data.json',
        remote: true
    }
};

var Themes = function() {
    return this;
};

Themes.prototype.init = function() {
    var _this = this;
    console.log('THEMES :: INIT');

    chrome.storage.local.get('themes', function(result) {
        themes = result.themes || {};

        // If we have a selected theme, add theme CSS to the variable
        if (LoungeUser.userSettings.currentTheme) {
            var name = LoungeUser.userSettings.currentTheme;
            if (themes.hasOwnProperty(name)) {
                console.log('THEMES :: User selected theme exists in storage, setting themeCSS');
                themeCSS = themes[name].cachedCSS || '';
            }
        }

        // If we don't have any themes
        if (!Object.keys(themes).length) {
            console.log('THEMES :: Resetting to bundled themes!');

            // add bundled themes
            themes = themeListOriginal;
            _this.syncThemesObject(function() {
                console.log('THEMES :: Reset theme list in storage to the orinal bundled themes list');
            });
        } else {
            _this.addNewBundledThemes();
        }
    });
};

Themes.prototype.addNewBundledThemes = function() {
    console.log('THEMES :: Checking if any missing bundled themes in themes storage');
    console.log(themes);
    for(bundledTheme in themeListOriginal) {
        if(!themes.hasOwnProperty(bundledTheme)) {
            console.log('THEMES :: Theme', bundledTheme, 'missing from themes storage, adding..');
            themes[bundledTheme] = themeListOriginal[bundledTheme];
        }
    }

    this.syncThemesObject();
    console.log(themes);
};

Themes.prototype.updateThemes = function(callback) {
    var _this = this;

    console.log('THEMES :: Updating themes!');

     for (var theme in themes) {
        if (themes[theme].remote) {
            console.log('THEMES :: Fetching data.json for theme ' + theme);

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
                                    err = 'THEMES :: The following information is missing from the JSON: ';
                                }

                                err += required[i] + ' ';
                            }
                        }

                        if (err) {
                            console.error(err);
                            return;
                        }

                        if (themes[theme].version == json.version) {
                            console.log('THEMES :: Version for ', theme, ' hasn\'t changed, no need to update');
                            return;
                        }

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
                        console.error('THEMES :: [' + theme + '] Failed to update: ', err);
                    }

                    console.log('THEMES :: ', theme, 'fetching CSS');

                    // cache CSS so we can inject instantly
                    get(themes[theme].css + '?cachebreak=' + Date.now(), function() {
                        if (!this.status) {
                            console.error('THEMES :: [' + theme + '] Failed to retrieve CSS');
                            return;
                        }

                        // If theme doesn't need to be importantified, in which case we will be disabling Lounge site stylesheets
                        if(themes[theme].hasOwnProperty('disableCss') && themes[theme].disableCss === true) {
                            console.log('THEMES :: ', theme, ' using raw CSS');
                            var css = this.responseText;
                        }
                        // Otherwise we importantify all CSS rules (due to styling prioritization limitations)
                        else {
                            console.log('THEMES :: ', theme, ' using importantified CSS');
                            var css = importantifyCSS(this.responseText);
                        }

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
};

Themes.prototype.selectTheme = function(themeId) {
    console.log('THEMES :: Selecting user theme with id' , themeId);
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
    this.syncThemesObject();
    return this;
};

Themes.prototype.syncThemesObject = function(callback) {
    chrome.storage.local.set({themes: themes}, function() {
        if (callback) {
            callback();
        }
    });

    return this;
};

var themesBg = new Themes();
themesBg.init();

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

    if (request.hasOwnProperty('hardRefresh')) {
        chrome.tabs.reload(sender.tab.id, {bypassCache: true}, function() {
            console.log('THEMES :: Hard refreshed tab ' + sender.tab.id);
        });
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

// Does not fire for on disk cached requests :(
chrome.webRequest.onBeforeRequest.addListener(function(details) {
        console.log('Stylesheet blocker', details);
        var name = LoungeUser.userSettings.currentTheme;
        if (themes.hasOwnProperty(name) && themes[name].hasOwnProperty('disableCss') && themes[name].disableCss == true) {
            console.log('THEMES :: Disabling sites stylesheet');
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
        themesBg.updateThemes();
    }
});

chrome.runtime.onInstalled.addListener(function(details) {
    themesBg.updateThemes();
});

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