var appID = (window.location.hostname == "dota2lounge.com" ? "570" : "730");
/*
    Based on Steam market API
 */
var currencyData = {
    1: {
        "name": "USDUSD",
        "htmlSymbol": "&#36;",
        symbolBeforeValue: true
    },
    2: {
        "name": "USDGBP",
        "htmlSymbol": "&#163;",
        symbolBeforeValue: true
    },
    3: {
        "name": "USDEUR",
        "htmlSymbol": "&#8364;",
        symbolBeforeValue: false
    },
    5: {
        "name": "USDRUB",
        "htmlSymbol": "p&#1091;&#1073;.",
        symbolBeforeValue: false
    },
    20: {
        "name": "USDCAD",
        "htmlSymbol": "CDN&#36;",
        symbolBeforeValue: true
    },
    21: {
        "name": "USDAUD",
        "htmlSymbol": "A&#36;",
        symbolBeforeValue: true
    }
};

var storageMarketItems,
    currencies = {},
    themes = {},
    streamPlaying = false,
    inventory = false,
    streamHTML = null;

var container = document.createElement("div");

var LoungeUser = new User();
chrome.storage.local.get(['marketPriceList', 'currencyConversionRates', 'themes'], function(result) {
    storageMarketItems = result.marketPriceList || {};
    currencies = result.currencyConversionRates || {};
    themes = result.themes || {};
    LoungeUser.loadUserSettings(function() {
        console.log("User settings have been loaded in content script!");
        init();
    });
});

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
    });

    // inject theme CSS
    if (LoungeUser.userSettings.currentTheme) {
        var name = LoungeUser.userSettings.currentTheme;
        if (themes.hasOwnProperty(name)) {
            var theme = themes[name],
                style;

            if (!theme.css) {
                var themePath = "themes/"+LoungeUser.userSettings.currentTheme+"/inject.css";
                chrome.runtime.sendMessage({getFile: themePath}, function(data){
                    if (data.error) {
                        console.error(data.error);
                        return;
                    }

                    style = document.createElement("style");
                    style.textContent = data.data;
                    $(document).ready(function(){
                        document.head.appendChild(style);
                    });
                });
            } else {
                if (!theme.remote) {
                    style = document.createElement("style");
                    style.textContent = theme.css;
                } else {
                    style = document.createElement("link");
                    style.setAttribute("href", theme.css);
                    style.setAttribute("rel", "stylesheet");
                }

                $(document).ready(function(){
                    document.head.appendChild(style);
                });
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
            getMarketPricesFromParent();
        }
        if(document.URL.indexOf("/mybets") != -1) {
            if (LoungeUser.userSettings.renameButtons === "1") {
                var btn = document.getElementById("freezebutton");
                if (btn)
                    btn.textContent = "FUCKING REQUEST RETURNS";
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
                // On infinite scrolling trade page, new trades wont have expanded description
                $(".tradepoll").each(function(index, value) {
                    var description = $(value).find(".tradeheader").attr("title");
                    var descriptionTextLength = description.length;
                    if(descriptionTextLength > 0) {
                        $(value).find(".tradecnt").after('<div class="trade-description"><p>' + $.trim(description) + (descriptionTextLength > 240 ? "..." : "") + '</p></div>');
                        var tradeDescription = $(".trade-description", value);
                        if(descriptionTextLength > 240) {
                            $.ajax({
                                url: $(value).find("a:eq(1)").attr("href"),
                                type: "GET",
                                success: function(data) {
                                    $(".trade-description p", value).html(textToUrl($.trim($(data).find(".standard.msgtxt").text())));
                                }
                            });
                        } else {
                            $(".trade-description p", value).html(
                                textToUrl($(".trade-description p", value).text())
                            );
                        }
                    }
                });
            }
        }
        if(document.URL.indexOf("/match?m=") != -1 || document.URL.indexOf("/predict") != -1) {
            if(LoungeUser.userSettings["removeStream"] == "1") {
                var $streamElement = $("#mainstream");
                streamHTML = $streamElement.html();
                $streamElement.children().remove();
                $streamElement.html('<div id="ld-streamRemovedWrapper">Stream has been removed from page by LoungeDestroyer. <a id="ld-restoreStream">Show stream</a></div>');
                $("#ld-restoreStream", $streamElement).click(function() {
                    $streamElement.html(streamHTML);
                });
            }
            if (LoungeUser.userSettings.renameButtons === "1") {
                var btn = document.getElementById("placebut");
                if (btn) {
                    var txt = btn.textContent.toUpperCase();
                    btn.textContent = "FUCKING "+txt;
                }
            }
            $("a.tab:contains('Returns')").after('<a class="tab" id="ld_cache" onclick="returns = false;">Cached inventory</div>');
            $("section.box .tab").width("33%").click(function() {
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

                                // add market prices to items if they should auto-load
                                if (LoungeUser.userSettings.itemMarketPricesv2 == "2") {
                                    getMarketPricesFromParent(document.getElementById("preview"));
                                }
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
    // create info box in top-right
    container.className = "destroyer auto-info hidden";
    container.innerHTML = '<p>Auto-<span class="type">betting</span> items<span class="worth-container"> on match <a class="match-link"></a></span>. <span class="type capitalize">Betting</span> for the <span class="num-tries">0th</span> time.</p><button class="red">Disable auto-bet</button><p class="destroyer error-title">Last error (<span class="destroyer time-since">0s</span>):</p><p class="destroyer error-text"></p><label>Seconds between retries:</label><input id="bet-time" type="number" min="5" max="60" step="1">';

    container.querySelector("button").addEventListener("click", function(){
        chrome.runtime.sendMessage({type: "autoBet", autoBet: false});
    });
    container.querySelector("input").addEventListener("input", function(){
        if (this.valueAsNumber) {
            chrome.runtime.sendMessage({"set": {bet: {autoDelay: this.valueAsNumber * 1000}},
                "saveSetting": {autoDelay: this.valueAsNumber}});
        }
    }); // TO-DO: save setting
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

/*
    Mouseover action for items
 */
$(document).on("mouseover", ".oitm", function() {
    var LoungeItem = new Item($(this));
    var settingMarketPrices = LoungeUser.userSettings["itemMarketPricesv2"];
    if(settingMarketPrices == "1" || settingMarketPrices == "2") {
        LoungeItem.getMarketPrice();
    }
    if(!$(this).hasClass("ld-appended")) {
        if(nonMarketItems.indexOf(LoungeItem.itemName) == -1) {
            if($("a:contains('Market')", this).length) {
                $("a:contains('Market')", this).html("Market Listings");
            } else {
                $(".name", this).append('<br/><a href="' + LoungeItem.generateMarketURL() + '" target="_blank">Market Listings</a>');
            }

            $(".name", this).append('<br/><a href="' + LoungeItem.generateMarketSearchURL() + '" target="_blank">Market Search</a>' +
                '<br/><br/><small><a class="refreshPriceMarket">Show Steam market price</a></small>');
        }

        $(this).addClass("ld-appended");
        
        $("a", this).click(function(e) {
            e.stopPropagation();
            if($(this).hasClass("refreshPriceMarket")) {
                LoungeItem.unloadMarketPrice();
                LoungeItem.fetchSteamMarketPrice();
            }
        });
    }
});
$(document).on("mouseover", ".matchmain", function() {
    if(LoungeUser.userSettings.showExtraMatchInfo != "0" && !$(this).hasClass("extraMatchInfo") && !$(this).hasClass("loading")) {
        $(this).addClass("loading");
        var matchURL = $("a[href]:eq(0)", this).attr("href");
        var matchElement = this;
        $.ajax({
            url: matchURL,
            type: "GET",
            success: function(data){
                var doc = document.implementation.createHTMLDocument("");
                doc.body.innerHTML = data;
                var bestOfType = $(doc).find(".box-shiny-alt:eq(0) .half:eq(1)").text().trim();
                var exactTime = $(doc).find(".box-shiny-alt:eq(0) .half:eq(2)").text().trim();
                var matchHeaderBlock = $(".matchheader .whenm:eq(0)", matchElement);
                if(exactTime) {
                    $(matchHeaderBlock).append('<span class="matchExactTime"> <span class="seperator">|</span> ' + exactTime + '</span>');
                }
                if(bestOfType) {
                    $(matchHeaderBlock).append(' <span class="seperator">|</span> <span class="bestoftype">' + bestOfType + '</span>');
                }
                $(matchElement).addClass("extraMatchInfo");
                $(matchElement).removeClass("loading");
            },
            error: function() {
                $(matchElement).removeClass("loading");
            }
        })
    }
});
