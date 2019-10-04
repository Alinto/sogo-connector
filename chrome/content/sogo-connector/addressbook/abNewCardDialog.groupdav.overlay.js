/* abNewCardDialog.groupdav.overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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
             dump("abNewCardDialog.groupdav.overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
         }
     }
}

jsInclude(["chrome://sogo-connector/content/addressbook/common-card-overlay.js"]);

function OnLoadHandler() {
  //this.OldNewCardOKButton = this.NewCardOKButton;
  //this.NewCardOKButton = this.SCNewCardOKButton;

  document.addEventListener("dialogaccept", SCNewCardOKButton);
  
  // From SOGo Integrator
  if (gEditCard.selectedAB && gEditCard.selectedAB == kPersonalAddressbookURI) {
    let handler = new AddressbookHandler();
    let existing = handler.getExistingDirectories();
    let personalURL = sogoBaseURL() + "Contacts/personal/";
    let directory = existing[personalURL];
    gEditCard.selectedAB = directory.URI;
    document.getElementById("abPopup").value = directory.URI;
  }
}

function SCNewCardOKButton() {
  dump("\n\n\nSCNewCardOKButton!!!\n\n\n");
  //let result = this.OldNewCardOKButton();
  //if (result) {
  setDocumentDirty(true);
  saveCard(true);
  //}
  //return result;
}

window.addEventListener("load", OnLoadHandler, false);
