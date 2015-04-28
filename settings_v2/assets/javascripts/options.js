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

//themesSelectSelectize.addOption({value: "", text: "Disabled"});

function restore_options() {
    var manifesto = chrome.runtime.getManifest();
    //document.getElementById("version").innerHTML = manifesto.version;

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
        $("#hideTradesFilter, #markTradesFilter").each(function(){
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
            theme_data_handler.call({
                result: "{}",
                obj: themes[theme],
                themeName: theme
            });
        }

        // Initialize slider cuz it does some epic fancy calculations based on the content
        initSlider();

        // Enable selectize
        // TODO: Readd .ld-settings class to inputs/selects so we dont have to manually whitelist here elements dont need Selectize
        $('select:not(#inventoryStatisticsGroup, #themes)').selectize(optionsSelectize);

        // populate themes
        // FIXME: Is this firing after themes have been appended (which happens in another chrome.storage.get)?
        //var curTheme = document.querySelector(".item[data-theme-name='"+Settings.currentTheme+"']");
        //if (curTheme) {
        //    var act;
        //    if (act = document.querySelector("#themes-carousel .item.active")) {
        //        act.classList.remove("active");
        //    }
        //    if (act = document.querySelector("#themes-carousel .item.current")) {
        //        act.classList.remove("current");
        //    }
        //
        //    curTheme.classList.add("current", "active");
        //    console.log("Found curTheme! Setting to ",Settings.currentTheme);
        //    document.querySelector(".cur-theme").value = Settings.currentTheme || "-none";
        //}
        //
        //if (document.querySelectorAll("#themes-carousel .carousel-inner > div").length < 2) {
        //    $("#themes-carousel .carousel-control").hide();
        //}
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

    $("#offer-audio-play-btn").click(function(){
        var url = this.parentNode.parentNode.querySelector("input[type='url']").value,
            a = new Audio(url);
        a.play();
    });
    $("#hideTradesFilter, #markTradesFilter").on("change", function(){
        var outp = parseAndDisplayKeywords.apply(this);

        defaultUser.saveSetting(this.id+"Array", outp);
    });

    //// handles extracting and displaying keywords. Should be used as event handler for input
    function parseAndDisplayKeywords() {
        var quoteRegexp = /(["'])((?:\\?.)*?)\1/g,
            input = this.value,
            keywords = [],
            container = $(this).siblings("p").children(".keywordsContainer");

        // get all text within quotes
        input = input.replace(quoteRegexp, function(m1,m2,m3){
            if (m3.length && keywords.indexOf(m3) === -1) {
                keywords.push(m3.trim().toLowerCase()); // push the content (sans quotes) to keywords
            }
            return ""; // remove from string
        });
        // get all words (separated by whitespace)
        input.replace(/[^\s]+/g, function(m1){
            if (m1.length && keywords.indexOf(m1) === -1) {
                keywords.push(m1.trim().toLowerCase()); // push word to keywords
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
* Called when data.json has been loaded for a theme
* Must be called with this.result, this.obj and this.themeName set
* this.result - plaintext JSON
* this.obj - stored parsed JSON, or empty object
* this.themeName - shortname of theme
* Merges .obj and parsed JSON of data, and saves to window.themes
*/
function theme_data_handler(){
    var data = this.result,
        json = JSON.parse(data),
        obj = this.obj,
        name = this.themeName;

    if (!json.bg) {
        json.bg = obj.bg;
    }
    if (!json.icon) {
        json.icon = obj.icon;
    }

    // overwrite settings with saved settings
    if (json.options) {
        for (var k in obj.options) {
            if (json.options.hasOwnProperty(k)) {
                json.options[k].checked = obj.options[k].checked;
            } else {
                delete obj.options[k];
            }
        }
    }

    // if JSON isn't empty, remove any key not found in JSON
    if (Object.keys(json).length > 2) {
        console.log("Removing keys from ",obj, " based on ",json);
        for (var k in obj) {
            if (!json.hasOwnProperty(k)) {
                delete obj[k];
            }
        }
    }

    // merge obj and json
    $.extend(true, obj, json);

    if (!obj.title || !obj.bg || !obj.description || !obj.version) {
        console.error("["+name+"] Invalid data.json - missing title, background, description or version");
        return;
    }

    themes[name] = obj;
    chrome.storage.local.set({themes: themes});
    theme_create_element(name, obj);
}

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


    //var item = document.createElement("div"),
    //    a = document.createElement("div");
    //
    //a.className = "theme-container";
    //item.className = "item "+(!document.querySelectorAll("#themes-carousel .item.active").length ? "active" : "");
    //item.setAttribute("data-theme-name", name);
    //
    //if (active) {
    //    var act;
    //    if (act = document.querySelector("#themes-carousel .item.active")) {
    //        act.classList.remove("active");
    //    }
    //    item.classList.add("active");
    //}
    var item = $('#theme-blank').clone(true);

    // avoid HTML injection
    obj = escape_obj(obj);

    // create the options button
    if (obj.options || obj.custom) {
        if (!(obj.options || obj.custom)) {
            $(item).find('.theme-settings').remove();
            $(item).find('button.btn[data-theme-settings]').remove();
        }

        //$(".options-toggle",item).click(function(){
        //    a.classList.toggle("blurred");
        //});
    }

    // Setting theme name to data-theme attribute
    $(item).attr('data-theme', name);
    $(item).removeAttr('id');

    // Temporary
    //$(item).addClass('current');
    //$(item).removeClass('hidden');


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


    // dirty dirty
    //a.innerHTML = "<div class='highlight'></div>"+
    //"<div class='carousel-caption'>"+
    //"<h2>"+obj.title+"</h2><h4 class='author'>by "+obj.author+" (v "+obj.version+")</h4><p style='font-size: 18px'>"+obj.description+"</p>"+
    //"</div>";
    //
    //var bgImg = document.createElement("img");
    //bgImg.src = obj.bg;
    //bgImg.onerror = function(){
    //    bgImg.src = "./bg_placeholder.png";
    //}
    //a.insertBefore(bgImg, a.firstChild);
    //
    //if (obj.icon) {
    //    var iconImg = document.createElement("img");
    //    iconImg.className = "icon";
    //    iconImg.src = obj.icon;
    //    iconImg.onerror = function(){
    //        iconImg.style.display = "none";
    //    };
    //
    //    var caption = a.querySelector(".carousel-caption");
    //    if (caption) {
    //        caption.insertBefore(iconImg, caption.firstChild);
    //    }
    //}

    // Add settings related shit
    if (obj.options || obj.custom) {

        // Looping through all theme settings and appending them
        if (obj.options) {
            for (var k in obj.options) {
                //optionsHTML += "<div class=\"label-group\">";
                //optionsHTML += "<label for='"+name+"-"+k+"'>";
                //optionsHTML += "<input "+(obj.options[k].checked ? "checked ":"")+"type='checkbox' id='"+name+"-"+k+"' data-theme='"+name+"' data-option='"+k+"'>";
                //optionsHTML += obj.options[k].description+"</label>";
                //optionsHTML += "</div>";
                console.log('test', obj.options[k]);

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
            $(item).find('.theme-settings.bundled').remove();
        }

        // Hide delete theme / edit CSS buttons for bundled themes

        if(!obj.custom) {
            $(item).find('.theme-settings .edit-theme-btn, .theme-settings .delete-theme-btn').hide();
        }

        // On setting changes

        $(item).find('.theme-settings input').on('change', function() {
            var theme = this.getAttribute('data-theme');
            var option = this.getAttribute('data-option');
            console.log(theme, option, this.checked);
            if (!theme || !option) {
                return;
            }

            themes[theme].options[option].checked = this.checked;
            chrome.storage.local.set({themes: themes});
        });

        // On theme remove button press



        // On theme edit css button press

        //var tmpElm = document.createElement("div");
        //tmpElm.className = "theme-option";
        //tmpElm.innerHTML = optionsHTML;
        //item.appendChild(tmpElm);
        //
        //if (obj.custom) {
        //    tmpElm.innerHTML += "<div class='theme-btns-container'>"+
        //    "<button class='btn btn-danger theme-remove' data-toggle='modal' data-target='.theme-modal-confirm-delete'>Delete theme</button>" +
        //    ((!obj.remote) ? "<button class='btn btn-primary theme-edit-css' data-toggle='modal' data-target='.theme-modal-edit-css'>Edit theme CSS</button>" : "") +
        //    "</div>";
        //}
        //
        //// on option change, save
        //$(tmpElm).find("input").on("change", function(){
        //    var theme = this.getAttribute("data-theme"),
        //        option = this.getAttribute("data-option");
        //
        //    if (!theme || !option) {
        //        return;
        //    }
        //
        //    themes[theme].options[option].checked = this.checked;
        //    chrome.storage.local.set({themes: themes});
        //});
        //$(tmpElm).find(".theme-remove").on("click", function(){
        //    document.querySelector(".theme-modal-confirm-delete .confirm").setAttribute("data-theme", name);
        //});
        //$(tmpElm).find(".theme-edit-css").on("click", function(){
        //    document.querySelector(".theme-modal-edit-css .theme-css-owner").textContent = themes[name].title;
        //    document.querySelector(".theme-modal-edit-css .theme-css-textarea").value = themes[name].cachedCSS || "";
        //    document.querySelector(".theme-modal-edit-css .confirm").setAttribute("data-theme", name);
        //});
    }

    $('.col-grid-3.theme-select').after(item);

    // Add theme to dropdown

    themesSelectSelectize.addOption({value: name, text: obj.title, silent: true});
    //themesSelectSelectize.addItem(name, true);
    //themesSelectSelectize.refreshOptions(false);
    //throw Error('swag');

    //$('#themes').append($("<option></option>")
    //    .attr("value", name)
    //    .text(obj.title));

    // Select current active theme, show buttons for enabling/disabling theme

    if (name === Settings.currentTheme) {
        //var act = document.querySelector("#themes-slider li.current");
        //if (act) {
        //    act.classList.remove("current");
        //}
        $('#themes-slider li.current').removeClass('current');

        //$(item).find('.btn.enabled').parent().removeClass('hidden');
        //$(item).find('.btn.enable-this-theme').parent().addClass('hidden');

        $(item).addClass('active');

        show_theme(name);
    } else {
        //$(item).find('.btn.enabled').parent().addClass('hidden');
        //$(item).find('.btn.enable-this-theme').parent().removeClass('hidden');
    }

    // On click, select theme
    $(item).find('.btn.enable-this-theme').click(function() {
        select_theme(name);
    });

    $(item).find('.btn.enabled').click(function() {
        select_theme(' ');
    });

    //var dropdownOption = document.createElement("option");
    //dropdownOption.setAttribute("value", name);
    //dropdownOption.textContent = obj.title;
    //document.querySelector(".cur-theme").appendChild(dropdownOption);

    //if (name === Settings.currentTheme) {
    //    var act = document.querySelector("#themes-carousel .item.active");
    //    if (act) {
    //        act.classList.remove("active");
    //    }
    //
    //    item.classList.add("active");
    //
    //    select_theme(name);
    //}
    //
    //if (document.querySelectorAll("#themes-carousel .carousel-inner > div").length > 1) {
    //    $("#themes-carousel .carousel-control").show();
    //}
}

/**
* Creates/saves a custom theme, based on given data
* @param String name - folder/theme name
* @param Object json - JSON to get data from, only containing description, author and version if local
* @param String css - css to be injected on page load/URL to load from if remote
* @param String bg - URL of the background image
* @param String remoteUrl - if set, theme is considered remote (css is URL)
* @param Function callback - callback to call with true or error string
* @param Boolean active - whether slide should be active
*/
function create_theme(name, json, css, bg, callback, remoteUrl, icon, active) {
    if (!callback) {
        callback = error_proxy;
    }

    if (!name || !json || !css || (!bg && !json.bg)) {
        console.error("Necesarry information not provided for create_theme on ",name);
        callback("Necesarry information not provided.");
        return;
    }

    var theme = {};
    theme.custom = true;
    theme.title = json.title || "Custom theme";
    theme.author = json.author || "Unknown";
    theme.version = json.version || "0.0.1";
    theme.description = json.description || "Custom theme";
    if (json.options) {
        theme.options = json.options;
    }
    theme.bg = bg || json.bg;

    if (remoteUrl) {
        theme.remote = true;
        theme.url = remoteUrl;

        console.log("URL:",theme.url);

        $.ajax({
            type: "GET",
            url: css+"?cachebreak="+Date.now(),
            success: function(data, status) {
                var css = data;
                chrome.runtime.getBackgroundPage(function(bg){
                    var newCSS = bg.importantifyCSS(css);
                    if (newCSS) {
                        theme.cachedCSS = newCSS;
                        themes[name] = theme;
                        theme_create_element(name, theme, active);
                        chrome.storage.local.set({themes: themes}, function(x){
                            callback(true);
                        });
                    } else {
                        alert("Failed to parse theme CSS!");
                        console.error("Failed to parse CSS: ",{received: css, minimized: newCSS});
                        return;
                    }
                });
            },
            error: function(xhr, status, err) {
                alert("Failed to load theme CSS!\r\nError:\r\n"+err);
            }
        });
    } else {
        chrome.runtime.getBackgroundPage(function(bg){
            console.log("Added local theme ",name," : ",theme);
            var newCSS = bg.importantifyCSS(css);
            if (newCSS) {
                theme.cachedCSS = newCSS;
                themes[name] = theme;
                theme_create_element(name, theme, active);
                chrome.storage.local.set({themes: themes}, function(){
                    callback(true);
                });
            } else {
                alert("Failed to parse theme CSS!");
                console.error("Failed to parse CSS: ",{received: css, minimized: newCSS});
            }
        });
    }
}


/**
* Set a specific theme to currently selected
* @param String name - name of theme, falsy if selecting none
*/
function select_theme(name) {
    console.log('Selecting theme', name);
    defaultUser.saveSetting("currentTheme", name);

    show_theme(name);

    // FIXME: Dry code, repeats from create_theme_element
    $('#themes-slider li[data-theme]').each(function() {
        if($(this).attr('data-theme') == name) {
            console.log('This is the theme we need');
            $(this).find('.btn.enabled').parent().removeClass('hidden');
            $(this).find('.btn.enable-this-theme').parent().addClass('hidden');
        } else {
            console.log('This is the theme we dont need');
            $(this).find('.btn.enabled').parent().addClass('hidden');
            $(this).find('.btn.enable-this-theme').parent().removeClass('hidden');
        }
    });

    //var current = document.querySelector("#themes-carousel .item.current"),
    //    active = document.querySelector("#themes-carousel .item.active"),
    //    ownElm = document.querySelector("#themes-carousel .item[data-theme-name='"+name+"']");
    //
    //if (current) {
    //    current.classList.remove("current");
    //}
    //
    //if (name && ownElm) {
    //    if (active) {
    //        active.classList.remove("active");
    //    }
    //
    //    ownElm.classList.add("current");
    //    ownElm.classList.add("active");
    //}
    //
    //document.querySelector(".cur-theme").value = name || "-none";
    //
    chrome.runtime.sendMessage({setCurrentTheme: true});
}

function show_theme(name) {
    console.log('show_theme', name);

    if($('#themes-slider li[data-theme="' + name + '"]').length) {
        // Remove currently active class from theme in the slider

        $('#themes-slider li.current').removeClass('current');

        // Add current class to selected theme

        $('#themes-slider li[data-theme="' + name + '"]').addClass('current');
    } else {
        // Else just show the first slide..
        console.log('Themes disabled...');
        ('#themes-slider li[data-theme]').addClass('hidden');
        $('#themes-slider li[data-theme]:eq(0)').addClass('current').removeClass('hidden');
    }

    //var current = document.querySelector("#themes-carousel .item.current"),
    //    active = document.querySelector("#themes-carousel .item.active"),
    //    ownElm = document.querySelector("#themes-carousel .item[data-theme-name='"+name+"']");
    //
    //if (current) {
    //    current.classList.remove("current");
    //}
    //
    //if (name && ownElm) {
    //    if (active) {
    //        active.classList.remove("active");
    //    }
    //
    //    ownElm.classList.add("current");
    //    ownElm.classList.add("active");
    //}

    // Can't select with $("#themes").val() >_<
    console.log(themesSelect);
    themesSelect[0].selectize.setValue(name, true);

    //document.querySelector(".cur-theme").value = name || "-none";

}

themesSelectSelectize.on('change', function(value) {
    console.log('Dropdown selected', value);
    select_theme(value);
});

//document.querySelector("#themes").addEventListener("change", function(){
//    console.log('Dropdown selected', this.value);
//    var val = this.value;
//    select_theme(val);
//});

//
//
//
///**
// * USER INPUT
// */
//
///**
// * Hook remote add theme button
// */
//document.querySelector("#add-theme-remote button[type='submit']").addEventListener("click", function(ev){
//    ev.preventDefault();
//
//    var url = document.getElementById("add-theme-url").value;
//    if (!url) {
//        alert("Missing the following information: url");
//        return;
//    }
//
//    get(url, function(){
//        if (this.status === 0) {
//            alert("Failed to connect to the URL - please make sure it's spelled correctly");
//            return;
//        }
//
//        try {
//            var data = this.responseText,
//                json = JSON.parse(data),
//                err = "";
//            required = ["name", "title", "css", "bg"]
//
//            for (var i = 0; i < required.length; ++i) {
//                if (!json[required[i]]) {
//                    if (!err)
//                        err = "The following information is missing from the JSON: ";
//
//                    err += required[i] + " ";
//                }
//            }
//
//            if (err) {
//                alert(err);
//                return;
//            }
//        } catch (err) {
//            alert("JSON could not be parsed. Please make sure you're using the correct URL");
//            return;
//        }
//
//        if (themes.hasOwnProperty(json.name)) {
//            alert("A theme with that name is already installed\r\nPlease uninstall "+themes[json.name].title+" before re-attempting.");
//            return;
//        }
//
//        create_theme(json.name, json, json.css, json.bg, function(val){
//            if (val !== true)
//                error_proxy.apply({}, arguments);
//            else {
//                select_theme(json.name);
//                chrome.runtime.sendMessage({updateThemes: true});
//            }
//        }, url, json.icon, true);
//    });
//});
//
///**
// * Hook local add theme button
// */
//document.querySelector("#add-theme-local button[type='submit']").addEventListener("click", function(ev){
//    ev.preventDefault();
//
//    var form = document.getElementById("add-theme-local"),
//        title = document.getElementById("add-theme-title").value,
//        description = document.getElementById("add-theme-description").value,
//        bg = document.getElementById("add-theme-bg").value,
//        author = document.getElementById("add-theme-author").value,
//        version = document.getElementById("add-theme-version").value,
//        css = document.getElementById("add-theme-css").value,
//        name = "custom_",
//        err = "",
//        vals = [title, bg, author, version, css],
//        names = ["title", "background", "author", "version", "css"];
//
//    for (var i = 0; i < vals.length; ++i) {
//        if (!vals[i]) {
//            if (!err) {
//                err = "We're missing the following information: ";
//            }
//
//            err += names[i] + " ";
//        }
//    }
//    if (err) {
//        alert(err);
//        return;
//    }
//
//    var i = 0;
//    while (themes.hasOwnProperty(name+i)) { ++i }
//    name += i;
//
//    create_theme(name, {
//        title: title,
//        description: description,
//        version: version,
//        author: author
//    }, css, bg, function(val){
//        if (val !== true) {
//            error_proxy.apply({}, arguments);
//        } else {
//            select_theme(name);
//        }
//    }, false, undefined, true);
//});
//
///**
// * Hook theme delete confirm button
// */
//document.querySelector(".theme-modal-confirm-delete .confirm").addEventListener("click", function(){
//    var theme = this.getAttribute("data-theme");
//    if (!theme || !themes.hasOwnProperty(theme)) {
//        console.error("Can't delete a theme that doesn't exist");
//        return;
//    }
//
//    $(".theme-modal-confirm-delete").modal("hide");
//    var themeElm = document.querySelector("#themes-carousel .item[data-theme-name='"+theme+"']"),
//        nextThemeElm = themeElm.nextSibling || themeElm.parentNode.querySelector(".item:first-of-type");
//
//    if (themeElm.classList.contains("current")) {
//        defaultUser.saveSetting("currentTheme", "");
//        document.querySelector(".cur-theme").value = "-none";
//    }
//
//    themeElm.parentNode.removeChild(themeElm);
//    nextThemeElm.classList.add("active");
//
//    delete themes[theme];
//    chrome.storage.local.set({themes: themes});
//    chrome.runtime.sendMessage({setCurrentTheme: true});
//
//    if (document.querySelectorAll("#themes-carousel .carousel-inner > div").length < 2) {
//        $("#themes-carousel .carousel-control").hide();
//    }
//});
//
///**
// * Hook edit CSS confirm button
// */
//document.querySelector(".theme-modal-edit-css .confirm").addEventListener("click", function(){
//    var theme = this.getAttribute("data-theme");
//    if (!theme || !themes.hasOwnProperty(theme)) {
//        console.error("Can't edit CSS of a theme that doesn't exist");
//        return;
//    }
//
//    var css = document.querySelector(".theme-modal-edit-css .theme-css-textarea").value;
//    if (!css) {
//        alert("Can't set theme CSS to be empty");
//        return;
//    }
//
//    chrome.runtime.getBackgroundPage(function(bg){
//        var newCSS = bg.importantifyCSS(css);
//        if (newCSS) {
//            themes[theme].cachedCSS = newCSS;
//            chrome.storage.local.set({themes: themes}, function(x){
//                chrome.runtime.sendMessage({setCurrentTheme: theme});
//                $(".theme-modal-edit-css").modal("hide");
//            });
//        } else {
//            alert("Failed to parse theme CSS!");
//            console.error("Failed to parse CSS: ",{received: css, minimized: newCSS});
//            return;
//        }
//    });
//});
//
///**
// * Hook the "current theme" dropdown
// */

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