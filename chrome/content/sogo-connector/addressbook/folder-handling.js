/* folder-handling.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

var { Services } = Components.utils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { CardDAVDirectory } = ChromeUtils.import("resource:///modules/CardDAVDirectory.jsm");

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
  return MailServices.ab.getDirectory(uri);
}

function SCCreateCardDAVDirectory(description, url) {
  //let abMgr = Components.classes["@mozilla.org/abmanager;1"]
  //    .getService(Components.interfaces.nsIAbManager);
  //let prefId = abMgr.newAddressBook(description, url.replace(/^http/, "carddav"), 0);
  dump("SCCreateCardDAVDirectory: " + description + " " + url + "\n");
  let prefId = MailServices.ab.newAddressBook(
    description,
    null,
    102,
    null
  );

  //Services.prefs.setStringPref(prefId + ".carddav.url", url);
  
  let book = MailServices.ab.getDirectoryFromId(prefId);
  book.setStringValue("carddav.url", url);

  return CardDAVDirectory.forFile(book.fileName);
  //return SCGetDirectoryFromURI("jscarddav://" + prefId);
  //return SCGetDirectoryFromURI("moz-abdavdirectory://" + prefId);
}

function SCCreateGroupDAVDirectory(description, url) {
  dump("SCCreateGroupDAVDirectory: " + description + " " + url + "\n");
  //let abMgr = Components.classes["@mozilla.org/abmanager;1"]
  //    .getService(Components.interfaces.nsIAbManager);
  //let prefId = abMgr.newAddressBook(description,
  //                                  null,
  //                                  Ci.nsIAbManager.JS_DIRECTORY_TYPE);
  let prefId = MailServices.ab.newAddressBook(
    description,
    null,
    101,
  );

  let groupdavPrefService = new GroupdavPreferenceService(prefId);
  groupdavPrefService.setURL(url);

  //let prefService = Components.classes["@mozilla.org/preferences-service;1"]
  //                            .getService(Components.interfaces.nsIPrefBranch);
  //let filename = Services.prefs.getCharPref(prefId + ".filename");
  //dump("filename: " + filename + "\n");
  return MailServices.ab.getDirectoryFromId(prefId);
  //return SCGetDirectoryFromURI("jsaddrbook://" + filename);
  //return SCGetDirectoryFromURI("moz-abmdbdirectory://" + filename);
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
    Services.prefs.deleteBranch(prefBranch);

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
        Services.prefs.setCharPref("mail.collect_addressbook", "jsaddrbook://abook.sqlite");
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

  if (isCardDavDirectory(uri)) {
    let directory = SCGetDirectoryFromURI(uri);
    if (directory) {
      try {
        SCDeleteDirectory(directory);
        //if (uri.indexOf("jscarddav://") == 0)
        //  Services.prefs.deleteBranch("extensions.ca.inverse.addressbook.groupdav."
        //                              + directory.dirPrefId);
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
