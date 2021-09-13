/* common-card-overlay.js - This file is part of "SOGo Connector".
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
};

var _window;
var _document;

function SCOnCommonCardOverlayLoad(window, document) {
  _window = window;
  _document = document;
  
  SICommonCardOverlay.onLoadHook();
  let catsArray = []
    /* categories */
  let cardCategoriesValue = _window.gEditCard.card.getProperty("Categories", "");

  if (cardCategoriesValue.length > 0)
    catsArray = multiValueToArray(cardCategoriesValue);

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
  let menuList = _document.createXULElement("menulist");
  menuList.setAttribute("is", "menulist-editable");
  menuList.setAttribute("editable", true);
  menuList.addEventListener("blur", SCOnCategoryBlur, false);
  menuList.addEventListener("change", SCOnCategoryChange, false);
  menuList.addEventListener("command", SCOnCategoryChange, false);
  SCResetCategoriesMenu(menuList, catValue);
  vbox.appendChild(menuList);

  return menuList;
}

function SCResetCategoriesMenu(menu, catValue) {
  let itemToSelect = null;
  menu.removeAllItems();
  
  for (let catName of gSCCardValues.categories) {
    let item = menu.appendItem(catName);
    if (catName == catValue) {
      dump("selecting item: " + catValue + "\n");
      itemToSelect = item;
    }
  }

  menu.selectedItem = itemToSelect;
}

function SCOnCategoryBlur() {
  let value = this.label.replace(/(^[ ]+|[ ]+$)/, "", "g");

  if (value.length == 0) {
    this.parentNode.removeChild(this);
  }
}

function SCOnCategoryChange() {
  if (this.selectedIndex == -1) { // text field was changed
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
  let vbox = _window.document.getElementById("abCategories");
  let menuLists = vbox.getElementsByTagName("menulist");
  let catsArray = [];
  for (var i = 0; i < menuLists.length; i++) {
    let value = menuLists[i].label.replace(/(^[ ]+|[ ]+$)/, "", "g");
    if (value.length > 0 && catsArray.indexOf(value) == -1) {
      catsArray.push(value);
    }
  }
  _window.gEditCard.card.setProperty("Categories", arrayToMultiValue(catsArray));
}

let SICommonCardOverlay = {
  initialCategories: null,

  onLoadHook: function SICO_onLoad() {
    this.initialCategories = SCContactCategories.getCategoriesAsString();

    let this_ = this;
    _window.addEventListener("unload",
                             function () { this_.onUnload(); },
                             false);
  },

  onUnload: function SICO_onUnload(event) {
    let newCategories = SCContactCategories.getCategoriesAsString();
    if (newCategories != this.initialCategories) {
      SIContactCategories.synchronizeToServer();
    }
  }
};
