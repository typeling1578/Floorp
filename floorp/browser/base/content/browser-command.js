/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function enableRestMode() {
  if (Services.prefs.getBoolPref("floorp.browser.rest.mode", false)) {
    var Tag = document.createElement("style");
    Tag.innerText = `*{display:none !important;}`
    document.getElementsByTagName("head")[0].insertAdjacentElement('beforeend', Tag);
    Tag.setAttribute("id", "none");

    gBrowser.selectedTab.toggleMuteAudio();
    reloadAllOtherTabs();

    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);

    let l10n = new Localization(["browser/floorp.ftl"], true);
    prompts.alert(null, l10n.formatValueSync("rest-mode"),
      l10n.formatValueSync("rest-mode-description"));

    document.getElementById("none").remove();
  }
}

function reloadAllOtherTabs() {
  let ourTab = BrowserWindowTracker.getTopWindow().gBrowser.selectedTab;
  BrowserWindowTracker.orderedWindows.forEach(win => {
    let otherGBrowser = win.gBrowser;
    for (let tab of otherGBrowser.tabs) {
      if (tab == ourTab) {
        continue;
      }
      if (tab.pinned || tab.selected) {
        otherGBrowser.reloadTab(tab);
      } else {
        otherGBrowser.discardBrowser(tab);
      }
    }
  });
  for (let notification of document.querySelectorAll(".reload-tabs")) {
    notification.hidden = true;
  }
}

function OpenChromeDirectory() {
  let currProfDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
  let profileDir = currProfDir.path;
  let nsLocalFile = Components.Constructor("@mozilla.org/file/local;1", "nsIFile", "initWithPath");
  new nsLocalFile(profileDir,).reveal();
}

function restartbrowser() {
  Services.obs.notifyObservers(null, "startupcache-invalidate");

  let env = Cc["@mozilla.org/process/environment;1"].getService(
    Ci.nsIEnvironment
  );
  env.set("MOZ_DISABLE_SAFE_MODE_KEY", "1");

  Services.startup.quit(
    Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
  );
}


/*---------------------------------------------------------------- Context Menu ----------------------------------------------------------------*/
function addContextBox(id,l10n,insert,runFunction){
  let contextMenu = document.createXULElement("menuitem");
  contextMenu.setAttribute("data-l10n-id",l10n);
  contextMenu.id = id;
  contextMenu.setAttribute("oncommand",runFunction);
  document.getElementById("contentAreaContextMenu").insertBefore(contextMenu,document.getElementById(insert));
  contextMenuObserverFunc();
}

function contextMenuObserverFunc(){
  if(document.getElementById("bsb-context-add") != null) document.getElementById("bsb-context-add").hidden = document.getElementById("context-viewsource").hidden || !document.getElementById("context-viewimage").hidden
  if(document.getElementById("bsb-context-link-add") != null) document.getElementById("bsb-context-link-add").hidden = document.getElementById("context-openlink").hidden
  if(document.getElementById("bsb-context-link-add") != null) document.getElementById("bsb-context-link-add").hidden = document.getElementById("context-openlink").hidden
}

function contextMenuObserverAdd(id){
  contextMenuObserver.observe(document.getElementById(id), {attributes:true})
  contextMenuObserverFunc()
}
