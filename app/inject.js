var appID = (window.location.hostname == "dota2lounge.com" ? "570" : "730");

var storageMarketItems,
    currencies = {},
    themes = {},
    matchInfoCache = {},
    streamPlaying = false,
    inventory = false,
    lastAccept = 0,
    blacklistedItemList = {};

var container = document.createElement("div");

var LoungeUser = new User();
chrome.storage.local.get(['marketPriceList', 'currencyConversionRates', 'themes', 'matchInfoCache', 'lastAutoAccept', 'blacklistedItemList'], function(result) {
    blacklistedItemList = result.blacklistedItemList || {};
    storageMarketItems = result.marketPriceList || {};
    currencies = result.currencyConversionRates || {};
    matchInfoCache = result.matchInfoCache || {};
    themes = result.themes || {};
    lastAccept = result.lastAutoAccept || 0;
    LoungeUser.loadUserSettings(function() {
        console.log("User settings have been loaded in content script!");
        init();
    });
});

// Inject theme as quickly as possible
chrome.runtime.sendMessage({injectCSSTheme: true});
/*
 Wrap the init code here, because for this to function properly, we need user settings to be loaded first
 */
function init() {
    /*
     When bot status changes (detected by background.js), a message gets send from background script to content script (here).
     TODO: Pass bot status through listener.
     */
    inventory = new Inventory();
    chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {
        if(msg.inventory) {
            inventory.onInventoryLoaded(msg.inventory);
        }
        if(msg.hasOwnProperty("changeSetting")) {
            for(var name in msg.changeSetting) {
                LoungeUser.userSettings[name] = msg.changeSetting[name];
            }
        }
        if(msg.hasOwnProperty("ajax")) {
            // peform ajax
            var settings = msg.ajax;
            settings.success = function(data){sendResponse(data)};
            settings.error = function(){sendResponse("error")};
            $.ajax(settings);

            return true;
        }
    });

    // do theme-related stuff
    if (LoungeUser.userSettings.currentTheme) {
        var name = LoungeUser.userSettings.currentTheme;
        if (themes.hasOwnProperty(name)) {
            var theme = themes[name],
                style;

            if (theme.cachedCSS) {
                //chrome.runtime.sendMessage({injectCSSCode: theme.cachedCSS});
            } else {
                style = document.createElement("link");
                style.setAttribute("href", theme.css);
                style.setAttribute("rel", "stylesheet");
                $(document).ready(function(){
                    document.head.appendChild(style);
                })
            }

            $(document).ready(function(){
                // collapsible menus and columns
                if (theme.collapsibleColumns) {
                    var collapsibleElms = document.querySelectorAll("#submenu, .box");
                    for (var i = 0, j = collapsibleElms.length; i < j; ++i) {
                        var hide_toggle = document.createElement("div"),
                            parentFirst = collapsibleElms[i].firstChild;

                        hide_toggle.className = "ld-collapse-toggle";
                        hide_toggle.addEventListener("click", (function(elm){return function(){
                            elm.classList.toggle("ld-collapsed");
                        }})(collapsibleElms[i]));
                        collapsibleElms[i].insertBefore(hide_toggle, parentFirst);
                    }
                }
            });

            // load options
            console.log("Got theme: ",theme);
            if (theme.options) {
                var classes = " ";
                for (var k in theme.options) {
                    if (theme.options[k].checked)
                        classes += k+" ";
                }
                $(document).ready(function(){
                    document.body.className += classes;
                });
            }
        }
    }

    $(document).ready(function() {
        // add describing classes to body
        $("body").addClass("appID" + appID);
        var themeChangeElm;
        // dark/light theme
        if (themeChangeElm = document.querySelector(".ddbtn a:nth-of-type(2)")) {
            var theme = /\?skin=([0-9])/.exec(themeChangeElm.href)[1];
            document.body.classList.add(["ld-dark", "ld-light"][theme]);
        }
        // main/match/whatever
        document.body.classList.add("ld-"+(window.location.pathname.replace("/","") || "main"));

        if(document.URL.indexOf("/mytrades") != -1 || $("a:contains('Clean messages')").length) {
            $("body").addClass("mytrades");
        }
        // cannot check if actually playing, unfortunately
        // only if it's been clicked while on the page
        (function(){
            var container = document.getElementById("mainstream"),
                flash = document.getElementById("live_embed_player_flash");

            if (!flash) { // it's a hitbox stream
                flash = document.querySelector("#mainstream iframe:first-child");
                if (!flash)
                    return;

                flash.contentWindow.document.addEventListener("click", function(){
                    streamPlaying = true
                });

                return
            }

            if (!container)
                return;

            flash = flash.document || flash;

            if (!flash)
                return;

            // onclick/onmousedown doesn't fire on flash objects
            container.addEventListener("mousedown", function(){
                streamPlaying = true;
            });

            // onmousedown won't fire unless wmode=transparent, don't ask me why
            flash.setAttribute("wmode", "transparent");
        })();

        if(LoungeUser.userSettings["itemMarketPricesv2"] == "2") {
            getMarketPricesForElementList();
        }
        if(document.URL.indexOf("/mybets") != -1) {
            if (LoungeUser.userSettings.renameButtons === "1") {
                var btn = document.getElementById("freezebutton");
                if (btn)
                    btn.textContent = "FUCKING REQUEST RETURNS";
            }

            if (["2","1"].indexOf(LoungeUser.userSettings.enableAuto) !== -1) {
                // inject primitive auto-freeze
                var btn = document.getElementById("freezebutton");
                if (btn) {
                    console.log("Replacing postToFreezeReturn");
                    // remove old onclick listener
                    btn.removeAttribute("onclick");
                    btn.onclick = null;
                    var oldBtn = btn,
                        btn = oldBtn.cloneNode(true);
                    oldBtn.parentNode.replaceChild(btn,oldBtn);

                    // inject own
                    btn.addEventListener("click", function(){
                        if (this.textContent !== "Are you sure") {
                            $(this).html("Are you sure").on("click", newFreezeReturn);
                        }
                    });
                }

                // return items if we've enabled auto-accept
                if (LoungeUser.userSettings.enableAuto === "1") {
                    // and if we have frozen items
                    if (document.querySelector("#freeze .item") && !document.getElementById("queue")) {
                        // and if we've just accepted an earlier offer
                        if (Date.now() - lastAccept < 60000) {
                            chrome.storage.local.set({lastAutoAccept: 0});
                            console.log("Returning items");
                            newFreezeReturn();
                        }
                    }
                }
            }

            $(".matchmain").each(function(index, value) {
                var total = 0;
                $(".item", value).each(function(itemIndex, itemValue) {
                    var betItemValue = parseFloat($(".value", itemValue).text().replace("$ ", ""));
                    total = total + betItemValue;
                });
                $(value).addClass("custom-my-bets-margin");
                $(".match .full:eq(0)", value).after('<div class="full total-bet"><span style="float: left; margin-right: 0.5em">Total value bet:</span><div class="potwin Value"><b>'+total.toFixed(2)+'</b> Value</div></div>');
            });
        }
        if($('a[href="/trades"]').length || document.URL.indexOf("/result?") != -1 || document.URL.indexOf("/trades") != -1) {
            if (LoungeUser.userSettings.showDescriptions !== "0") {
                $(".tradepoll").each(function(index, value) {
                    var trade = new Trade(value);
                    trade.addTradeDescription();
                });
            }
        }
        if(document.URL.indexOf("/match?m=") != -1 || document.URL.indexOf("/predict") != -1) {
            if (LoungeUser.userSettings.renameButtons === "1") {
                var btn = document.getElementById("placebut");
                if (btn) {
                    var txt = btn.textContent.toUpperCase();
                    btn.textContent = "FUCKING "+txt;
                }
            }
            // convert time to local time
            var timeElm = document.querySelector("main > .box:first-child > div:first-child > div:first-child .half:nth-child(3)");
            if (timeElm) {
                var newTime = convertLoungeTime(timeElm.textContent, true);
                if(newTime) {
                    timeElm.textContent = timeElm.textContent + (newTime ? ", " + newTime : newTime);
                }
            }
            var $returnsTab = $("a.tab:contains('Returns')");
            if($returnsTab.length) {
                $returnsTab.after('<a class="tab" id="ld_cache" onclick="returns = false;">Cached inventory</div>');
                $("section.box div[style='width: 96%;margin: 0 2%;border-radius: 5px;overflow: hidden;'] .tab").width("33%").click(function() {
                    inventory.stopLoadingInventory();
                });
                $("#ld_cache").click(function() {
                    $(".left").html("");
                    document.getElementById("backpack").innerHTML = '<div id="LDloading" class="spin-1"></div>';
                    inventory.getCachedInventory("bettingInventory" + appID + "_" + readCookie("id"), function(bpHTML) {
                        document.getElementById("backpack").innerHTML = bpHTML;
                        this.bettingInventoryType = "inventory";
                        addInventoryStatistics();
                        inventory.getMarketPrices(true);
                    });
                });
            }
        }
        if(document.URL.indexOf("/addtrade") != -1) {
            $(".tabholder .tab").click(function() {
                inventory.stopLoadingInventory();
            });
        }

        // add custom 'Preview' buttons to trades that don't have it
        // first create preview element if it doesn't exist
        (function(){
            if (LoungeUser.userSettings.addTradePreviews === "0")
                return;
            if (!document.getElementById("logout"))
                return;

            var previewElm = document.getElementById("preview");
            
            if (previewElm)
                return;

            if (document.querySelector(".tradepoll")) {
                previewElm = document.createElement("section");
                previewElm.id = "preview";
                previewElm.className = "destroyer";
                document.body.appendChild(previewElm);
                customPreview = true;
            }
            previewElm = $(previewElm);

            $(".tradepoll").each(function(ind, elm){
                if (!elm.querySelector(".tradeheader a.button[onclick^=\"livePreview\"]")) {
                    var header = elm.querySelector(".tradeheader"),
                        span = (header && header.querySelector("span[style*=\"float: right\"]")) || false,
                        btn = document.createElement("a");

                    btn.className = "button destroyer live-preview";
                    btn.innerHTML = "Preview";
                    btn.style.float = "none";

                    if (!header)
                        return;
                    if (!span) {
                        // if buttons already exist in header, don't place within span
                        if (elm.querySelector(".tradeheader > a.button")) {
                            span = header;
                            btn.className = "buttonright";
                            btn.style.float = "right";
                        } else {
                            span = document.createElement("span");
                            span.style.float = "right";
                            header.appendChild(span);
                        }
                    }

                    var tradeId = elm.querySelector("a[href^=\"trade?\"]"),
                        self = this instanceof $ ? this : $(this);
                    if (tradeId)
                        tradeId = tradeId.getAttribute("href").replace("trade?t=","");
                    else
                        return;

                    // magic happens here
                    btn.addEventListener("click", function(){
                        if (previewElm.attr("data-index") == ind) {
                            previewElm.hide();
                            previewElm.attr("data-index", "-1");
                            return;
                        }

                        previewElm.show();
                        previewElm.html('<img src="../img/load.gif" id="loading" style="margin: 0.75em 2%">');

                        var offset = self.offset();
                        if ($(document).width() > offset.left + self.outerWidth() + Math.max(410, $(document).width()*0.5)) {
                            offset.top = Math.floor(offset.top - 20);
                            offset.left = Math.floor(offset.left + self.outerWidth() + 10);
                        } else {
                        // position below if not enough space on right
                            offset.top = Math.floor(offset.top+self.height()+10);
                            offset.left = Math.floor(offset.left);
                        }
                        previewElm.offset(offset);

                        $.ajax({
                            url: "ajax/livePreview.php",
                            type: "POST",
                            data: "t="+tradeId,
                            success: function(d){
                                previewElm.html(d).slideDown("fast");
                                previewElm.attr("data-index", ind);
                            }
                        })
                    });

                    span.appendChild(btn);
                }
            });
        })();

        container.querySelector("input").value = LoungeUser.userSettings.autoDelay || 5;

        if(LoungeUser.userSettings.showExtraMatchInfo == "2") {
            $(".matchmain").each(function(i, v) {
                if(!$(v).find(".notavailable").length) {
                    // Instead of repeating myself with the same code I have in .mouseover part or moving logic to somewhere else,
                    // I just trigger the hover event
                    $(v).trigger('mouseenter');
                }
            });
        }
    });
}
/*
    Code that does not rely heavily on Chrome storage data
 */
$(document).ready(function() {
    // listen for additions to items
    itemObs.observe(document.body, {
        childList: true,
        subtree: true
    });

    // create info box in top-right
    container.className = "destroyer auto-info hidden";
    container.innerHTML = '<p>Auto-<span class="type">betting</span> items<span class="worth-container"> on match <a class="match-link"></a></span>. <span class="type capitalize">Betting</span> for the <span class="num-tries">0th</span> time.</p><button class="red">Disable auto-bet</button><p class="destroyer error-title">Last error (<span class="destroyer time-since">0s</span>):</p><p class="destroyer error-text"></p><label>Seconds between retries:</label><input id="bet-time" type="number" min="2" max="60" step="1">';

    container.querySelector("button").addEventListener("click", function(){
        chrome.runtime.sendMessage({type: "autoBet", autoBet: false});
    });
    container.querySelector("input").addEventListener("input", function(){
        var newVal = Math.max(2, this.valueAsNumber);
        if (newVal) {
            chrome.runtime.sendMessage({"set": {bet: {autoDelay: newVal * 1000}},
                "saveSetting": {autoDelay: newVal}});
        }
    });
    container.querySelector("input").addEventListener("blur", function(){
        var newVal = Math.max(2, this.valueAsNumber);
        if (newVal) {
            this.valueAsNumber = newVal;
            chrome.runtime.sendMessage({"set": {bet: {autoDelay: newVal * 1000}},
                "saveSetting": {autoDelay: newVal}});
        }
    });
    document.body.appendChild(container);

    document.body.addEventListener("click",function(ev) {
        if (ev.srcElement) {
            if (ev.srcElement.id !== "preview"
                && !$("#preview").find(ev.srcElement).length) {

                $("#preview").hide();
                $("#preview").attr("data-index", "-1");
            }
            if (ev.srcElement.id !== "modalPreview"
                && !$("#modalPreview").find(ev.srcElement).length) {
                $("#modalPreview").fadeOut();
            }
        }
    });
});

// postToFreezeReturn overwrite
function newFreezeReturn(tries){
    if (typeof tries !== "number")
        tries = 1;

    var toreturn = retrieveWindowVariables("toreturn")["toreturn"];
    if (toreturn === "true") {
        // hacky hacky UI stuff
        var toHide = document.querySelectorAll(".destroyer.auto-info > *:not(:first-child)");
        for (var i = 0, j = toHide.length; i < j; ++i) {
            if (toHide[i].classList)
                toHide[i].classList.remove("hidden");
        }
        // end hacky hacky UI stuff

        $.ajax({
            url: "ajax/postToReturn.php",
            success: function(data) {
                if (data) { // this should never happen
                    console.error("Whoops, this shouldn't happen: ",data);
                } else {
                    console.error("This shouldn't happen.");
                }
            }
        });
    } else {
        // hacky hacky UI stuff
        document.querySelector(".destroyer.auto-info").classList.remove("hidden");
        var ordinalEnding = ((tries||0)+"").slice(-1);
        ordinalEnding = (tries%100 < 20 &&
                        tries%100 > 10) ? "th" : // if a "teen" number, end in th
                        ordinalEnding === "1" ? "st":
                        ordinalEnding === "2" ? "nd":
                        ordinalEnding === "3" ? "rd":
                        "th";
        document.querySelector(".destroyer.auto-info .num-tries").textContent = (tries||0)+ordinalEnding;
        var toHide = document.querySelectorAll(".destroyer.auto-info > *:not(:first-child)");
        for (var i = 0, j = toHide.length; i < j; ++i) {
            if (toHide[i].classList)
                toHide[i].classList.add("hidden");
        }

        var typeSpans = document.querySelectorAll(".destroyer.auto-info .type");
        for (var i = 0, j = typeSpans.length; i < j; ++i) {
            typeSpans[i].textContent = "freezing";
        }
        // end hacky hacky UI stuff

        $.ajax({
            url: "ajax/postToFreeze.php",
            data: $("#freeze").serialize(),
            type: "POST",
            success: function(data) {
                if (data) {
                    console.error(data);
                    setTimeout(function(){
                        console.log("Retrying freeze for the ",tries,". time - ",data);
                        newFreezeReturn(tries+1);
                    }, 2000);
                } else {
                    setWindowVariables({toreturn: true});
                    newFreezeReturn(tries+1);
                }
            }
        });
    }
}

/*
    Mouseover action for items
 */
$(document).on("mouseover", ".oitm", function() {
    // We do not have to do any of the stuff below anymore
    if($(this).hasClass("ld-appended")) {
        return false;
    }
    var LoungeItem = new Item(this);
    LoungeItem.appendHoverElements();
    var settingMarketPrices = LoungeUser.userSettings["itemMarketPricesv2"];
    if(settingMarketPrices == "1" || settingMarketPrices == "2") {
        LoungeItem.getMarketPrice();
    }
});
$(document).on("click", "a.refreshPriceMarket", function(e) {
    e.stopPropagation();
    var LoungeItem = new Item($(this).parents(".oitm"));
    LoungeItem.unloadMarketPrice();
    LoungeItem.fetchSteamMarketPrice();
});
$(document).on("mouseover", ".matchmain", function() {
    if(LoungeUser.userSettings.showExtraMatchInfo != "0" && !$(this).hasClass("extraMatchInfo") && !$(this).hasClass("loading")) {
        $(this).addClass("loading");

        var matchURL = $("a[href]:eq(0)", this).attr("href"),
            matchElement = this,
            matchID = matchURL.replace("match?m=","");

        $.ajax({
            url: matchURL,
            type: "GET",
            success: function(data){
                var doc = document.implementation.createHTMLDocument("");
                doc.body.innerHTML = data;
                var bestOfType = $(doc).find(".box-shiny-alt:eq(0) .half:eq(1)").text().trim(),
                    exactTime = $(doc).find(".box-shiny-alt:eq(0) .half:eq(2)").text().trim(),
                    matchHeaderBlock = $(".matchheader .whenm:eq(0)", matchElement);

                if(exactTime) {
                    var convertedTime = convertLoungeTime(exactTime);
                    if(convertedTime) {
                        exactTime = convertedTime;
                    }
                    $(matchHeaderBlock).append('<span class="matchExactTime"> <span class="seperator">|</span> ' + exactTime + '</span>');
                }
                if(bestOfType) {
                    $(matchHeaderBlock).append(' <span class="seperator">|</span> <span class="bestoftype">' + bestOfType + '</span>');
                }
                $(matchElement).addClass("extraMatchInfo");
                $(matchElement).removeClass("loading");

                // trim the unneeded spaces
                var redInfo = matchHeaderBlock[0].querySelector("span[style*='#D12121']");
                if (redInfo) {
                    if (!redInfo.textContent.trim().length) {
                        matchHeaderBlock[0].removeChild(redInfo);
                    }
                }
            },
            error: function() {
                $(matchElement).removeClass("loading");
            }
        });

    }
});

// auto-magically add market prices to newly added items, currently only for trade list
var itemObs = new MutationObserver(function(records){
    for (var i = 0, j = records.length; i < j; ++i) {
        if (records[i].addedNodes && records[i].addedNodes.length && records[i].target.id == "tradelist") {
            var hasTradeNodes = false;
            for (var k = 0, l = records[i].addedNodes.length; k < l; ++k) {
                var elm = records[i].addedNodes[k];
                if (elm.classList) {
                    if (elm.classList.contains("tradepoll")) {
                        hasTradeNodes = true;
                        if (LoungeUser.userSettings.showDescriptions !== "0") {
                            var trade = new Trade(elm);
                            trade.addTradeDescription();
                        }
                    }
                }
            }
            if(hasTradeNodes) {
                if (LoungeUser.userSettings["itemMarketPricesv2"] == "2") {
                    getMarketPricesForElementList($(records[i].addedNodes).find(".oitm"));
                }
            }
        }
    }
});

function convertLoungeTime(loungeTimeString) {
    if(LoungeUser.userSettings.changeTimeToLocal != "0") {
        // I am no timezone expert, but I assume moment.js treats CET/CEST automatically
        var trimmedTime = loungeTimeString.replace("CET", "").replace("CEST", "").trim();
        // Intl.DateTimeFormat().resolved.timeZone, might be derpy in other browsers
        var timezoneName = (LoungeUser.userSettings.timezone == "auto" ? Intl.DateTimeFormat().resolved.timeZone : LoungeUser.userSettings.timezone);
        if(moment.tz.zone(timezoneName)) {
            var format = (LoungeUser.userSettings.americanosTime == "0" ? "HH:mm" : "h:mm A");
            format = (LoungeUser.userSettings.displayTzAbbr == "0" ? format : format + " z");
            return moment.tz(trimmedTime, "HH:mm", "CET").tz(timezoneName).format(format);
        }
    }
    return false;
}