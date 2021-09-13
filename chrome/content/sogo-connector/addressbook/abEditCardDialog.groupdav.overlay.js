/* abEditCardDialog.groupdav.overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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
      //dump("abEditCardDialog.groupdav.overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
    }
  }
}

function i18n(entity) {
  let msg = entity.slice(1,-1);
  return WL.extension.localeData.localizeMessage(msg);
} 

jsInclude(["chrome://sogo-connector/content/addressbook/common-card-overlay.js"]);

/* starting... */
function OnLoadHandler() {
  dump("abEditCardDialog.groupdav.overlay.js: OnLoadHandler()\n");
  window.SCOldOnLoadEditCard();
  SCOnCommonCardOverlayLoad(window, document);
}

/* event handlers */
function SCEditCardOKButton() {
  dump("abEditCardDialog.groupdav.overlay.js: SCEditCardOKButton()\n");
  SCSaveCategories();
  return window.SCOldEditCardOKButton();
}

function onLoad(activatedWhileWindowOpen) {
  dump("abEditCardDialog.groupdav.overlay.js: onLoad()\n");

  WL.injectCSS("chrome://messenger/skin/input-fields.css");
  WL.injectElements(`
  <tabs id="abTabs">
    <tab insertbefore="homeTabButton" id="categoriesTabButton" label="&sogo-connector.tabs.categories.label;"/>
  </tabs>
  <tabpanels id="abTabPanels">
    <vbox id="abCategoriesTab" flex="0" style="max-height: 200px; overflow-y: auto;" insertbefore="abHomeTab">
      <vbox id="abCategories">
      </vbox>
      <html:input id="abEmptyCategory" readonly="true"/>
    </vbox>
  </tabpanels>`.replaceAll(/&(.*?);/g, i18n));

  window.SCOldOnLoadEditCard = window.OnLoadEditCard;
  window.OnLoadEditCard = OnLoadHandler;

  window.SCOldEditCardOKButton = window.EditCardOKButton;
  window.EditCardOKButton = SCEditCardOKButton;
}
