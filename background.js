/* background.js - This file is part of "SOGo Connector", a Thunderbird extension.
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


(async () => {  
  messenger.WindowListener.registerChromeUrl([ 
    ["content",  "sogo-connector",           "chrome/content/sogo-connector/"],
    ["content",  "inverse-library",          "chrome/content/inverse-library/"],
    ["resource", "sogo-connector",           "chrome/"]
  ]);

  // rework unload?
  messenger.WindowListener.registerWindow("chrome://messenger/content/messenger.xhtml",
                                          "chrome://sogo-connector/content/calendar/calendar-overlay.js");

  // TODO: not working remove xul
  messenger.WindowListener.registerWindow("chrome://messenger/content/messageWindow.xhtml",
                                          "chrome://sogo-connector/content/addressbook/messagewindow-overlay.js");

  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/addressbook.xhtml",
                                          "chrome://sogo-connector/content/addressbook/addressbook.groupdav.overlay.js");

  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abNewCardDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/abNewCardDialog.groupdav.overlay.js");
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abEditCardDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/abEditCardDialog.groupdav.overlay.js");

  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abMailListDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/edit-list-overlay.js");
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abEditListDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/edit-list-overlay.js");

  // TODO: must create JS file. use for autocomplete
  // we might just drop that entirely
  messenger.WindowListener.registerWindow("chrome://messenger/content/messengercompose/messengercompose.xhtml",
                                         "chrome://sogo-connector/content/messengercompose/messengercompose-overlay.js");

  messenger.WindowListener.registerWindow("chrome://calendar/content/calendar-invitations-dialog.xhtml",
                                          "chrome://sogo-connector/content/calendar/calendar-invitations-dialog.js");

  // // need to test if the unload function is called
  // messenger.WindowListener.registerWindow("chrome://global/content/commonDialog.xhtml",
  //                                         "chrome://sogo-connector/content/global/common-dialog-overlay.js");

  messenger.WindowListener.registerWindow("chrome://messenger/content/newTagDialog.xhtml",
                                          "chrome://sogo-connector/content/global/newtag-overlay.js");

  // kPersonalAddressbookURI is undefined and makes use of RDF
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abMailListDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/newlist-overlay.js");

  messenger.WindowListener.registerWindow("chrome://calendar/content/calendar-properties-dialog.xhtml",
                                          "chrome://sogo-connector/content/calendar/properties-overlay.js");

  messenger.WindowListener.registerWindow("chrome://calendar/content/calendar-event-dialog.xhtml",
                                          "chrome://sogo-connector/content/calendar/calendar-event-dialog.js");
                                          
  messenger.WindowListener.registerStartupScript("chrome://sogo-connector/content/messenger/startup-overlay.js");
  messenger.WindowListener.startListening();
})();
