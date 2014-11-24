$(document).ready(function(){
    $(".ld-setting a").tooltip({
        placement : 'right'
    });
});

var defaultUser = new User();
var Settings = defaultUser.defaultSettings;

function restore_options() {
    var manifesto = chrome.runtime.getManifest();
    document.getElementById("version").innerHTML = manifesto.version;
    chrome.storage.local.get("userSettings", function(result) {
        var storageSettings = JSON.parse(result.userSettings);

        $.each(storageSettings, function(index, value) {
            Settings[index] = value;
        });
        $.each(Settings, function(index, value) {
            if (value)
                $(".ld-settings #" + index + " option[value=" + value + "]").prop('selected', true);
        });

        var curTheme = document.querySelector(".item[data-theme-name='"+Settings.currentTheme+"']");
        if (curTheme) {
            curTheme.classList.add("current", "active");
            document.querySelector(".curTheme").textContent = themes[Settings.currentTheme].title || "None";
        }
    });
}

document.addEventListener('DOMContentLoaded', restore_options);

$(".ld-settings select").on('change', function() {
    defaultUser.saveSetting(this.id, this.value);
});

// THEMES
var themes = {},
    themeDirectory;

// load themes from storage first
chrome.storage.local.get("themes", function(result){
    if (result.hasOwnProperty("themes")) {
        themes = result.themes;
    }

    // then load from directory
    chrome.runtime.getPackageDirectoryEntry(function(entry){
        entry.getDirectory("themes", {create: false}, function(dir){
            themeDirectory = dir;

            // get all dirs/files in themes/
            var reader = dir.createReader();
            reader.readEntries(function mainLoop(results){
                if (!results)
                    return;

                for (var i = 0, j = results.length; i < j; ++i) {
                    // if it's a directory
                    if (results[i].isDirectory === true) {
                        theme_format(results[i]);
                    }
                }

                mainLoop();
            }, error_proxy);

        }, error_proxy);
    });

    for (var theme in result.themes) {
        console.log("Checking theme "+theme);
        if (themes[theme].custom) {
            console.log("Theme "+theme+" was custom");
            theme_data_handler.call({
                result: "{}",
                obj: themes[theme],
                themeName: theme
            });
        }
    }
});

/**
 * Formats a theme into an object, and pushes it to window.themes
 * @param DirectoryEntry dirEntry - directory entry of theme folder
 */
function theme_format(dirEntry) {
    console.log("Theme: "+dirEntry.name);
    var obj = {},
        reader = dirEntry.createReader(),
        fileReader = new FileReader(),
        dataFileEntry;

    fileReader.addEventListener("loadend", theme_data_handler);
    fileReader.addEventListener("error", error_proxy);

    // if theme is in storage, load
    if (themes[dirEntry.name]) {
        obj = themes[dirEntry.name];
    }

    // then read from directory
    reader.readEntries(function loop(results){
        if (!results)
            return;

        // loop through every file in theme directory
        for (var i = 0, j = results.length; i < j; ++i) {
            if (results[i].isFile === true) {
                // if it's bg.[ext]
                if (/bg\.[^.]*$/.test(results[i].name)) {
                    obj.bg = "$dir/"+results[i].name;
                }

                // if it's icon.[ext]
                if (/icon\.[^.]*$/.test(results[i].name)) {
                    obj.icon = "$dir/"+results[i].name;
                }

                // if it's data.json
                if (results[i].name === "data.json") {
                    dataFileEntry = results[i];
                }
            }
        }

        // placed outside of loop, so were sure bg & icon has been found
        if (!dataFileEntry) {
            console.error("["+dirEntry.name+"] Couldn't find data.json");
            return;
        }

        dataFileEntry.file(function(file){
            fileReader.themeName = dirEntry.name;
            fileReader.obj = obj;
            fileReader.readAsText(file);
        });
    }, error_proxy);
}

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

    if (!json.bg)
        json.bg = obj.bg;
    if (!json.icon)
        json.icon = obj.icon;
    
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
    if (Object.keys(json).length) {
        console.log("Removing keys from ",obj, " based on ",json);
        for (var k in obj) {
            if (!json.hasOwnProperty(k))
                delete obj[k];
        }
    }

    // merge obj and json
    $.extend(true, obj, json);

    if (!obj.bg) {
        console.error("["+name+"] Couldn't find bg.[ext]");
        return;
    }
    if (!obj.title || !obj.description || !obj.version) {
        console.error("["+name+"] Invalid data.json - missing title, description or version");
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

    var item = document.createElement("div"),
        a = document.createElement("div");

    a.className = "theme-container";
    item.className = "item "+(!document.querySelectorAll("#themes-carousel .item.active").length ? "active" : "");
    item.setAttribute("data-theme-name", name);

    if (active) {
        var act;
        if (act = document.querySelector("#themes-carousel .item.active"))
            act.classList.remove("active");
        item.classList.add("active");
    }

    // avoid HTML injection
    obj = escape_obj(obj);
    
    var optionsHTML = "<h2 class='text-primary'>Options <small>"+obj.title+(obj.remote && obj.url ? " - <a href='"+obj.url+"' class='text-info'>"+obj.url+"</a>" : "")+"</small></h2>";
    if (obj.options || obj.custom || obj.changelog) {
        if (obj.options || obj.custom) {
            item.innerHTML += "<input id='"+name+"-options-toggle' type='checkbox' class='options-toggle glyphicon glyphicon-cog'>";
            for (var k in obj.options) {
                optionsHTML += "<div>";
                optionsHTML += "<label for='"+name+"-"+k+"'>";
                optionsHTML += "<input "+(obj.options[k].checked ? "checked ":"")+"type='checkbox' id='"+name+"-"+k+"' data-theme='"+name+"' data-option='"+k+"'>";
                optionsHTML += obj.options[k].description+"</label>";
                optionsHTML += "</div>";
            }

            if (obj.custom) {
                optionsHTML += "<button class='btn btn-danger theme-remove' data-toggle='modal' data-target='.theme-modal-confirm-delete'>Delete theme</button>";
            }
        }
        if (obj.changelog) {
            item.innerHTML += "<a target='_blank' href='"+obj.changelog+"' class='theme-changelog glyphicon glyphicon-list'></a>";
        }
    }
    
    // dirty dirty
    a.innerHTML = "<img src='"+obj.bg.replace("$dir","../themes/"+name)+"'><div class='highlight'></div>"+
                  "<div class='carousel-caption'>"+
                      (obj.icon ? "<img class='icon' src='"+obj.icon.replace("$dir","../themes/"+name)+"'>" : "")+
                      "<h2>"+obj.title+"</h2><h4 class='author'>by "+obj.author+" (v "+obj.version+")</h4><p style='font-size: 18px'>"+obj.description+"</p>"+
                  "</div>";

    item.appendChild(a);

    if (obj.options || obj.custom) {
        var tmpElm = document.createElement("div");
        tmpElm.className = "theme-option";
        tmpElm.innerHTML = optionsHTML;
        item.appendChild(tmpElm);

        if (obj.custom) {
            tmpElm.innerHTML += "<button class='btn btn-danger theme-remove' data-toggle='modal' data-target='.theme-modal-confirm-delete'>Delete theme</button>";
        }

        // on option change, save
        $(tmpElm).find("input").on("change", function(){
            var theme = this.getAttribute("data-theme"),
                option = this.getAttribute("data-option");

            if (!theme || !option)
                return;

            themes[theme].options[option].checked = this.checked;
            chrome.storage.local.set({themes: themes});
        });
        $(tmpElm).find(".theme-remove").on("click", function(){
            document.querySelector(".theme-modal-confirm-delete .confirm").setAttribute("data-theme", name);
        });
    }

    // on click, select new theme
    a.addEventListener("click", function(){
        select_theme(name);
    });

    document.querySelector("#themes-carousel .carousel-inner").appendChild(item);


    // add to dropdown
    var dropdownOption = document.createElement("option");
    dropdownOption.setAttribute("value", name);
    dropdownOption.textContent = obj.title;
    document.querySelector(".cur-theme").appendChild(dropdownOption);

    if (name === Settings.currentTheme) {
        var act = document.querySelector("#themes-carousel .item.active");
        if (act)
            act.classList.remove("active");

        item.classList.add("active");

        select_theme(name);
    }
}



/**
 * Creates/saves a custom theme, based on given data
 * @param String name - folder/theme name
 * @param Object json - JSON to get data from, only containing description, author and version if local
 * @param String css - css to be inserted into inject.css
 * @param String bg - URL of the background image
 * @param String remoteUrl - if set, theme is considered remote (css is URL)
 * @param Function callback - callback to call with true or error string
 * @param Boolean active - whether slide should be active
 */
function create_theme(name, json, css, bg, callback, remoteUrl, icon, active) {
    if (!callback)
        callback = error_proxy;

    if (!name || !json || !css || (!bg && !json.bg)) {
        callback("Necesarry information not provided.");
        return;
    }

    var theme = {};
    theme.custom = true;
    theme.title = json.title || "Custom theme";
    theme.author = json.author || "Unknown";
    theme.version = json.version || "0.0.1";
    theme.description = json.description || "Custom theme";
    if (json.options)
        theme.options = json.options;
    theme.bg = bg || json.bg;
    theme.css = css;

    if (remoteUrl) {
        theme.remote = true;
        theme.url = remoteUrl;
    }

    console.log("Added theme ",name," : ",theme);
    themes[name] = theme;
    theme_create_element(name, theme, active);
    chrome.storage.local.set({themes: themes}, function(){
        callback(true);
    });
}


/**
 * Set a specific theme to currently selected
 * @param String name - name of theme, falsy if selecting none
 */
function select_theme(name) {
    defaultUser.saveSetting("currentTheme", name);

    var current = document.querySelector("#themes-carousel .item.current"),
        active = document.querySelector("#themes-carousel .item.active"),
        ownElm = document.querySelector("#themes-carousel .item[data-theme-name='"+name+"']");
    
    if (current)
        current.classList.remove("current");

    if (name && ownElm) {
        if (active)
            active.classList.remove("active");

        ownElm.classList.add("current");
        ownElm.classList.add("active");
    }

    document.querySelector(".cur-theme").value = name || "-none";
}



/**
 * USER INPUT
 */

/**
 * Hook remote add theme button
 */
document.querySelector("#add-theme-remote button[type='submit']").addEventListener("click", function(ev){
    ev.preventDefault();

    var url = document.getElementById("add-theme-url").value;
    if (!url) {
        alert("Missing the following information: url");
        return;
    }

    get(url, function(){
        if (this.status === 0) {
            alert("Failed to connect to the URL - please make sure it's spelled correctly");
            return;
        }

        try {
            var data = this.responseText,
                json = JSON.parse(data),
                err = "";
                required = ["name", "title", "css", "bg"]

            for (var i = 0; i < required.length; ++i) {
                if (!json[required[i]]) {
                    if (!err)
                        err = "The following information is missing from the JSON: ";

                    err += required[i] + " ";
                }
            }

            if (err) {
                alert(err);
                return;
            }
        } catch (err) {
            alert("JSON could not be parsed. Please make sure you're using the correct URL");
            return;
        }
        create_theme(json.name, json, json.css, json.bg, function(val){
            if (val !== true)
                error_proxy.apply({}, arguments);
        }, url, json.icon, true);
    });
});

/**
 * Hook local add theme button
 */
document.querySelector("#add-theme-local button[type='submit']").addEventListener("click", function(ev){
    ev.preventDefault();

    var form = document.getElementById("add-theme-local"),
        title = document.getElementById("add-theme-title").value,
        description = document.getElementById("add-theme-description").value,
        bg = document.getElementById("add-theme-bg").value,
        author = document.getElementById("add-theme-author").value,
        version = document.getElementById("add-theme-version").value,
        css = document.getElementById("add-theme-css").value,
        name = "custom_",
        err = "",
        vals = [title, bg, author, version, css],
        names = ["title", "background", "author", "version", "css"];

    for (var i = 0; i < vals.length; ++i) {
        if (!vals[i]) {
            if (!err)
                err = "We're missing the following information: ";

            err += names[i] + " ";
        }
    }
    if (err) {
        alert(err);
        return;
    }

    var i = 0;
    while (themes.hasOwnProperty(name+i)) { ++i }
    name += i;

    create_theme(name, {
        title: title,
        description: description,
        version: version,
        author: author
    }, css, bg, function(val){
        if (val !== true)
            error_proxy.apply({}, arguments);
    }, false, undefined, true);
});

/**
 * Hook theme delete confirm button
 */
document.querySelector(".theme-modal-confirm-delete .confirm").addEventListener("click", function(){
    var theme = this.getAttribute("data-theme");
    if (!theme || !themes.hasOwnProperty(theme)) {
        console.error("Can't delete a theme that doesn't exist");
        return;
    }

    $(".theme-modal-confirm-delete").modal("hide");
    var themeElm = document.querySelector("#themes-carousel .item[data-theme-name='"+theme+"']"),
        nextThemeElm = themeElm.nextSibling || themeElm.parentNode.querySelector(".item:first-of-type");

    if (themeElm.classList.contains("current")) {
        defaultUser.saveSetting("currentTheme", "");
        document.querySelector(".curTheme").textContent = "None";
    }

    themeElm.parentNode.removeChild(themeElm);
    nextThemeElm.classList.add("active");

    delete themes[theme];
    chrome.storage.local.set({themes: themes});
});

/**
 * Hook the "current theme" dropdown
 */
document.querySelector(".cur-theme").addEventListener("change", function(){
    var val = this.value;
    select_theme(val)
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
        if (!obj.hasOwnProperty(k))
            continue;
        if(k === "css")
            continue;

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