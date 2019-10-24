/* messenger.groupdav.overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2019
 *     Email: support@inverse.ca
 *       URL: http://inverse.ca
 *
 * "SOGo Connector" is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 as published by
 * the Free Software Foundation;
 *
 * "SOGo Connector" is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * "SOGo Connector"; if not, write to the Free Software Foundation, Inc., 51
 * Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { notificationManagerInstance } = ChromeUtils.import("resource://sogo-connector/NotificationManager.jsm");


function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("messenger.groupdav.overlay.js: failed to include '" + files[i] +
                 "'\n" + e
                 + "\nFile: " + e.fileName
                 + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js"]);

/*
 * This overlay adds GroupDAV functionalities to Addressbooks
 * it contains the observers needed by the addressBook and the cards dialog
 */

let groupdavSynchronizationObserver = {
    count: 0,
    handleNotification: function(notification, data) {
        let active = (this.count > 0);
        let throbber = document.getElementById("navigator-throbber");
        /* Throbber may not exist, thus we need to check the returned value. */
        if (notification == "groupdav.synchronization.start") {
            this.count++;
            if (!active) {
                dump("GETTING BUSY\n");
                if (throbber)
                    throbber.setAttribute("busy", true);
            }
        }
        else if (notification == "groupdav.synchronization.stop") {
            this.count--;
            if (active) {
                dump("RESTING\n");
                if (throbber)
                    throbber.setAttribute("busy", false);
            }
        }
    }
};

function OnLoadMessengerOverlay() {
    /* if SOGo Integrator is present, we let it take the startup procedures */
    notificationManagerInstance.registerObserver("groupdav.synchronization.start",
                          groupdavSynchronizationObserver);
    notificationManagerInstance.registerObserver("groupdav.synchronization.stop",
                          groupdavSynchronizationObserver);

    if (!this.sogoIntegratorStartupOverlayOnLoad) {
        dump("startup from sogo-connector\n");
        cleanupAddressBooks();
        startFolderSync();
    }
    else
        dump("skipping startup, sogo-connector present\n");

    window.addEventListener("unload", SCUnloadHandler, false);
}

function SCUnloadHandler(event) {
    notificationManagerInstance.unregisterObserver("groupdav.synchronization.start",
                            groupdavSynchronizationObserver);
    notificationManagerInstance.unregisterObserver("groupdav.synchronization.stop",
                            groupdavSynchronizationObserver);
}

function cleanupAddressBooks() {
    // 	_cleanupLocalStore();
    let uniqueChildren = _uniqueChildren("ldap_2.servers", 2);
    _cleanupABRemains(uniqueChildren);
    uniqueChildren = _uniqueChildren("ldap_2.servers", 2);
    _cleanupBogusAB(uniqueChildren);

    uniqueChildren = _uniqueChildren("extensions.ca.inverse.addressbook.groupdav.ldap_2.servers",
                                     7);
    _cleanupOrphanDAVAB(uniqueChildren);
    _migrateOldCardDAVDirs(uniqueChildren);
}

function _uniqueChildren(path, dots) {
    let count = {};
    let children = Services.prefs.getChildList(path, count);
    let uniqueChildren = {};
    for (let i = 0; i < children.length; i++) {
        let leaves = children[i].split(".");
        uniqueChildren[leaves[dots]] = true;
    }

    return uniqueChildren;
}

function _cleanupABRemains(uniqueChildren) {
    let path = "ldap_2.servers";

    for (let key in uniqueChildren) {
        let branchRef = path + "." + key;
        let count = {};
        let children = Services.prefs.getChildList(branchRef, count);
        if (children.length < 2) {
            if (children[0] == (branchRef + ".position"))
                Services.prefs.deleteBranch(branchRef);
        }
    }
}

function _cleanupBogusAB(uniqueChildren) {
    let path = "ldap_2.servers";

    for (let key in uniqueChildren) {
        if (key != "default") {
            let uriRef = path + "." + key + ".uri";
            let uri = null;
            // 			dump("trying: " + uriRef + "\n");
            try {
                uri = Services.prefs.getCharPref(uriRef);
                if (uri.indexOf("moz-abldapdirectory:") == 0) {
                    dump("deleting: " + path + "." + key + "\n");
                    Services.prefs.deleteBranch(path + "." + key);
                    // 			dump("uri: " + uri + "\n");
                }
            }
            catch(e) {};
        }
    }
}

function _cleanupOrphanDAVAB(uniqueChildren) {
    var	path = "extensions.ca.inverse.addressbook.groupdav.ldap_2.servers";
    for (let key in uniqueChildren) {
        let otherRef = "ldap_2.servers." + key + ".description";
        // 		dump("XXXX otherRef: " + otherRef + "\n");
        try {
            Services.prefs.getCharPref(otherRef);
        }
        catch(e) {
            // 			dump("exception: " + e + "\n");
            dump("deleting orphan: " + path + "." + key + "\n");
            Services.prefs.deleteBranch(path + "." + key);
        }
    }
}

function _migrateOldCardDAVDirs(uniqueChildren) {
    var	path = "extensions.ca.inverse.addressbook.groupdav.ldap_2.servers.";
    for (let key in uniqueChildren) {
        let fullPath = path + key;
        try {
            let isCardDAV = (Services.prefs.getCharPref(fullPath + ".readOnly") == "true");
            if (isCardDAV) {
                dump("######### trying to migrate " + key + "\n");
                let description = "" + Services.prefs.getCharPref(fullPath + ".name");
                let url = "" + Services.prefs.getCharPref(fullPath + ".url");
                dump("description: " + description + "\n");
                dump("url: " + url + "\n");
                if (description.length > 0
                    && url.length > 0) {
                    try {
                        Services.prefs.deleteBranch(fullPath);
                    }
                    catch(x) {};
                    try {
                        Services.prefs.deleteBranch("ldap_2.servers." + key);
                    }
                    catch(y) {};
                    SCCreateCardDAVDirectory(description, url);
                    // 					dump("********* migrated CardDAV: " + key + "\n");
                }
            }
        }
        catch(e) {}
    }
}

// TODO : better handling of that var
var SOGO_Timers = [];

function startFolderSync() {
    let abManager = Components.classes["@mozilla.org/abmanager;1"]
                              .getService(Components.interfaces.nsIAbManager);

    let children = abManager.directories;
    while (children.hasMoreElements()) {
        let ab = children.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);
        if (isGroupdavDirectory(ab.URI)) {            
            let dirPrefId = ab.dirPrefId;                
            let groupdavPrefService = new GroupdavPreferenceService(dirPrefId);
            let periodicSync = false;
            let periodicSyncInterval = 60;
            let notifications = false;
            let notificationsOnlyIfNotEmpty = false;
            try {
                periodicSync = groupdavPrefService.getPeriodicSync();
                periodicSyncInterval = groupdavPrefService.getPeriodicSyncInterval();
                notifications = groupdavPrefService.getNotifications();
                notificationsOnlyIfNotEmpty = groupdavPrefService.getNotificationsOnlyIfNotEmpty();            
            } catch(e) {
            }
            
            
            // handle startup sync
            sync = GetSyncNotifyGroupdavAddressbook(ab.URI, ab, SOGOC_SYNC_STARTUP);
            sync.notify();

            if (periodicSync) {
                // handle future periodic sync
                psync = GetSyncNotifyGroupdavAddressbook(ab.URI, ab, SOGOC_SYNC_PERIODIC);
                
                // TODO : handle syncInterval and Notifications in a dynamic way :
                // today, we have to restart TB if we change those values.
                 
                // Now it is time to create the timer.
                var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
                 
                let delay = periodicSyncInterval;
                delay = delay *60; // min --> sec
                // delay = delay * 3; // min --> sec DEBUG
                delay = delay * 1000; // sec --> ms
                timer.initWithCallback(psync, delay, Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE_CAN_SKIP);
                SOGO_Timers.push(timer);
            }
        }
    }
}

function SCSynchronizeFromChildWindow(uri) {
    this.setTimeout(SynchronizeGroupdavAddressbook, 100, uri, null, SOGOC_SYNC_WRITE);
}

window.addEventListener("load", OnLoadMessengerOverlay, false);
