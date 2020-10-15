/* sync.addressbook.groupdav.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

//var { contextManagerInstance } = ChromeUtils.import("resource://sogo-connector/components/ContextManager.jsm");
//var { syncProgressManagerInstance } = ChromeUtils.import("resource://sogo-connector/components/SyncProgressManager.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
        .getService(Components.interfaces.mozIJSSubScriptLoader);
  for (let i = 0; i < files.length; i++) {
    try {
      loader.loadSubScript(files[i], target);
    }
    catch(e) {
      //dump("sync.addressbook.groupdav.js: failed to include '" + files[i] +
      //     "'\n" + e
      //     + "\nFile: " + e.fileName
      //    + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
    }
  }
}

//const kNameKey = "groupDavKey";
//const kETagKey = "groupDavVersion";

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://inverse-library/content/uuid.js",
           "chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js",
           "chrome://sogo-connector/content/general/vcards.utils.js"]);

/* pseudo-constants for ctag management:
 server side: fetch ctag + download operations + local ctag update
 client side: fetch ctag + download/upload operations + fetch ctag + local ctag update */
//let SOGOC_UPDATES_NONE = 0;
//let SOGOC_UPDATES_SERVERSIDE = 1;
//let SOGOC_UPDATES_CLIENTSIDE = 2;
//let SOGOC_PROCESS_CARDS = 0;
//let SOGOC_PROCESS_LISTS = 1;
//let SOGOC_PROCESS_FINALIZE = 2;
let SOGOC_SYNC_MANUAL = 0;      // manual sync
let SOGOC_SYNC_WRITE = 1;       // manual save in card from addressbook
let SOGOC_SYNC_PERIODIC = 2;    // periodic sync
let SOGOC_SYNC_STARTUP = 3;     // startup

function loadNotificationsStrings() {
  var SOGO_Notifications_Strings = {};

  let keys = ['notificationsTitle', 'notificationsFailure', 'notificationsFailures', 'notificationsUpload',
              'notificationsUploads', 'notificationsDownload', 'notificationsDownloads', 'notificationsDelete', 
              'notificationsDeletes', 'notificationsNoChanges' ];
  for (let i in keys) {
    let key = keys[i];
    try {
      SOGO_Notifications_Strings[key] = WL.extension.localeData.localizeMessage(key);
    } catch (e) {
      SOGO_Notifications_Strings[key] = key;
    }
  }
  return SOGO_Notifications_Strings;
}

//let sCounter = 0;
// function GroupDavSynchronizer(uri) {
//   if (typeof uri == "undefined" || !uri)
//     throw "Missing 'uri' parameter";
//   if (!isCardDavDirectory(uri)) {
//     throw (uri + " : Specified addressbook cannot be synchronized");
//   }

//   sCounter++;
//   this.mCounter = sCounter;
//   dump("*** new sync: " + this.mCounter + "\n");
//   this.gSelectedDirectoryURI = uri;
//   this.callbackCode = 0;
//   this.callbackFailures = {};
//   this.callback = null;
//   this.callbackData = null;
//   this.context = this.initGroupDAVContext();

//   this.progressMgr = syncProgressManagerInstance;
// }

// GroupDavSynchronizer.prototype = {
//     processMode: SOGOC_PROCESS_CARDS,
//     updatesStatus: SOGOC_UPDATES_NONE,
//     context: null,
//     progressMgr: null,
//     callback: null,
//     callbackCode: 0,
//     callbackFailures: null,
//     callbackData: null,
//     remainingUploads: -1,
//     remainingDownloads: -1,
//     pendingOperations: -1,

//     localCardPointerHash: null,
//     localCardVersionHash: null,    // stores the version no of the local cards
//     localListPointerHash: null,
//     localListVersionHash: null,

//     serverDownloadsCount: 0,
//     serverDownloads: null,
//     serverDeletes: null,

//     gURL: null, /* URL of the ab on the DAV server */
//     gDisplaySyncDialog: null,
//     gSelectedDirectoryURI: null, // gAddressBook to synchronize
//     gAddressBook: null,
//     validCollection: false,     /* is addressbook a vcard-collection? */

//     hasWebdavSync: false,
//     webdavSyncToken: null,

//     initGroupDAVContext: function() {
//       //let handler = Components.classes['@inverse.ca/context-manager;1']
//       //                        .getService(Components.interfaces.inverseIJSContextManager).wrappedJSObject;
//       //let handler = getContextManager();
//       let newContext = contextManagerInstance.getContext("inverse.ca/groupdav/sync-context");

//         if (!newContext.requests)
//             newContext.requests = {};

//         return newContext;
//     },
//     abortOngoingSync: function() {
//       this.initSyncVariables();
//       if (this.context.requests[this.gURL]) {
//         dump("*** a request is already active for url: " + this.gURL + " Abort...\n");
//         this.abort();
//         //alert("Synchronization of address book was aborted.");
//       }
//       else {
//         //alert("Address book is not being synchronized. Nothing to abort.");
//         dump("*** a request not active for url: " + this.gURL + " Nothing to abort.\n");
//       }
//     },
//     start: function() {
//       this.initSyncVariables();
//       if (this.context.requests[this.gURL])
//         dump("*** a request is already active for url: " + this.gURL + "\n");
//       else {
//         dump("  " + this.mCounter + "/sync with " + this.gURL + "...\n");
//         this.context.requests[this.gURL] = true;
//         this.fillServerHashes();
//       }
//     },
//     prefService: function() {
//         let prefId = ((this.gSelectedDirectoryURI
//                        == "jsaddrbook://abook.sqlite")
//                       ? "pab"
//                       : this.gAddressBook.dirPrefId);

//         return new GroupdavPreferenceService(prefId);
//     },
//     initSyncVariables: function() {
//         this.processMode = SOGOC_PROCESS_CARDS;
//         this.updatesStatus = SOGOC_UPDATES_NONE;
//         this.gAddressBook = SCGetDirectoryFromURI(this.gSelectedDirectoryURI);

//         let groupdavPrefService = this.prefService();
//         this.gURL = groupdavPrefService.getURL();
//         this.gCTag = groupdavPrefService.getCTag();
//         this.webdavSyncToken = groupdavPrefService.getWebdavSyncToken();

//         this.localCardVersionHash = {};
//         this.localListVersionHash = {};

//         this.serverDownloadsCount = 0;
//         this.serverDownloads = {};
//         this.serverDeletes = [],

//         this.localUploads = 0;
//         this.localCardUploads = {};
//         this.localListUploads = {};

//         this.localCardPointerHash = {};
//         this.localListPointerHash = {};

//         this.callbackFailures = {};
//     },
//     // Fill the Local Directory data structures for the syncronization
//     fillLocalCardHashes: function() {
//         // dump("  fillLocalCardHashes\n");
//         let uploads = 0;

//         let cards = this.gAddressBook.childCards;
//         // dump("  ab: " + this.gAddressBook + "\n");
//         // dump("  local cards: " + cards + "\n");
//         while (cards.hasMoreElements()) {
//             let card = cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
//             if (!card.isMailList) {
//                 let key = card.getProperty(kNameKey, "");
//                 if (key != "") {
//                     // dump("  existing card '" + card.displayName + "' will be uploaded\n");
//                     this.localCardPointerHash[key] = card;
//                     let version = card.getProperty(kETagKey, "-1");
//                     // dump("  version of candidate card: " + version + "\n");
//                     this.localCardVersionHash[key] = version;
//                     if (version == "-1") {
//                         dump("  card set for upload: " + key + "\n");
//                         this.localCardUploads[key] = card;
//                         uploads++;
//                     }
//                     // dump("xxxx localcard: " + key + "; version: " + version + "\n");
//                 }
//                 else {
//                     // this.dumpCard(card);
//                     dump("  new card '" + card.displayName + "' will be uploaded\n");
//                     key = new UUID() + ".vcf";
//                     card.setProperty(kNameKey, key);
//                     this.localCardUploads[key] = card;
//                     uploads++;
//                 }
//             }
//         }

//         if (uploads > 0) {
//             this.localUploads += uploads;
//             this.updatesStatus |= SOGOC_UPDATES_CLIENTSIDE;
//         }
//     },

//     fillLocalListHashes: function() {
//         //  		dump("fillLocalListHashes\n");
//         let lists = this.gAddressBook.childCards;
//         let uploads = 0;
//         let count = 0;
//         while (lists.hasMoreElements()) {
//             let list = lists.getNext().QueryInterface(Components.interfaces.nsIAbCard);
//             if (list.isMailList) {
//                 count++;
//                 let attributes = new GroupDAVListAttributes(list.mailListURI);
//                 let key = attributes.key;
//                 // dump("  list with key: " + key + "\n");
//                 if (key) {
//                     this.localListPointerHash[key] = list;
//                     this.localListVersionHash[key] = attributes.version;
//                     dump("  found old list: " + key
//                          + "; version: " + attributes.version
//                          + "\n");
//                     if (attributes.version == "-1") {
//                         dump("  list '" + list.displayName + "' will be updated (" + key + ")\n");
//                         this.localListUploads[key] = list;
//                         uploads++;
//                     }
//                 }
//                 else {
//                     dump("  list '" + list.displayName + "' will be added\n");
//                     let key = new UUID() + ".vlf";
//                     this.localListUploads[key] = list;
//                     uploads++;
//                 }
//             }
//         }
//         // dump("  found " + count + " lists\n");

//         if (uploads > 0) {
//             this.localUploads += uploads;
//             this.updatesStatus |= SOGOC_UPDATES_CLIENTSIDE;
//         }
//     },

//     /***********************************************************
//      *
//      * Fills the Server,
//      * LocalUpdate
//      * and Conflict data structures
//      *
//      * for the syncronization
//      *
//      ***********************************************************/
//     fillServerHashes: function() {
//         //dump("fillServerHashes\n");
//         this.pendingOperations = 1;
//         //dump("pendingOperations: " + this.pendingOperations + "\n");
//         let data = {query: "server-check-propfind"};
//         //dump("fillServerHashes (url): " + this.gURL + "\n");
//         let request = new sogoWebDAV(this.gURL, this, data, undefined, true);
//         request.propfind(["DAV: resourcetype", "DAV: supported-report-set",
//                           "http://calendarserver.org/ns/ getctag"], false);
//     },
//     downloadVcards: function() {
//         // dump("  downloadVcards\n");
//         this.remainingDownloads = 0;
//         let hasDownloads = false;

//         for (let key in this.serverDownloads) {
//             let itemDict = this.serverDownloads[key];
//             if (this.isSupportedVCardType(itemDict.type)) {
//                 hasDownloads = true;
//                 let fileUrl = this.gURL + key;
//                 let data = {query: "vcard-download", data: key};
//                 this.remainingDownloads++;
//                 let request = new sogoWebDAV(fileUrl, this, data);
//                 request.get("text/vcard");
//             }
//         }

//         if (!hasDownloads) {
//             //dump("  no download needed\n");
//             this.pendingOperations--;
//             //  			dump("decreasing 1 pendingOperations...\n");
//             this.checkCallback();
//         }
//     },
//     downloadLists: function() {
//         // dump("  downloadLists\n");
//         this.remainingDownloads = 0;
//         let hasDownloads = false;

//         for (let key in this.serverDownloads) {
//             let itemDict = this.serverDownloads[key];
//             if (this.isSupportedVCardListType(itemDict.type)) {
//                 //         dump(key + " is a list to download\n");
//                 hasDownloads = true;
//                 let fileUrl = this.gURL + key;
//                 let data = {query: "list-download", data: key};
//                 this.remainingDownloads++;
//                 let request = new sogoWebDAV(fileUrl, this, data);
//                 request.get("text/vcard");
//             }
//         }

//         if (!hasDownloads) {
//             this.pendingOperations--;
//             //  			dump("decreasing 1 pendingOperations...\n");
//             this.checkCallback();
//         }
//     },
//     onDAVQueryComplete: function(status, response, headers, data) {
//         this.callbackCode = status;
//         dump("request status: " + status + " data.query: " + data.query + "\n");

//         if (data.query == "vcard-download")
//             this.onCardDownloadComplete(status, response, data.data);
//         else if (data.query == "list-download")
//             this.onListDownloadComplete(status, response, data.data);
//         else if (data.query == "server-check-propfind")
//             this.onServerCheckComplete(status, response);
//         else if (data.query == "server-propfind")
//             this.onServerHashQueryComplete(status, response);
//         else if (data.query == "server-sync-query")
//             this.onServerSyncQueryComplete(status, response);
//         else if (data.query == "card-upload")
// 	    this.onCardUploadComplete(status, response, data.key, data.data, headers);
//         else if (data.query == "list-upload")
//             this.onListUploadComplete(status, response, data.key, data.data, headers);
//         else if (data.query == "server-finalize-propfind")
//             this.onServerFinalizeComplete(status, response);
//         else
//             throw("unknown query: " + data.query);
//     },
//     abort: function() {
//         dump("Unacceptable status code: " + this.callbackCode + ". We abort.\n");
//         this.pendingOperations = 0;
//         this.checkCallback();
//     },

//     appendFailure: function(status, data) {
//         let failures = this.callbackFailures[status];
//         if (!failures) {
//             failures = [];
//             this.callbackFailures[status] = failures;
//         }
//         failures.push(data);
//     },

//     onCardDownloadComplete: function(status, data, key) {
//         this.remainingDownloads--;
//         this.progressMgr.updateAddressBook(this.gURL);
//         let pos;
//         if (Components.isSuccessCode(status)
//             && data
//             && ((pos = data.toLowerCase().indexOf("begin:vcard")) >= 0))
//             this.importCard(key, data.substr(pos));
//         else
//             this.appendFailure(status, key);

//         if (this.remainingDownloads == 0) {
//             this.pendingOperations--;
//             //  			dump("decreasing 3 pendingOperations...\n");
//             this.checkCallback();
//         }
//     },
//     onListDownloadComplete: function(status, data, key) {
//         this.remainingDownloads--;
//         this.progressMgr.updateAddressBook(this.gURL);
//         let pos;
//         if (Components.isSuccessCode(status)
//             && data
//             && ((pos = data.toLowerCase().indexOf("begin:vlist")) >= 0))
//             this.importList(key, data.substr(pos));
//         else
//             this.appendFailure(status, key);
//         if (this.remainingDownloads == 0) {
//             this.pendingOperations--;
//             //  			dump("decreasing 4 pendingOperations...\n");
//             this.checkCallback();
//         }
//     },
//     _setCardETagAndLocation: function(card, key, etag, location) {
//         // let mdbCard = card.QueryInterface(Components.interfaces.nsIAbMDBCard);
//         let oldKey = card.getProperty(kNameKey, "");
//         let isNew = (oldKey == "");
//         if (isNew) {
//             if (location && location.length) {
//                 let parts = location[0].split("/");
//                 dump("  replaced old card key: " + key + "\n");
//                 key = parts[parts.length-1];
//             }
//             dump("  new card uploaded with key: " + key + "\n");
//             card.setProperty(kNameKey, String(key));
//         }
//         else {
//             dump("  updated card with key: " + key + "\n");
//         }
//         dump("  uploaded card has etag: " + etag + "\n");
//         card.setProperty(kETagKey, "" + String(etag));
//         this.gAddressBook.modifyCard(card);
//     },

//     _fetchCardETag: function(url) {
//         let etag = null;

//         let target = {
//             onDAVQueryComplete: function(status, response, headers, data) {
//                 if (status > 199 && status < 400) {
//                     let responses = response["multistatus"][0]["response"];
//                     for (let response of responses) {
//                         let href = response["href"][0];
//                         let propstats = response["propstat"];
//                         for (let propstat of propstats) {
//                             if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
//                                 let prop = propstat["prop"][0];
//                                 if (prop["getetag"] && prop["getetag"].length > 0) {
//                                     etag = prop["getetag"][0];
//                                 }
//                             }
//                         }
//                     }
//                 }
//             }
//         };
//         let request = new sogoWebDAV(url, target, null, true, true);
//         request.requestJSONResponse = true;
//         request.propfind(["DAV: getetag"], false);

//         return etag;
//     },

//     onCardUploadComplete: function(status, data, key, card, headers) {
//         // dump("status: " + status + "; data: " + data + "; key: " + key
//         //      + "; card: " + card + "; headers: " + headers + "\n");
//         let cardURL = this.gURL + key;
//         if (status > 199 && status < 400) {
//             let etag = headers["etag"];
//             if (!etag || !etag.length) {
//                 dump("No etag returned vcard at " + cardURL + ", explicit fetch...\n");
//                 etag = this._fetchCardETag(cardURL);
//             }

//             if (etag && etag.length) {
//                 let location = null;
//                 if ("location" in headers) {
//                     location = headers["location"];
//                 }
//                 this._setCardETagAndLocation(card, key, etag, location);
//             }
//             else
//                 dump("No etag returned for vcard uploaded at " + cardURL + ", ignored\n");
//         }
//         else {
//             let console = Components.classes["@mozilla.org/consoleservice;1"]
//                 .getService(Components.interfaces.nsIConsoleService);

// 	    if (status == 412) {
// 		console.logStringMessage("Precondition failed for card: " + cardURL
// 					 + ".\nHTTP Status Code:" + status + "\nRedownloading!");
// 		let data = {query: "vcard-download", data: key};
// 		let itemDict = { etag: headers["etag"], type: "text/vcard" };
// 		this.serverDownloads[key] = itemDict;
// 		this.serverDownloadsCount++;
//                 this.remainingDownloads++;
//                 let request = new sogoWebDAV(cardURL, this, data);
//                 request.get("text/vcard");
// 	    }
// 	    else {
// 		this.appendFailure(status, card);
// 		console.logStringMessage("Upload failure uploading card: " + cardURL
// 					 + ".\nHTTP Status Code:" + status + "\n" + this.cardToString(card));
// 	    }
//             this.localUploads--;
//         }

//         this.progressMgr.updateAddressBook(this.gURL);
//         this.remainingUploads--;
//         if (this.remainingUploads == 0) {
//             this.pendingOperations--;
//             this.checkCallback();
//         }
//     },
//     commitPreferences: function() {
//         let prefService = (Components.classes["@mozilla.org/preferences-service;1"]
//                                      .getService(Components.interfaces.nsIPrefService));
//         prefService.savePrefFile(null);
//     },
//     importCard: function(key, data) {
//         // let vcardFieldsArray = {};  //To handle fbURL from SOGo(freebusy) and vcards fields that have no equivalent in Thunderbird.
//         // vcardFieldsArray["groupDavVcardCompatibility"] = "";

//         if (!this.serverDownloads[key]) {
//             let string = ("Missing card key '" + key + "' from hash"
//                           + " 'this.serverDownloads'.\n"
//                           + "Valid keys are:\n");
//             for (let validKey in this.serverDownloads)
//                 string += "  " + validKey;
//             throw string;
//         }

//         // dump("importCard\n");
//         let card = importFromVcard(data);
//         card.setProperty(kNameKey, String(key));
//         card.setProperty(kETagKey,
//                          String(this.serverDownloads[key].etag));
//         // card.setProperty("groupDavVcardCompatibility",
//         //                  vcardFieldsArray["groupDavVcardCompatibility"]);
//         dump("  received card key: " + key + "\n");
//         if (this.localCardPointerHash[key]) {
//             dump("  existing card\n");

//             /* we must delete the previous photo file to avoid duplicating it
//              with another name */
//             let oldCard = this.localCardPointerHash[key];
//             // dump("  TEST oldCard: "+oldCard+"\n");
//             // dump("  TEST card: "+card+"\n");
//             /* we reset photo properties */
//             let photoName = oldCard.getProperty("PhotoName", "");
//             if (photoName != "") {
//                 deletePhotoFile(photoName, false);
//                 oldCard.deleteProperty("PhotoName");
//             }
//             let photoURL = oldCard.getProperty("PhotoURI", "");
//             if (photoURL != "") {
//                 if (urlIsInSOGoImageCache(photoURL)) {
//                     //for Windows: photoURL == file://C:\Some\path\to\file
//                     var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime);
//                     let parts;
//                     if (appInfo.OS == "WINNT"){
//                         parts = photoURL.split("\\");
//                     } else {
//                         parts = photoURL.split("/");
//                     }
//                     let lastPart = parts[parts.length-1];
//                     if (lastPart != "") 
//                         deletePhotoFile(lastPart, true);
//                 }
//                 oldCard.deleteProperty("PhotoURI");
//             }
//             oldCard.setProperty("PhotoType", "generic");

//             let allOldCardProperties = oldCard.properties;
//             while (allOldCardProperties.hasMoreElements()) {
//                 let prop = allOldCardProperties.getNext().QueryInterface(Components.interfaces.nsIProperty);
//                 let propName = String(prop.name);
//                 /*ignore properties starting with "unprocessed:"*/
//                 if (propName.indexOf("unprocessed:") == 0) {
//                     oldCard.deleteProperty(propName);
//                 }
//                 /*for properties not starting with "unprocessed:" ... */
//                 else
//                 {
//                     // List of all card properties which may be deleted e.g., via web interface
//                     let deleteableProp = [
//                         'HomeAddress'        ,
//                         'WorkCity'           ,
//                         'FaxNumber'          ,
//                         'Company'            ,
//                         'HomeAddress2'       ,
//                         'HomeCity'           ,
//                         'WorkCountry'        ,
//                         'WorkZipCode'        ,
//                         'HomeCountry'        ,
//                         'BirthYear'          ,
//                         'CellularNumber'     ,
//                         'FirstName'          ,
//                         'Notes'              ,
//                         'WorkState'          ,
//                         'LastName'           ,
//                         'HomeState'          ,
//                         'PrimaryEmail'       ,
//                         'BirthDay'           ,
//                         'WebPage2'           ,
//                         'WorkAddress2'       ,
//                         'BirthMonth'         ,
//                         'Categories'         ,
//                         'NickName'           ,
//                         'WorkAddress'        ,
//                         'HomeZipCode',
//                         'WebPage1',
//                         'WorkPhone',
//                         '_AimScreenName',
//                         'PagerNumber',
//                         'SecondEmail',
//                         'HomePhone'
//                         ];
//                     if (deleteableProp.indexOf(propName) == -1) {
//                         dump("  Property "+propName+" is not deletable. Ignore.\n");
//                     }
//                     else
//                     {
//                         /* If property is deleteable, 
//                            search for all properties in new card if current propName is still available.
//                            If not, remove propName from oldCard. */
//                         let allNewCardProperties = card.properties;
//                         let propertyStillAvailable = false;
//                         while (allNewCardProperties.hasMoreElements()) {
//                             let propNew = allNewCardProperties.getNext().QueryInterface(Components.interfaces.nsIProperty);
//                             let propNameNew = String(propNew.name);
//                             if(propName == propNameNew)
//                             {
//                               propertyStillAvailable = true;
//                               dump("  Property "+propName+" still available in new, received card.\n");
//                               break;
//                             }
//                         }
//                         if(propertyStillAvailable == false)
//                         {
//                             dump("  Property "+propName+" NOT available in new, received card. Delete this property...\n");
//                             oldCard.deleteProperty(propName);
//                         }
//                     }
//                 }

//             }
//             /* FIXME or REMOVEME: Is modifyCard really required twice here? */
//             this.gAddressBook.modifyCard(oldCard);

//             oldCard.copy(card);
//             this.gAddressBook.modifyCard(oldCard);
//         } else {
//             dump("  new card\n");
//             this.gAddressBook.addCard(card);
//             this.localCardPointerHash[key] = card;
//             this.localCardVersionHash[key] = card.getProperty(kETagKey, "-1");
//         }
//     },
//     importList: function(key, data) {
//         if (!this.serverDownloads[key]) {
//             let string = ("Missing list key '" + key + "' from hash"
//                           + " 'this.serverDownloads'.\n"
//                           + "Valid keys are:\n");
//             for (let validKey in this.serverDownloads)
//                 string += "  " + validKey;
//             throw string;
//         }

//         let listCard = this.localListPointerHash[key];
//         let abManager = Components.classes["@mozilla.org/abmanager;1"]
//                                   .getService(Components.interfaces.nsIAbManager);
//       let isNew = false;
//       let listDir = null;
//         if (!listCard) {
//             isNew = true;
//             // 			dump("creating local list '" + key + "'\n");
//             let firstListDir = Components.classes["@mozilla.org/addressbook/directoryproperty;1"]
//                                          .createInstance(Components.interfaces.nsIAbDirectory);
//             firstListDir.isMailList = true;
//             let listName = new UUID();
//             firstListDir.dirName = listName;
//             listDir = this.gAddressBook.addMailList(firstListDir);

//             //let sQuery = ("?(and(IsMailList,=,TRUE)(DisplayName,=,"
//             //              + encodeURIComponent(listName) + "))");
//             //let cards = abManager.getDirectory(this.gAddressBook.URI + sQuery)
//             //                      .childCards;
//             //let cards = newList.childCards;
//             //while (cards.hasMoreElements()) {
//             //    listCard = cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
//             //}
//             //if (!listCard) {
//             //    throw "listCard not found for new list";
//            // }
//         }
//         //let listDir = abManager.getDirectory(listCard.mailListURI);
//         if (!listDir) {
//             throw "listDir not found for old list: " + listCard.mailListURI;
//         }
//         let listUpdated = updateListFromVList(listCard, data, this.localCardPointerHash);
//         // dump("listDir.uri: " + listDir.URI
//         //      + "; listCard.uri: " + listCard.mailListURI + "\n");
//         listDir.editMailListToDatabase(listCard);

//         let attributes = new GroupDAVListAttributes(listCard.mailListURI);
//         if (isNew) {
//             attributes.key = key;
//         }
//         attributes.version = (listUpdated ? "-1" : this.serverDownloads[key].etag);
//     },
//     onListUploadComplete: function(status, data, key, list, headers) {
//         let listURL = this.gURL + key;

//         if (status > 199 && status < 400) {
//             let etag = headers["etag"];
//             if (etag && etag.length) {
//                 let attributes = new GroupDAVListAttributes(list.mailListURI);
//                 let oldKey = attributes.key;
//                 let isNew = (!oldKey || oldKey == "");
//                 if (isNew)
//                     attributes.key = key;
//                 attributes.version = etag;
//             }
//             else
//                 dump("  No etag returned for vlist uploaded at " + listURL + ", ignored\n");
//         }
//         else {
//             let console = Components.classes["@mozilla.org/consoleservice;1"]
//                 .getService(Components.interfaces.nsIConsoleService);

//             this.appendFailure(status, list);
//             this.localUploads--;

//             console.logStringMessage("Upload failure uploading list: " + listURL
//                                      + ".\nHTTP Status Code:" + status + "\n" + this.cardToString(list));
//         }

//         this.progressMgr.updateAddressBook(this.gURL);
//         this.remainingUploads--;
//         if (this.remainingUploads == 0) {
//             this.pendingOperations--;
//             this.checkCallback();
//         }
//     },
//     cleanedUpHref: function(origHref) {
//         // href might be something like: http://foo:80/bar while this.gURL might
//         // be something like: http://foo/bar so we strip the port value if the URLs
//         // don't match. eGroupWare sends back such data.

//         let hrefArray = origHref.split("/");
//         let noprefix = false;
//         // 		dump("hrefArray: " + hrefArray + "\n");

//         if (hrefArray[0].substr(0,5) == "https"
//             && hrefArray[2].indexOf(":443") > 0) {
//             hrefArray[2] = hrefArray[2].substring(0, hrefArray[2].length-4);
//         }
//         else if (hrefArray[0].substr(0,4) == "http"
//                  && hrefArray[2].indexOf(":80") > 0) {
//             hrefArray[2] = hrefArray[2].substring(0, hrefArray[2].length-3);
//         } else {
//             noprefix = true;
//         }
//         let href = hrefArray.join("/");

//         // We also check if this.gURL begins with http{s}:// but NOT href. If
//         // that's the case, with servers such as OpenGroupware.org (OGo), we
//         // prepend the relevant part.
//         //
//         // For example, this.gURL could be:
//         // http://foo.bar/zidestore/dav/fred/public/Contacts/
//         // while href is:
//         // /dav/fred/public/Contacts/
//         //
//         if (noprefix && this.gURL.substr(0,4) == "http") {
//             let gURLArray = this.gURL.split("/");
//             href = gURLArray[0] + "//" + gURLArray[2] + href;
//         }

//         // 		dump("Cleaned up href: " + href + "\n");

//         return href;
//     },
//     //
//     // We check for URLs equality. If both HREF aren't identical, we then
//     // compare the host part and the last path component in order to avoid
//     // scenarios where we try to compare:
//     //
//     // http://sogo/SOGo/dav/sogo1/Contacts/personal and http://sogo/SOGo/dav/sogo1@example.com/Contacts/personal
//     //
//     // This is due to (generally) broken configurations in SOGo. Lightning does a similar trick, see:
//     //
//     // http://mxr.mozilla.org/comm-central/source/calendar/providers/caldav/calDavCalendar.js#1028
//     //
//     URLsAreEqual: function(href1, href2) {
//         if (href1 == href2)
//             return true;
        
//         let resPathComponents1 = href1.split("/");
//         let resPathComponents2 = href2.split("/");

//         return ((resPathComponents1[2] == resPathComponents2[2]) &&
//                 (resPathComponents1[resPathComponents1.length-2] == resPathComponents2[resPathComponents2.length-2]));
//     },
//     /* The right way... */
//     _detectWebdavSyncInSupportedReports: function(supportedReports) {
//         let i = 0;
//         while (!this.hasWebdavSync && i < supportedReports.length) {
//             let report = supportedReports[i]["report"];
//             if (report && report.length && report[0]["sync-collection"]) {
//                 this.hasWebdavSync = true;
//             } else {
//                 i++;
//             }
//         }
//     },

//     /* The wrong way, used by SOGO < 1.2 */
//     _detectWebdavSyncInReports: function(reports) {
//         let i = 0;
//         while (!this.hasWebdavSync && i < reports.length) {
//             if (reports[i]["sync-collection"])
//                 this.hasWebdavSync = true;
//             else
//                 i++;
//         }
//     },

//     _detectWebdavSyncInSupportedReportSet: function(reportSet) {
//         if (reportSet && reportSet.length) {
//             let supportedReports = reportSet[0]["supported-report"];
//             if (supportedReports) {
//                 this._detectWebdavSyncInSupportedReports(supportedReports);
//             } else {
//                 let reports = reportSet[0]["report"];
//                 if (reports) {
//                     this._detectWebdavSyncInReports(reports);
//                 }
//             }
//         }
//     },

//     onServerCheckComplete: function(status, jsonResponse) {
//         this.pendingOperations = 0;
        
//         //dump("pendingOperations: " + this.pendingOperations + "\n");
//         //dump("status: " + status + "\n");
//         //dump("jsonResponse: " + jsonResponse + "\n");

//         if (status > 199 && status < 400 && jsonResponse) {
//             let responses = jsonResponse["multistatus"][0]["response"];
//             for (let response of responses) {
//                 let href = response["href"][0];
//                 let propstats = response["propstat"];
//                 for (let propstat of propstats) {
//                     if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
//                         if (href[href.length-1] != '/')
//                             href += '/';
//                         if (href != this.gURL)
//                             href = this.cleanedUpHref(href);

//                         let prop = propstat["prop"][0];
//                         if (this.URLsAreEqual(href,this.gURL)) {
//                             let rsrcType = prop["resourcetype"][0];
//                             if (rsrcType["vcard-collection"]
//                                 || rsrcType["addressbook"]) {
//                                 this.validCollection = true;
//                                 this._detectWebdavSyncInSupportedReportSet(prop["supported-report-set"]);

//                                 /* we "load" the local card keys and etags here */
//                                 this.fillLocalCardHashes();
//                                 this.fillLocalListHashes();

//                                 let newCTag = prop["getctag"];
//                                 if (newCTag && newCTag[0] && newCTag[0] == this.gCTag) {
//                                     dump("  ctag matches or drop operation\n");
//                                     this.processCards();
//                                 }
//                                 else {
//                                     //                   dump("ctag does not match\n");
//                                     this.updatesStatus = SOGOC_UPDATES_SERVERSIDE;
//                                     this.newCTag = newCTag;
//                                     this.checkServerUpdates();
//                                 }
//                             }
//                             else {
//                                 this.validCollection = false;
//                                 this.context.requests[this.gURL] = null;
//                                 this.checkCallback();
//                                 dump("server '" + this.gURL
//                                      + "' is not a valid groupdav collection");
//                             }
//                         } else {
//                             dump("URLs don't match: " + href + " vs. " + this.gURL  + "\n");
//                         }
//                     }
//                 }
//             }
//         } // if (status > 199 && status < 400 && jsonResponse) {
//         else {
//             setTimeout("throw new Error('Address book synchronzation could not contact server.')",0); 
//             this.abort();
//         }
//     },
//     triggerWebDAVSync: function() {
//         let syncQuery = ('<?xml version="1.0"?>'
//                          + '<sync-collection xmlns="DAV:">'
//                          + ((this.webdavSyncToken.length)
//                             ? ('<sync-token>'
//                                + this.webdavSyncToken
//                                + '</sync-token>')
//                             : '<sync-token/>')
//                          + '<prop><getetag/><getcontenttype/></prop>'
//                          + '</sync-collection>');
//         let data = {query: "server-sync-query"};
//         let request = new sogoWebDAV(this.gURL, this, data);
//         request.requestJSONResponse = true;
//         request.report(syncQuery, true);
//     },
//     checkServerUpdates: function() {
//         if (this.hasWebdavSync) {
//             this.triggerWebDAVSync();
//         }
//         else {
//             let data = {query: "server-propfind"};
//             let request = new sogoWebDAV(this.gURL, this, data, undefined, true);
//             request.propfind(["DAV: getcontenttype", "DAV: getetag"]);
//         }
//     },
//     isSupportedVCardType: function(itemType) {
//         //check if contenttype starts with supported types.
//         //this allow extra variables, e.g. in:
//         //  content-type: text/x-vcard; charset=utf-8
//         if (itemType.indexOf("text/x-vcard") == 0 
//               || itemType.indexOf("text/vcard") == 0 ) {
//           return true;
//         }
//         else
//           return false;
//     },
//     isSupportedVCardListType: function(listType) {
//         //check if contenttype starts with supported types.
//         //this allow extra variables, e.g. in:
//         //  content-type: text/x-vlist; charset=utf-8
//         if (listType.indexOf("text/x-vlist") == 0) {
//           return true;
//         }
//         else
//           return false;
//     },
//     isSupportedContentType: function(contType) {
//         //check if contenttype starts with supported types.
//         //this allow extra variables, e.g. in:
//         //  content-type: text/x-vcard; charset=utf-8
//         if (this.isSupportedVCardType(contType)
//               || this.isSupportedVCardListType(contType) ) {
//           return true;
//         }
//         else
//           return false;
//     },
//     onServerHashQueryComplete: function(status, jsonResponse) {
//              dump("onServerHashQueryComplete\n");
//         this.pendingOperations = 0;

//         let reportedKeys = {};

//         if (jsonResponse) {
//             if (status > 199 && status < 400) {
//                 let responses = jsonResponse["multistatus"][0]["response"];
//                 for (let response of responses) {
//                     let href = response["href"][0];
//                     let propstats = response["propstat"];
//                     for (let propstat of propstats) {
//                         if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
//                             let prop = propstat["prop"][0];
//                             if (href != this.gURL) {

// 			      // We make sure getcontenttype is defined. If not defined (for example, if
// 			      // we receive the collection in the response with no getcontenttype (like
// 			      // eGroupware sends over, we just ignore it.
// 			      if (typeof(prop["getcontenttype"]) == "undefined")
// 				continue;

//                                 // If the href ends with a '/' then we have recieved a collection in the response
//                                 // This should be ignored, otherwise we end up with a empty key below.
//                                 // This causes extra address book entries to be created. See Bug: 1411
//                                 if (href.indexOf("/", href.length -1) !== -1)
//                                     continue;

// 			        let contType = prop["getcontenttype"][0];

//                                 if (this.isSupportedContentType(contType)) {
//                                     let version = prop["getetag"][0];
//                                     let keyArray = href.split("/");
//                                     let key = keyArray[keyArray.length - 1];

//                                     reportedKeys[key] = true;

//                                     let itemDict = { etag: version, type: contType };
//                                     if (this.localCardPointerHash[key]
//                                         || this.localListPointerHash[key]) {
//                                         let localVersion = this.localCardVersionHash[key];
//                                         if (!localVersion)
//                                             localVersion = this.localListVersionHash[key];
//                                         /* the local version has precedence over server */
//                                         dump("  local version: " + localVersion + "\n");
//                                         if (localVersion != "-1" && localVersion != version) {
//                                             dump("  added to downloads\n");
//                                             this.serverDownloads[key] = itemDict;
//                                             this.serverDownloadsCount++;
//                                         }
//                                     }
//                                     else {
//                                         dump("[sogo-connector] new card added to downloads: " +
//                                              key + "\n");
//                                         this.serverDownloads[key] = itemDict;
//                                         this.serverDownloadsCount++;
//                                     }
//                                 }
//                                 else {
//                                     dump("unknown content-type: " + contType + "  (ignored)\n");
//                                 }
//                             }
//                         }
//                     }
//                 }

//                 if (this.validCollection) {
//                     /* all keys that were not reported and that were not "modified",
//                      must be deleted. */
//                     for (let key in this.localCardVersionHash) {
//                         let localVersion = this.localCardVersionHash[key];
//                         if (localVersion != "-1" && !reportedKeys[key])
//                             this.serverDeletes.push(key);
//                     }
//                     for (key in this.localListVersionHash) {
//                         let localVersion = this.localListVersionHash[key];
//                         if (localVersion != "-1" && !reportedKeys[key])
//                             this.serverDeletes.push(key);
//                     }
//                     this.processCards();
//                 }
//             }
//             else
//                 this.abort();
//         }
//         else {
//             dump("onServerHashQueryComplete: the server returned an empty response\n");
//             this.abort();
//         }
//     },

//     onServerSyncQueryComplete: function(status, jsonResponse) {
//              dump("onServerSyncQueryComplete\n");
//         this.pendingOperations = 0;

// /*
//  *
//  * old webdav-sync response:

// delete:
// <?xml version="1.0" encoding="utf-8"?>
// <D:multistatus xmlns:D="DAV:">
//   <D:sync-response>
//     <D:href>/SOGo/dav/wsourdeau/Contacts/personal/28C3-4F340280-7-74097C00.vcf</D:href>
//     <D:status>HTTP/1.1 404 Not Found</D:status>
//   </D:sync-response>
//   <D:sync-response>
//     <D:href>/SOGo/dav/wsourdeau/Contacts/personal/28C3-4F340280-9-74097C00.vcf</D:href>
//     <D:status>HTTP/1.1 404 Not Found</D:status>
//   </D:sync-response>
//   <D:sync-token>1328808591</D:sync-token>
// </D:multistatus>

// update:
// <?xml version="1.0" encoding="utf-8"?>
// <D:multistatus xmlns:D="DAV:">
//   <D:sync-response>
//     <D:href>/SOGo/dav/wsourdeau/Contacts/personal/28C3-4F341700-B-74097C00.vcf</D:href>
//     <D:status>HTTP/1.1 200 OK</D:status>
//     <D:propstat>
//       <D:prop>
//         <D:getcontenttype>text/x-vcard</D:getcontenttype>
//         <D:getetag>&quot;gcs00000001&quot;</D:getetag>
//       </D:prop>
//       <D:status>HTTP/1.1 200 OK</D:status>
//     </D:propstat>
//   </D:sync-response>
//   <D:sync-token>1328814961</D:sync-token>
// </D:multistatus>

// new:
// <?xml version="1.0" encoding="utf-8"?>
// <D:multistatus xmlns:D="DAV:">
//   <D:sync-response>
//     <D:href>/SOGo/dav/wsourdeau/Contacts/personal/28C3-4F341B80-F-74097C00.vcf</D:href>
//     <D:status>HTTP/1.1 201 Created</D:status>
//     <D:propstat>
//       <D:prop>
//         <D:getcontenttype>text/x-vcard</D:getcontenttype>
//         <D:getetag>&quot;gcs00000000&quot;</D:getetag>
//       </D:prop>
//       <D:status>HTTP/1.1 200 OK</D:status>
//     </D:propstat>
//   </D:sync-response>
//   <D:sync-token>1328814996</D:sync-token>
// </D:multistatus>

// */


//         if (jsonResponse) {
//             if (status > 199 && status < 400) {

//                 let this_ = this;

//                 /* code common between old and new webdav sync impl */
//                 function handleAddOrModify(key, itemStatus, propstat) {
//                     let prop = propstat["prop"][0];
//                     let contType = prop["getcontenttype"][0];
//                     if (this_.isSupportedContentType(contType)) {
//                         reportedKeys[key] = true;
//                         let version = prop["getetag"][0];
//                         let itemDict = { etag: version, type: contType };
//                         dump("  item: " + key
//                              + "; etag: " + version
//                              + "; type: " + contType
//                              + "; status: " + itemStatus
//                              + "\n");
//                         if (itemStatus == "201") {
//                             /* we won't download "new" cards if we already have them,
//                              otherwise we will end up with duplicated instances. */
//                             if (!(this_.localCardPointerHash[key]
//                                   || this_.localListPointerHash[key])) {
//                                 //                         dump("adopting: " + key + "\n");
//                                 this_.serverDownloads[key] = itemDict;
//                                 this_.serverDownloadsCount++;
//                             }
//                             else {
//                                 let localVersion = this_.localCardVersionHash[key];
//                                 if (!localVersion)
//                                     localVersion = this_.localListVersionHash[key];
//                                 if (!localVersion || localVersion != version) {
//                                     dump("  new card/list " + key
//                                          + " declared as new"
//                                          + " from server, with a local copy but"
//                                          + " with a different version.");
//                                     this_.serverDownloads[key] = itemDict;
//                                     this_.serverDownloadsCount++;
//                                 }
//                                 else
//                                     dump("skipped " + key + "\n");
//                             }
//                         }
//                         else {
//                             let localVersion = this_.localCardVersionHash[key];
//                             if (!localVersion)
//                                 localVersion = this_.localListVersionHash[key];
//                             if (localVersion) {
//                                 /* If the local version already matches the server
//                                  version, we skip its update. */
//                                 dump("  local version: " + localVersion
//                                      + "\n");
//                                 if (localVersion != "-1" && localVersion != version) {
//                                     dump("  added to downloads\n");
//                                     this_.serverDownloads[key] = itemDict;
//                                     this_.serverDownloadsCount++;
//                                 }
//                                 else
//                                     dump("  skipped\n");
//                             }
//                             else {
//                                 /* If the local version of the card doesn't even
//                                  exist, which should never happen, we download the card
//                                  anew. */
//                                 this_.serverDownloads[key] = itemDict;
//                                 this_.serverDownloadsCount++;
//                                 dump("[sogo-connector] a card considered updated"
//                                      + " was not found locally.\n");
//                             }
//                         }
//                     }
//                     else
//                         dump("unknown content-type: " + contType + "  (ignored)\n");
//                 }

//                 let completeSync = (this.webdavSyncToken.length == 0);
//                 let reportedKeys = {};
//                 this.newWebdavSyncToken
//                     = jsonResponse["multistatus"][0]["sync-token"][0];
//                 let responses = jsonResponse["multistatus"][0]["sync-response"];
//                 if (responses) { /* old webdav sync */
//                     for (let response of responses) {
//                         let href = response["href"][0];
//                         let keyArray = href.split("/");
//                         let key = keyArray[keyArray.length - 1];

//                         let itemStatus = response["status"][0].substr(9, 3);
//                         if (itemStatus == "200" || itemStatus == "201") {
//                             let propstats = response["propstat"];
//                             for (let propstat of propstats) {
//                                 let propStatus = propstat["status"][0].substr(9, 3);
//                                 if (propStatus == "200" && href != this.gURL) {
//                                     handleAddOrModify(key, itemStatus, propstat);
//                                 }
//                             }
//                         }
//                         else if (itemStatus == "404") {
//                             if (this.localCardPointerHash[key]
//                                 || this.localListPointerHash[key])
//                                 this.serverDeletes.push(key);
//                         }
//                     }
//                 }
//                 else { /* new webdav sync */
//                   responses = jsonResponse["multistatus"][0]["response"];
//                   if (responses) {
//                     for (let response of responses) {
//                         let href = response["href"][0];
//                         let keyArray = href.split("/");
//                         let key = keyArray[keyArray.length - 1];

//                         let propstats = response["propstat"];
//                         if (propstats) {
//                             for (let propstat of propstats) {
//                                 let statusTag = propstat["status"];
//                                 let itemStatus  = statusTag[0].substr(9, 3);
//                                 if ((itemStatus == "200"
//                                      || itemStatus == "201")
//                                     && href != this.gURL) {
//                                     handleAddOrModify(key, itemStatus, propstat);
//                                 }
//                               // See https://sogo.nu/bugs/view.php?id=4094 - handling
//                               // server-side deletes from ownCloud.
//                               else if (itemStatus == "418" && href != this.gURL) {
//                                 this.serverDeletes.push(key);
//                               }
//                             }
//                         }
//                         else { /* 404 responses are now supposed to occur only
//                                 when no propfind is present. Yet, the "status"
//                                 seems not mandatory so we play it safe
//                                 here. */
//                             let status = response["status"];
//                             if (status && status.length > 0) {
//                                 let itemStatus = response["status"][0].substr(9, 3);
//                                 if (itemStatus == "404") {
//                                     if (this.localCardPointerHash[key]
//                                         || this.localListPointerHash[key])
//                                         this.serverDeletes.push(key);
//                                 }
//                             }
//                         }
//                     } //  for (let response of responses)
//                   } //  if (responses)
//                   else {
//                     dump("Got empty multistatus response.\n");
//                   }
//                 }

//                 if (completeSync) {
//                     for (let key in this.localCardVersionHash) {
//                         let localVersion = this.localCardVersionHash[key];
//                         if (localVersion != "-1" && !reportedKeys[key])
//                             this.serverDeletes.push(key);
//                     }
//                     for (key in this.localListVersionHash) {
//                         let localVersion = this.localListVersionHash[key];
//                         if (localVersion != "-1" && !reportedKeys[key])
//                             this.serverDeletes.push(key);
//                     }
//                 }

//                 if (this.validCollection)
//                     this.processCards();
//             } else {
//                 let syncError = false;
//                 if (this.webdavSyncToken.length
//                     && jsonResponse["error"] && jsonResponse["error"].length) {
//                     let davError = jsonResponse["error"][0];
//                     if (davError["valid-sync-token"].length) {
//                         syncError = true;
//                     }
//                 }
//                 if (status == 403 && syncError) {
//                     dump("[sogo-connector] received 'valid-sync-token' error"
//                          + " code, retrying without a token...\n");
//                     this.webdavSyncToken = "";
//                     this.triggerWebDAVSync();
//                 } else {
//                     this.abort();
//                 }
//             }
//         }
//         else {
//             dump("onServerSyncQueryComplete: the server returned an empty response\n");
//             // We handle a special case : server returns a 403 status but with an empty response.
//             // It is not well defined in RFC how to handle that.
//             // It seems that IceWarp Server wants the client to retry without a token.
//             if (status == 403) {
//                 dump("[sogo-connector] received '403' status"
//                      + ", retrying without a token...\n");
//                 this.webdavSyncToken = "";
//                 this.triggerWebDAVSync();
//             } else {
//                 this.abort();
//             }
//         }
//     },

//     processCards: function() {
//         // 		dump("processCards...\n");
//         let total = (this.localUploads
//                      + this.serverDownloadsCount
//                      + this.serverDeletes.length);
//         if (total > 0)
//             this.progressMgr.registerAddressBook(this.gURL, total);

//         // 		dump("  total: " + total + "\n");
//         // 		dump("  this.updatesStatus: " + this.updatesStatus + "\n");
//         if (this.updatesStatus == SOGOC_UPDATES_CLIENTSIDE) {
//             this.pendingOperations = 1;
//             // 			dump("pendingOperations: " + this.pendingOperations + "\n");
//             this.uploadCards();
//         }
//         else if ((this.updatesStatus & SOGOC_UPDATES_SERVERSIDE)) {
//             this.pendingOperations = 3;
//             // 			dump("pendingOperations: " + this.pendingOperations + "\n");
//             this.downloadVcards(); //asyncronuous
//             this.uploadCards(); //asyncronous
//             this.processCardDeletes();
//         }
//         else
//             this.checkCallback();
//     },
//     uploadCards: function() {
//         // 		dump("uploadCards\n");
//         this.remainingUploads = 0;

//         for (let key in this.localCardUploads) {
//             let card = this.localCardUploads[key]
//                            .QueryInterface(Components.interfaces.nsIAbCard);
//             // let mdbCard = card.QueryInterface(Components.interfaces.nsIAbMDBCard);
//             let vcard = card2vcard(card);
//             if (vcard) {
//                 let cardURL = this.gURL + key;
//                 let data = {query: "card-upload", data: card, key: key};
//                 //         dump("upload new/updated card: " + cardURL + "\n");
//                 this.remainingUploads++;
//                 let request = new sogoWebDAV(cardURL, this, data);
//                 request.put(vcard, "text/vcard; charset=utf-8");
//             }
//             else {
//                 dump("new vcard could not be generated for update\n");
//                 dump("  card: " + card + "\n");
//                 dump("  card.displayName: " + card.displayName + "\n");
//                 dump("  card.primaryEmail: " + card.primaryEmail + "\n");
//                 dump("  card.isMailList: " + card.isMailList + "\n");
//                 this.progressMgr.updateAddressBook(this.gURL);
//             }
//         }

//         if (this.remainingUploads == 0) {
//           this.pendingOperations--;
//             //  			dump("decreasing 11 pendingOperations...\n");
//             this.checkCallback();
//         }
//     },

//     processLists: function() {
//         //     dump("processLists\n");
//         if (this.updatesStatus == SOGOC_UPDATES_CLIENTSIDE) {
//             this.pendingOperations = 1;
//             // 			dump("pendingOperations: " + this.pendingOperations + "\n");
//             this.uploadLists();
//         }
//         else if ((this.updatesStatus & SOGOC_UPDATES_SERVERSIDE)) {
//             this.pendingOperations = 3;
//             // 			dump("pendingOperations: " + this.pendingOperations + "\n");
//             this.downloadLists(); //asyncronuous
//             this.uploadLists(); //asyncronous
//             this.processListDeletes();
//         }
//         else
//             this.checkCallback();
//     },
//     uploadLists: function() {
//         // 		dump("uploadLists\n");
//         this.remainingUploads = 0;

//         for (let key in this.localListUploads) {
//             let vlist = list2vlist(key, this.localListUploads[key]);
//             if (vlist) {
//                 let listURL = this.gURL + key;
//                 // 				dump("upload updated list: " + listURL + "\n");
//                 let data = {query: "list-upload",
//                             data: this.localListUploads[key],
//                             key: key};
//                 this.remainingUploads++;
//                 let request = new sogoWebDAV(listURL, this, data);
//                 request.put(vlist, "text/x-vlist; charset=utf-8");
//             }
//             else {
//                 dump("new vlist could not be generated for update\n");
//                 this.progressMgr.updateAddressBook(this.gURL);
//             }
//         }

//         if (this.remainingUploads == 0) {
//             this.pendingOperations--;
//             //  			dump("decreasing 13 pendingOperations...\n");
//             this.checkCallback();
//         }
//     },

//     processCardDeletes: function() {
//         let deletes = [];
//         for (let key of this.serverDeletes) {
//             if (this.localCardPointerHash[key])
//                 deletes.push(key);
//         }
//         this.deleteCards(deletes);
//         this.pendingOperations--;
//         //  		dump("decreasing 14 pendingOperations...\n");
//         this.checkCallback();
//     },
//     deleteCards: function(deletes) {
//         dump("  " + deletes.length + " card deletes to perform\n");
//         if (deletes.length) {
//             let cards = Components.classes["@mozilla.org/array;1"]
//                                   .createInstance(Components.interfaces.nsIMutableArray);
//             for (let i = 0; i < deletes.length; i++) {
//                 cards.appendElement(this.localCardPointerHash[deletes[i]], false);
//             }

//             // 			dump("delete from : " + this.gSelectedDirectoryURI + "\n");
//             this.gAddressBook.deleteCards(cards);
//         }
//     },
//     processListDeletes: function() {
//         // 		let deleteListStringForTestPurposes = "";
//         //Filling the Server deleted cards Hash

//         for (let key of this.serverDeletes) {
//             let listCard = this.localListPointerHash[key];
//             if (listCard) {
//                 let attributes = new GroupDAVListAttributes(listCard.mailListURI);
//                 attributes.deleteRecord();
//                 /* we commit the preferences here because sometimes Thunderbird will
//                  crash when deleting the real instance of the list. */
//                 this.commitPreferences();
//                 dump("  deleting list: " + key
//                      + "; " + this.localListVersionHash[key] + "\n");

//                 let abManager = Components.classes["@mozilla.org/abmanager;1"]
//                                           .getService(Components.interfaces.nsIAbManager);
//                 abManager.deleteAddressBook(listCard.mailListURI);
//             }
//         }
//         this.pendingOperations--;
//         this.checkCallback();
//     },
//     finalize: function() {
//         //     dump("finalize\n");
//         if ((this.updatesStatus & SOGOC_UPDATES_CLIENTSIDE)) {
//             let data = {query: "server-finalize-propfind"};
//             let request = new sogoWebDAV(this.gURL, this, data, undefined, true);
//             request.propfind(["http://calendarserver.org/ns/ getctag"], false);
//         }
//         else {
//             if (this.updatesStatus == SOGOC_UPDATES_SERVERSIDE) {
//                 let groupdavPrefService = this.prefService();
//                 if (this.newCTag)
//                     groupdavPrefService.setCTag(this.newCTag);
//                 if (this.newWebdavSyncToken) {
//                     dump("saving new sync token: " + this.newWebdavSyncToken + "\n");
//                     groupdavPrefService.setWebdavSyncToken(this.newWebdavSyncToken);
//                 }
//             }
//             this.checkCallback();
//         }
//     },
//     onServerFinalizeComplete: function(status, jsonResponse) {
//         if (status > 199 && status < 400) {
//             let responses = jsonResponse["multistatus"][0]["response"];
//             for (let response of responses) {
//                 let href = response["href"][0];
//                 //  				dump("href: " + href + "\n");
//                 let propstats = response["propstat"];
//                 for (let propstat of propstats) {
//                     if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
//                         if (href[href.length-1] != '/')
//                             href += '/';
//                         if (href != this.gURL)
//                             href = this.cleanedUpHref(href);

//                         let prop = propstat["prop"][0];
//                         if (this.URLsAreEqual(href,this.gURL)) {
//                             let newCTag = prop["getctag"][0];
//                             if (newCTag) {
//                                 let groupdavPrefService = this.prefService();
//                                 groupdavPrefService.setCTag(newCTag);
//                             }
//                         } else {
//                             dump("URLs don't match: " + href + " vs. " + this.gURL + "\n");
//                         }
//                     }
//                 }
//             }

//             this.checkCallback();
//         }
//         else {
//             this.abort();
//         }
//     },
//     checkCallback: function() {
//         //dump("checkCallback:\n");
//         //dump("\n\nthis = " + this.mCounter + "\n");
//         //dump("  this.processMode: " + this.processMode + "\n");
//         //dump("  this.pendingOperations: " + this.pendingOperations + "\n");
//         //dump("  this.updatesStatus: " + this.updatesStatus + "\n");
        
//         if (this.pendingOperations < 0) {
//             this.context.requests[this.gURL] = null;
//             throw "Buggy situation! (pendingOperations < 0)";
//         }

//         if (this.pendingOperations == 0) {
//             //dump("switching processMode " + this.processMode + "!\n");
//             if (this.processMode == SOGOC_PROCESS_CARDS) {
//                 this.processMode = SOGOC_PROCESS_LISTS;
//                 this.processLists();
//             }
//             else if (this.processMode == SOGOC_PROCESS_LISTS) {
//                 this.commitPreferences();
//                 this.processMode = SOGOC_PROCESS_FINALIZE;
//                 this.finalize();
//             }
//             else if (this.processMode == SOGOC_PROCESS_FINALIZE) {
//                 this.commitPreferences();
//                 if (this.callback)
//                     this.callback(this.gURL, this.callbackCode, this.callbackFailures,
//                                   this.callbackData);

//                 let total = (this.localUploads
//                              + this.serverDownloadsCount
//                              + this.serverDeletes.length);
//               if (total > 0) {
//                     // allow a delay before hiding the progressNotification
//                     var that = this;
//                     // FIXME
//                     //window.setTimeout(function() {
//                     //  that.progressMgr.unregisterAddressBook(that.gURL);
//                     //}, 1000);
//                 }
//                 dump("  " + this.mCounter +"/sync with " + this.gURL + " has ended.\n\n");
//                 this.context.requests[this.gURL] = null;
//             }
//             else
//                 throw "Buggy situation (processMode)!";
//         }
//     },

//     // Debug helpers
//     cardToString: function(card) {
//         let s = "  * card properties:\n";
//         let props = card.properties;
//         let count = 0;
//         while (props.hasMoreElements()) {
//             let prop = props.getNext().QueryInterface(Components.interfaces.nsIProperty);
//             s = (s + "  " + count + " prop: " + prop + ";  name: " + prop.name + "; value: " + prop.value + "\n");
//             count++;
//         }
//         s = s + "  * done\n";

//         return s;
//     },
    
//     dumpCard: function(card) {
//         dump(this.cardToString(card));
//     },

//     dumpCardNames: function() {
//         let cards = this.gAddressBook.childCards;
//         dump("  * card list\n");
//         dump("  ab.URI: " + this.gAddressBook.URI + "\n");
//         dump("  ab.isQuery: " + this.gAddressBook.isQuery + "\n");
//         let count = 0;
//         while (cards.hasMoreElements()) {
//             let card = cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
//             dump("  " + count + ") " + card.displayName
//                  +  ": " + card.getProperty("DbRowID", "")
//                  +  ": " + card.getProperty("RecordKey", "")
//                  +  ": " + card.getProperty("LastModifiedDate", "")
//                  + "\n");
//             count++;
//         }
//         dump("  * done\n");
//     },

//     dumpDeletedCards: function() {
//         let cards = this.gAddressBook.QueryInterface(Components.interfaces.nsIAbMDBDirectory).database.deletedCardList;
//         dump("  * " + cards.length + " deleted cards\n");
//         for (let i = 0; i < cards.length; i++) {
//             dump("    card: " + cards.queryElementAt(i, Components.interfaces.nsIAbCard) + "\n");
//         }
//     }
// }; // GroupDavSynchronizer.prototype = {


/*
 * Returns an timer object that handle syncs.
 * He can be used in a timer or as a one-call sync.
 * 
 * params :
 *      uri :   text, the URI of CardDAV addressbook.
 *      ab :    object, the (OPTIONAL) addressbook object.
 *              Depending on the calling chain, it is defined
 *              only for periodic sync.
 *      origin : int
 *              0 : manual sync
 *              1 : manual save in card from addressbook
 *              2 : periodic sync
 *              3 : startup
 */
function GetSyncNotifyGroupdavAddressbook(uri, ab, origin) {
  let notifications = false;
  let notificationsOnlyIfNotEmpty = false;
  let notificationsManual = true;
  let notificationsSave = false;
  let notificationsStart = true;
  let dirName = uri;

  // search addressbook with URI :
  // needed to get :
  //   - ab dirName
  //   - notification prefs
  if (typeof(ab) === 'undefined' || ab === null) {
    ab = false;
    let abManager = Components.classes["@mozilla.org/abmanager;1"]
        .getService(Components.interfaces.nsIAbManager);

    let children = abManager.directories;
    while (children.hasMoreElements()) {
      let ab = children.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);
      if (ab.URI === uri) {
        dirName = ab.dirName;
        let dirPrefId = ab.dirPrefId;                
        let groupdavPrefService = new GroupdavPreferenceService(dirPrefId);
        try {
          notifications = groupdavPrefService.getNotifications();
          notificationsOnlyIfNotEmpty = groupdavPrefService.getNotificationsOnlyIfNotEmpty();
          notificationsManual = groupdavPrefService.getNotificationsManual();
          notificationsSave = groupdavPrefService.getNotificationsSave();
          notificationsStart = groupdavPrefService.getNotificationsStart();
        } catch(e) {
          dump("Exception in GetSyncNotifyGroupdavAddressbook(): " + e + "\n");
        }
      }
    }
  } else {
    dirName = ab.dirName;
    let dirPrefId = ab.dirPrefId;
    let groupdavPrefService = new GroupdavPreferenceService(dirPrefId);
    try {
      notifications = groupdavPrefService.getNotifications();
      notificationsOnlyIfNotEmpty = groupdavPrefService.getNotificationsOnlyIfNotEmpty();            
      notificationsManual = groupdavPrefService.getNotificationsManual();
      notificationsSave = groupdavPrefService.getNotificationsSave();
      notificationsStart = groupdavPrefService.getNotificationsStart();
    } catch(e) {
      dump("Exception in GetSyncNotifyGroupdavAddressbook(): " + e + "\n");
    }
  }
  if (typeof(origin) === 'undefined') {
    origin = SOGOC_SYNC_MANUAL;
  }

  var sync = {
    URI : uri,
    dirName : dirName,
    origin : origin,
    notifications : notifications,
    notificationsOnlyIfNotEmpty : notificationsOnlyIfNotEmpty,
    notificationsManual : notificationsManual,
    notificationsSave : notificationsSave,
    notificationsStart : notificationsStart,
    notificationsStrings : loadNotificationsStrings(),
    
    notify: function() {
      Services.obs.addObserver(this.abSynchronizeCallback.bind(this), "addrbook-directory-synced");
      let book = MailServices.ab.getDirectory(this.URI);
      let dir = CardDAVDirectory.forFile(book.fileName);
      dir.updateAllFromServer();
    },

    abSynchronizeCallback: function (ab, topic) {
      dump("Addressbook synchronize callback for: " + ab.dirName);
      let title = "";
      let content = "Synchronization completed for: " + ab.dirName;
      let alertService = Components.classes['@mozilla.org/alerts-service;1']
          .getService(Components.interfaces.nsIAlertsService);

      switch (this.origin) {
      case SOGOC_SYNC_MANUAL:
        if (this.notificationsManual)
          alertService.showAlertNotification(null, title, content, false, '', null);
        break;

      case SOGOC_SYNC_WRITE:
        if (this.notificationsSave)
          alertService.showAlertNotification(null, title, content, false, '', null);
        break;

      case SOGOC_SYNC_PERIODIC:
        if (this.notifications)
          alertService.showAlertNotification(null, title, content, false, '', null);
        break;

      case SOGOC_SYNC_STARTUP:
        if (this.notificationsStart)
          alertService.showAlertNotification(null, title, content, false, '', null);
        break;
      }
      
      Services.obs.removeObserver(this.abSynchronizeCallback, "addrbook-directory-synced");
    },
  }

  return sync;
}
  

function SynchronizeGroupdavAddressbook(uri, ab, origin) {
  var sync = GetSyncNotifyGroupdavAddressbook(uri, ab, origin);
  sync.notify();
}

// function SynchronizeGroupdavAddressbookAbort(uri) {
//     let synchronizer = new GroupDavSynchronizer(uri);
//     synchronizer.abortOngoingSync();
// }
