/* preferences.addressbook.groupdav.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2020
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

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("preferences.addressbook.groupdav.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js",
           "chrome://inverse-library/content/sogoWebDAV.js",
	   "chrome://sogo-connector/content/global/sogo-config.js"]);

var WL = null;

function SCGetCurrentDirectory() {
    let directory = null;

    if (window.arguments.length > 0) {
        let args = window.arguments[2];
        if (args) {
            directory = args.selectedDirectory;
        }
    }

    return directory;
}

function onAccept() {
  // There has to be at least a description to create a SOGo addressbook
  let description = document.getElementById("description").value;
  if (!description || description == "") {
    alert(WL.extension.localeData.localizeMessage("missingDescriptionMsg"));
    return false;
  }

  let url = document.getElementById("groupdavURL").value;
  if (!url || url == "") {
    alert(WL.extension.localeData.localizeMessage("missingDescriptionURL"));
    return false;
  }

  //let readOnly = document.getElementById("readOnly").checked;
  //if (readOnly) {
  //  onAcceptCardDAV();
  //}
  //else {
  onAcceptWebDAV();
  //}

  let prefService = (Components.classes["@mozilla.org/preferences-service;1"]
                     .getService(Components.interfaces.nsIPrefService));
  prefService.savePrefFile(null);

  return true;
}

// function onAcceptCardDAV() {
//     let description = document.getElementById("description").value;

//     let directory = SCGetCurrentDirectory();
//     if (directory) {
//         directory.dirName = description;
//     }
//     else {
//         let url = document.getElementById("groupdavURL").value;
//         SCCreateCardDAVDirectory(description, url);
//     }
// }

function onAcceptWebDAV() {
  let description = document.getElementById("description").value;
  let directory = SCGetCurrentDirectory();
  let prefId = directory.dirPrefId;
  
  // if (directory && directory.dirPrefId.length > 0) {
  //     directory.dirName = description;
  //     prefId = directory.dirPrefId;
  // }
  // else {
  //   // adding a new Addressbook
  //   let abMgr = Components.classes["@mozilla.org/abmanager;1"]
  //       .getService(Components.interfaces.nsIAbManager);
  //   prefId = abMgr.newAddressBook(description, null, 101)
  // }

  try {
    let groupdavPrefService = new GroupdavPreferenceService(prefId);
    //groupdavPrefService.setURL(document.getElementById("groupdavURL").value);
    
    groupdavPrefService.setPeriodicSync(document.getElementById("periodicSync").checked);
    groupdavPrefService.setPeriodicSyncInterval(document.getElementById("periodicSyncInterval").value);

    groupdavPrefService.setNotifications(document.getElementById("notifications").checked);
    groupdavPrefService.setNotificationsOnlyIfNotEmpty(document.getElementById("notificationsOnlyIfNotEmpty").checked);

    groupdavPrefService.setNotificationsManual(document.getElementById("notificationsManual").checked);
    groupdavPrefService.setNotificationsSave(document.getElementById("notificationsSave").checked);
    groupdavPrefService.setNotificationsStart(document.getElementById("notificationsStart").checked);
  } catch(e) {
    dump("preferences.addressbook.groupdav.js: " + e + "\n");
  }
}

function onLoad() {
  dump("preferences.addressbook.groupdav.js: onLoad()\n");
  
  WL = window.arguments[1];
  
  let description = "";
  let url = "";
  let periodicSync = false;
  let periodicSyncInterval = 15;
  let notifications = true;
  let notificationsOnlyIfNotEmpty = false;
  let notificationsManual = true;
  let notificationsSave = false;
  let notificationsStart = true;

  let directory = SCGetCurrentDirectory();
  url = directory.getStringValue("carddav.url", "");
  
  if (directory) {
    let readOnly = directory.getBoolValue("readOnly", false);
    let roElem = document.getElementById("readOnly");
    roElem.setAttribute("checked", readOnly);
    roElem.disabled = true;
  
    //if (readOnly) {
    description = directory.dirName;
    //  directory = directory.wrappedJSObject;
     // url = directory.serverURL;
      // }

    try {
      let groupdavPrefService = new GroupdavPreferenceService(directory.dirPrefId);
      //description = directory.dirName;
      //url = groupdavPrefService.getURL();
      
      periodicSync = groupdavPrefService.getPeriodicSync();
      periodicSyncInterval = groupdavPrefService.getPeriodicSyncInterval();
      
      notifications = groupdavPrefService.getNotifications();
      notificationsOnlyIfNotEmpty = groupdavPrefService.getNotificationsOnlyIfNotEmpty();            
      notificationsManual = groupdavPrefService.getNotificationsManual();
      notificationsSave = groupdavPrefService.getNotificationsSave();
      notificationsStart = groupdavPrefService.getNotificationsStart();
    } catch(e) {
      dump("preferences.addressbook.groupdav.js: " + e + "\n");
    }
  }

  // always define values
  document.getElementById("description").value = description;
  document.getElementById("groupdavURL").value = url;

  document.getElementById("periodicSync").checked = periodicSync;
  document.getElementById("periodicSyncInterval").value = periodicSyncInterval;
    
  document.getElementById("notifications").checked = notifications;
  document.getElementById("notificationsOnlyIfNotEmpty").checked = notificationsOnlyIfNotEmpty;
  document.getElementById("notificationsManual").checked = notificationsManual;
  document.getElementById("notificationsSave").checked = notificationsSave;
  document.getElementById("notificationsStart").checked = notificationsStart;

  onUpdateCheck();

  if (window.arguments && window.arguments[2]) {
    folderURL = document.getElementById("groupdavURL").value;
    originalName = document.getElementById("description").value;
  }
}

function onUpdateCheck() {
  var psc = document.getElementById("periodicSync").checked;
  var nc = document.getElementById("notifications").checked;
  document.getElementById("periodicSyncInterval").disabled = !psc;    
  document.getElementById("notifications").disabled = !psc;
  //document.getElementById("notificationsOnlyIfNotEmpty").disabled = !nc || !psc;
}

function onShowRestart() {
    // show the info about restart
    document.getElementById("periodicSync_restart").hidden = false;
}

//TODO:catch the directory delete and delete preferences

// From SOGo Integrator
var folderURL = "";
var originalName = "";

function onOverlayAccept() {
  var rc;

  var newFolderURL = document.getElementById("groupdavURL").value;
  var newName = document.getElementById("description").value;
  if (newFolderURL.indexOf(sogoBaseURL()) > -1
      && newFolderURL == folderURL
      && newName != originalName) {
    var proppatch = new sogoWebDAV(newFolderURL,
				   new renameTarget(this), undefined, undefined, true);
    proppatch.proppatch("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
			+ "<propertyupdate xmlns=\"DAV:\">"
			+ "<set>"
			+ "<prop><displayname>" + xmlEscape(newName)
			+ "</displayname>"
			+ "</prop></set></propertyupdate>");
    rc = false;
  }
  else
    rc = onAccept();

  return rc;
}

function renameTarget(dlg) {
  this.dialog = dlg;
}

renameTarget.prototype = {
 onDAVQueryComplete: function(status, jsonResult) {
   var correct = false;

   if (status == 207) {
     var responses = jsonResult["multistatus"][0]["response"];
     var response = responses[0];
     var url = response["href"][0];
     if (this.dialog.folderURL.indexOf(url) > -1) {
       propstat = response["propstat"][0];
       if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
	 if (propstat["prop"][0]["displayname"]) {
	   if (onAccept())
	     setTimeout("window.close();", 200);
	   }
       }
     }
   }
   else {
     var strBundle = document.getElementById("preferencesMessages");
     window.alert(WL.extension.localeData.localizeMessage("serverUpdateFailed") + "\n" + status);
   }
 }
};

document.addEventListener("dialogaccept", function(event) {
  onOverlayAccept();
});

window.addEventListener("load", onLoad, false);
