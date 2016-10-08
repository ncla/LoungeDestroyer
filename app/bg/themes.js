var themes = {};
var themeCSS = '';
var themeListOriginal = {
    cleanlounge: {
        url: 'http://127.0.0.1/themes/CleanLounge/data.json',
        remote: true
    }
    , glasstheme: {
        url: 'https://api.ncla.me/themes/GlassLounge/data.json',
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

        // If we don't have any themes or we are missing some
        _this.checkForMissingThemes(function() {
            _this.updateThemes();
        });
    });
};

Themes.prototype.checkForMissingThemes = function(callback) {
    var _this = this;

    if (!Object.keys(themes).length) {
        console.log('THEMES :: Resetting to bundled themes!');

        // add bundled themes
        themes = jQuery.extend(true, {}, themeListOriginal);
    } else {
        _this.addNewBundledThemes();
    }

    _this.syncThemesObject(function() {
        callback();
    });
};

Themes.prototype.addNewBundledThemes = function() {
    console.log('THEMES :: Checking if any missing bundled themes in themes storage');
    for(bundledTheme in themeListOriginal) {
        if (!themes.hasOwnProperty(bundledTheme)) {
            console.log('THEMES :: Theme', bundledTheme, 'missing from themes storage, adding..');
            themes[bundledTheme] = themeListOriginal[bundledTheme];
        }

        if (themes.hasOwnProperty(bundledTheme)) {
            console.log('THEMES :: Theme', bundledTheme, 'not missing from themes storage, updating data.json URL');
            themes[bundledTheme].url = themeListOriginal[bundledTheme].url;
        }
    }
};

Themes.prototype.updateThemes = function(callback) {
    var _this = this;

    console.log('THEMES :: Updating themes!');

    var promisesThemeData = [];
    var promisesThemeCss = [];

    var themesVersionChanged = [];

    $.each(themes, function(themeIndex, theme) {
        if(!themes[themeIndex].hasOwnProperty('url') || !themes[themeIndex].hasOwnProperty('remote') || themes[themeIndex].remote !== true) {
            console.log('THEMES :: ', themeIndex, 'does not have data.json url set / remote property set / remote property is not true');
            return true;
        }

        promisesThemeData.push(
            $.ajax({
                url: theme.url,
                cache: false,
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    try {
                        var json = data;
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

                        if (themes[themeIndex].version == json.version) {
                            console.log('THEMES :: Version for ', themeIndex, ' hasn\'t changed, no need to update');
                            return;
                        }

                        // If the version has changed we need to update CSS in most cases
                        themesVersionChanged.push(themeIndex);

                        // merge new JSON into old, keeping options
                        if (json.options) {
                            for (var k in themes[themeIndex].options) {
                                if (json.options.hasOwnProperty(k)) {
                                    json.options[k].checked = themes[themeIndex].options[k].checked;
                                } else {
                                    delete themes[themeIndex].options[k];
                                }
                            }
                        }

                        // merge obj and json
                        $.extend(true, themes[themeIndex], json);
                    } catch (err) {
                        console.error('THEMES :: [' + themeIndex + '] Failed to update: ', err);
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error('THEMES :: [' + themeIndex + '] Failed to update: ', errorThrown);
                }
            })
        );

    });

    $.when.apply($, promisesThemeData).always(function() {
        console.log('THEMES :: data.json fetching completed');

        console.log('THEMES :: Fetching CSS for all themes');

        $.each(themesVersionChanged, function(theme, themeIndex) {

            if(!themes[themeIndex].hasOwnProperty('css')) {
                console.log('THEMES :: ', themeIndex, 'does not have CSS url set');
                return true;
            }

            promisesThemeCss.push(

                $.ajax({
                    url: themes[themeIndex].css,
                    dataType: 'text',
                    cache: false,
                    success: function(data, textStatus, jqXHR) {
                        // If theme doesn't need to be importantified, in which case we will be disabling Lounge site stylesheets
                        if(themes[themeIndex].hasOwnProperty('disableCss') && themes[themeIndex].disableCss === true) {
                            console.log('THEMES :: ', themeIndex, ' using raw CSS');
                            var css = parsifyCSS(data);
                        }
                        // Otherwise we importantify all CSS rules (due to styling prioritization limitations)
                        else {
                            console.log('THEMES :: ', themeIndex, ' using importantified CSS');
                            var css = importantifyCSS(data);
                        }

                        if (css) {
                            if (themeIndex === LoungeUser.userSettings.currentTheme) {
                                themeCSS = css;
                            }

                            themes[themeIndex].cachedCSS = css;
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error('THEMES :: [' + themeIndex + '] Failed to update: ', errorThrown);
                    }
                })

            );
        });

        $.when.apply($, promisesThemeCss).always(function() {
            console.log('THEMES :: CSS fetching finished');

            _this.syncThemesObject(function() {
                console.log('THEMES :: Saved all the theme data from updating to the local storage');

                if(callback) {
                    callback();
                }
            });
        });

    });

    return this;
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

Themes.prototype.resetAndUpdateThemes = function(callback) {
    var _this = this;
    themes = null;
    _this.syncThemesObject(function() {
        _this.init();
    });
};

var themesBg = new Themes();
themesBg.init();

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Inject CSS file to specific tab
    if (request.hasOwnProperty('injectCSS')) {
        console.log('Injecting CSS (' + request.injectCSS + ') into tab ' + sender.tab.id);
        chrome.tabs.insertCSS(sender.tab.id, {file: request.injectCSS, runAt: 'document_start'}, function(x) {
            console.log(x);
        });
    }

    // Inject CSS code to specific tab
    if (request.hasOwnProperty('injectCSSCode')) {
        console.log('Injected CSS code into tab ' + sender.tab.id);
        chrome.tabs.insertCSS(sender.tab.id, {
            code: importantifyCSS(request.injectCSSCode),
            runAt: 'document_start'
        }, function(x) {
            console.log(x);
        });
    }

    // Inject theme CSS (in bg for speed purposes)
    if (request.hasOwnProperty('injectCSSTheme')) {
        sendResponse((themeCSS.length == 0));

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
        themesBg.resetAndUpdateThemes();
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
        if (themes.hasOwnProperty(name) && themes[name].hasOwnProperty('disableCss') && themes[name].disableCss == true && themeCSS.length > 0) {
            console.log('THEMES :: Disabling sites stylesheet');
            return {cancel: true}
        }
    },
    {
        urls: ['*://csgolounge.com/css/*', '*://dota2lounge.com/css/*', '*://csgolounge.com/assets/css/*'], 
        types: ['stylesheet']
    },
    ['blocking']
);

chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name == 'remoteThemesUpdate') {
        themesBg.updateThemes();
    }
});

/**
 * Function to parse and minify CSS, instead of feeding direct CSS response from the server (security)
 * @param css {string} CSS stylesheet contents
 * @return {string}
 */
function parsifyCSS(css) {
    if (css) {
        try {
            var cssTree = parseCSS(css);

            css = stringifyCSS(cssTree, {compress: true});
        } catch (err) {
            console.error('Tried to parse CSS, failed: ', err);
            return '';
        }
    }

    return css;
}

/**
 * Importantifies a.k.a. appends !important to all style property values
 * @param css {string} CSS stylesheet contents
 * @return {string}
 */
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