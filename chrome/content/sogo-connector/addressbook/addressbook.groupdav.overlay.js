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

/* AbDeleteDirectory done cleanly... */
function SCAbDeleteDirectory(aURI) {
  let result = false;

  dump("SCAbDeleteDirectory: aURI: " + aURI + "\n");
  //dump("  backtrace:\n" + backtrace() + "\n\n");

  if (isCardDavDirectory(aURI)) {
    SCAbConfirmDeleteDirectory(aURI).then(function(result) {
      if (result)
        SCDeleteDAVDirectory(aURI);
    });
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

async function SCAbConfirmDeleteDirectory(aURI) {

  let directory = window.GetDirectoryFromURI(aURI);
  if (
    !directory ||
    ["ldap_2.servers.history", "ldap_2.servers.pab"].includes(
      directory.dirPrefId
    )
  ) {
    return;
  }

  let action = "delete-book";
  if (directory.isMailList) {
    action = "delete-lists";
  } else if (
    [
      Ci.nsIAbManager.CARDDAV_DIRECTORY_TYPE,
      Ci.nsIAbManager.LDAP_DIRECTORY_TYPE,
    ].includes(directory.dirType)
  ) {
    action = "remove-remote-book";
  }

  let [title, message] = await document.l10n.formatValues([
    { id: `about-addressbook-confirm-${action}-title`, args: { count: 1 } },
    {
      id: `about-addressbook-confirm-${action}`,
      args: { name: directory.dirName, count: 1 },
    },
  ]);

  return Services.prompt.confirm(window, title, message);
}

function SCSynchronizeFromChildWindow() {
  let uri = window.GetSelectedDirectory()
  SynchronizeGroupdavAddressbook(uri, null, 0);
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
  }
}

window.SCSetSearchCriteria = function(menuitem) {
  let criteria = menuitem.getAttribute("sc-search-criteria");
  if (criteria.length > 0) {
    window.gQueryURIFormat = "(or(" + criteria + ",c,@V))"; // the "or" is important here
  }
  else {
    let nameOrEMailSearch = "";
    if (Services.prefs.getComplexValue("mail.addr_book.show_phonetic_fields", Components.interfaces.nsIPrefLocalizedString).data == "true") {
      nameOrEMailSearch =  Services.prefs.getCharPref("mail.addr_book.quicksearchquery.format.phonetic");
    } else {
      nameOrEMailSearch = Services.prefs.getCharPref("mail.addr_book.quicksearchquery.format");
    }

    // (or(DisplayName,c,@V)(FirstName,c,@V)(LastName,c,@V)(NickName,c,@V)(PrimaryEmail,c,@V)(SecondEmail,c,@V)(and(IsMailList,=,TRUE)(Notes,c,@V))(Company,c,@V)(Department,c,@V)(JobTitle,c,@V)(WebPage1,c,@V)(WebPage2,c,@V)(PhoneticFirstName,c,@V)(PhoneticLastName,c,@V))
    if (nameOrEMailSearch.startsWith("?"))
      nameOrEMailSearch = nameOrEMailSearch.slice(1);

    window.gQueryURIFormat = nameOrEMailSearch;
  }
  window.document.getElementById('peopleSearchInput').setAttribute("placeholder", menuitem.getAttribute("label"));
  window.document.getElementById('peopleSearchInput').focus();
  window.onEnterInSearchBar();
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
      SCAbConfirmDeleteDirectory(aURI).then(function(result) {
        if (result) {
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
      });
    } // if (url.indexOf(sogoBaseURL()) == 0 ...
  } // if (isCardDavDirectory(aURI)) { ..
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

  window.AbSyncSelectedDirectory = SCSynchronizeFromChildWindow;
  
  this.SCAbEditSelectedDirectoryOriginal = window.AbEditSelectedDirectory;
  window.AbEditSelectedDirectory = this.SCAbEditSelectedDirectory;
  //this.SCAbDeleteOriginal = window.AbDelete;
  //window.AbDelete = this.SCAbDelete;
  window.SCAbDeleteDirectoryOriginal = window.AbDeleteDirectory;
  //window.AbDeleteDirectory = this.SCAbDeleteDirectory;

  /* command updaters */
  // FIXME: remove all old functions
  //this.SCCommandUpdate_AddressBookOld = this.CommandUpdate_AddressBook;
  //this.CommandUpdate_AddressBook = this.SCCommandUpdate_AddressBook;
  //this.SCGoUpdateGlobalEditMenuItemsOld = this.goUpdateGlobalEditMenuItems;
  //this.goUpdateGlobalEditMenuItems = 	this.SCGoUpdateGlobalEditMenuItems;
  //this.SCGoUpdateSelectEditMenuItemsOld = this.goUpdateSelectEditMenuItems;
  //this.goUpdateSelectEditMenuItems = this.SCGoUpdateSelectEditMenuItems;

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
}
