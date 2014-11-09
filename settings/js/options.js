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
            $(".ld-settings #" + index + " option[value=" + value + "]").prop('selected', true);
        });

        var curTheme = document.querySelector(".item[data-theme-name='"+Settings.currentTheme+"']");
        if (curTheme)
            curTheme.classList.add("current", "active");
    });
}

document.addEventListener('DOMContentLoaded', restore_options);

$(".ld-settings select").on('change', function() {
    defaultUser.saveSetting(this.id, this.value);
});

// THEMES
var themes = {};

document.querySelector(".curTheme").addEventListener("click", function(){
    // TODO: confirm before deleting current theme
    defaultUser.saveSetting("currentTheme", "");
    var current = document.querySelector(".item.current");
    if (current);
        current.classList.remove("current");

    this.textContent = "None";
});

// get themes directories
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
                if (results[i].isFile === false) {
                    theme_format(results[i]);
                }
            }

            mainLoop();
        }, error_proxy);

    }, error_proxy);
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

    reader.readEntries(function loop(results){
        if (!results)
            return;

        // loop through every file in theme directory
        for (var i = 0, j = results.length; i < j; ++i) {
            if (results[i].isFile === true) {
                // if it's bg.[ext]
                if (/bg\.[^.]*$/.test(results[i].name)) {
                    obj.bg = results[i].name;
                }

                // if it's icon.[ext]
                if (/icon\.[^.]*$/.test(results[i].name)) {
                    obj.icon = results[i].name;
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
 * Must be called as listener for loadend event on FileReader
 * FileReader must have .obj and .themeName properties
 * Merges .obj and parsed JSON of data, and saves to window.themesx
 */
function theme_data_handler(){
    var data = this.result,
        json = JSON.parse(data),
        obj = this.obj,
        name = this.themeName;

    console.log(this.obj);
    console.log(json);

    // merge obj and json
    for (var k in json) {
        obj[k] = json[k];
    }

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
 */
function theme_create_element(name, obj) {
    var item = document.createElement("div"),
        a = document.createElement("a");

    item.className = "item "+(!document.querySelectorAll("#themes-carousel .item.active").length ? "active" : "");
    item.setAttribute("data-theme-name", name);
    if (name === Settings.currentTheme) {
        var active = document.querySelector("#themes-carousel .item.active");
        if (active)
            active.classList.remove("active");

        item.classList.add("current","active");
        document.querySelector(".curTheme").textContent = obj.title;
    }
    
    // dirty dirty
    a.innerHTML = "<img src='../themes/"+name+"/"+obj.bg+"'><div class='highlight'></div>"+
                  "<div class='carousel-caption'>"+
                      (obj.icon ? "<img class='icon' src='../themes/"+name+"/"+obj.icon+"'>" : "")+
                      "<h2>"+obj.title+"</h2><h4 class='author'>by "+obj.author+" (v "+obj.version+")</h4><p style='font-size: 18px'>"+obj.description+"</p>"+
                  "</div>";

    // on click, select new theme
    item.addEventListener("click", function(){
        defaultUser.saveSetting("currentTheme", name);

        var current = document.querySelector("#themes-carousel .item.current");
        if (current)
            current.classList.remove("current");

        this.classList.add("current");
        document.querySelector(".curTheme").textContent = obj.title;
    });

    item.appendChild(a);
    document.querySelector("#themes-carousel .carousel-inner").appendChild(item);
}

/**
 * Native code can't be passed as callbacks
 * This proxies console.error
 */
function error_proxy(err) {
    console.error(err);
}