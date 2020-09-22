(async () => {
  
  messenger.WindowListener.registerChromeUrl([ 
    ["content",  "sogo-connector",           "chrome/content/sogo-connector/"],
    ["content",  "inverse-library",          "chrome/content/inverse-library/"],
    ["resource", "sogo-connector",           "chrome/"]
  ]);
  
  messenger.WindowListener.registerStartupScript("chrome://sogo-connector/content/messenger/startup-overlay.js");

  // rework unload?
  messenger.WindowListener.registerWindow("chrome://messenger/content/messenger.xhtml",
                                          "chrome://sogo-connector/content/calendar/calendar-overlay.js");

  // to wipe
  //messenger.WindowListener.registerWindow("chrome://messenger/content/messenger.xhtml",
  //                                        "chrome://sogo-connector/content/addressbook/messenger.groupdav.overlay.js");

  // TODO: not working remove xul
  messenger.WindowListener.registerWindow("chrome://messenger/content/messageWindow.xhtml",
                                          "chrome://sogo-connector/content/addressbook/messagewindow-overlay.js");

  // to combine
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/addressbook.xhtml",
                                          "chrome://sogo-connector/content/addressbook/addressbook.groupdav.overlay.js");

  // to wipe
  //messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/addressbook.xhtml",
  //                                        "chrome://sogo-connector/content/addressbook/cardview-overlay.js");

  // Seems OK but not possible to add categories
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abNewCardDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/abNewCardDialog.groupdav.overlay.js");
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abEditCardDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/abEditCardDialog.groupdav.overlay.js");

  // both seem OK
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abMailListDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/edit-list-overlay.js");
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abEditListDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/edit-list-overlay.js");

  // TODO: not working, abCardOverlay.xhtml does not exist anynore
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abCard.inc.xhtml",
                                          "chrome://sogo-connector/content/addressbook/common-card-overlay.js");

  // TODO: must create JS file. use for autocomplete
  // we might just drop that entirely
  messenger.WindowListener.registerWindow("chrome://messenger/content/messengercompose/messengercompose.xhtml",
                                          "chrome://sogo-connector/content/messengercompose/messengercompose-overlay.js");

  messenger.WindowListener.registerWindow("chrome://calendar/content/calendar-invitations-dialog.xhtml",
                                          "chrome://sogo-connector/content/calendar/calendar-invitations-dialog.js");

  // TODO
  messenger.WindowListener.registerWindow("about:preferences",
                                          "chrome://sogo-connector/content/preferences/preferences-overlay.js");

  // need to test if the unload function is called
  messenger.WindowListener.registerWindow("chrome://global/content/commonDialog.xhtml",
                                          "chrome://sogo-connector/content/global/common-dialog-overlay.js");

  // probably OK - merge wth other overlay on messenger.xhtml
  //messenger.WindowListener.registerWindow("chrome://messenger/content/messenger.xhtml",
  //                                        "chrome://sogo-connector/content/global/headerview-overlay.js");


  // seems OK, drop XUL
  messenger.WindowListener.registerWindow("chrome://messenger/content/newTagDialog.xhtml",
                                          "chrome://sogo-connector/content/global/newtag-overlay.js");


  // kPersonalAddressbookURI is undefined and makes use of RDF
  messenger.WindowListener.registerWindow("chrome://messenger/content/addressbook/abMailListDialog.xhtml",
                                          "chrome://sogo-connector/content/addressbook/newlist-overlay.js");
  
  messenger.WindowListener.registerWindow("chrome://calendar/content/calendar-properties-dialog.xhtml",
                                          "chrome://sogo-connector/content/calendar/properties-overlay.js");

  messenger.WindowListener.registerWindow("chrome://calendar/content/calendar-event-dialog.xhtml",
                                          "chrome://sogo-connector/content/calendar/calendar-event-dialog.js");

  messenger.WindowListener.startListening();
})();
