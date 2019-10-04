/* folder-handling.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2014
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

Components.utils.import("resource://gre/modules/Services.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("folder-handling.js: failed to include '" + files[i] +
                 "'\n" + e);
            if (e.fileName)
                dump ("\nFile: " + e.fileName
                      + "\nLine: " + e.lineNumber
                      + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js"]);

function SCGetDirectoryFromURI(uri) {
    // dump("SCGetDirectoryFromURI: " + uri + "\n");
    let abManager = Components.classes["@mozilla.org/abmanager;1"]
                              .getService(Components.interfaces.nsIAbManager);
    return abManager.getDirectory(uri);
}

function SCCreateCardDAVDirectory(description, url) {
    let abMgr = Components.classes["@mozilla.org/abmanager;1"]
                          .getService(Components.interfaces.nsIAbManager);
    let prefId = abMgr.newAddressBook(description, url.replace(/^http/, "carddav"), 0);

    return SCGetDirectoryFromURI("moz-abdavdirectory://" + prefId);
}

function SCCreateGroupDAVDirectory(description, url) {
    let abMgr = Components.classes["@mozilla.org/abmanager;1"]
                          .getService(Components.interfaces.nsIAbManager);
    let prefId = abMgr.newAddressBook(description, null,
                                      2 /* don't know which values should go in
                                         there but 2 seems to get the job
                                         done */);
    let groupdavPrefService = new GroupdavPreferenceService(prefId);
    groupdavPrefService.setURL(url);

    //let prefService = Components.classes["@mozilla.org/preferences-service;1"]
    //                            .getService(Components.interfaces.nsIPrefBranch);
    let filename = Services.prefs.getCharPref(prefId + ".filename");

    return SCGetDirectoryFromURI("moz-abmdbdirectory://" + filename);
}

function SCDeleteDirectoryWithURI(uri) {
    let directory = SCGetDirectoryFromURI(uri);
    if (directory)
        SCDeleteDirectory(directory);
}

function SCDeleteDirectory(directory) {
    let abURI = directory.URI;

    dump("SCDeleteDirectory: "  + directory + "\n"
         + "   delete abURI: " + abURI + "\n");

    let abMgr = Components.classes["@mozilla.org/abmanager;1"]
                          .getService(Components.interfaces.nsIAbManager);
    try {
        abMgr.deleteAddressBook(abURI);
    }
    catch(e) {
        dump("folder-handling.js: failed to delete '" + abURI + "'\n" + e);
        if (e.fileName)
            dump ("\nFile: " + e.fileName
                  + "\nLine: " + e.lineNumber
                  + "\n\n Stack:\n\n" + e.stack);
    }

    //let prefService = Components.classes["@mozilla.org/preferences-service;1"]
    //                            .getService(Components.interfaces.nsIPrefBranch);
    let prefBranch = directory.dirPrefId;
    dump("  dirPrefId: "  + prefBranch + "\n");
    Services.prefs.deleteBranch(prefBranch + ".position");

    let clearPrefsRequired = false;
    try {
        clearPrefsRequired
            = (Services.prefs.getCharPref("mail.collect_addressbook") == abURI
               && (Services.prefs.getBoolPref("mail.collect_email_address_outgoing")
                   || Services.prefs.getBoolPref("mail.collect_email_address_incoming")
                   || Services.prefs.getBoolPref("mail.collect_email_address_newsgroup")));
   }
   catch(e) {
        dump("Exception occured in SCDeleteDirectory() - " + e);
   }

   if (clearPrefsRequired) {
        Services.prefs.setBoolPref("mail.collect_email_address_outgoing", false);
        Services.prefs.setBoolPref("mail.collect_email_address_incoming", false);
        Services.prefs.setBoolPref("mail.collect_email_address_newsgroup", false);
        Services.prefs.setCharPref("mail.collect_addressbook",	"moz-abmdbdirectory://abook.mab");
    }

    dump("  deleted done\n");
}

function SCDeleteDirectories(directories) {
    for (let i = 0; i < directories.length; i++) {
        SCDeleteDirectory(directories[i]);
    }
}

function SCDeleteDAVDirectory(uri) {
    let result = false;
    dump("SCDeleteDAVDirectory : " + uri + "\n");

    if (isGroupdavDirectory(uri) || isCardDavDirectory(uri)) {
        let directory = SCGetDirectoryFromURI(uri);
        if (directory) {
            try {
                SCDeleteDirectory(directory);
                let prefBranch = directory.dirPrefId;
                //let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                //                            .getService(Components.interfaces.nsIPrefBranch);
                /* groupdav = moz-abmdbdirectory, carddav = moz-abdavdirectory */
                if (uri.indexOf("moz-abmdbdirectory://") == 0)
                    Services.prefs.deleteBranch("extensions.ca.inverse.addressbook.groupdav."
                                             + prefBranch);

                result = true;
            }
            catch(e) {
                dump("folder-handling.js: failed to delete '" + uri + "'\n" + e);
                if (e.fileName)
                    dump ("\nFile: " + e.fileName
                          + "\nLine: " + e.lineNumber
                          + "\n\n Stack:\n\n" + e.stack);
            };
        }
    }
    else {
        dump("attempting to delete a non-DAV directory: " + uri
             + "\n" + backtrace() + "\n\n");
        throw("attempting to delete a non-DAV directory: " + uri);
    }

    return result;
}
