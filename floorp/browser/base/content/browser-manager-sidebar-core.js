const BROWSER_SIDEBAR_DATA_PREF = "floorp.browser.sidebar2.data";

const STATIC_SIDEBARS = {
    "floorp//bmt": {
        "l10n": "show-browser-manager-sidebar",
        "src": "chrome://browser/content/places/places.xhtml",
        "privileged": true,
    },
    "floorp//bookmarks": {
        "l10n": "show-bookmark-sidebar",
        "src": "chrome://browser/content/places/bookmarksSidebar.xhtml",
        "privileged": true,
    },
    "floorp//history": {
        "l10n": "show-history-sidebar",
        "src": "chrome://browser/content/places/historySidebar.xhtml",
        "privileged": true,
    },
    "floorp//downloads": {
        "l10n": "show-download-sidebar",
        "src": "about:downloads",
        "privileged": true,
    },
    "floorp//tst": {
        "l10n": "show-TST-sidebar",
        "src": getTSTsrc(),
        "privileged": true,
    }
}

let BROWSER_SIDEBAR_DATA = null;
let BROWSER_SIDEBAR_IDS = null;

function getTSTsrc() {
    let addon_uuids = Services.prefs.getStringPref("extensions.webextensions.uuids");
    let TST_addon_uuids = JSON.parse(addon_uuids)["treestyletab@piro.sakura.ne.jp"];
    let sidebarURL = `moz-extension://${TST_addon_uuids}/sidebar/sidebar.html`;
    return sidebarURL;
}

function readBMSData() {
    let bms_default_data = Services.prefs.getDefaultBranch(null).getStringPref(BROWSER_SIDEBAR_DATA_PREF);
    let init_data = JSON.parse(Services.prefs.getStringPref(BROWSER_SIDEBAR_DATA_PREF, "{}"));
    if (typeof init_data["data"] !== "object") {
        init_data = JSON.parse(bms_default_data);
    }

    // データの移行
    // v1: floorp.browser.sidebar2.customurl*  floorp.browser.sidebar2.customurl*.usercontext
    // v2: indexプロパティが存在する
    function getPref(name) {
        switch (Services.prefs.getPrefType(name)) {
            case 0:
              return undefined;
            case 32:
              return Services.prefs.getStringPref(name);
            case 64:
              return Services.prefs.getIntPref(name);
            case 128:
              return Services.prefs.getBoolPref(name);
        }
    }
    for (let i = 0;  i <= 19;  i++) {
        let url = getPref(`floorp.browser.sidebar2.customurl${i}`);
        let usercontext = getPref(`floorp.browser.sidebar2.customurl${i}.usercontext`);
        let width = getPref(`floorp.browser.sidebar2.width.mode${i}`);

        let willMigrate = true;
        if (url === undefined) willMigrate = false;
        for (let key of Object.keys(init_data["data"])) {
            if (init_data["data"][key]["url"] === url) {
                willMigrate = false;
            }
        }
        if (!willMigrate) continue;

        let newPanelId = `w${String((new Date()).getTime())}`;
        let newdata = {
            "url": url,
            "usercontext": usercontext !== undefined ?
                            String(usercontext) :
                            null,
            "userAgent": false,
            "width": width !== undefined ?
                      Number(width) :
                      0,
        }

        init_data["data"][newPanelId] = newdata;
    }
    Services.prefs.setStringPref(BROWSER_SIDEBAR_DATA_PREF, JSON.stringify(init_data));

    const v2_example = {
        "data": {
            "w20221023122919": {
                "url": "https://open.spotify.com",
                "usercontext": "1",
                "userAgent": false,
                "width": 770
            }
        },
        "index": [
            "1"
        ]
    }

    BROWSER_SIDEBAR_DATA = JSON.parse(Services.prefs.getStringPref(BROWSER_SIDEBAR_DATA_PREF, "{}"));
    BROWSER_SIDEBAR_IDS = BROWSER_SIDEBAR_DATA["index"];
}

async function getFavicon(panelId) {
    let url = BROWSER_SIDEBAR_DATA["data"][panelId]["url"];
    let URL_parsed;
    try {
        URL_parsed = new URL(url);
    } catch (e) {
        console.error(e);
        return "chrome://devtools/skin/images/globe.svg";
    }

    let iconProvider = Services.prefs.getStringPref("floorp.browser.sidebar.useIconProvider", null);
    let icon_url;
    if (URL_parsed.protocol.match(/^https?:$/)) {
        switch (iconProvider) {
            case "google":
                icon_url = `https://www.google.com/s2/favicons?domain=${URL_parsed.hostname}`;
                break;
            case "duckduckgo":
                icon_url = `https://external-content.duckduckgo.com/ip3/${URL_parsed.hostname}.ico`;
                break;
            case "yandex":
                icon_url = `https://favicon.yandex.net/favicon/v2/${URL_parsed.origin}`;
                break;
            case "hatena":
                icon_url = `https://cdn-ak.favicon.st-hatena.com/?url=${URL_parsed.origin}`;
                break;
            default:
                icon_url = `https://external-content.duckduckgo.com/ip3/${URL_parsed.hostname}.ico`;
                break;
        }
    } else if (URL_parsed.protocol === "moz-extension:") {
        let addon_id = URL_parsed.hostname;
        let addon_base_url = `moz-extension://${addon_id}`;
        icon_url = await new Promise(resolve => {
            fetch(addon_base_url + "/manifest.json")
                .then(async(response) => {
                    if (response.status !== 200) {
                        throw `${response.status} ${response.statusText}`;
                    }
                    let addon_manifest = await response.json();
                    let addon_icon_path = addon_manifest["icons"][
                        Math.max(...Object.keys(addon_manifest["icons"]))
                    ];
                    if (addon_icon_path === undefined) throw "Icon not found.";
                    let addon_icon_url = addon_icon_path.startsWith("/") ?
                        `${addon_base_url}${addon_icon_path}` :
                        `${addon_base_url}/${addon_icon_path}`;
                    resolve(addon_icon_url);
                })
                .catch(e => {
                    console.error(e);
                    resolve("chrome://mozapps/skin/extensions/extensionGeneric.svg");
                });
        });
        if (icon_url.startsWith("chrome://")) {
            return icon_url;
        }
    } else {
        return "chrome://devtools/skin/images/globe.svg";
    }

    return await new Promise(resolve => {
        fetch(icon_url)
            .then(async(response) => {
                if (response.status !== 200) {
                    throw `${response.status} ${response.statusText}`;
                }
                let reader = new FileReader();
                let blob_data = await response.blob();
                // TODO: ハッシュ値を計算してソフト404を判定する。
                let icon_data_url = await new Promise(resolve => {
                    reader.addEventListener("load", function() {
                        resolve(this.result);
                    });
                    reader.readAsDataURL(blob_data);
                });
                // TODO: hatenaも
                if (icon_data_url === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWIAAYAAAwAABQABggWTzwAAAABJRU5ErkJggg==") {
                    // Yandex will return a 1px size icon with status code 200 if the icon is not available. If it matches a specific Data URL, it will be considered as a failure to acquire, and this process will be aborted.
                    throw "Yandex 404";
                }
                resolve(icon_data_url);
            })
            .catch(e => {
                console.error(e);
                if (URL_parsed.protocol === "moz-extension:") {
                    resolve("chrome://mozapps/skin/extensions/extensionGeneric.svg");
                } else {
                    resolve("chrome://devtools/skin/images/globe.svg");
                }
            });
    });
}

const BMSManager = {
    CURRENT_PANEL: null,

    isInitialized: function() {
        return BROWSER_SIDEBAR_DATA !== null;
    },
    addPanelWithPrompt: function(url, usercontext){
        if (!this.isInitialized) throw "Not initialized!";
        let parentWindow = window;
        let newPanelId = `w${String((new Date()).getTime())}`;
        let panelInfo = {
            "new": true,
            "id": newPanelId,
            "url": url ? url : null,
            "userContext": usercontext ? usercontext : null,
        };
        if (
            parentWindow?.document.documentURI ==
            "chrome://browser/content/hiddenWindowMac.xhtml"
        ) {
            parentWindow = null;
        }
        if (parentWindow?.gDialogBox) {
            parentWindow.gDialogBox.open(
                "chrome://browser/content/preferences/dialogs/customURLs.xhtml",
                object
            );
        } else {
            Services.ww.openWindow(
                parentWindow,
                "chrome://browser/content/preferences/dialogs/customURLs.xhtml",
                "AddWebpanel",
                "chrome,titlebar,dialog,centerscreen,modal",
                panelInfo
            );
        }
    },
    addPanel: function(url, usercontext){
        if (!this.isInitialized) throw "Not initialized!";
        let newPanelId = `w${String((new Date()).getTime())}`;
        BROWSER_SIDEBAR_DATA["data"][newPanelId] = {
            "url": url,
            "usercontext": String(usercontext),
            "userAgent": false,
            "width": 0,
        };
        BROWSER_SIDEBAR_DATA["index"].push(newPanelId);
        Services.prefs.setStringPref(BROWSER_SIDEBAR_DATA_PREF, JSON.stringify(BROWSER_SIDEBAR_DATA));
    },
    removePanel: function(id){
        if (!this.isInitialized) throw "Not initialized!";
        delete BROWSER_SIDEBAR_DATA["data"][id];
        BROWSER_SIDEBAR_DATA["index"] = 
            BROWSER_SIDEBAR_DATA["index"].filter(index => index !== id);
        Services.prefs.setStringPref(BROWSER_SIDEBAR_DATA_PREF, JSON.stringify(BROWSER_SIDEBAR_DATA));
        document.getElementById(`webpanel_${id}`)?.remove();
    },
    movePanel: function(from, to){
        if (!this.isInitialized) throw "Not initialized!";
        let from_id = BROWSER_SIDEBAR_IDS[from];
        delete BROWSER_SIDEBAR_DATA["index"][from];
        BROWSER_SIDEBAR_DATA["index"][to] = from_id;
        Services.prefs.setStringPref(BROWSER_SIDEBAR_DATA_PREF, JSON.stringify(BROWSER_SIDEBAR_DATA));
    },
    editPanel: function(id, panelData){
        if (!this.isInitialized) throw "Not initialized!";
        BROWSER_SIDEBAR_DATA["data"][id] = Object.assign(BROWSER_SIDEBAR_DATA["data"][id], panelData);
        Services.prefs.setStringPref(BROWSER_SIDEBAR_DATA_PREF, JSON.stringify(BROWSER_SIDEBAR_DATA));
        if (panelData["url"] !== undefined ||
            panelData["userAgent"] !== undefined ||
            panelData["usercontext"] !== undefined
        ) {
            document.getElementById(`webpanel_${id}`)?.remove();
        }
        if (this.CURRENT_PANEL === id) {
            this.show(id);
        }
    },
    show: function(id){
        if (!this.isInitialized) throw "Not initialized!";
        let panelData = BROWSER_SIDEBAR_DATA["data"][id];
        let panelURL = panelData["url"];
        let panelSrc = panelURL;
        let privileged = false;
        if (STATIC_SIDEBARS[panelURL] !== undefined) {
            panelSrc = STATIC_SIDEBARS[panelURL]["src"];
            privileged = Boolean(STATIC_SIDEBARS[panelURL]["privileged"]);
        }

        for (let browser of document.querySelectorAll("#sidebar2-box > browser")) {
            browser.setAttribute("hidden", "true");
        }

        let browserManagerSidebarWebpanel = document.getElementById(`webpanel_${id}`);
        if (browserManagerSidebarWebpanel !== null) {
            // show
            browserManagerSidebarWebpanel.removeAttribute("hidden");
        } else {
            browserManagerSidebarWebpanel = document.createXULElement("browser");

            const SHARED_ATTRIBUTES = {
                "xmlns": "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
                "id": `webpanel_${id}`,
                "class": "webpanels",
                "flex": "1",
                "autoscroll": "false",
                "disablehistory": "true",
                "tooltip": "aHTMLTooltip",
            }
            const PRIVILEGED_ATTRIBUTES = {
                "disablefullscreen": "true",
                "disableglobalhistory": "true",
                "messagemanagergroup": "webext-browsers",
                "context": "",
                "webextension-view-type": "sidebar",
                "autocompletepopup": "PopupAutoComplete",
                "initialBrowsingContextGroupId": "40",
                "type": "content",
                /*
                "remote": "true",
                */
                "maychangeremoteness": "true",
                "src": panelSrc,
            }
            const NOT_PRIVILEGED_ATTRIBUTES = {
                "disablefullscreen": "true",
                "disableglobalhistory": "true",
                "messagemanagergroup": "webext-browsers",
                "context": "",
                "webextension-view-type": "sidebar",
                "autocompletepopup": "PopupAutoComplete",
                "initialBrowsingContextGroupId": "40",
                "type": "content",
                "remote": "true",
                "maychangeremoteness": "true",
                "src": panelSrc,
            }

            for (let key of Object.keys(SHARED_ATTRIBUTES)) {
                browserManagerSidebarWebpanel.setAttribute(key, SHARED_ATTRIBUTES[key]);
            }
            if (privileged) {
                for (let key of Object.keys(PRIVILEGED_ATTRIBUTES)) {
                    browserManagerSidebarWebpanel.setAttribute(key, PRIVILEGED_ATTRIBUTES[key]);
                }
            } else {
                for (let key of Object.keys(NOT_PRIVILEGED_ATTRIBUTES)) {
                    browserManagerSidebarWebpanel.setAttribute(key, NOT_PRIVILEGED_ATTRIBUTES[key]);
                }
            }

            document.getElementById("sidebar2-box").appendChild(browserManagerSidebarWebpanel);

            browserManagerSidebarWebpanel.removeAttribute("hidden");
        }

        browserManagerSidebarWebpanel.setAttribute("width", panelData["width"]);

        this.CURRENT_PANEL = id;
    },
    hidden: function(id, background = true){
        if (!this.isInitialized) throw "Not initialized!";
        for (let browser of document.querySelectorAll("#sidebar2-box > browser")) {
            browser.setAttribute("hidden", "true");
        }
        if (id !== null && !background) {
            document.getElementById(`webpanel_${id}`)?.remove();
        }
        this.CURRENT_PANEL = null;
    }
};

function updateBMSBox() {
    for (let box of document.querySelectorAll("#sidebar-select-box > toolbarbutton")) {
        if (box.id.startsWith("select-")) {
            box.remove();
        }
    }
    for (let BROWSER_SIDEBAR_ID of BROWSER_SIDEBAR_IDS.reverse()) {
        let panelData = BROWSER_SIDEBAR_DATA["data"][BROWSER_SIDEBAR_ID];
        if (!panelData) continue;
        let box = document.createXULElement("toolbarbutton");
        box.id = `select-${BROWSER_SIDEBAR_ID}`;
        box.classList.add("sidepanel-icon");
        box.classList.add("sicon-list");
        box.setAttribute("context", "all-panel-context");
        let panelURL = panelData["url"];
        let STATIC_SIDEBAR = STATIC_SIDEBARS[panelURL];
        if (STATIC_SIDEBAR) {
            box.setAttribute("data-l10n-id", STATIC_SIDEBAR["l10n"]);
        } else {
            box.style.listStyleImage = `url("chrome://devtools/skin/images/globe.svg")`;
            (async() => {
                let icon_url = await getFavicon(BROWSER_SIDEBAR_ID);
                box.style.listStyleImage = `url("${icon_url}")`;
            })();
        }
        document.querySelector("#sidebar-select-box > .workspace").insertAdjacentElement("afterend", box);
    }
}

// init
(async() => {
    if (!Services.prefs.getBoolPref("floorp.browser.sidebar.enable", false)) return;

    let os_languages = Cc["@mozilla.org/intl/ospreferences;1"].getService(Ci.mozIOSPreferences).regionalPrefsLocales;
    let prefBranch = Services.prefs.getDefaultBranch(null);
    prefBranch.setStringPref(
    "floorp.browser.sidebar.useIconProvider",
    os_languages.includes("zh-CN") ?
        "yandex" :
        "duckduckgo"
    );

    readBMSData();
    updateBMSBox();

    Services.prefs.addObserver(BROWSER_SIDEBAR_DATA_PREF, function() {
        readBMSData();
        updateBMSBox();
    });
})();
