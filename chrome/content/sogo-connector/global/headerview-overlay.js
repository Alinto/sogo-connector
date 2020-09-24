/* headerview-overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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
      dump("headerview-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
    }
  }
}

jsInclude(["chrome://sogo-connector/content/addressbook/folder-handler.js"]);

/* TODO: this module should handle synchronization after card editing,
 including moves between abs */

/* The original "AddContact" method (./mail/base/content/msgHdrView.js) makes use of
 "moz-abmdbdirectory://abook.mab", which we remove at startup... */

function AddContact(emailAddressNode)
{
  emailAddressNode.setAttribute("updatingUI", true);

  let abManager = Components.classes["@mozilla.org/abmanager;1"]
      .getService(Components.interfaces.nsIAbManager);
  
  let handler = new AddressbookHandler();
  let existing = handler.getExistingDirectories();
  let personalURL = sogoBaseURL() + "Contacts/personal/";
  let addressBook = existing[personalURL];

  let card = Components.classes["@mozilla.org/addressbook/cardproperty;1"]
      .createInstance(Components.interfaces.nsIAbCard);
  card.displayName = emailAddressNode.getAttribute("displayName");
  card.primaryEmail = emailAddressNode.getAttribute("emailAddress");

  // Just save the new node straight away.
  addressBook.addCard(card);

  emailAddressNode.removeAttribute("updatingUI");

  let synchronizer = new GroupDavSynchronizer(addressBook.URI);
  synchronizer.start();
}

function onLoad(activatedWhileWindowOpen) {
  dump("headerview-overlay.js: onLoad()\n");
}
