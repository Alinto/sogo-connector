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
