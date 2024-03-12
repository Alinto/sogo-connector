/* folder-handler.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

function jsInclude(files, target) {
  let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader);
  for (let i = 0; i < files.length; i++) {
    try {
      loader.loadSubScript(files[i], target);
    }
    catch(e) {
      dump("folder-handler.js: failed to include '" + files[i] + "'\n" + e +
           "\nFile: " + e.fileName +
           "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
    }
  }
}

jsInclude(["chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://sogo-connector/content/addressbook/folder-handling.js"]);
jsInclude(["chrome://sogo-connector/content/global/sogo-config.js"]);

function AddressbookHandler() {
  this.doubles = {};
}

AddressbookHandler.prototype = {
  doubles: null,
  getExistingDirectories: function() {
    // dump("getExistingDirectories\n");
    let existing = {};
    let children = MailServices.ab.directories;

    if (!children)
      dump("warning: directories not ready, sync will probably occur later\n");

    for (let ab of MailServices.ab.directories) {
      let abURI = ab.URI;
      let abURL = null;
      // dump("  rdfAB.Value: " + abURI + "\n");
      //if (isGroupdavDirectory(abURI)) {
      //  let service = new GroupdavPreferenceService(ab.dirPrefId);
      //  abURL = service.getURL();
      //          // dump("  GroupDAV existing: " + ab.dirPrefId + " - " + abURL + "\n");
      //}
      if (isCardDavDirectory(abURI) && ab.getStringValue("carddav.url", "").indexOf(sogoBaseURL()) != -1) {
        abURL = ab.getStringValue("carddav.url", "");
        //abURL = ab.wrappedJSObject.serverURL;
        //dump("  CardDAV existing: " + ab.dirPrefId + " - " + abURL + "\n");

        if (existing[abURL])
          this.doubles[abURI] = ab;
        else
          existing[abURL] = ab;
      }
      
    }
    dump("   end getExistingDirectories\n");

    return existing;
  },
  removeDoubles: function() {
    let newDoubles = [];
    /* we need to use as hash here to ensure each abDirectory is only present once. */
    for (let abURI in this.doubles) {
      dump("   double uri: "  + abURI + "\n");
      newDoubles.push(this.doubles[abURI]);
    }

    dump("doubles:  " + newDoubles.length + "\n");

    SCDeleteDirectories(newDoubles);
  },
  addDirectories: function(newDirs) {
    for (let i = 0; i < newDirs.length; i++) {
      let description = "" + newDirs[i]['displayName'];
      let url = newDirs[i]['url'];
      let readOnly = (newDirs[i]['owner'] == "nobody");
      let directory = SCCreateCardDAVDirectory(description, url);
      try {
        directory.fetchAllFromServer();
        directory.setBoolValue("readOnly", readOnly);
      } catch(e) {
        dump(e);
      }

      //if (readOnly) { 
      //  let directory = SCCreateCardDAVDirectory(description, url);
      //  directory.fetchAllFromServer();
      //}
      //else {
      //let directory = SCCreateGroupDAVDirectory(description, url);
      //    let URI = directory.URI;
      //    let synchronizer = new GroupDavSynchronizer(URI);
      //    synchronizer.start();
      //  }
      }
    },
  renameDirectories: function(dirs) {
    for (let i = 0; i < dirs.length; i++) {
      let ab = dirs[i]['folder'];
      let oldName = ab.dirName;
      let displayName = dirs[i]['displayName'];
      if (oldName != displayName) {
        ab.dirName = displayName;
      }
    }
  },
  removeDirectories: function(oldDirs) {
    dump("removeDirectories: backtrace: " +  backtrace() + "\n\n\n");
    for (let i = 0; i < oldDirs.length; i++) {
      let abURI = oldDirs[i].URI;
      SCDeleteDAVDirectory(abURI);
    }
  },
  urlForParentDirectory: function() {
    return sogoBaseURL() + "Contacts";
  },
  ensurePersonalIsRemote: function() {
    this._ensureFolderIsRemote("abook.sqlite");
    if (this._autoCollectIsHistory()) {
      this._ensureHistoryIsPersonal();
    }
    this._ensureFolderIsRemote("history.sqlite");
  },
  _moveAddressBook: function(sourceAB, destAB) {
    //let abManager = Components.classes["@mozilla.org/abmanager;1"]
    //                          .getService(Components.interfaces.nsIAbManager);
    if (sourceAB.URI != destAB.URI) {
      /* ugly hack: we empty the addressbook after its cards were
         transfered, so that we can be sure the ab no longer "exists" */
      let cardsArray = [];

      let childCards = sourceAB.childCards;
      let countCards = 0;
      let countLists = 0;
      for (let card of childCards) {
        if (card.isMailList) {
          //let oldListDir = abManager.getDirectory(card.mailListURI);
          let oldListDir = MailServices.ab.getDirectory(card.mailListURI);
          let listDir = Components.classes["@mozilla.org/addressbook/directoryproperty;1"]
              .createInstance(Components.interfaces.nsIAbDirectory);
          listDir.isMailList = true;

          listDir.dirName = oldListDir.dirName;
          listDir.listNickName = oldListDir.listNickName;
          listDir.description = oldListDir.description;

          //for (let i = 0; i < oldListDir.addressLists.length; i++) {
          //  let subcard = oldListDir.addressLists.queryElementAt(i, Components.interfaces.nsIAbCard);
          for (let subcard of oldListDir.childCards) {
            let cloneCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"]
                .createInstance(Components.interfaces.nsIAbCard);
            cloneCard.copy(subcard);
            listDir.addressLists.appendElement(cloneCard, false);
          }
          destAB.addMailList(listDir);
          countLists++;
        }
        else {
          let cloneCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"]
              .createInstance(Components.interfaces.nsIAbCard);
          cloneCard.copy(card);
          destAB.addCard(cloneCard);
          countCards++;
        }
        //cardsArray.appendElement(card, false);
        cardsArray.push(card);
      }
      sourceAB.deleteCards(cardsArray);
      //sourceAB.QueryInterface(Components.interfaces.nsIAbMDBDirectory).database.close(true);
      if (countCards || countLists) {
        dump("moved " + countCards + " cards and "
             + countLists + " lists from " + sourceAB.URI
             + " to " + destAB.URI + "\n");
      }
    }
    else {
      dump("_moveAddressBook: source and destination AB are the same\n");
    }
  },
  _ensureFolderIsRemote: function(filename) {
    let localURI = "jsaddrbook://" + filename;
    let localAB = MailServices.ab.getDirectory(localURI);
    if (localAB) {
      let personalURL = sogoBaseURL() + "Contacts/personal/";

      dump("personalURL: " + personalURL + "\n");
      let existing = this.getExistingDirectories();
      let personalAB = existing[personalURL];

      if (!personalAB)
        personalAB = existing[personalURL.substr(0, personalURL.length - 1)];
      if (!personalAB) {
        let newDir = {url: personalURL,
                      displayName: "personal",
                      owner: sogoUserName()};
        this.addDirectories([newDir]);
        existing = this.getExistingDirectories();
        personalAB = existing[personalURL];
      }
      if (personalAB) {
        this._moveAddressBook(localAB, personalAB);
        SCDeleteDirectory(localAB);
      }
      else
        throw "Personal Addressbook cannot be replaced!";
    }
  },
  _autoCollectIsHistory: function() {
    let isHistory = false;
    try {
      let abURI = Services.prefs.getCharPref("mail.collect_addressbook");
      isHistory = (abURI == "jsaddrbook://history.sqlite"
                   || abURI == "jsaddrbook://abook.sqlite");
    }
    catch(e) {
    }

    return isHistory;
  },
    _ensureHistoryIsPersonal: function() {
        let personalURL = sogoBaseURL() + "Contacts/personal/";
        let existing = this.getExistingDirectories();
        let personalAB = existing[personalURL];
        Services.prefs.setCharPref("mail.collect_addressbook", personalAB.URI);
    },
    ensureAutoComplete: function() {
        let prefACURL;
        try {
            let prefACURLID = Services.prefs.getCharPref("sogo-connector.autocomplete.server.urlid");
            prefACURL = sogoBaseURL() + "Contacts/" + prefACURLID + "/";
        }
        catch(e) {
            prefACURL = null;
        }
        if (prefACURL) {
            let existing = this.getExistingDirectories();
            let acAB = existing[prefACURL];
            if (!acAB) {
                let newDir = {url: prefACURL,
                              displayName: "public",
                              owner: "nobody"};
                this.addDirectories([newDir]);
                existing = this.getExistingDirectories();
                acAB = existing[prefACURL];
            }
            if (acAB) {
                let abPrefID = acAB.dirPrefId;
                Services.prefs.setCharPref("ldap_2.autoComplete.directoryServer", abPrefID);
            }
            else
                dump("Could not set public directory as preferred autocomplete server\n");
        }
    }
};
