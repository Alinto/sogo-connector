/* addressbook.groupdav.overlay.js - This file is part of "SOGo Connector".
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
var { notificationManagerInstance } = ChromeUtils.import("resource://sogo-connector/components/NotificationManager.jsm");
var { syncProgressManagerInstance } = ChromeUtils.import("resource://sogo-connector/components/SyncProgressManager.jsm");

var _this = this;

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            //dump("addressbook.groupdav.overlay.js: failed to include '" + files[i] +
            //     "'\n" + e);
            //if (e.fileName)
            //    dump ("\nFile: " + e.fileName
            //          + "\nLine: " + e.lineNumber
            //          + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-connector/content/addressbook/categories.js",
           "chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://sogo-connector/content/global/sogo-config.js",
	   "chrome://sogo-connector/content/addressbook/folder-handler.js",
	   "chrome://sogo-connector/content/general/creation-utils.js",
	   "chrome://sogo-connector/content/messenger/folders-update.js"], _this);

jsInclude(["chrome://sogo-connector/content/general/subscription-utils.js"], window);

function i18n(entity) {
  let msg = entity.slice(1,-1);

  return WL.extension.localeData.localizeMessage(msg);
} 

let gSelectedDir = "";
let gCurDirectory = null;
let gLDAPPrefsService = null;
let deleteCmdLabel = "";

function openGroupdavPreferences(directory) {
  window.openDialog("chrome://sogo-connector/content/addressbook/preferences.addressbook.groupdav.xhtml",
                    "", "chrome,modal=yes,resizable=no,centerscreen",
                    _this,
                    WL,
                    {selectedDirectory: directory});
}

function SCOpenDeleteFailureDialog(directory) {
  window.openDialog("chrome://sogo-connector/content/addressbook/deletefailure-dialog.xhtml",
                    "", "chrome,modal=yes,resizable=no,centerscreen",
                    _this,
                    WL,
                    {directory: directory});
}

function SCGoUpdateGlobalEditMenuItems() {
  try {
    gSelectedDir = GetSelectedDirectory();
    //  		dump("SCGoUpdateGlobalEditMenuItems\n  gSelectedDir" + gSelectedDir + "\n");
    window.goUpdateCommand("cmd_syncGroupdav");
    this.SCGoUpdateGlobalEditMenuItemsOld();
  }
  catch (e) {
    //		exceptionHandler(window,"Error",e);
  }
}

function SCCommandUpdate_AddressBook() {
  try {
    gSelectedDir = GetSelectedDirectory();
    //  		dump("SCCommandUpdate_AddressBook  gSelectedDir" + gSelectedDir + "\n");
    window.goUpdateCommand('cmd_syncGroupdav');
    this.SCCommandUpdate_AddressBookOld();
  }
  catch (e) {
    //		exceptionHandler(window,"Error",e);
  }
}

function SCGoUpdateSelectEditMenuItems() {
  try {
    gSelectedDir = GetSelectedDirectory();
    //  		dump("SCGoUpdateSelectEditMenuItems  gSelectedDir" + gSelectedDir + "\n");
    window.goUpdateCommand('cmd_syncGroupdav');
    this.SCGoUpdateSelectEditMenuItemsOld();
  }
  catch (e) {
    //		exceptionHandler(window,"Error",e);
  }
}

// Additionnal Controller object for Dir Pane
function dirPaneControllerOverlay() {
}

dirPaneControllerOverlay.prototype = {
  supportsCommand: function(command) {
    return (command == "cmd_syncGroupdav");
  },

  isCommandEnabled: function(command) {
    let result = false;

        // 		dump("isCommandEnabled\n  command: " + command + "\n");

    if (gSelectedDir && gSelectedDir != "") {
      try {
        switch (command) {
        case "cmd_syncGroupdav":
          result = isCardDavDirectory(gSelectedDir);
          break;
        }
      }
      catch (e) {
        exceptionHandler(window,"Exception",e);
      }
    }

    return result;
  },

  doCommand: function(command){
    dump("Unexpected doCommand: " + command + "\n");
    throw("Unexpected doCommand: " + command);
  },
  
  onEvent: function(event) {}
};

function SCAbEditSelectedDirectory() {
  let abUri = window.GetSelectedDirectory();
  if (isCardDavDirectory(abUri)) {
    let directory = SCGetDirectoryFromURI(abUri);
    openGroupdavPreferences(directory);
  }
  else {
    _this.SCAbEditSelectedDirectoryOriginal();
  }
}

// let deleteManager = {
//     mCount: 0,
//     mErrors: 0,
//     mDirectory: null,
//     begin: function(directory, count) {
//         this.mDirectory = directory;
//         this.mCount = count;
//         this.mErrors = 0;
//     },
//     decrement: function(code) {
//         this.mCount--;
//         if (!((code > 199 && code < 400)
//             || code == 404
//               || code > 599))
//             this.mErrors++;

//         return (this.mCount == 0);
//     },
//     finish: function() {
//         if (this.mErrors != 0)
//             SCOpenDeleteFailureDialog(this.mDirectory);
//         this.mDirectory = null;
//     },
//     onDAVQueryComplete: function(code, result, headers, data) {
//         // 		dump("on davquerycompplete\n");
//         if (data.deleteLocally
//             && ((code > 199 && code < 400)
//                 || code == 404
//                 || code == 604)) {
//             // 			dump("code: " + code + "\n");
//             if (data.component.isMailList) {
//                 // 				dump("deleting list\n");
//                 let mailListURI = ((data.component
//                                     instanceof Components.interfaces.nsIAbCard)
//                                    ? data.component.mailListURI
//                                    : data.component.URI);
//                 let attributes = new GroupDAVListAttributes(mailListURI);
//                 attributes.deleteRecord();
//                 /* we commit the preferences here because sometimes Thunderbird will
//                  crash when deleting the real instance of the list. */
//                 let prefService = (Components.classes["@mozilla.org/preferences-service;1"]
//                                              .getService(Components.interfaces.nsIPrefService));
//                 prefService.savePrefFile(null);

//                 let listDirectory = SCGetDirectoryFromURI(mailListURI);
//                 data.directory.deleteDirectory(listDirectory);
//                 //gAbView.deleteSelectedCards();
//             }
//             else {
//                 let cards = Components.classes["@mozilla.org/array;1"]
//                                       .createInstance(Components.interfaces.nsIMutableArray);
//                 cards.appendElement(data.component, false);
//                 data.directory.deleteCards(cards);
//             }
//         }
//         if (this.decrement(code))
//             this.finish();
//     }
// };

// function DeleteGroupDAVCards(directory, cards, deleteLocally) {
//     dump("delete: " + cards.length + " cards\n");
//     let mdbDirectory = SCGetDirectoryFromURI(directory);
//     let prefService = new GroupdavPreferenceService(mdbDirectory.dirPrefId);

//     deleteManager.begin(directory, cards.length);
//     for (let i = 0; i < cards.length; i++) {
//         let card = cards[i].QueryInterface(Components.interfaces.nsIAbCard);
//         let key;
//         if (card.isMailList) {
//             let attributes = new GroupDAVListAttributes(card.mailListURI);
//             key = attributes.key;
//         }
//         else {
//             try {
//                 key = card.getProperty("groupDavKey", null);
//             }
//             catch(e) {
//                 key = null;
//             }
//         }

//         dump("  card to delete: '" + card.displayName + "'\n");
//         dump("    key: '" + key + "'\n");

//         _deleteGroupDAVComponentWithKey(prefService, key, mdbDirectory, card, deleteLocally);
//     }
// }

// function _deleteGroupDAVComponentWithKey(prefService,
//                                          key,
//                                          directory,
//                                          component,
//                                          deleteLocally) {
//     dump("\n\nwe delete: " + key + " with deleteLocally="+deleteLocally+"\n\n\n");
//     if (key && key.length) {
//         let href = prefService.getURL() + key;
//         let deleteOp = new sogoWebDAV(href, deleteManager,
//                                       {directory: directory,
//                                        component: component,
//                                        deleteLocally: deleteLocally});
//         deleteOp.delete();
//         dump("webdav_delete on '" + href + "'\n");
//         // force full sync on next sync by invalidating cTag.
//         // This way, if server does not delete contact correctly (e.g. write permission denied)
//         // the contact will reappear on next synchronization.
//         prefService.setCTag("invalid");
//     }
//     else /* 604 = "not found locally" */
//         deleteManager.onDAVQueryComplete(604, null, null,
//                                          {directory: directory,
//                                           deleteLocally: true,
//                                           component: component});
// }

// function SCAbConfirmDelete(types) {
//   let confirm = false;

//   if (types != kNothingSelected) {
//     // Determine strings for smart and context-sensitive user prompts
//     // for confirming deletion.
//     let confirmDeleteTitleID;
//     let confirmDeleteTitle;
//     let confirmDeleteMessageID;
//     let confirmDeleteMessage;
//     let itemName;
//     let containingListName;
//     let selectedDir = getSelectedDirectory();
//     let numSelectedItems = gAbView.selection.count;

//     switch(types) {
//     case kListsAndCards:
//       confirmDeleteMessageID = "confirmDelete2orMoreContactsAndLists";
//       confirmDeleteTitleID   = "confirmDelete2orMoreContactsAndListsTitle";
//       break;
//     case kSingleListOnly:
//       // Set item name for single mailing list.
//       let theCard = GetSelectedAbCards()[0];
//       itemName = theCard.displayName;
//       confirmDeleteMessageID = "confirmDeleteThisMailingList";
//       confirmDeleteTitleID   = "confirmDeleteThisMailingListTitle";
//       break;
//     case kMultipleListsOnly:
//       confirmDeleteMessageID = "confirmDelete2orMoreMailingLists";
//       confirmDeleteTitleID   = "confirmDelete2orMoreMailingListsTitle";
//       break;
//     case kCardsOnly:
//       if (selectedDir.isMailList) {
//         // Contact(s) in mailing lists will be removed from the list, not deleted.
//         if (numSelectedItems == 1) {
//           confirmDeleteMessageID = "confirmRemoveThisContact";
//           confirmDeleteTitleID = "confirmRemoveThisContactTitle";
//         } else {
//           confirmDeleteMessageID = "confirmRemove2orMoreContacts";
//           confirmDeleteTitleID   = "confirmRemove2orMoreContactsTitle";
//         }
//         // For removing contacts from mailing list, set placeholder value
//         containingListName = selectedDir.dirName;
//       } else {
//         // Contact(s) in address books will be deleted.
//         if (numSelectedItems == 1) {
//           confirmDeleteMessageID = "confirmDeleteThisContact";
//           confirmDeleteTitleID   = "confirmDeleteThisContactTitle";
//         } else {
//           confirmDeleteMessageID = "confirmDelete2orMoreContacts";
//           confirmDeleteTitleID   = "confirmDelete2orMoreContactsTitle";
//         }
//       }
//       if (numSelectedItems == 1) {
//         // Set item name for single contact.
//         let theCard = GetSelectedAbCards()[0];
//         let nameFormatFromPref = Services.prefs.getIntPref("mail.addr_book.lastnamefirst");
//         itemName = theCard.generateName(nameFormatFromPref);
//       }
//       break;
//     }

//     // Get the raw model strings.
//     // For numSelectedItems == 1, it's simple strings.
//     // For messages with numSelectedItems > 1, it's multi-pluralform string sets.
//     // confirmDeleteMessage has placeholders for some forms.
//     confirmDeleteTitle   = WL.extension.localeData.localizeMessage(confirmDeleteTitleID);
//     confirmDeleteMessage = WL.extension.localeData.localizeMessage(confirmDeleteMessageID);

//     // Get plural form where applicable; substitute placeholders as required.
//     if (numSelectedItems == 1) {
//       // If single selected item, substitute itemName.
//       confirmDeleteMessage = confirmDeleteMessage.replace("#1", itemName);
//     } else {
//       // If multiple selected items, get the right plural string from the
//       // localized set, then substitute numSelectedItems.
//       confirmDeleteMessage = PluralForm.get(numSelectedItems, confirmDeleteMessage);
//       confirmDeleteMessage = confirmDeleteMessage.replace("#1", numSelectedItems);
//     }
//     // If contact(s) in a mailing list, substitute containingListName.
//     if (containingListName)
//       confirmDeleteMessage = confirmDeleteMessage.replace("#2", containingListName);

//     // Finally, show our smart confirmation message, and act upon it!
//     confirm = Services.prompt.confirm(window, confirmDeleteTitle,
//                                       confirmDeleteMessage);
//   }

//   return confirm;
// }

// function SCAbDelete() {
//     let deletePerformed = false;

//     if (gSelectedDir) {
//         if (isGroupdavDirectory(gSelectedDir)) {
//             let types = GetSelectedCardTypes();
//             if (types != kNothingSelected) {
//                 let confirm = SCAbConfirmDelete(types);
//                 if (!confirm)
//                     return;
//                 else {
//                     let cards = GetSelectedAbCards();
//                     // let abView = GetAbView();
//                     DeleteGroupDAVCards(gSelectedDir, cards, true);
//                     deletePerformed = true;
//                 }
//             }
//         }
//         else if (gSelectedDir.search("mab/MailList") > -1) {
//             let parentURI = GetParentDirectoryFromMailingListURI(gSelectedDir);
//             if (isGroupdavDirectory(parentURI)) {
//                 let list = SCGetDirectoryFromURI(gSelectedDir);
//                 let cards = GetSelectedAbCards();
//                 let xpcomArray = Components.classes["@mozilla.org/array;1"]
//                                            .createInstance(Components.interfaces.nsIMutableArray);
//                 for (let i = 0; i < cards.length; i++) {
//                     xpcomArray.appendElement(cards[i], false);
//                 }
//                 list.deleteCards(xpcomArray);
//                 let attributes = new GroupDAVListAttributes(gSelectedDir);
//                 attributes.version = "-1";
//                 SynchronizeGroupdavAddressbook(parentURI);
//                 deletePerformed = true;
//             }
//         }
//     }

//     if (!deletePerformed) {
//         this.SCAbDeleteOriginal();
//     }
// }

/* AbDeleteDirectory done cleanly... */
function SCAbDeleteDirectory(aURI) {
  let result = false;

  dump("SCAbDeleteDirectory: aURI: " + aURI + "\n");
  dump("  backtrace:\n" + backtrace() + "\n\n");

  if (isCardDavDirectory(aURI)) {
    // || isCardDavDirectory(selectedDir)) {
    // 			dump("pouet\n");
    result = (SCAbConfirmDeleteDirectory(aURI)
              && SCDeleteDAVDirectory(aURI));
  }
  else {
    // 			dump("pouet dasdsa\n");
    let directory = SCGetDirectoryFromURI(aURI);
    if (!(directory.isMailList
          && _SCDeleteListAsDirectory(directory, aURI)))
      window.SCAbDeleteDirectoryOriginal(aURI);
  }
}

function _SCDeleteListAsDirectory(directory, selectedDir) {
    let result = false;

    // 	dump("_SCDeleteListAsDirectory\n");
    let uriParts = selectedDir.split("/");
    let parentDirURI = uriParts[0] + "//" + uriParts[2];
    if (isGroupdavDirectory(parentDirURI)) {
        // 		dump("_SCDeleteListAsDirectory 2\n");
        let attributes = new GroupDAVListAttributes(directory.URI);
        if (attributes.key) {
            // 			dump("_SCDeleteListAsDirectory 3\n");

            result = true;
            if (SCAbConfirmDelete(kSingleListOnly)) {
                // 				dump("_SCDeleteListAsDirectory 4\n");
                let parentDir = SCGetDirectoryFromURI(parentDirURI);
                let prefService = new GroupdavPreferenceService(parentDir.dirPrefId);
                deleteManager.begin(parentDirURI, 1);
                _deleteGroupDAVComponentWithKey(prefService, attributes.key,
                                                parentDir, directory, true);
            }
        }
    }

    return result;
}

function SCAbConfirmDeleteDirectory(selectedDir) {
  let confirmDeleteTitle;
  let confirmDeleteMessage;
  let directory = window.GetDirectoryFromURI(selectedDir);

  // Check if this address book is being used for collection
  if (Services.prefs.getCharPref("mail.collect_addressbook") == selectedDir
      && (Services.prefs.getBoolPref("mail.collect_email_address_outgoing")
          || Services.prefs.getBoolPref("mail.collect_email_address_incoming")
          || Services.prefs.getBoolPref("mail.collect_email_address_newsgroup"))) {
    let brandShortName = document.getElementById("bundle_brand").getString("brandShortName");
    confirmDeleteTitle = window.gAddressBookBundle.getString("confirmDeleteThisCollectionAddressbook");
    confirmDeleteMessage = confirmDeleteMessage.replace("#2", brandShortName);
  }
  else {
    confirmDeleteTitle = window.gAddressBookBundle.getString("confirmDeleteThisAddressbookTitle");
    confirmDeleteMessage = window.gAddressBookBundle.getString("confirmDeleteThisAddressbook");
  }

  confirmDeleteMessage = confirmDeleteMessage.replace("#1", directory.dirName);

  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);

  return (promptService.confirm(window,
                                confirmDeleteTitle,
                                confirmDeleteMessage));
}

function SCSynchronizeFromChildWindow(uri) {
    this.setTimeout(SynchronizeGroupdavAddressbook, 1, uri, null, 1);
}

let groupdavSynchronizationObserver = {
    oldPC: -1,
    syncManager: null,

    _createProgressBar: function() {
        let progressBar = document.createXULElement("progressmeter");
        progressBar.setAttribute("id", "groupdavProgressMeter");
        progressBar.setAttribute("mode", "determined");
        progressBar.setAttribute("value", "0%");

        return progressBar;
    },
    ensureProgressBar: function() {
        // 		dump("document: " + document + "\n");
        // 		dump("window: " + window + "\n");
        // 		dump("window.title: " + window.title + "\n");
        // 		dump("window.document: " + window.document + "\n");
        let progressBar = this._createProgressBar();
        let panel = document.getElementById("groupdavProgressPanel");
        panel.appendChild(progressBar);
        panel.setAttribute("collapsed", false);

        return progressBar;
    },
    handleNotification: function(notification, data) {
        let progressBar = document.getElementById("groupdavProgressMeter");
        if (notification == "groupdav.synchronization.start") {
            if (!progressBar)
                this.ensureProgressBar();
        }
        else if (notification == "groupdav.synchronization.stop") {
            if (progressBar) {
                let panel = document.getElementById("groupdavProgressPanel");
                panel.removeChild(progressBar);
                panel.setAttribute("collapsed", true);
            }
        }
        else if (notification == "groupdav.synchronization.addressbook.updated") {
            if (!progressBar)
                progressBar = this.ensureProgressBar();
            let pc = Math.floor(this.syncManager.globalProgress() * 100);
            if (this.oldPC != pc) {
                window.setTimeout(_updateProgressBar, 200, pc);
                this.oldPC = pc;
            }
        }
    }
};

function _updateProgressBar(pc) {
    let progressBar = document.getElementById("groupdavProgressMeter");
    if (progressBar)
        progressBar.setAttribute("value", pc + "%");
}

function SCOnResultsTreeContextMenuPopup(event) {
    if (this == event.target) { /* otherwise the reset will be executed when
                                 any submenu pops up too... */
        let cards = window.GetSelectedAbCards();
        let rootEntry = document.getElementById("sc-categories-contextmenu");
        rootEntry.disabled = (cards.length == 0);
        if (!rootEntry.disabled) {
            SCResetCategoriesContextMenu();
        }
    }
}

function SCResetCategoriesContextMenu() {
    let popup = document.getElementById("sc-categories-contextmenu-popup");
    while (popup.lastChild) {
        popup.removeChild(popup.lastChild);
    }

    let catsArray = SCContactCategories.getCategoriesAsArray();
    for (let i = 0; i < catsArray.length; i++) {
        let newItem = document.createXULElement("menuitem");
        newItem.setAttribute("label", catsArray[i]);
        newItem.setAttribute("type", "checkbox");
        newItem.setAttribute("autocheck", "false");
        newItem.addEventListener("click",
                                 SCOnCategoriesContextMenuItemCommand,
                                 false);
        popup.appendChild(newItem);
    }
}

function SCOnCategoriesContextMenuPopup(event) {
    let cards = window.GetSelectedAbCards();
    if (cards.length > 0) {
        let card = cards[0].QueryInterface(Components.interfaces.nsIAbCard);
        let cats = card.getProperty("Categories", "");
        if (cats.length > 0) {
            let catsArray = cats.split("\u001A");
            let popup = document.getElementById("sc-categories-contextmenu-popup");
            let popupItems = popup.getElementsByTagName("menuitem");
            for (var i = 0; i < popupItems.length; i++) {
                let popupItem = popupItems[i];
                if (popupItem.label
                    && catsArray.indexOf(popupItem.label) > -1) {
                    popupItem.setAttribute("checked", "true");
                }
            }
        }
    }
}

function SCOnCategoriesContextMenuItemCommand(event) {
  let cards = window.GetSelectedAbCards();
  if (cards.length > 0) {
    let requireSync = false;
    let abUri = null;
    let category = this.label;
    let set = !this.hasAttribute("checked");
    for (let i = 0; i < cards.length; i++) {
      let card = cards[i];
      let cats = card.getProperty("Categories", "");
      let changed = false;
      if (cats.length > 0) {
        let catsArray = cats.split("\u001A");
        let catIdx = catsArray.indexOf(category);
        if (set) {
          if (catIdx == -1) {
            catsArray.push(category);
            changed = true;
          }
        }
        else {
          if (catIdx > -1) {
            catsArray.splice(catIdx, 1);
            changed = true;
          }
        }
        if (changed) {
          cats = catsArray.join("\u001A");
        }
      }
      else {
        if (set) {
          changed = true;
          cats = category;
        }
      }
      if (changed) {
        requireSync = true;
	//let oldDavVersion = card.getProperty("groupDavVersion", "-1");
	//card.setProperty("groupDavVersion", "-1");
	//card.setProperty("groupDavVersionPrev", oldDavVersion);
	card.setProperty("Categories", cats);
        let abManager = Components.classes["@mozilla.org/abmanager;1"]
            .getService(Components.interfaces.nsIAbManager);
	let children = abManager.directories;
	while (children.hasMoreElements()) {
	  let ab = children.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);
	  //if (ab.isRemote || ab.isMailList)
          if (ab.isMailList)
	    continue;
	  if (ab.hasCard(card)) {
	    ab.modifyCard(card);
	    abUri = ab.URI;
	    break;
	  }
	}
      }
    }
 //   if (requireSync) {
 //     if (isCardDavDirectory(abUri)) {
 //       SynchronizeGroupdavAddressbook(abUri);
 //     }
 //   }
  }
}

window.SCSetSearchCriteria = function(menuitem) {
  let criteria = menuitem.getAttribute("sc-search-criteria");
  if (criteria.length > 0) {
    gQueryURIFormat = "(or(" + criteria + ",c,@V))"; // the "or" is important here
  }
  else {
    //let prefBranch = (Components.classes["@mozilla.org/preferences-service;1"]
    //                  .getService(Components.interfaces.nsIPrefBranch));
    let nameOrEMailSearch = "";
    if (Services.prefs.getComplexValue("mail.addr_book.show_phonetic_fields", Components.interfaces.nsIPrefLocalizedString).data == "true") {
      nameOrEMailSearch =  Services.prefs.getCharPref("mail.addr_book.quicksearchquery.format.phonetic");
    } else {
      nameOrEMailSearch = Services.prefs.getCharPref("mail.addr_book.quicksearchquery.format");
    }

    // (or(DisplayName,c,@V)(FirstName,c,@V)(LastName,c,@V)(NickName,c,@V)(PrimaryEmail,c,@V)(SecondEmail,c,@V)(and(IsMailList,=,TRUE)(Notes,c,@V))(Company,c,@V)(Department,c,@V)(JobTitle,c,@V)(WebPage1,c,@V)(WebPage2,c,@V)(PhoneticFirstName,c,@V)(PhoneticLastName,c,@V))
    if (nameOrEMailSearch.startsWith("?"))
      nameOrEMailSearch = nameOrEMailSearch.slice(1);

    gQueryURIFormat = nameOrEMailSearch;
  }
  document.getElementById('peopleSearchInput').setAttribute("emptytext", menuitem.getAttribute("label"));
  document.getElementById('peopleSearchInput').focus();
  window.onEnterInSearchBar();
}

function SCOnUnload() {
  //let nmgr = Components.classes["@inverse.ca/notification-manager;1"]
  //                     .getService(Components.interfaces.inverseIJSNotificationManager)
  //                     .wrappedJSObject;
  notificationManagerInstance.unregisterObserver("groupdav.synchronization.start",
                                                 groupdavSynchronizationObserver);
  notificationManagerInstance.unregisterObserver("groupdav.synchronization.stop",
                                                 groupdavSynchronizationObserver);
  notificationManagerInstance.unregisterObserver("groupdav.synchronization.addressbook.updated",
                                                 groupdavSynchronizationObserver);
}

window.SCCommandSynchronize = function() {
  SynchronizeGroupdavAddressbook(gSelectedDir, window.SCCommandSynchronizeCallback);
}

window.openAddressBookCreationDialog = function() {
  window.openDialog("chrome://sogo-connector/content/addressbook/creation-dialog.xhtml",
		    "addressbookCreate",
		    "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
		    _this,
                    WL);
}

window.openAddressBookSubscriptionDialog = function() {
  window.openDialog("chrome://sogo-connector/content/general/subscription-dialog.xhtml",
		    "addressbookSubscribe",
		    "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
		    _this,
                    WL);
}

window.openABACLDialog = function() {
  let dir = window.GetSelectedDirectory();

  let abManager = Components.classes["@mozilla.org/abmanager;1"]
      .getService(Components.interfaces.nsIAbManager);
  let abDir = abManager.getDirectory(dir).QueryInterface(Components.interfaces.nsIAbDirectory);

  let groupdavPrefService = new GroupdavPreferenceService(abDir.dirPrefId);
  let url = abDir.getStringValue("carddav.url", "");
  //let url = groupdavPrefService.getURL();

  window.openDialog("chrome://sogo-connector/content/general/acl-dialog.xhtml",
		    "addressbookACL",
		    "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
                    _this,
                    WL,
		    {url: url,
		     rolesDialogURL: "chrome://sogo-connector/content/addressbook/roles-dialog.xhtml"});
}

function openDeletePersonalDirectoryForbiddenDialog() {
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);

  promptService.alert(window,
                      document.getElementById("cmd_delete").getAttribute("valueAddressBook"),
                      WL.extension.localeData.localizeMessage("deletePersonalABError"));
}

function openDeletePublicDirectoryForbiddenDialog() {
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);

  promptService.alert(window,
                      document.getElementById("cmd_delete").getAttribute("valueAddressBook"),
                      WL.extension.localeData.localizeMessage("deletePublicABError"));
}

window.SIAbDeleteDirectory = function(aURI) {
  let selectedDirectory = SCGetDirectoryFromURI(aURI);

  if (isCardDavDirectory(aURI)) {
    //let prefs = new GroupdavPreferenceService(selectedDirectory.dirPrefId);
    //let url = prefs.getURL();
    let url = selectedDirectory.getStringValue("carddav.url", "");
    let urlParts = url.split("/");
 
    if (url.indexOf(sogoBaseURL()) == 0
	&& urlParts[urlParts.length - 2] == "personal")
      openDeletePersonalDirectoryForbiddenDialog();
    else if (selectedDirectory.getBoolValue("readOnly", false)) {
      if (url.indexOf(sogoBaseURL()) == 0)
        openDeletePublicDirectoryForbiddenDialog();
      else
        SCAbDeleteDirectory(aURI);
    }
    else {
      if (SCAbConfirmDeleteDirectory(aURI)) {
	//let selectedDirectory = SCGetDirectoryFromURI(aURI);
	//let groupdavPrefService
	//    = new GroupdavPreferenceService(selectedDirectory.dirPrefId);
	//let url = groupdavPrefService.getURL();
	if (url.indexOf(sogoBaseURL()) == 0) {
	  let elements = url.split("/");
	  let dirBase = elements[elements.length-2];
	  let handler = new AddressbookHandler();
	  if (dirBase.indexOf("_") == -1) {
	    if (dirBase != 'personal') {
              //dump("should delete folder: " + url+ "\n");
	      deleteFolder(url, handler);
	    }
	  }
	  else
	    window.unsubscribeFromFolder(url, handler);
	}
	else
	  SCDeleteDAVDirectory(aURI);
      }
    }
  }
  else
    SCAbDeleteDirectory(aURI);
}

function SIDirPaneController() {
}

SIDirPaneController.prototype = {
  supportsCommand: function(command) {
    return (command == "cmd_SOGoACLS"
	    || command == "addressbook_delete_addressbook_command");
  },

 isCommandEnabled: function(command) {
   let result = false;
		
   if (command == "cmd_SOGoACLS") {
     let uri = window.GetSelectedDirectory();
     if (uri && isCardDavDirectory(uri)) {
       let ab = SCGetDirectoryFromURI(uri);
       let prefs = new GroupdavPreferenceService(ab.dirPrefId);
       let dirURL = ab.getStringValue("carddav.url", "");
       if (dirURL.indexOf(sogoBaseURL()) == 0) {
	 let elements = dirURL.split("/");
	 let dirBase = elements[elements.length-2];
	 /* FIXME: we don't support usernames with underscores */
	 result = (dirBase.indexOf("_") == -1);
       }
     }
   } else if (command == "addressbook_delete_addressbook_command") {
     let uri = window.GetSelectedDirectory();
     if (uri) {
       let cd;
       let url;
       let deleteMenuIsUnsubscribe = false;
       let ab = SCGetDirectoryFromURI(uri);
       if (isCardDavDirectory(uri)) {
	 let prefs = new GroupdavPreferenceService(ab.dirPrefId);
         url = ab.getStringValue("carddav.url", "");
	 cd = ab.getBoolValue("readOnly", "");
       }
       else
	 result = true;

       if (!result) {
	 if (url.indexOf(sogoBaseURL()) == 0) {
	   if (!cd) {
	     let urlParts = url.split("/");
	     let dirBase = urlParts[urlParts.length - 2];
	     if (dirBase != "personal") {
	       result = true;
	       /* HACK: use of "_" to determine whether a resource is owned
		  or subscribed... */
	       deleteMenuIsUnsubscribe = (dirBase.indexOf("_") > -1);
	     }
	   }
	 }
	 else
	   result = true;
       }

       let deleteMenuItem
	   = document.getElementById("dirTreeContext-delete");
       if (deleteMenuIsUnsubscribe) {
	 deleteMenuItem.label = WL.extension.localeData.localizeMessage("addressbook-overlay.subscription.menu.unsubscribe");
       } else {
	 deleteMenuItem.label = deleteCmdLabel;
       }
     }
   }
   
   return result;
 },

 doCommand: function(command){},

 onEvent: function(event) {}
};

window.subscriptionDialogType = function() {
  return "contact";
}

window.subscriptionGetHandler = function() {
  return new AddressbookHandler();
}

window.creationGetHandler = function() {
  return new AddressbookHandler();
}

function SISetupAbCommandUpdateHandlers(){
  let controller = new SIDirPaneController();

  let dirTree = document.getElementById("dirTree");
  if (dirTree) {
    dirTree.controllers.appendController(controller);
  }
}

function SICommandUpdate_AddressBook() {
  _this.SICommandUpdate_AddressBookOld();
  window.goUpdateCommand("cmd_SOGoACLS");
  window.goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIGoUpdateGlobalEditMenuItems() {
  gSelectedDir = window.GetSelectedDirectory();
  _this.SIGoUpdateGlobalEditMenuItemsOld();
  window.goUpdateCommand("cmd_SOGoACLS");
  window.goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIGoUpdateSelectEditMenuItems() {
  _this.SIGoUpdateSelectEditMenuItemsOld();
  window.goUpdateCommand("cmd_SOGoACLS");
  window.goUpdateCommand("addressbook_delete_addressbook_command");
}

function onLoad(activatedWhileWindowOpen) {
  dump("addressbook.groupdav.overlay.js: onLoad()\n");
  WL.injectCSS("resource://sogo-connector/skin/addressbook/addressbook.groupdav.overlay.css");
  WL.injectCSS("resource://sogo-connector/skin/addressbook/addressbook-overlay.css");
  WL.injectElements(`
  <commandset id="addressBook">
    <command id="cmd_syncGroupdav" oncommand="SCCommandSynchronize();"/>
    <command id="cmd_SOGoACLS" oncommand="openABACLDialog();"/>

    <command id="addressbook_new_addressbook_command"
      oncommand="openAddressBookCreationDialog()"/>
    <command id="addressbook_subscribe_addressbook_command"
      oncommand="openAddressBookSubscriptionDialog()"/>
    <command id="addressbook_delete_addressbook_command"
      oncommand="SIAbDeleteDirectory(GetSelectedDirectory())"/>
  </commandset>

  <vbox id="dirTreeBox">
    <sidebarheader id="subscriptionToolbar" insertbefore="dirTree">
      <toolbarbutton id="addAddressBookBtn"
	command="addressbook_new_addressbook_command"
	tooltiptext="&addressbook-overlay.susbcription.tooltips.add;"/>
      <toolbarbutton id="subscribeAddressBookBtn"
	command="addressbook_subscribe_addressbook_command"
	tooltiptext="&addressbook-overlay.susbcription.tooltips.subscribe;"/>
      <toolbarbutton id="removeAddressBookBtn"
	command="addressbook_delete_addressbook_command"
	tooltiptext="&addressbook-overlay.susbcription.tooltips.remove;"/>
    </sidebarheader>
  </vbox>

  <!--Add the GroupDAV synchronize button to the toolbar -->
  <toolbarpalette id="AddressBookToolbarPalette">
    <toolbarbutton id="button-groupdavSync" label="&GroupDavSync.label;" tooltiptext="&GroupDavSync.tooltip;" class="toolbarbutton-1" command="cmd_syncGroupdav"/>
  </toolbarpalette>

  <toolbaritem id="search-container">
    <toolbarbutton id="SCSearchCriteriaButton"
      class="toolbarbutton-1"
      type="menu"
      label="&SearchCriteriaButton.label;"
      insertbefore="peopleSearchInput"
      >
      <menupopup id="SCSearchCriteriaButtonMenu">
        <menuitem id="scsearchnameoremail" type="radio" checked="true" value="0"
          sc-search-criteria=""
          oncommand="SCSetSearchCriteria(this);"/>
        <menuitem type="radio" label="&SearchCategory.label;" value="1"
          sc-search-criteria="Categories"
          oncommand="SCSetSearchCriteria(this);"/>
      </menupopup>
    </toolbarbutton>
  </toolbaritem>

  <!--Add the GroupDAV synchronize menu to the tree contextual menu -->
  <popup id="dirTreeContext">
    <menuseparator/>	
    <menuitem id="dirTreeContext-ABACLDialog" label="&addressbook-overlay.acl-menu.label;" command="cmd_SOGoACLS"/>
  </popup>

  <popup id="abResultsTreeContext">
    <menu id="sc-categories-contextmenu" label="&sogo-connector.tabs.categories.label;" insertafter="abResultsTreeContext-properties">
      <menupopup id="sc-categories-contextmenu-popup">
      </menupopup>
    </menu>
  </popup>

  <statusbar id="status-bar">
    <statusbarpanel id="groupdavProgressPanel" collapsed="true">
      <label value="&addressbook.synchronize.label;"/>
    </statusbarpanel>
  </statusbar>
         
  <vbox id="cvbContact">
    <vbox id="cvbCategories" class="cardViewGroup" insertbefore="cvbDescription">
      <description class="CardViewHeading" id="SCCvCategories_label">&sogo-connector.tabs.categories.label;</description>
      <description id="SCCvCategories" class="CardViewText"/>
    </vbox>
  </vbox>`.replaceAll(/&(.*?);/g, i18n));

  let appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
      .getService(Components.interfaces.nsIXULRuntime);
  if (appInfo.OS == "Darwin") {
    let toolbar = document.getElementById("ab-bar2");
    toolbar.setAttribute("arch", "mac");
  }

  document.getElementById("scsearchnameoremail").setAttribute("label", document.getElementById("peopleSearchInput").getAttribute("placeholder"));
  deleteCmdLabel = document.getElementById("dirTreeContext-delete").getAttribute("label"),
  
  this.SCAbEditSelectedDirectoryOriginal = window.AbEditSelectedDirectory;
  window.AbEditSelectedDirectory = this.SCAbEditSelectedDirectory;
  //this.SCAbDeleteOriginal = window.AbDelete;
  //window.AbDelete = this.SCAbDelete;
  window.SCAbDeleteDirectoryOriginal = window.AbDeleteDirectory;
  //window.AbDeleteDirectory = this.SCAbDeleteDirectory;

  /* drag and drop */
  //window.abDirTreeObserver.SCOnDropOld = window.abDirTreeObserver.onDrop;
  //window.abDirTreeObserver.onDrop = window.abDirTreeObserver.SCOnDrop;

  /* command updaters */
  // FIXME: remove all old functions
  //this.SCCommandUpdate_AddressBookOld = this.CommandUpdate_AddressBook;
  //this.CommandUpdate_AddressBook = this.SCCommandUpdate_AddressBook;
  //this.SCGoUpdateGlobalEditMenuItemsOld = this.goUpdateGlobalEditMenuItems;
  //this.goUpdateGlobalEditMenuItems = 	this.SCGoUpdateGlobalEditMenuItems;
  //this.SCGoUpdateSelectEditMenuItemsOld = this.goUpdateSelectEditMenuItems;
  //this.goUpdateSelectEditMenuItems = this.SCGoUpdateSelectEditMenuItems;

  let ctlOvl = new dirPaneControllerOverlay();

  // dir pane
  let aDirTree = document.getElementById("dirTree");
  if (aDirTree) {
    aDirTree.controllers.appendController(ctlOvl);
    // 		aDirTree.controllers.appendController(DirPaneController);
  }

  // results pane
  let gAbResultsTree = document.getElementById("abResultsTree");
  if (gAbResultsTree) {
    // 		gAbResultsTree.controllers.appendController(ResultsPaneController);
    gAbResultsTree.controllers.appendController(ctlOvl);
  }

  groupdavSynchronizationObserver.syncManager = syncProgressManagerInstance;
  notificationManagerInstance.registerObserver("groupdav.synchronization.start",
                                               groupdavSynchronizationObserver);
  notificationManagerInstance.registerObserver("groupdav.synchronization.stop",
                                               groupdavSynchronizationObserver);
  notificationManagerInstance.registerObserver("groupdav.synchronization.addressbook.updated",
                                               groupdavSynchronizationObserver);

  let popup = document.getElementById("abResultsTreeContext");
  if (popup) {
    popup.addEventListener("popupshowing", SCOnResultsTreeContextMenuPopup, false);
  }

  popup = document.getElementById("sc-categories-contextmenu-popup");
  if (popup) {
    popup.addEventListener("popupshowing", SCOnCategoriesContextMenuPopup, false);
  }

  this.SICommandUpdate_AddressBookOld = window.CommandUpdate_AddressBook;
  window.CommandUpdate_AddressBook = this.SICommandUpdate_AddressBook;
  this.SIGoUpdateGlobalEditMenuItemsOld = window.goUpdateGlobalEditMenuItems;
  window.goUpdateGlobalEditMenuItems = 	this.SIGoUpdateGlobalEditMenuItems;
  this.SIGoUpdateSelectEditMenuItemsOld = window.goUpdateSelectEditMenuItems;
  window.goUpdateSelectEditMenuItems = this.SIGoUpdateSelectEditMenuItems;
  
  window.AbDeleteDirectory = window.SIAbDeleteDirectory;

  SISetupAbCommandUpdateHandlers();

  let toolbar = document.getElementById("subscriptionToolbar");
  if (toolbar) {
    toolbar.collapsed = true;
    let ABChecker = new directoryChecker("Contacts");
    ABChecker.checkAvailability(function() { toolbar.collapsed = false; });
  }
}

// window.abDirTreeObserver.SCOnDrop = function(row, or, dataTransfer) {
//   let dragSession = dragService.getCurrentSession();
//   if (dragSession) {
//     /* Here, we don't seem to have the choice but to use the RDF
//        interface to discover the target directory. */
//     let sourceDirectory = gAbView.directory;
//     let targetResource = gDirectoryTreeView.getDirectoryAtIndex(row);
//     let targetURI = targetResource.URI;

//     let cards = null;
//     let cardKeys = [];

//     if (targetURI.indexOf(sourceDirectory.URI) != 0
//         && isGroupdavDirectory(sourceDirectory.URI)) {
//       if (dragSession.dragAction
//           == Components.interfaces.nsIDragService.DRAGDROP_ACTION_MOVE) {
//         cards = this._getDroppedCardsKeysFromSession(gAbView, dataTransfer);
//         for (let i = 0; i < cards.length; i++) {
//           this._pushCardKey(cards[i], cardKeys);
//         }
//       }
//       this._resetDroppedCardsVersionFromSession(gAbView, dataTransfer);
//     }

//     let proceed = true;
//     try {
//       this.SCOnDropOld(row, or, dataTransfer);
//     }
//     catch(e) {
//       proceed = false;
//       dump("an exception occured: " + e + "\n");
//     }

//     if (targetResource.isMailList) {
//       let uriParts = targetURI.split("/");
//       let parentDirURI = uriParts[0] + "//" + uriParts[2];
//       if (isGroupdavDirectory(parentDirURI)) {
//         let attributes = new GroupDAVListAttributes(targetURI);
//         attributes.version = "-1";
//         SynchronizeGroupdavAddressbook(parentDirURI);
//       }
//     }
//     else if (isGroupdavDirectory(targetURI)) {
//       SynchronizeGroupdavAddressbook(targetURI);
//     }

//     if (cardKeys)
//       dump("cardKeys: " + cardKeys.length + " to delete\n");
//     else
//       dump("cardKeys: nothing to delete\n");
//     if (proceed && cardKeys.length) {
//       DeleteGroupDAVCards(gSelectedDir, cards, true);
//       //let prefService = new GroupdavPreferenceService(sourceDirectory.dirPrefId);
//       //for (let i = 0; i < cardKeys.length; i++) {
//       //  dump("deleting " + cardKeys[i] + "\n");
//       //  _deleteGroupDAVComponentWithKey(prefService, cardKeys[i]);
//       // }
//     }
//     dump("done drop delete\n");
//   }
// };

// window.abDirTreeObserver._getDroppedCardsKeysFromSession = function(abView, dataTransfer) {
//   var rows = dataTransfer.getData("moz/abcard").split(",").map(j => parseInt(j, 10));
//   var numrows = rows.length;
//   let cards = [];

//   for (let j = 0; j < numrows; j++) {
//     cards.push(abView.getCardFromRow(rows[j]));
//   }
//   return cards;
// };

// window.abDirTreeObserver._resetDroppedCardsVersionFromSession = function(abView, dataTransfer) {
//   var rows = dataTransfer.getData("moz/abcard").split(",").map(j => parseInt(j, 10));
//   var numrows = rows.length;
//   let cards = [];

//   for (let j = 0; j < numrows; j++) {
//     cards.push(abView.getCardFromRow(rows[j]));
//   }

//   for (let card of cards) {
//     if (card.isMailList) {
//       let attributes = new GroupDAVListAttributes(card.mailListURI);
//       attributes.version = "-1";
//     } else {
//       let oldDavVersion = card.getProperty("groupDavVersion", "-1");
//       card.setProperty("groupDavVersion", "-1");
//       card.setProperty("groupDavVersionPrev", oldDavVersion);
//       abView.directory.modifyCard(card);
//     }
//   }
// };

// window.abDirTreeObserver._pushCardKey = function(card, cards) {
//     let key = null;

//     if (card.isMailList) {
//         let attributes = new GroupDAVListAttributes(card.mailListURI);
//         key = attributes.key;
//     }
//     else {
//         key = card.getProperty("groupDavKey", null);
//         // dump("ke2y: " + key + "\n");
//     }

//     if (key && key.length) {
//         cards.push(key);
//     }
// };  

let SCCardViewOverlay = {
  oldDisplayCardViewPane: null,

  displayCardViewPane: function(card) {
    this.oldDisplayCardViewPane.apply(window, arguments);
    let cvCategories = document.getElementById("SCCvCategories");
    let catString = card.getProperty("Categories", "").split("\u001A").join(", ");
    cvCategories.textContent = catString;
   }
};

SCCardViewOverlay.oldDisplayCardViewPane = window.DisplayCardViewPane;
window.DisplayCardViewPane = function(card) { SCCardViewOverlay.displayCardViewPane(card); };

function onUnload(deactivatedWhileWindowOpen) {
  dump("addressbook.groupdav.overlay.js: onUnload()\n");
  SCOnUnload();
}
