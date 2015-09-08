// JavaScript only related to tying settings with DOM

var defaultUser = new User();
var Settings = defaultUser.defaultSettings;

var optionsSelectize = {
    closeAfterSelect: false,
    readOnly: true,
    onDelete: function () {
        return false
    }
};

var themesSelect = $('#themes').selectize(optionsSelectize);
var themesSelectSelectize = themesSelect[0].selectize;

function restore_options() {
    var manifesto = chrome.runtime.getManifest();
    document.getElementById("version").innerHTML = manifesto.version;

    $.each(currencyData, function(i, v) {
        $("#marketCurrency").append('<option value="' + i + '">' + v["naming"] + '</option>');
    });

    $.each(moment.tz.names(), function(i, v) {
        $("#timezone").append('<option value="' + v + '">' + v + '</option>');
    });

    chrome.storage.local.get(["userSettings", "themes"], function(result) {
        var storageSettings = JSON.parse(result.userSettings);

        $.each(storageSettings, function(index, value) {
            Settings[index] = value;
        });

        $.each(Settings, function(index, value) {
            if (value) {
                $("#" + index).val(value);
            }
        });

        // display the keywords list
        $("#showTradesFilter, #hideTradesFilter, #hideTradesItemsHave, #hideTradesItemsWant").each(function(){
            parseAndDisplayKeywords.apply(this);
        });

        // populate group <select> for inventory statistics
        $.each(Settings.itemGroups, function(gameId, groups){
            var optgroup = document.querySelector("optgroup[group='"+gameId+"']");
            if (optgroup) {
                // first generate for ungrouped, to make sure it's at the top
                optgroup.appendChild(generateOpt("default", "Ungrouped"));

                $.each(groups, function(groupName, group){
                    optgroup.appendChild(generateOpt(groupName, group.title));
                });
            }

            // temporary function for less DRYness
            function generateOpt(groupName, groupTitle) {
                var opt = document.createElement("option");
                opt.value = groupName;
                opt.textContent = groupTitle;
                if (Settings.inventoryStatisticsGroup[gameId].indexOf(groupName)!==-1) {
                    opt.setAttribute("selected", "true");
                }
                return opt;
            }
        });

        // set 'selected' on Disabled/Enabled for inventory statistics
        if (Settings.inventoryStatisticsGroup["570"].indexOf("0")!==-1){
            document.querySelector("#inventoryStatisticsGroup option[value='0']")
                .setAttribute("selected", "true");
        }
        if (Settings.inventoryStatisticsGroup["570"].indexOf("1")!==-1){
            document.querySelector("#inventoryStatisticsGroup option[value='1']")
                .setAttribute("selected", "true");
        }

        // Load themes
        if (result.hasOwnProperty("themes")) {
            themes = result.themes;
        }

        for (var theme in result.themes) {
            console.log("Creating theme " + theme);
            theme_create_element(theme, themes[theme], false);
        }

        // We no longer initialize here because we need the slider to be visible to do some calculations because we bad
        // initSlider();

        // Enable selectize
        // TODO: Readd .ld-settings class to inputs/selects so we dont have to manually whitelist here elements dont need Selectize
        $('select:not(#inventoryStatisticsGroup, #themes)').selectize(optionsSelectize);
    });
    $("#refetchmarketcrap").click(function() {
        var that = this;
        that.disabled = true;
        chrome.runtime.sendMessage({refetchMarketPriceList: true},
            function(){
                that.disabled = false;
            });
    });
    $("#refetchcurrencies").click(function() {
        var that = this;
        that.disabled = true;
        chrome.runtime.sendMessage({refetchCurrencyConversionRates: true},
            function(){
                that.disabled = false;
            });
    });
    $("#updatethemes").click(function() {
        var that = this;
        that.disabled = true;
        chrome.runtime.sendMessage({updateThemes: true},
            function(){
                that.disabled = false;
            });
    });
    $("#restoreDefaults").click(function() {
        defaultUser.restoreDefaults();
        document.location.reload();
    });
    $("#refetchcsglvalues").click(function() {
        var that = this;
        that.disabled = true;
        chrome.runtime.sendMessage({refetchCsglValues: true},
            function(){
                that.disabled = false;
            });
    });
    $("#offer-audio-play-btn").click(function(){
        var url = $('#customTradeOfferSound').val(),
            a = new Audio(url);
        a.play();
    });
    $("#showTradesFilter, #hideTradesFilter, #hideTradesItemsHave, #hideTradesItemsWant").on("change", function(){
        var outp = parseAndDisplayKeywords.apply(this);

        defaultUser.saveSetting(this.id + "Array", outp);
    });

    //// handles extracting and displaying keywords. Should be used as event handler for input
    function parseAndDisplayKeywords() {
        var quoteRegexp = /(["'])((?:\\?.)*?)\1/g,
            input = this.value,
            keywords = [],
            container = $(this).parent().find(".keywordsContainer");

        // get all text within quotes
        input = input.replace(quoteRegexp, function(m1,m2,m3){
            if (m3.length && keywords.indexOf(m3) === -1) {
                keywords.push(m3.trim()); // push the content (sans quotes) to keywords
            }
            return ""; // remove from string
        });
        // get all words (separated by whitespace)
        input.replace(/[^\s]+/g, function(m1){
            if (m1.length && keywords.indexOf(m1) === -1) {
                keywords.push(m1.trim()); // push word to keywords
            }
            return "";
        });

        // display keywords to user
        container.empty();
        for (var i = 0; i < keywords.length; ++i) {
            container.append($("<span class='keyword' />").text(keywords[i]));
        }

        return keywords;
    }
}

document.addEventListener('DOMContentLoaded', restore_options);

$("select, input").on('change', function() {
    // make sure number inputs are limited to their min/max settings
    if (this.type === "number" && (this.hasOwnProperty("min") || this.hasOwnProperty("max"))) {
        var min = this.min!==undefined ? this.min : Infinity,
            max = this.max!==undefined ? this.max : -Infinity;

        this.value = Math.min(Math.max(this.value, min), max);
    }

    // handles <select multiple>'s.
    // Also adds support for the "solo" keyword, making an option selectable only by itself
    // resulting setting is in format:
    //   {optgroup-1: [val-1, ...], optgroup-2: [val-2, ...]}
    if (this.type === "select-multiple") {
        var opts = this.selectedOptions,
            groupElms = this.querySelectorAll("optgroup"),
            groups = [],
            outp = {};

        // turn groups into an array of names
        for (var i = 0, j = groupElms.length; i < j; ++i) {
            groups[i] = groupElms[i].getAttribute("group");
            outp[groups[i]] = [];
        }

        for (var i = 0, j = opts.length; i < j; ++i) {
            var val = opts[i].value,
                solo = opts[i].hasAttribute("solo"),
                inGroup = opts[i].parentNode.tagName === "OPTGROUP",
                group = opts[i].parentNode.getAttribute("group");

            // if a "solo" option is selected, save that alone and exit
            if (solo) {
                this.value = val;
                outp = {};
                for (var i = 0; i < groups.length; ++i) {
                    outp[groups[i]] = [val];
                }
                break;
            }

            // otherwise, add option to its group (or all groups, if it doesn't have one)
            if (inGroup) {
                outp[group].push(val);
            } else {
                for (var k = 0; k < groups.length; ++k) {
                    outp[groups[k]].push(val);
                }
            }
        }

        defaultUser.saveSetting(this.id, outp);
        return;
    }

    // make sure URL inputs are actually valid URLs
    if (this.type === "url") {
        var urlRegxp = /^(http(?:s)?\:\/\/[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,6}(?:\/?|(?:\/[\w\-]+)*)(?:\/?|\/\w+\.[a-zA-Z]{2,4}(?:\?[\w]+\=[\w\-]+)?)?(?:\&[\w]+\=[\w\-]+)*(?:\.([a-zA-Z0-9]+))?)$/,
            url = this.value,
            parent = this.parentNode,
            btn = parent.querySelector(".input-group-btn button");

        // just save if URL is empty
        if (url) {
            // reset previous data
            clearTimeout(this.stateTimer);
            parent.classList.remove("has-success", "has-error");
            if (btn) { btn.removeAttribute("disabled"); }

            // if the URL seems valid
            if (urlRegxp.test(url)) {
                // display success, remove after 2.5 seconds
                var that = this;
                parent.classList.add("has-success");

                this.stateTimer = setTimeout(function(){
                    parent.classList.remove("has-success");
                }, 2500);
            } else {
                parent.classList.add("has-error");
                if (btn) { btn.setAttribute("disabled", "disabled"); }
                return;
            }
        }
    }

    // save setting
    defaultUser.saveSetting(this.id, this.value);
});

// THEMES
var themes = {},
    themeDirectory;

/**
* Creates the .item element that goes into the carousel for a theme
* And appends this element to the carousel
* @param string name - name of theme
* @param Object obj - theme object
* @param Boolean active - whether the slide should be active
*/
function theme_create_element(name, obj, active) {
    console.log("Creating theme element for ",name);
    console.log(obj);

    var item = $('#theme-blank').clone(true);

    // avoid HTML injection
    obj = escape_obj(obj);

    // Removing unnecessary stuff
    if (!(obj.options || obj.custom)) {
        $(item).find('.theme-settings').remove();
        $(item).find('button.btn[data-theme-settings]').remove();
    }

    // Setting theme name to data-theme attribute
    $(item).attr('data-theme', name);
    $(item).removeAttr('id');

    // AUTHOR, VERSION, DESCRIPTION, NAME
    $(item).find('.theme-info .theme-author').text(obj.author);
    $(item).find('.theme-info .theme-version').text(obj.version);
    $(item).find('theme-desc').text(obj.description);
    $(item).find('.theme-info .theme-name').text(obj.title);
    $(item).find('.theme-desc').text(obj.description);

    // BACKGROUND IMAGE, ICON
    var fallbackImgUrl = 'http://i.imgur.com/qeqFgkG.jpg';

    var themeIcon = obj.icon || fallbackImgUrl;
    var themePreview = obj.bg || fallbackImgUrl;

    $(item).find('.theme-preview img').attr('src', themePreview);

    $(item).find('.theme-info .icon.left').attr('src', themeIcon);

    // Add settings related shit
    if (obj.options || obj.custom) {

        console.log('Have options/custom shit');
        // Looping through all theme settings and appending them
        if (obj.options) {
            console.log('Theme has theme settings');
            for (var k in obj.options) {
                var optionTemplate = $(item).find('.theme-settings.bundled .label-group.blank-template').clone();

                $(optionTemplate).removeClass('blank-template');

                $(optionTemplate).find('label').attr('for', (name + '-' + k));

                if(obj.options[k].checked) {
                    $(optionTemplate).find('input[type=checkbox]').prop('checked', true);
                }

                $(optionTemplate).find('input[type=checkbox]').attr('id', (name + '-' + k)).attr('data-theme', name).attr('data-option', k);
                $(optionTemplate).find('label').text(obj.options[k].description);

                $(item).find('.theme-settings .content').append(optionTemplate);
            }

            $(item).find('.theme-settings.bundled .label-group.blank-template').remove();
            $(item).find('.theme-settings.theme-edit').remove();

        } else {
            console.log('theme does not have settings');
            $(item).find('.theme-settings.bundled').remove();
        }

        // On setting changes

        $(item).find('.theme-settings input').on('change', function() {
            var theme = this.getAttribute('data-theme');
            var option = this.getAttribute('data-option');
            console.log(theme, option, this.checked);
            if (!theme || !option) {
                return;
            }

            chrome.runtime.sendMessage({changeThemeSetting: {
                themeId: theme,
                settingId: option,
                settingValue: this.checked
            }});
        });

    }

    $('.col-grid-3.theme-select').after(item);

    // Add theme to dropdown

    themesSelectSelectize.addOption({value: name, text: obj.title, silent: true});

    // Select current active theme
    if (name === Settings.currentTheme) {
        console.log('Theme', name, 'is active');
        $('#themes-slider li.current').removeClass('current');

        $(item).addClass('active');
        themesSelect[0].selectize.setValue(name, true);
    }

    // On click, select theme
    $(item).find('.btn.enable-this-theme').click(function() {
        select_theme(name);
    });

    $(item).find('.btn.enabled').click(function() {
        select_theme(' ');
    });
}

/**
* Set a specific theme to currently selected
* @param String name - name of theme, falsy if selecting none
*/
function select_theme(name) {
    console.log('Selecting theme', name);

    show_theme(name);
    chrome.runtime.sendMessage({setCurrentTheme: name});
}

function show_theme(name) {
    console.log('show_theme', name);

    if($('#themes-slider li[data-theme="' + name + '"]').length) {
        // Remove currently active class from theme in the slider

        $('#themes-slider li[data-theme]').removeClass('current').removeClass('active');

        // Add current class to selected theme

        $('#themes-slider li[data-theme="' + name + '"]').addClass('current').addClass('active');
    } else {
        $('#themes-slider li[data-theme]').removeClass('active');
    }

    // Can't select with $("#themes").val() >_<
    console.log(themesSelect);
    themesSelect[0].selectize.setValue(name, true);
}

themesSelectSelectize.on('change', function(value) {
    console.log('Dropdown selected', value);
    select_theme(value);
});

/**
* Native code can't be passed as callbacks
* This proxies console.error
*/
function error_proxy(err) {
    console.error(err);
}

/**
* Escapes all string properties in an object
* Deeply (mhmm)
* @param Object obj - object to escape
*/
function escape_obj(obj) {
    for (var k in obj) {
        if (!obj.hasOwnProperty(k)) {
            continue;
        }
        if(["cachedCSS"].indexOf(k) !== -1) {
            continue;
        }

        var val = obj[k];
        if (typeof val === "string") {
            obj[k] = val.replace(/[<>"']/g, function(s){
                return ({
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[s];
            });
        } else if (val instanceof Object) {
            obj[k] = escape_obj(val);
        } else {
            continue;
        }
    }

    return obj;
}