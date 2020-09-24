/* -*- Mode: js2-mode; tab-width: 4; c-tab-always-indent: t; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            //dump("common-card-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://sogo-connector/content/addressbook/categories.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-connector/content/global/sogo-config.js"]);

let gSCCardValues = {
    documentDirty: false,
    categories: [],

    // This is necessary to allow the listener of webdavPutString and the
    // upload Observer to remain in scope since the dialog is closed before
    // the listener can do its job.

    messengerWindow: Components.classes["@mozilla.org/appshell/window-mediator;1"]
                               .getService(Components.interfaces.nsIWindowMediator)
                               .getMostRecentWindow("mail:3pane"),
    abWindow: Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Components.interfaces.nsIWindowMediator)
                        .getMostRecentWindow("mail:addressbook")
};

var _window;
var _document;

function SCOnCommonCardOverlayLoad(window, document) {
  _window = window;
  _document = document;
  
    if (typeof(SCOnCommonCardOverlayLoadPreHook) == "function") {
        SCOnCommonCardOverlayLoadPreHook();
    }
    /* categories */
    let cardCategoriesValue = _window.gEditCard.card.getProperty("Categories", "");
    let catsArray = multiValueToArray(cardCategoriesValue);
    gSCCardValues.categories = SCContactCategories.getCategoriesAsArray();

    /* we first check whether all the card categories exist in the prefs */
    let max = catsArray.length;
    let newCategories = [];
    for (let i = 0; i < max; i++) {
        let catName = catsArray[i];
        if (gSCCardValues.categories.indexOf(catName) == -1
            && newCategories.indexOf(catName) == -1) {
            newCategories.push(catName);
        }
    }
    if (newCategories.length > 0) {
        gSCCardValues.categories = gSCCardValues.categories.concat(newCategories);
        SCContactCategories.setCategoriesAsArray(gSCCardValues.categories);
        gSCCardValues.categories = SCContactCategories.getCategoriesAsArray();
    }

    /* we now add the combo boxes */
    for (let i = 0; i < max; i++) {
        SCAppendCategory(catsArray[i]);
    }
    let emptyField = document.getElementById("abEmptyCategory");
    emptyField.addEventListener("click", SCOnEmptyFieldFocus, false);

    /* events */
    //let tabPanelElement = document.getElementById("abTabPanels");
    //let menulists = tabPanelElement.getElementsByTagName("menulist");
    //for (let i = 0; i < menulists.length; i++) {
    //    menulists[i].addEventListener("mouseup", setDocumentDirty, true);
    //}
    //let textboxes = tabPanelElement.getElementsByTagName("html:input");
    //for (let i = 0; i < textboxes.length; i++) {
    //    textboxes[i].addEventListener("change", setDocumentDirty, true);
    //}
}

function SCOnEmptyFieldFocus(event) {
    let newCategory = SCAppendCategory("");
    newCategory.focus();
    event.preventDefault = true;
}

function SCAppendCategory(catValue) {
  let vbox = _document.getElementById("abCategories");
  //let menuList = document.createElement("menulist", { is : "menulist-editable" });
  //menuList.setAttribute("is", "menulist-editable");
  let menuList = _document.createXULElement("menulist");
  menuList.setAttribute("is", "menulist-editable");
  menuList.setAttribute("editable", true);
  menuList.addEventListener("blur", SCOnCategoryBlur, false);
  menuList.addEventListener("change", SCOnCategoryChange, false);
  menuList.addEventListener("command", SCOnCategoryChange, false);
  SCResetCategoriesMenu(menuList, catValue);
  //menuList.value = catValue;
  //menuList.label = catValue;
  
  vbox.appendChild(menuList);

  return menuList;
}

function SCResetCategoriesMenu(menu, catValue) {
  //let popups = menu.getElementsByTagName("menupopup");
  let itemToSelect = null;

  //for (let i = 0; i < popups.length; i++) {
  //  menu.removeChild(popups[i]);
  //}
  menu.removeAllItems();
  
  //let menuPopup = document.createXULElement("menupopup");
  for (let catName of gSCCardValues.categories) {
    //let item = document.createElement("menuitem");
    //item.setAttribute("label", catName);
    //menuPopup.appendChild(item);
    let item = menu.appendItem(catName);
    if (catName == catValue) {
      dump("selecting item: " + catValue + "\n");
      itemToSelect = item;
    }
  }

  menu.selectedItem = itemToSelect;
  //menu.appendChild(menuPopup);
}

function SCOnCategoryBlur() {
  //let value = this.inputField.value
  //                .replace(/(^[ ]+|[ ]+$)/, "", "g");
  let value = this.label.replace(/(^[ ]+|[ ]+$)/, "", "g");

  if (value.length == 0) {
    this.parentNode.removeChild(this);
  }
}

function SCOnCategoryChange() {
  if (this.selectedIndex == -1) { // text field was changed
    //let value = this.inputField.value;
    let value = this.label;
    if (value.length > 0) {
      if (gSCCardValues.categories.indexOf(value) < 0) {
        gSCCardValues.categories.push(value);
        SCContactCategories.setCategoriesAsArray(gSCCardValues.categories);
        gSCCardValues.categories = SCContactCategories.getCategoriesAsArray();
        let box = document.getElementById("abCategories");
        let lists = box.getElementsByTagName("menulist");
        for (let i = 0; i < lists.length; i++) {
          SCResetCategoriesMenu(lists[i]);
        }
      }
    }
  }
}

function SCSaveCategories() {
  let vbox = document.getElementById("abCategories");
  let menuLists = vbox.getElementsByTagName("menulist");
  let catsArray = [];
  for (var i = 0; i < menuLists.length; i++) {
      //let value = menuLists[i].inputField.value
    //                        .replace(/(^[ ]+|[ ]+$)/, "", "g");
    let value = menuLists[i].label.replace(/(^[ ]+|[ ]+$)/, "", "g");
    if (value.length > 0 && catsArray.indexOf(value) == -1) {
      catsArray.push(value);
    }
  }
  window.gEditCard.card.setProperty("Categories", arrayToMultiValue(catsArray));
}

// function getUri() {
//     let uri;

//     if (window.gEditCard.abURI && gEditCard.abURI == kAllDirectoryRoot + "?") { // Find the correct address book for "All Address Books"
//         let dirId = window.gEditCard.card.directoryId
//                              .substring(0, window.gEditCard.card.directoryId.indexOf("&"));
//         uri = MailServices.ab.getDirectoryFromId(dirId).URI;
//     }
//     else if (document.getElementById("abPopup")) {
//         uri = document.getElementById("abPopup").value;
//     }
//     else if (window.arguments[0].abURI) {
//         uri = window.arguments[0].abURI;
//     }
//     else
//         uri = window.arguments[0].selectedAB;

//     return uri;
// }

// function setDocumentDirty(boolValue) {
//     gSCCardValues.documentDirty = boolValue;
// }

// function saveCard(isNewCard) {
//     try {
//         let parentURI = getUri();
//         let uriParts = parentURI.split("/");
//         parentURI = uriParts[0] + "//" + uriParts[2];

//         if (gSCCardValues.documentDirty
//             && isCardDavDirectory(parentURI)) {
//             SCSaveCategories();
//             //let oldDavVersion = window.gEditCard.card.getProperty("groupDavVersion", "-1");
//             //window.gEditCard.card.setProperty("groupDavVersion", "-1");
//             //window.gEditCard.card.setProperty("groupDavVersionPrev", oldDavVersion);

//             let abManager = Components.classes["@mozilla.org/abmanager;1"]
//                                       .getService(Components.interfaces.nsIAbManager);
//             let ab = abManager.getDirectory(parentURI);
//             ab.modifyCard(window.gEditCard.card);

//             // We make sure we try the messenger window and if it's closed, the address book
//             // window. It might fail if both of them are closed and we still have a composition
//             // window open and we try to modify the card from there (from the contacts sidebar)
//             if (gSCCardValues.messengerWindow)
//                 gSCCardValues.messengerWindow.SCSynchronizeFromChildWindow(parentURI);
//             else
//                 gSCCardValues.abWindow.SCSynchronizeFromChildWindow(parentURI);

//             setDocumentDirty(false);
//         }
//     }
//     catch(e) {
//         if (typeof gSCCardValues.messengerWindow.exceptionHandler != "undefined")
//             gSCCardValues.messengerWindow.exceptionHandler(null, "saveCard", e);
//     }
// }

// function inverseInitEventHandlers() {
// // 	if (isGroupdavDirectory(getUri()))
// // 		RegisterSaveListener(setGroupDavFields);
// 	inverseSetupFieldsEventHandlers();
// }

function isLDAPDirectory(uri) {
    let ab = GetDirectoryFromURI(uri);

    return (ab.isRemote && !isCardDavDirectory(uri));
}

// From SOGo Integrator
let SICommonCardOverlay = {
  initialCategories: null,

  onLoadHook: function SICO_onLoad() {
    this.initialCategories = SCContactCategories.getCategoriesAsString();

    let this_ = this;
    //window.addEventListener("unload",
    //                        function () { this_.onUnload(); },
    //                        false);
  },

  onUnload: function SICO_onUnload(event) {
    let newCategories = SCContactCategories.getCategoriesAsString();
    if (newCategories != this.initialCategories) {
      SIContactCategories.synchronizeToServer();
        }
  }
};

let SCOnCommonCardOverlayLoadPreHook = function() { SICommonCardOverlay.onLoadHook(); };

//window.addEventListener("load", SCOnCommonCardOverlayLoad, false);
function onLoad(activatedWhileWindowOpen) {
  dump("common-card-overlay.js: onLoad()\n");
  SCOnCommonCardOverlayLoad();
}
