/* -*- Mode: java; c-tab-always-indent: t; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

var iCc = Components.classes;
var iCi = Components.interfaces;
var shouldRestart = false;
var errorsHappened = false;
let activeRemovals = 0;
let activeInstalls = 0;

function uninstallCurrentExtensions(cfExtensions) {
    dump("update-dialogs.js: about to remove " + cfExtensions.length + " extensions\n");
    if (cfExtensions.length > 0) {
        activeRemovals = cfExtensions.length;
        shouldRestart = true;
        function removeCallback(addon) {
            dump("Removing existing extension: " + addon.name + "\n");
            activeRemovals--;
            addon.uninstall();
            this.restartIfPossible();
        }
        for (var i = 0; i < cfExtensions.length; i++) {
            AddonManager.getAddonByID(cfExtensions[i]).then(removeCallback);
        }
    }
}

let installListener = {
  onNewInstall: function(install) {},
  onDownloadStarted: function(install) {},
  onDownloadProgress: function(install) {},
  onDownloadEnded: function(install) { installationCheckpoint(install, true, true); },
  onDownloadCancelled: function(install) { installationCheckpoint(install, true, false); },
  onDownloadFailed: function(install) { installationCheckpoint(install, true, false); },
  onInstallStarted: function(install) {},
  onInstallEnded: function(install, addon) { installationCheckpoint(install, false, true); },
  onInstallCancelled: function(install) { installationCheckpoint(install, false, false); },
  onInstallFailed: function(install) { installationCheckpoint(install, false, false); },
  onExternalInstall: function(install, existingAddon, needsRestart) {}
};

function installationCheckpoint(install, isDownload, isSuccess) {
    // dump("install: " + install.name + "; dl: " + isDownload + "; success: " + isSuccess + "\n");
    if (isSuccess) {
        if (!isDownload) {
            shouldRestart = true;
        }
    }
    else if (!errorsHappened) {
        errorsHappened = !isSuccess;
    }

    if (!isDownload || !isSuccess) {
        activeInstalls--;
        this.restartIfPossible();
    }
}

function downloadMissingExtensions(dlExtensions) {
    function installCallback(installObject) {
        if (installObject.error != 0) {
            errorsHappened = true;
            activeInstalls--;
        }
        else {
            try {
              installObject.install();
              dump("install launched\n");
            }
            catch(e) {
                errorsHappened = true;
                activeInstalls--;
            }
        }
    }

    activeInstalls = dlExtensions.length;
    if (activeInstalls > 0) {
        AddonManager.addInstallListener(installListener);
        dlExtensions.forEach(function(extension) {
                dump("update-dialogs.js: downloading " + extension["name"]
                     + " from " + extension["url"] + "\n");
                AddonManager.getInstallForURL(extension["url"], installCallback,
                                              "application/x-xpinstall", null,
                                              extension["name"]);
            });
    }
}

function restartIfPossible() {
    if (activeInstalls == 0 && activeRemovals == 0) {
        if (errorsHappened) {
            if (window.opener)
                window.opener.deferredCheckFolders();
            AddonManager.removeInstallListener(installListener);
            window.close();
        }
        else {
            if (shouldRestart) {
                var dialog = document.getElementById("inverseMessengerUpdateDlg");
                var button = dialog.getButton("accept");
                button.disabled = false;
                var image = document.getElementById("spinner");
                image.collapsed = true;
                var restartMessage = document.getElementById("restartMessage");
                var message = document.getElementById("message");
                var maxChild = message.childNodes.length;
                for (var i = maxChild - 1; i > -1; i--)
                    message.removeChild(message.childNodes[i]);
                message.appendChild(document.createTextNode(restartMessage.value));
                window.setTimeout(updateDialogOnReload, 3000);
            }
        }
    }
}

function onAcceptClick(event) {
    var appStartup = iCc["@mozilla.org/toolkit/app-startup;1"]
                     .getService(iCi.nsIAppStartup);
    appStartup.quit(iCi.nsIAppStartup.eRestart
                    | iCi.nsIAppStartup.eAttemptQuit);
    event.preventDefault();
}

function updateDialogOnReload() {
    dump("update-dialogs.js: Restarting...\n");
    var appStartup = iCc["@mozilla.org/toolkit/app-startup;1"]
                     .getService(iCi.nsIAppStartup);
    appStartup.quit(iCi.nsIAppStartup.eRestart
                    | iCi.nsIAppStartup.eForceQuit);
}

function updateDialogOnLoad () {
    // 	dump("onRealLoad...\n");
    var dialog = document.getElementById("inverseMessengerUpdateDlg");
    var button = dialog.getButton("accept");
    button.disabled = true;
    shouldRestart = false;

    try {
        this.uninstallDone = false;
        var results = window.arguments[0];
        this.downloadMissingExtensions(results["urls"]);
        this.uninstallCurrentExtensions(results["uninstall"]);
        restartIfPossible();
    }
    catch(e) {
        dump("update-dialogs.js: updateDialogOnLoad: " + e + "\n");
        if (window.opener)
            window.opener.deferredCheckFolders();
        window.close();
    }

    document.addEventListener("dialogaccept", function(event) {
            onAcceptClick(event);
        });
}

window.addEventListener("load", updateDialogOnLoad, false);
