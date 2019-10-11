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
var { notificationManagerInstance } = ChromeUtils.import("resource://sogo-connector/NotificationManager.jsm");
var { syncProgressManagerInstance } = ChromeUtils.import("resource://sogo-connector/SyncProgressManager.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("addressbook.groupdav.overlay.js: failed to include '" + files[i] +
                 "'\n" + e);
            if (e.fileName)
                dump ("\nFile: " + e.fileName
                      + "\nLine: " + e.lineNumber
                      + "\n\n Stack:\n\n" + e.stack);
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
	   "chrome://sogo-connector/content/general/subscription-utils.js",
	   "chrome://sogo-connector/content/messenger/folders-update.js"]);

/*
 * This overlay adds GroupDAV functionalities to Addressbooks
 */

let gSelectedDir = "";
let gCurDirectory = null;
let gLDAPPrefsService = null;

/*****************************************************************************************
 *
 *  UI functions
 *
 *****************************************************************************************/
function AbNewGroupDavContacts(){
    window.openDialog("chrome://sogo-connector/content/addressbook/preferences.addressbook.groupdav.xul",
                      "", "chrome,modal=yes,resizable=no,centerscreen", null);
}

function openGroupdavPreferences(directory) {
    window.openDialog("chrome://sogo-connector/content/addressbook/preferences.addressbook.groupdav.xul",
                      "", "chrome,modal=yes,resizable=no,centerscreen",
                      { selectedDirectory: directory});
}

function SCOpenDeleteFailureDialog(directory) {
    window.openDialog("chrome://sogo-connector/content/addressbook/deletefailure-dialog.xul",
                      "", "chrome,modal=yes,resizable=no,centerscreen",
                      {directory: directory});
}

/********************************************************************************************
 *
 *  Override of the  UI functionalities
 *
 ********************************************************************************************/
function SCGoUpdateGlobalEditMenuItems() {
    try {
        gSelectedDir = GetSelectedDirectory();
        //  		dump("SCGoUpdateGlobalEditMenuItems\n  gSelectedDir" + gSelectedDir + "\n");
        goUpdateCommand("cmd_syncGroupdav");
        goUpdateCommand("cmd_syncAbortGroupdav");
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
        goUpdateCommand('cmd_syncGroupdav');
        goUpdateCommand("cmd_syncAbortGroupdav");
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
        goUpdateCommand('cmd_syncGroupdav');
        goUpdateCommand("cmd_syncAbortGroupdav");
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
        return (command == "cmd_syncGroupdav" || command == "cmd_syncAbortGroupdav");
    },

    isCommandEnabled: function(command) {
        let result = false;

        // 		dump("isCommandEnabled\n  command: " + command + "\n");

        if (gSelectedDir && gSelectedDir != "") {
            try {
                switch (command) {
                case "cmd_syncGroupdav":
                    result = isGroupdavDirectory(gSelectedDir);
                    break;
                case "cmd_syncAbortGroupdav":
                    result = isGroupdavDirectory(gSelectedDir);
                    break;
                    // case "cmd_newlist":
                    // case "cmd_newcard":
                    // 	let directory = SCGetDirectoryFromURI(gSelectedDir);
                    // 	result = (!directory.readOnly);
                    // 	break;
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

abDirTreeObserver.SCOnDrop = function(row, or, dataTransfer) {
  let dragSession = dragService.getCurrentSession();
  if (dragSession) {
    /* Here, we don't seem to have the choice but to use the RDF
       interface to discover the target directory. */
    let sourceDirectory = gAbView.directory;
    let targetResource = gDirectoryTreeView.getDirectoryAtIndex(row);
    let targetURI = targetResource.URI;

    let cards = null;
    let cardKeys = [];

    if (targetURI.indexOf(sourceDirectory.URI) != 0
        && isGroupdavDirectory(sourceDirectory.URI)) {
      if (dragSession.dragAction
          == Components.interfaces.nsIDragService.DRAGDROP_ACTION_MOVE) {
        cards = this._getDroppedCardsKeysFromSession(gAbView, dataTransfer);
        for (let i = 0; i < cards.length; i++) {
          this._pushCardKey(cards[i], cardKeys);
        }
      }
      this._resetDroppedCardsVersionFromSession(gAbView, dataTransfer);
    }

    let proceed = true;
    try {
      this.SCOnDropOld(row, or, dataTransfer);
    }
    catch(e) {
      proceed = false;
      dump("an exception occured: " + e + "\n");
    }

    if (targetResource.isMailList) {
      let uriParts = targetURI.split("/");
      let parentDirURI = uriParts[0] + "//" + uriParts[2];
      if (isGroupdavDirectory(parentDirURI)) {
        let attributes = new GroupDAVListAttributes(targetURI);
        attributes.version = "-1";
        SynchronizeGroupdavAddressbook(parentDirURI);
      }
    }
    else if (isGroupdavDirectory(targetURI)) {
      SynchronizeGroupdavAddressbook(targetURI);
    }

    if (cardKeys)
      dump("cardKeys: " + cardKeys.length + " to delete\n");
    else
      dump("cardKeys: nothing to delete\n");
    if (proceed && cardKeys) {
      DeleteGroupDAVCards(gSelectedDir, cards, true);
      //let prefService = new GroupdavPreferenceService(sourceDirectory.dirPrefId);
      //for (let i = 0; i < cardKeys.length; i++) {
      //  dump("deleting " + cardKeys[i] + "\n");
      //  _deleteGroupDAVComponentWithKey(prefService, cardKeys[i]);
      // }
    }
    dump("done drop delete\n");
  }
};

abDirTreeObserver._getDroppedCardsKeysFromSession = function(abView, dataTransfer) {
  var rows = dataTransfer.getData("moz/abcard").split(",").map(j => parseInt(j, 10));
  var numrows = rows.length;
  let cards = [];

  for (let j = 0; j < numrows; j++) {
    cards.push(abView.getCardFromRow(rows[j]));
  }
  return cards;
};

abDirTreeObserver._resetDroppedCardsVersionFromSession = function(abView, dataTransfer) {
  var rows = dataTransfer.getData("moz/abcard").split(",").map(j => parseInt(j, 10));
  var numrows = rows.length;
  let cards = [];

  for (let j = 0; j < numrows; j++) {
    cards.push(abView.getCardFromRow(rows[j]));
  }

  for (let card of cards) {
    if (card.isMailList) {
      let attributes = new GroupDAVListAttributes(card.mailListURI);
      attributes.version = "-1";
    } else {
      let oldDavVersion = card.getProperty("groupDavVersion", "-1");
      card.setProperty("groupDavVersion", "-1");
      card.setProperty("groupDavVersionPrev", oldDavVersion);
      abView.directory.modifyCard(card);
    }
  }
};

abDirTreeObserver._pushCardKey = function(card, cards) {
    let key = null;

    if (card.isMailList) {
        let attributes = new GroupDAVListAttributes(card.mailListURI);
        key = attributes.key;
    }
    else {
        key = card.getProperty("groupDavKey", null);
        // dump("ke2y: " + key + "\n");
    }

    if (key && key.length) {
        cards.push(key);
    }
};

function SCAbEditSelectedDirectory() {
    /* This method is no longer used for CardDAV addressbooks, since we now
     return a proper "propertiesChromeURI" attribute. */
    let abUri = GetSelectedDirectory();
    if (isGroupdavDirectory(abUri)) {
        let directory = SCGetDirectoryFromURI(abUri);
        openGroupdavPreferences(directory);
    }
    else {
        this.SCAbEditSelectedDirectoryOriginal();
    }
}

let deleteManager = {
    mCount: 0,
    mErrors: 0,
    mDirectory: null,
    begin: function(directory, count) {
        this.mDirectory = directory;
        this.mCount = count;
        this.mErrors = 0;
    },
    decrement: function(code) {
        this.mCount--;
        if (!((code > 199 && code < 400)
            || code == 404
              || code > 599))
            this.mErrors++;

        return (this.mCount == 0);
    },
    finish: function() {
        if (this.mErrors != 0)
            SCOpenDeleteFailureDialog(this.mDirectory);
        this.mDirectory = null;
    },
    onDAVQueryComplete: function(code, result, headers, data) {
        // 		dump("on davquerycompplete\n");
        if (data.deleteLocally
            && ((code > 199 && code < 400)
                || code == 404
                || code == 604)) {
            // 			dump("code: " + code + "\n");
            if (data.component.isMailList) {
                // 				dump("deleting list\n");
                let mailListURI = ((data.component
                                    instanceof Components.interfaces.nsIAbCard)
                                   ? data.component.mailListURI
                                   : data.component.URI);
                let attributes = new GroupDAVListAttributes(mailListURI);
                attributes.deleteRecord();
                /* we commit the preferences here because sometimes Thunderbird will
                 crash when deleting the real instance of the list. */
                let prefService = (Components.classes["@mozilla.org/preferences-service;1"]
                                             .getService(Components.interfaces.nsIPrefService));
                prefService.savePrefFile(null);

                let listDirectory = SCGetDirectoryFromURI(mailListURI);
                data.directory.deleteDirectory(listDirectory);
                //gAbView.deleteSelectedCards();
            }
            else {
                let cards = Components.classes["@mozilla.org/array;1"]
                                      .createInstance(Components.interfaces.nsIMutableArray);
                cards.appendElement(data.component, false);
                data.directory.deleteCards(cards);
            }
        }
        if (this.decrement(code))
            this.finish();
    }
};

function DeleteGroupDAVCards(directory, cards, deleteLocally) {
    dump("delete: " + cards.length + " cards\n");
    let mdbDirectory = SCGetDirectoryFromURI(directory);
    let prefService = new GroupdavPreferenceService(mdbDirectory.dirPrefId);

    deleteManager.begin(directory, cards.length);
    for (let i = 0; i < cards.length; i++) {
        let card = cards[i].QueryInterface(Components.interfaces.nsIAbCard);
        let key;
        if (card.isMailList) {
            let attributes = new GroupDAVListAttributes(card.mailListURI);
            key = attributes.key;
        }
        else {
            try {
                key = card.getProperty("groupDavKey", null);
            }
            catch(e) {
                key = null;
            }
        }

        dump("  card to delete: '" + card.displayName + "'\n");
        dump("    key: '" + key + "'\n");

        _deleteGroupDAVComponentWithKey(prefService, key, mdbDirectory, card, deleteLocally);
    }
}

function _deleteGroupDAVComponentWithKey(prefService,
                                         key,
                                         directory,
                                         component,
                                         deleteLocally) {
    dump("\n\nwe delete: " + key + " with deleteLocally="+deleteLocally+"\n\n\n");
    if (key && key.length) {
        let href = prefService.getURL() + key;
        let deleteOp = new sogoWebDAV(href, deleteManager,
                                      {directory: directory,
                                       component: component,
                                       deleteLocally: deleteLocally});
        deleteOp.delete();
        dump("webdav_delete on '" + href + "'\n");
        // force full sync on next sync by invalidating cTag.
        // This way, if server does not delete contact correctly (e.g. write permission denied)
        // the contact will reappear on next synchronization.
        prefService.setCTag("invalid");
    }
    else /* 604 = "not found locally" */
        deleteManager.onDAVQueryComplete(604, null, null,
                                         {directory: directory,
                                          deleteLocally: true,
                                          component: component});
}

function SCAbConfirmDelete(types) {
  let confirm = false;

  if (types != kNothingSelected) {
    // Determine strings for smart and context-sensitive user prompts
    // for confirming deletion.
    let confirmDeleteTitleID;
    let confirmDeleteTitle;
    let confirmDeleteMessageID;
    let confirmDeleteMessage;
    let itemName;
    let containingListName;
    let selectedDir = getSelectedDirectory();
    let numSelectedItems = gAbView.selection.count;

    switch(types) {
    case kListsAndCards:
      confirmDeleteMessageID = "confirmDelete2orMoreContactsAndLists";
      confirmDeleteTitleID   = "confirmDelete2orMoreContactsAndListsTitle";
      break;
    case kSingleListOnly:
      // Set item name for single mailing list.
      let theCard = GetSelectedAbCards()[0];
      itemName = theCard.displayName;
      confirmDeleteMessageID = "confirmDeleteThisMailingList";
      confirmDeleteTitleID   = "confirmDeleteThisMailingListTitle";
      break;
    case kMultipleListsOnly:
      confirmDeleteMessageID = "confirmDelete2orMoreMailingLists";
      confirmDeleteTitleID   = "confirmDelete2orMoreMailingListsTitle";
      break;
    case kCardsOnly:
      if (selectedDir.isMailList) {
        // Contact(s) in mailing lists will be removed from the list, not deleted.
        if (numSelectedItems == 1) {
          confirmDeleteMessageID = "confirmRemoveThisContact";
          confirmDeleteTitleID = "confirmRemoveThisContactTitle";
        } else {
          confirmDeleteMessageID = "confirmRemove2orMoreContacts";
          confirmDeleteTitleID   = "confirmRemove2orMoreContactsTitle";
        }
        // For removing contacts from mailing list, set placeholder value
        containingListName = selectedDir.dirName;
      } else {
        // Contact(s) in address books will be deleted.
        if (numSelectedItems == 1) {
          confirmDeleteMessageID = "confirmDeleteThisContact";
          confirmDeleteTitleID   = "confirmDeleteThisContactTitle";
        } else {
          confirmDeleteMessageID = "confirmDelete2orMoreContacts";
          confirmDeleteTitleID   = "confirmDelete2orMoreContactsTitle";
        }
      }
      if (numSelectedItems == 1) {
        // Set item name for single contact.
        let theCard = GetSelectedAbCards()[0];
        let nameFormatFromPref = Services.prefs.getIntPref("mail.addr_book.lastnamefirst");
        itemName = theCard.generateName(nameFormatFromPref);
      }
      break;
    }

    // Get the raw model strings.
    // For numSelectedItems == 1, it's simple strings.
    // For messages with numSelectedItems > 1, it's multi-pluralform string sets.
    // confirmDeleteMessage has placeholders for some forms.
    confirmDeleteTitle   = gAddressBookBundle.getString(confirmDeleteTitleID);
    confirmDeleteMessage = gAddressBookBundle.getString(confirmDeleteMessageID);

    // Get plural form where applicable; substitute placeholders as required.
    if (numSelectedItems == 1) {
      // If single selected item, substitute itemName.
      confirmDeleteMessage = confirmDeleteMessage.replace("#1", itemName);
    } else {
      // If multiple selected items, get the right plural string from the
      // localized set, then substitute numSelectedItems.
      confirmDeleteMessage = PluralForm.get(numSelectedItems, confirmDeleteMessage);
      confirmDeleteMessage = confirmDeleteMessage.replace("#1", numSelectedItems);
    }
    // If contact(s) in a mailing list, substitute containingListName.
    if (containingListName)
      confirmDeleteMessage = confirmDeleteMessage.replace("#2", containingListName);

    // Finally, show our smart confirmation message, and act upon it!
    confirm = Services.prompt.confirm(window, confirmDeleteTitle,
                                      confirmDeleteMessage);
  }
  
  // if (types != kNothingSelected) {
  //   let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
  //                                     .getService(Components.interfaces.nsIPromptService);
  //   let confirmDeleteTitle;
  //   let confirmDeleteMessage;
       
  //   if (types == kListsAndCards) {
  //     confirmDeleteTitle = gAddressBookBundle.getString("confirmDelete2orMoreContactsAndListsTitle");
  //     confirmDeleteMessage = gAddressBookBundle.getString("confirmDelete2orMoreContactsAndLists");
  //   }
  //   else if (types == kMultipleListsOnly) {
  //     confirmDeleteTitle = gAddressBookBundle.getString("confirmDeleteThisMailingListTitle");
  //     confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteThisMailingList");
  //   }
  //   else if (types == kCardsOnly && gAbView && gAbView.selection) {
  //     if (gAbView.selection.count < 2) {
  //       confirmDeleteTitle = gAddressBookBundle.getString("confirmDeleteThisContact");
  //       confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteThisContactTitle");
  //     }
  //     else {
  //       confirmDeleteTitle = gAddressBookBundle.getString("confirmDelete2orMoreContactsTitle");
  //       confirmDeleteMessage =  gAddressBookBundle.getString("confirmDelete2orMoreContacts");
  //     }
  //   }
  //   else {
  //     confirmDeleteTitle = gAddressBookBundle.getString("confirmDeleteThisMailingListTitle");
  //     confirmDeleteMessage =  gAddressBookBundle.getString("confirmDeleteThisMailingList");
  //   }

  //   confirm = promptService.confirm(window, confirmDeleteTitle, confirmDeleteMessage);
  // }

  return confirm;
}

function SCAbDelete() {
    let deletePerformed = false;

    if (gSelectedDir) {
        if (isGroupdavDirectory(gSelectedDir)) {
            let types = GetSelectedCardTypes();
            if (types != kNothingSelected) {
                let confirm = SCAbConfirmDelete(types);
                if (!confirm)
                    return;
                else {
                    let cards = GetSelectedAbCards();
                    // let abView = GetAbView();
                    DeleteGroupDAVCards(gSelectedDir, cards, true);
                    deletePerformed = true;
                }
            }
        }
        else if (gSelectedDir.search("mab/MailList") > -1) {
            let parentURI = GetParentDirectoryFromMailingListURI(gSelectedDir);
            if (isGroupdavDirectory(parentURI)) {
                let list = SCGetDirectoryFromURI(gSelectedDir);
                let cards = GetSelectedAbCards();
                let xpcomArray = Components.classes["@mozilla.org/array;1"]
                                           .createInstance(Components.interfaces.nsIMutableArray);
                for (let i = 0; i < cards.length; i++) {
                    xpcomArray.appendElement(cards[i], false);
                }
                list.deleteCards(xpcomArray);
                let attributes = new GroupDAVListAttributes(gSelectedDir);
                attributes.version = "-1";
                SynchronizeGroupdavAddressbook(parentURI);
                deletePerformed = true;
            }
        }
    }

    if (!deletePerformed) {
        this.SCAbDeleteOriginal();
    }
}

/* AbDeleteDirectory done cleanly... */
function SCAbDeleteDirectory(aURI) {
    let result = false;

    dump("SCAbDeleteDirectory: aURI: " + aURI + "\n");
    dump("  backtrace:\n" + backtrace() + "\n\n");

    if (isGroupdavDirectory(aURI)) {
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
            this.SCAbDeleteDirectoryOriginal(aURI);
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
  let directory = GetDirectoryFromURI(selectedDir);

  // Check if this address book is being used for collection
  if (Services.prefs.getCharPref("mail.collect_addressbook") == selectedDir
      && (Services.prefs.getBoolPref("mail.collect_email_address_outgoing")
          || Services.prefs.getBoolPref("mail.collect_email_address_incoming")
          || Services.prefs.getBoolPref("mail.collect_email_address_newsgroup"))) {
    let brandShortName = document.getElementById("bundle_brand").getString("brandShortName");
    confirmDeleteTitle = gAddressBookBundle.getString("confirmDeleteThisCollectionAddressbook");
    confirmDeleteMessage = confirmDeleteMessage.replace("#2", brandShortName);
  }
  else {
    confirmDeleteTitle = gAddressBookBundle.getString("confirmDeleteThisAddressbookTitle");
    confirmDeleteMessage = gAddressBookBundle.getString("confirmDeleteThisAddressbook");    
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
        let progressBar = document.createElement("progressmeter");
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

function SCOnLoad() {
    let appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                            .getService(Components.interfaces.nsIXULRuntime);
    if (appInfo.OS == "Darwin") {
        let toolbar = document.getElementById("ab-bar2");
        toolbar.setAttribute("arch", "mac");
    }

    this.SCAbEditSelectedDirectoryOriginal = this.AbEditSelectedDirectory;
    this.AbEditSelectedDirectory = this.SCAbEditSelectedDirectory;
    this.SCAbDeleteOriginal = this.AbDelete;
    this.AbDelete = this.SCAbDelete;
    this.SCAbDeleteDirectoryOriginal = this.AbDeleteDirectory;
    this.AbDeleteDirectory = this.SCAbDeleteDirectory;

    /* drag and drop */
    abDirTreeObserver.SCOnDropOld = abDirTreeObserver.onDrop;
    abDirTreeObserver.onDrop = abDirTreeObserver.SCOnDrop;

    /* command updaters */
    this.SCCommandUpdate_AddressBookOld = this.CommandUpdate_AddressBook;
    this.CommandUpdate_AddressBook = this.SCCommandUpdate_AddressBook;
    this.SCGoUpdateGlobalEditMenuItemsOld = this.goUpdateGlobalEditMenuItems;
    this.goUpdateGlobalEditMenuItems = 	this.SCGoUpdateGlobalEditMenuItems;
    this.SCGoUpdateSelectEditMenuItemsOld = this.goUpdateSelectEditMenuItems;
    this.goUpdateSelectEditMenuItems = this.SCGoUpdateSelectEditMenuItems;

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

    //let nmgr = Components.classes["@inverse.ca/notification-manager;1"]
    //                     .getService(Components.interfaces.inverseIJSNotificationManager)
    //                     .wrappedJSObject;
    //let smgr = Components.classes["@inverse.ca/sync-progress-manager;1"]
    //                     .getService(Components.interfaces.inverseIJSSyncProgressManager)
    //                     .wrappedJSObject;
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

  SIOnLoadHandler();
}

function SCOnResultsTreeContextMenuPopup(event) {
    if (this == event.target) { /* otherwise the reset will be executed when
                                 any submenu pops up too... */
        let cards = GetSelectedAbCards();
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
        let newItem = document.createElement("menuitem");
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
    let cards = GetSelectedAbCards();
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
    let cards = GetSelectedAbCards();
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

		let oldDavVersion = card.getProperty("groupDavVersion", "-1");
		card.setProperty("groupDavVersion", "-1");
		card.setProperty("groupDavVersionPrev", oldDavVersion);
		card.setProperty("Categories", cats);

                let abManager = Components.classes["@mozilla.org/abmanager;1"]
                    .getService(Components.interfaces.nsIAbManager);
		let children = abManager.directories;
		while (children.hasMoreElements()) {
		    let ab = children.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);
		    if (ab.isRemote || ab.isMailList)
			continue;
		    if (ab.hasCard(card)) {
			ab.modifyCard(card);
			abUri = ab.URI;
			break;
		    }
		}
	    }
        }
        if (requireSync) {
            if (isGroupdavDirectory(abUri)) {
                SynchronizeGroupdavAddressbook(abUri);
            }
        }
    }
}

function SCSetSearchCriteria(menuitem) {
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
    onEnterInSearchBar();
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

function SCCommandSynchronizeAbort() {
    SynchronizeGroupdavAddressbookAbort(gSelectedDir);
}

function SCCommandSynchronize() {
    SynchronizeGroupdavAddressbook(gSelectedDir, SCCommandSynchronizeCallback);
}

function SCCommandSynchronizeCallback(url, code, failures, datas) {
    dump("SCCommandSynchronizeCallback\n");
    dump("  url: " + url + "\n");
    dump("  code: " + code + "\n");
    for (let i in failures) {
        dump("  failure: " + i + "\n");
    }
}

// From SOGo Integrator
function openAbCreationDialog() {
	openDialog("chrome://sogo-connector/content/addressbook/creation-dialog.xul",
						 "addressbookCreate",
						 "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
						 this);
}

function openAbSubscriptionDialog() {
	openDialog("chrome://sogo-connector/content/general/subscription-dialog.xul",
						 "addressbookSubscribe",
						 "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
						 this);
}

function openABACLDialog() {
	let dir = GetSelectedDirectory();
	
	let abManager = Components.classes["@mozilla.org/abmanager;1"]
												    .getService(Components.interfaces.nsIAbManager);
	let abDir = abManager.getDirectory(dir).QueryInterface(Components.interfaces.nsIAbDirectory);

	let groupdavPrefService = new GroupdavPreferenceService(abDir.dirPrefId);
	let url = groupdavPrefService.getURL();

	openDialog("chrome://sogo-connector/content/general/acl-dialog.xul",
						 "addressbookACL",
						 "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
						 {url: url,
								 rolesDialogURL: "chrome://sogo-connector/content/addressbook/roles-dialog.xul"});
}

function openDeletePersonalDirectoryForbiddenDialog() {
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
  let bundle = document.getElementById("bundle_integrator_addressbook");

  promptService.alert(window,
                        deleteAbCmdLlabel,
                        bundle.getString("deletePersonalABError"));
}

function openDeletePublicDirectoryForbiddenDialog() {
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
  let bundle = document.getElementById("bundle_integrator_addressbook");

  promptService.alert(window,
                        deleteAbCmdLlabel,
                        bundle.getString("deletePublicABError"));
}

function SIAbDeleteDirectory(aURI) {
	let selectedDirectory = SCGetDirectoryFromURI(aURI);
	if (isGroupdavDirectory(aURI)) {
		let prefs = new GroupdavPreferenceService(selectedDirectory.dirPrefId);
		let url = prefs.getURL();
		let urlParts = url.split("/");
		if (url.indexOf(sogoBaseURL()) == 0
				&& urlParts[urlParts.length - 2] == "personal")
			openDeletePersonalDirectoryForbiddenDialog();
		else {
			if (SCAbConfirmDeleteDirectory(aURI)) {
				let selectedDirectory = SCGetDirectoryFromURI(aURI);
				let groupdavPrefService
					= new GroupdavPreferenceService(selectedDirectory.dirPrefId);
				let url = groupdavPrefService.getURL();
				if (url.indexOf(sogoBaseURL()) == 0) {
					let elements = url.split("/");
					let dirBase = elements[elements.length-2];
					let handler = new AddressbookHandler();
					if (dirBase.indexOf("_") == -1) {
						if (dirBase != 'personal') {
// 							dump("should delete folder: " + url+ "\n");
							deleteFolder(url, handler);
						}
					}
					else
						unsubscribeFromFolder(url, handler);
				}
				else
					SCDeleteDAVDirectory(aURI);
			}
		}
	}
	else if (isCardDavDirectory(aURI)) {
		let selectedDirectory = SCGetDirectoryFromURI(aURI);
		let url = selectedDirectory.wrappedJSObject.serverURL;
		if (url.indexOf(sogoBaseURL()) == 0)
			openDeletePublicDirectoryForbiddenDialog();
		else
			SCAbDeleteDirectory(aURI);
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
			let uri = GetSelectedDirectory();
			if (uri && isGroupdavDirectory(uri)) {
				let ab = SCGetDirectoryFromURI(uri);
				let prefs = new GroupdavPreferenceService(ab.dirPrefId);
				let dirURL = prefs.getURL();
				if (dirURL.indexOf(sogoBaseURL()) == 0) {
					let elements = dirURL.split("/");
					let dirBase = elements[elements.length-2];
					/* FIXME: we don't support usernames with underscores */
					result = (dirBase.indexOf("_") == -1);
				}
			}
		} else if (command == "addressbook_delete_addressbook_command") {
			let uri = GetSelectedDirectory();
			if (uri) {
				let cd;
				let url;
				let deleteMenuIsUnsubscribe = false;
				let ab = SCGetDirectoryFromURI(uri);
				if (isGroupdavDirectory(uri)) {
					let prefs = new GroupdavPreferenceService(ab.dirPrefId);
					url = prefs.getURL();
					cd = false;
				}
				else if (isCardDavDirectory(uri)) {
					url = ab.wrappedJSObject.serverURL;
					cd = true;
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
					deleteMenuItem.label
						= deleteMenuItem.getAttribute("unsubscribelabel");
				} else {
					deleteMenuItem.label = deleteMenuItem.getAttribute("deletelabel");
				}
			}
		}

		return result;
	},

 doCommand: function(command){},

 onEvent: function(event) {}
};

function subscriptionDialogType() {
	return "contact";
}

function subscriptionGetHandler() {
	return new AddressbookHandler();
}

window.creationGetHandler = subscriptionGetHandler;

function SISetupAbCommandUpdateHandlers(){
	let controller = new SIDirPaneController();

	let dirTree = document.getElementById("dirTree");
	if (dirTree) {
		dirTree.controllers.appendController(controller);
	}
}

function SICommandUpdate_AddressBook() {
	this.SICommandUpdate_AddressBookOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIGoUpdateGlobalEditMenuItems() {
	this.SIGoUpdateGlobalEditMenuItemsOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIGoUpdateSelectEditMenuItems() {
	this.SIGoUpdateSelectEditMenuItemsOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIOnLoadHandler() {
	this.SICommandUpdate_AddressBookOld = this.CommandUpdate_AddressBook;
	this.CommandUpdate_AddressBook = this.SICommandUpdate_AddressBook;
	this.SIGoUpdateGlobalEditMenuItemsOld = this.goUpdateGlobalEditMenuItems;
	this.goUpdateGlobalEditMenuItems = 	this.SIGoUpdateGlobalEditMenuItems;
	this.SIGoUpdateSelectEditMenuItemsOld = this.goUpdateSelectEditMenuItems;
	this.goUpdateSelectEditMenuItems = this.SIGoUpdateSelectEditMenuItems;

	this.AbDeleteDirectory = this.SIAbDeleteDirectory;

	SISetupAbCommandUpdateHandlers();

	let toolbar = document.getElementById("subscriptionToolbar");
	if (toolbar) {
		toolbar.collapsed = true;
		let ABChecker = new directoryChecker("Contacts");
		ABChecker.checkAvailability(function() { toolbar.collapsed = false; });
	}
}


window.addEventListener("load", SCOnLoad, false);
window.addEventListener("unload", SCOnUnload, false);
