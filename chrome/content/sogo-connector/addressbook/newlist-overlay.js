/* newlist-overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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
  var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader);
  for (var i = 0; i < files.length; i++) {
    try {
      loader.loadSubScript(files[i], target);
    }
    catch(e) {
      //dump("newlist-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
    }
  }
}

jsInclude(["chrome://sogo-connector/content/global/sogo-config.js",
           "chrome://sogo-connector/content/addressbook/folder-handler.js"]);

function SIOnNewListOverlayLoad() {
    var abPopup = document.getElementById("abPopup");
    if (abPopup.value == kPersonalAddressbookURI) {
        var handler = new AddressbookHandler();
        var existing = handler.getExistingDirectories();
        var personalURL = sogoBaseURL() + "Contacts/personal/";
        var directory = existing[personalURL]
            .QueryInterface(Components.interfaces.nsIRDFResource);
        abPopup.value = directory.Value;
    }
}

//window.addEventListener("load", SIOnNewListOverlayLoad, false);
function onLoad(activatedWhileWindowOpen) {
  dump("newlist-overlay.js: onLoad()\n");
  SIOnNewListOverlayLoad();
}
