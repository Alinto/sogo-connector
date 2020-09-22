/* edit-list-overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

jsInclude(["chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js"]);

let autocompleteWidgetPrefix = "addressCol1";

function OnLoadEditListOverlay() {
  document.addEventListener("dialogaccept", function(event) {
    if (typeof(window.arguments[0].listURI) == "undefined")
      SCMailListOKButton(event);
    else
      SCEditListOKButton(event);
  });
}

function SCMailListOKButton() {
  let popup = document.getElementById('abPopup');
  let uri = popup.getAttribute('value');
  
  if (isGroupdavDirectory(uri))
    window.opener.SCSynchronizeFromChildWindow(uri);
  
}

function SCEditListOKButton(event) {    
  let listURI = window.arguments[0].listURI;
  let parentURI = GetParentDirectoryFromMailingListURI(listURI);

  if (isGroupdavDirectory(parentURI)) {
    let w = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator)
        .getMostRecentWindow("mail:addressbook");

    if (!w) {
      w = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator)
        .getMostRecentWindow("mail:3pane");
    }

    let attributes = new GroupDAVListAttributes(listURI);
    attributes.version = "-1";
    w.SCSynchronizeFromChildWindow(parentURI);
  }
}

//window.addEventListener("load", OnLoadEditListOverlay, false);
function onLoad(activatedWhileWindowOpen) {
  dump("edit-list-overlay.js: onLoad()\n");
  OnLoadEditListOverlay();
}
