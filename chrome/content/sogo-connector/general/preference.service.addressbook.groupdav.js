/* preference.service.addressbook.groupdav.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2016
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

Components.utils.import("resource://gre/modules/Services.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("preference.services.addressbook.groupdav.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js"]);

function isGroupdavDirectory(abURI) {
    let value = false;

    if (abURI
        && abURI.search("mab/MailList") == -1
        && abURI.search("moz-abmdbdirectory://") == 0) {
        let abManager = Components.classes["@mozilla.org/abmanager;1"]
                                  .getService(Components.interfaces.nsIAbManager);
        let ab = abManager.getDirectory(abURI);
        //  		let prefId = ab.directoryProperties.prefName;
        let prefId = ab.dirPrefId;
        try {
            let groupdavPrefService = new GroupdavPreferenceService(prefId);
            value = (groupdavPrefService.getURL() != null && groupdavPrefService.getURL() != "");
        }
        catch(e) {
            //let xpcConnect =Components.classes["DEB1D48E-7469-4B01-B186-D9854C7D3F2D"].getService(Components.interfaces.nsIXPConnect);
            // dump("ab prefid: " + prefId + "\n");
            // dump("abURI '" + abURI
            //      + " is invalid in call isGroupdavDirectory(abURI) \n\n STACK:\n"
            // 		 + backtrace(10));
            // TODO this needs to be handle better
            // Currently if for any reason someone messed up prefs.js this could create havoc
        }
    }

    //   	dump("abURI: " + abURI + " isGroupDav? " + value + "\n");

    return value;
}

function isCardDavDirectory(abURI){
    let value = false;

    if (abURI && abURI.search("carddav") == 0) {
        dump("isCardDavDirectory Wrong URI for a CardDAV entry: " + abURI
             + "\n" + backtrace() + "\n\n");
        throw("isCardDavDirectory Wrong URI for a CardDAV entry: " + abURI);
    }

    let abdavPrefix = "moz-abdavdirectory://";
    if (abURI
        && abURI.search("mab/MailList") == -1
        && abURI.search(abdavPrefix) == 0) {
        //let prefs = Components.classes["@mozilla.org/preferences-service;1"]
        //                      .getService(Components.interfaces.nsIPrefBranch);
        let prefName = abURI.substr(abdavPrefix.length);
        try {
            let uri = Services.prefs.getCharPref(prefName + ".uri");
            value = (uri.search("carddav") == 0);
        }
        catch(e) {
            dump("uri for " + prefName + " not found\n");
        }
    }

    // dump("isCardDAV: " + abURI + " = " + value + "\n");

    // /* CUT */
    // let abManager = Components.classes["@mozilla.org/abmanager;1"]
    //     .getService(Components.interfaces.nsIAbManager);
    // let ab = abManager.getDirectory(abURI);
    // dump("   ab: "  + ab + "\n");
    // /* /CUT */

    return value;
}

function GroupdavPreferenceService(uniqueId) {
    if (uniqueId == null || uniqueId == "") {
        // 		dump("GroupdavPreferenceService exception: Missing uniqueId"+
        // 				 backtrace());
        throw new Components.Exception("GroupdavPreferenceService exception: Missing uniqueId");
    }

    //this.mPreferencesService = Components.classes["@mozilla.org/preferences-service;1"]
    //                                     .getService(Components.interfaces.nsIPrefBranch);
    this.prefPath = "extensions.ca.inverse.addressbook.groupdav." + uniqueId + ".";
}

GroupdavPreferenceService.prototype = {
    //mPreferencesService: null,
    prefPath: null,

    _getPref: function GdPSvc__getPref(prefName) {
        let value = null;

        // 		dump("getPref: " + this.prefPath + prefName + "\n");

        try {
            value = Services.prefs.getCharPref(this.prefPath + prefName);
        }
        catch(e) {
          //dump("Exception getting pref '" + this.prefPath + prefName + "': \n" + e + " (" + e.lineNumber + ") - ignoring...\n");
          // dump("  stack:\n" + backtrace() + "\n");
          //throw("unacceptable condition: " + e);
        }

        return value;
    },
    _getPrefWithDefault:
    function GdPSvc__getPrefWithDefault(prefName, defaultValue) {
        let value = defaultValue;

        // 		dump("getPref: " + this.prefPath + prefName + "\n");

        try {
            let newValue = Services.prefs.getCharPref(this.prefPath + prefName);
            if (newValue)
                value = newValue;
        }
        catch(e) {}

        return value;
    },

    _setPref: function GdPSvc__setPref(prefName, value) {
        // 		dump("setPref: " + this.prefPath + prefName + " to: " + value + "\n");
        try {
            Services.prefs.setCharPref(this.prefPath + prefName, value);
        }
        catch(e) {
            // 			dump("exception setting pref '" + this.prefPath + prefName + "' to value '"
            // 					 + value + "': \n" + e + " (" + e.lineNumber + ")\n");
            // 			dump("stack: " + backtrace() + "\n");
            throw("unacceptable condition: " + e);
        }
        // 		dump("setPref - done\n");
    },
    _getBoolPref: function GdPSvc__getBoolPref(prefName) {
        let boolValue = false;
        let value = this._getPref(prefName);
        if (value) {
            let strValue = value.toLowerCase();
            if (strValue == "true"
                || strValue == "1"
                || strValue == "on"
                || strValue == "enabled")
                boolValue = true;
        }

        return boolValue;
    },
    _setBoolPref: function GdPSvc__setBoolPref(prefName, value) {
        let strValue;

        if (value)
            strValue = "true";
        else
            strValue = "false";

        this._setPref(prefName, strValue);
    },

    getURL: function GdPSvc_getURL() {
        let url = this._getPref("url");
        if (url) {
            if (url[url.length - 1] != '/')
                url += '/';
        }

        return url;
    },
    setURL: function GdPSvc_setURL(url) {
        this._setPref("url", url);
    },

    getHostName: function GdPSvc_getHostName(){
        let hostname = null;
        let url = this.getURL();

        if (url && url.length > 0) {
            let uri = Components.classes["@mozilla.org/network/standard-url;1"]
                                .createInstance(Components.interfaces.nsIURI);
            uri.spec = url;
            hostname = uri.host;
        }

        return hostname;
    },

    getCTag: function GdPSvc_getCTag() {
        return this._getPrefWithDefault("ctag", "");
    },
    setCTag: function GdPSvc_setCTag(value) {
        this._setPref("ctag", value);
    },

    getWebdavSyncToken: function GdPSvc_getWebdavSyncToken() {
        return this._getPrefWithDefault("sync-token", "");
    },
    setWebdavSyncToken: function GdPSvc_setWebdavSyncToken(value) {
        this._setPref("sync-token", value);
    },


    getPeriodicSync: function GdPSvc_getPeriodicSync() {
        return this._getBoolPref("periodicSync");
    },
    setPeriodicSync: function GdPSvc_setPeriodicSync(value) {
        this._setBoolPref("periodicSync", value);
    },
    
    getPeriodicSyncInterval: function GdPSvc_getPeriodicSyncInterval() {
        return this._getPrefWithDefault("periodicSyncInterval", "15");
    },
    setPeriodicSyncInterval: function GdPSvc_setPeriodicSyncInterval(value) {
        this._setPref("periodicSyncInterval", value);
    },


    getNotifications: function GdPSvc_getNotifications() {
        return this._getBoolPref("notifications");
    },
    setNotifications: function GdPSvc_setNotifications(value) {
        this._setBoolPref("notifications", value);
    },

    getNotificationsOnlyIfNotEmpty: function GdPSvc_getNotificationsOnlyIfNotEmpty() {
        return this._getBoolPref("notificationsNotEmpty");
    },
    setNotificationsOnlyIfNotEmpty: function GdPSvc_setNotificationsOnlyIfNotEmpty(value) {
        this._setBoolPref("notificationsNotEmpty", value);
    },

    getNotificationsManual: function GdPSvc_getNotificationsManual() {
        return this._getBoolPref("notificationsManual");
    },
    setNotificationsManual: function GdPSvc_setNotificationsManual(value) {
        this._setBoolPref("notificationsManual", value);
    },
    
    getNotificationsSave: function GdPSvc_getNotificationsSave() {
        return this._getBoolPref("notificationsSave");
    },
    setNotificationsSave: function GdPSvc_setNotificationsSave(value) {
        this._setBoolPref("notificationsSave", value);
    },

    getNotificationsStart: function GdPSvc_getNotificationsStart() {
        return this._getBoolPref("notificationsStart");
    },
    setNotificationsStart: function GdPSvc_setNotificationsStart(value) {
        this._setBoolPref("notificationsStart", value);
    }
};

function GroupDAVListAttributes(uri) {
    // dump("GroupDAVListAttributes on uri: " + uri + "\n");
    if (!uri) {
        dump("  stack:\n" + backtrace() + "\n");
    }
    let uriParts = uri.split("/");

    let abManager = Components.classes["@mozilla.org/abmanager;1"]
                              .getService(Components.interfaces.nsIAbManager);
    let ab = abManager.getDirectory(uriParts[0] + "//" + uriParts[2]);

    let prefPrefix = "ldap_2.servers.";
    let uniqueID = (ab.dirPrefId.substr(prefPrefix.length)
                      .replace("_", "", "g")
                    + "_" + uriParts[3].replace("_", "", "g"));
    //this.mPrefs = Components.classes["@mozilla.org/preferences-service;1"]
    //                        .getService(Components.interfaces.nsIPrefBranch);
    this.prefPath = "extensions.ca.inverse.addressbook.groupdav." + uniqueID;
    // dump("*** list: " + this.prefPath + "\n");
}

GroupDAVListAttributes.prototype = {
    _getCharPref: function(key) {
        let value;
        try {
            value = Services.prefs.getCharPref(this.prefPath + "." + key);
        }
        catch(e) {
            value = null;
        }

        // dump(key + ": " + value + "\n");
        return value;
    },
    _setCharPref: function(key, value) {
        // dump("new " + key + ": " + value + "\n");
        Services.prefs.setCharPref(this.prefPath + "." + key, value);
    },

    get key() {
        return this._getCharPref("key");
    },
    set key(newKey) {
        this._setCharPref("key", newKey);
    },

    get version() {
        return this._getCharPref("version");
    },
    set version(newVersion) {
        this._setCharPref("version", newVersion);
    },

    deleteRecord: function() {
        try {
            Services.prefs.deleteBranch(this.prefPath);
        }
        catch(e) {};
    }
};
