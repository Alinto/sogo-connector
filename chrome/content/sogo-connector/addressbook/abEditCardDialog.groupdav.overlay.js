/* abEditCardDialog.groupdav.overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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
             dump("abEditCardDialog.groupdav.overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
         }
     }
}

jsInclude(["chrome://sogo-connector/content/addressbook/common-card-overlay.js"]);


/* starting... */
function OnLoadHandler() {
  let uri = getUri();
  if (isGroupdavDirectory(uri)) {
    //this.OldEditCardOKButton = this.EditCardOKButton;
    //this.EditCardOKButton = this.SCEditCardOKButton;
    document.addEventListener("dialogaccept", SCEditCardOKButton);
  }
}

/* event handlers */
function SCEditCardOKButton() {
  //let result = this.OldEditCardOKButton();
  //   if (result) {
  //let ab = GetDirectoryFromURI(gEditCard.abURI);
  if (isGroupdavDirectory(gEditCard.abURI)) {
    setDocumentDirty(true);
    saveCard(false);
  }
  //return result;
}

window.addEventListener("load", OnLoadHandler, false);
