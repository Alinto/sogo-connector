/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                 .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("startup-overlay.js: failed to include '" + files[i] + "'\n" + e +
                 "\nFile: " + e.fileName +
                 "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://sogo-connector/content/messenger/folders-update.js"]);

let forcedPrefs = {};

let iCc = Components.classes;
let iCi = Components.interfaces;
let thunderbirdUID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";

let appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                        .getService(Components.interfaces.nsIXULRuntime);
let platformId = appInfo.OS + "_" + appInfo.XPCOMABI;

let xulAppInfo = Components.classes["@mozilla.org/xre/app-info;1"]
    .getService(Components.interfaces.nsIXULAppInfo);

let appVersion = xulAppInfo.version;

function checkExtensionsUpdate() {
    let extensionInfos = getHandledExtensions();
    let extensions = extensionInfos["extensions"];
    dump("number of handled extensions: " + extensions.length + "\n");
    if (extensions.length > 0) {
        function checkExtensionsUpdate_callback(items) {
            let results = prepareRequiredExtensions(extensionInfos, items);
            if (results["urls"].length + results["uninstall"].length > 0) {
                window.openDialog("chrome://sogo-connector/content/messenger/update-dialog.xul",
                                  "Extensions", "status=yes", results);
            } else {
                dump("  no available update for handled extensions\n");
                checkFolders();
            }
        }

        AddonManager.getAddonsByIDs(extensions.map(function(x) { return x.id; })).then(checkExtensionsUpdate_callback);
    }
    else {
        checkFolders();
    }
}

function getHandledExtensions() {
    let extensionInfos = { "extensions": [] };

    let rdf = iCc["@mozilla.org/rdf/rdf-service;1"].getService(iCi.nsIRDFService);
    let extensions = rdf.GetResource("http://inverse.ca/sogo-connector/extensions");
    let updateURL = rdf.GetResource("http://inverse.ca/sogo-connector/updateURL");
    let extensionId = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#id");
    let extensionName = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#name");

    let ds = rdf.GetDataSourceBlocking("chrome://sogo-connector/content/global/extensions.rdf");

    try {
        let urlNode = ds.GetTarget(extensions, updateURL, true);
        if (urlNode instanceof iCi.nsIRDFLiteral) {
            extensionInfos["updateRDF"] = urlNode.Value;
        }

        let targets = ds.ArcLabelsOut(extensions);
        while (targets.hasMoreElements()) {
            let predicate = targets.getNext();
            if (predicate instanceof iCi.nsIRDFResource) {
                let target = ds.GetTarget(extensions, predicate, true);
                if (target instanceof iCi.nsIRDFResource) {
                    let extension = {};
                    let id = ds.GetTarget(target, extensionId, true);
                    if (id instanceof iCi.nsIRDFLiteral) {
                        extension.id = id.Value;
                        //dump("id: " + extension.id + "\n");
                    }
                    let name = ds.GetTarget(target, extensionName, true);
                    if (name instanceof iCi.nsIRDFLiteral) {
                        extension.name = name.Value;
                        //dump("name: " + extension.name + "\n");
                    }
                    if (extension.id) {
                        extensionInfos["extensions"].push(extension);
                    }
                }
            }
        }
    }
    catch(e) {
        dump("getHandledExtensions: " + e + "\n");
    }

    return extensionInfos;
}

function makeExtensionURL(baseURL, extension, extensionItem) {
    let replaceDict = { "%APP_VERSION%": escape (appVersion),
                        "%ITEM_ID%": escape(extension.id),
                        "%ITEM_VERSION%": escape(extensionItem ? extensionItem.version : "0.00"),
                        "%PLATFORM%": escape(platformId) };

    let url = baseURL;
    for (let k in replaceDict) {
        let v = replaceDict[k];
        url = url.replace(k, v, "g");
    }

    return url;
}

function prepareRequiredExtensions(extensionInfos, extensionItems) {
    let extensions = extensionInfos["extensions"];

    //dump("prepareRequiredExtensions: " + JSON.stringify(extensions) + "\n");

    let extensionsURL = [];
    let unconfiguredExtensions = [];
    let uninstallExtensions = [];

    //let preferences = Components.classes["@mozilla.org/preferences;1"]
    //                            .getService(Components.interfaces.nsIPrefBranch);
    let appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                            .getService(Components.interfaces.nsIXULRuntime);

    let rdf = iCc["@mozilla.org/rdf/rdf-service;1"].getService(iCi.nsIRDFService);
    //let rdf = Cc["@mozilla.org/rdf/rdf-service;1"].getService(iCi.nsIRDFService);
    for (let i = 0; i < extensions.length; i++) {
        let url = makeExtensionURL(extensionInfos["updateRDF"], extensions[i], extensionItems[i]);
        let extensionURN = rdf.GetResource("urn:mozilla:extension:" + extensions[i].id);
        let extensionData = getExtensionData(rdf, url, extensionURN);
        if (extensionData) {
            let extensionItem = extensionItems[i];
            // We check if we have to disable some extension that _is installed_
            // If so, let's do it right away
            if (extensionItem && extensionItem.name.length > 0
                && extensionData.version == "disabled") {
                uninstallExtensions.push(extensions[i].id);
            }
            else if ((!extensionItem || !extensionItem.name
                      || extensionData.version != extensionItem.version)
                     && extensionData.version != "disabled") {
                extensionsURL.push({ name: extensions[i].name,
                                     url: extensionData.url});
            }
            else {
                let configured = false;
                try {
                    configured = Services.prefs.getBoolPref("inverse-sogo-connector.extensions." + extensions[i].id + ".isconfigured");
                }
                catch(e) {}
                if (!configured)
                    unconfiguredExtensions.push(extensions[i].id);
            }
        }
        else
            dump("no data returned for '" + extensions[i].id + "'\n");
    }

    let result = { urls: extensionsURL,
                   configuration: unconfiguredExtensions,
                   uninstall: uninstallExtensions};

    dump("prepareRequiredExtensions - result: " + JSON.stringify(result) + "\n");
    return result;
}

function getExtensionData(rdf, url, extensionURN) {
    //dump("getExtensionData...\n");

    let extensionData = null;
    let updates = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#updates");

    try {
        dump("url: " + url + "\n");
        let ds = rdf.GetDataSourceBlocking(url);
        let urlNode = ds.GetTarget(extensionURN, updates, true);
        if (urlNode instanceof iCi.nsIRDFResource) {
            let targets = ds.ArcLabelsOut(urlNode);
            while (targets.hasMoreElements()) {
                let node = targets.getNext();
                if (node instanceof iCi.nsIRDFResource) {
                    let nodeValue = ds.GetTarget(urlNode, node, true);
                    if (nodeValue instanceof iCi.nsIRDFResource)
                        extensionData = GetRDFUpdateData(rdf, ds, nodeValue);
                }
            }
        }
    }
    catch (e) {
        dump("getExtensionData: " + e + "\n");
    }

    //dump("getExtensionData completed, returning: " + JSON.stringify(extensionData) + "\n");

    return extensionData;
}

function GetRDFUpdateData(rdf, ds, node) {
    //dump("GetRDFUpdateData... rdf:" + rdf + " ds:" + ds + " node: " + node + "\n");
    let updateData = { url: null, version: null };

    let targetApplication = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#targetApplication");
    let applicationId = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#id");
    let updateLink = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#updateLink");
    let extensionVersion = ds.GetTarget(node,  rdf.GetResource("http://www.mozilla.org/2004/em-rdf#version"), true);

    //dump("extensionVersion: " + extensionVersion + " targetApplication: " + targetApplication + " applicationId: " + applicationId + " updateLink: " + updateLink + " version: " + version + "\n");

    if (extensionVersion instanceof iCi.nsIRDFLiteral) {
        updateData.version = extensionVersion.Value;
        let appNode = ds.GetTarget(node, targetApplication, true);
        if (appNode) {
            let appId = ds.GetTarget(appNode, applicationId, true);
            if (appId instanceof iCi.nsIRDFLiteral
                && appId.Value == thunderbirdUID) {
                let updLink = ds.GetTarget(appNode, updateLink, true);
                if (updLink instanceof iCi.nsIRDFLiteral)
                    updateData.url = updLink.Value;
            }
        }
    }

    if (!(updateData.url && updateData.version))
        updateData = null;

    //dump("GetRDFUpdateData completed, returning: " + JSON.stringify(updateData) + "\n");
    return updateData;
}

function sogoIntegratorStartupOverlayOnLoad() {

    dump("Starting SOGo Integrator code...\n");

    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                 .getService(Components.interfaces.mozIJSSubScriptLoader);
    try {
        loader.loadSubScript("chrome://sogo-connector/content/general/custom-preferences.js");
        applyForcedPrefs();
    }
    catch(e) {
        dump("Custom preference code not available.\ne: " + e + "\n");
    }

    try {
        loader.loadSubScript("chrome://sogo-connector/content/general/startup.js");
        try {
            CustomStartup();
        }
        catch(customE) {
            dump("An exception occured during execution of custom startup"
                 + " code.\nException: " + customE
                 + "\nFile: " + customE.fileName
                 + "\nLine: " + customE.lineNumber
                 + "\n\n Stack:\n\n" + customE.stack);
        }
        dump("Custom startup code executed\n");
    }
    catch(e) {
        dump("Custom startup code not available.\ne: " + e + "\n");
    }

    if (typeof(getCompositeCalendar) == "undefined"
        || !_setupCalStartupObserver()) {
        dump("no calendar available: checking extensions update right now.\n");
        checkExtensionsUpdate();
    }
}

//
// Work-around a bug in the SSL code which seems to hang Thunderbird when
// calendars are refreshing and extensions updates are being checked...
//
function _setupCalStartupObserver() {
	let handled = false;

	let compCalendar = getCompositeCalendar();
	let calDavCount = 0;
	let calendars = compCalendar.getCalendars({});
	for (let calendar in calendars) {
      if (calendar.type == "caldav"
          && calendar.readOnly
          && !calendar.getProperty("disabled")) {
          calDavCount++;
      }
  }

	dump("extensions/folder update starts after: " + calDavCount + " cals\n");

	if (calDavCount > 0) {
// composite observer
      let SICalStartupObserver = {
      counter: 0,
      maxCount: calDavCount,
      onLoad: function(calendar) {
              this.counter++;
              dump("counter: " + this.counter + "\n");
              if (this.counter >= this.maxCount) {
                  compCalendar.removeObserver(this);
                  dump("calendars loaded, now checking extensions\n");
                  checkExtensionsUpdate();
              }
          },
      onStartBatch: function(calendar) {},
      onEndBatch: function(calendar) {},
      onAddItem: function(aItem) {},
      onModifyItem: function(newItem, oldItem) {},
      onDeleteItem: function(aItem) {},
      onError: function(calendar, errNo, msg) {},
      onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {},
      onPropertyDeleting: function(aCalendar, aName) {}
      };

      compCalendar.addObserver(SICalStartupObserver);
      handled = true;
	}

	return handled;
}

function _getVersionTags(versionString) {
    let currentVersionTags = [];

    let currentString = versionString;
    let dotIndex = currentString.indexOf(".");
    if (dotIndex == 0) {
        currentString = "0" + currentString;
        dotIndex++;
    }
    while (dotIndex > -1) {
        let currentTag = currentString.substr(0, dotIndex);
        currentVersionTags.push(parseInt(currentTag));
        currentString = currentString.substr(dotIndex + 1);
        dotIndex = currentString.indexOf(".");
    }
    currentVersionTags.push(parseInt(currentString));

    return currentVersionTags;
}

function checkExtensionVersion(currentVersion, minVersion, strict) {
    let acceptable = true;

    let stop = false;

    let currentVersionTags = _getVersionTags(currentVersion);
    let minVersionTags = _getVersionTags(minVersion);
    if (currentVersionTags.length > minVersionTags.length) {
        let delta = currentVersionTags.length - minVersionTags.length;
        for (let i = 0; i < delta; i++) {
            minVersionTags.push(0);
        }
    }
    else if (currentVersionTags.length < minVersionTags.length) {
        let delta = minVersionTags.length - currentVersionTags.length;
        for (let i = 0; i < delta; i++) {
            currentVersionTags.push(0);
        }
    }

    let max = currentVersionTags.length;
    for (let i = 0; !stop && i < max; i++) {
        if (currentVersionTags[i] != minVersionTags[i]) {
            stop = true;
            if (strict
                || currentVersionTags[i] < minVersionTags[i])
                acceptable = false;
        }
    }

    return acceptable;
}

function deferredCheckFolders() {
    jsInclude(["chrome://sogo-connector/content/messenger/folders-update.js"]);
    window.setTimeout(checkFolders, 100);
}

// forced prefs
function force_int_pref(key, value) {
    forcedPrefs[key] = { type: "int", value: value };
}

function force_bool_pref(key, value) {
    forcedPrefs[key] = { type: "bool", value: value };
}

function force_char_pref(key, value) {
    forcedPrefs[key] = { type: "char", value: value };
}

function applyForcedPrefs() {
    //let prefService = Components.classes["@mozilla.org/preferences;1"]
    //    .getService(Components.interfaces.nsIPrefBranch);
    for (let key in forcedPrefs) {
        let pref = forcedPrefs[key];
        if (pref["type"] == "int") {
            Services.prefs.setIntPref(key, pref["value"]);
        }
        else if (pref["type"] == "bool") {
            Services.prefs.setBoolPref(key, pref["value"]);
        }
        else if (pref["type"] == "char") {
            Services.prefs.setCharPref(key, pref["value"]);
        }
        else
            dump("unsupported pref type: " + pref["type"] + "\n");
    }
}

// startup
window.addEventListener("load", sogoIntegratorStartupOverlayOnLoad, false);
