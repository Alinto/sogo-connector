/* CardDAVDirectoryFactory.js - This file is part of "SOGo Connector", a Thunderbird extension.
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


var { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");


//class constructor
function CardDAVDirectoryFactory() {
    // 	dump("CardDAVDirectoryFactory constructed\n");
};

//class definition
CardDAVDirectoryFactory.prototype = {
    /* nsIClassInfo */
    classID: Components.ID("{868e510b-d758-4f6f-8cba-c223347ab644}"),
    contractID: null,
    classDescription: "CardDAV directory factory",

    getInterfaces: function cDACLM_getInterfaces(count) {
        const ifaces = [Components.interfaces.nsIAbDirFactory,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function cDACLM_getHelperForLanguage(language) {
        return null;
    },
    //implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    /* nsIAbDirFactory */
    getDirectories: function(aDirName, aURI, aPrefId) {
        dump("CardDAVDirectoryFactory.js: getDirectories"
             + "\n  aDirName: " + aDirName
             + "\n  aURI: " + aURI
             + "\n  aPrefId: " + aPrefId + "\n");

        let baseArray = Components.classes["@mozilla.org/array;1"]
            .createInstance(Components.interfaces.nsIMutableArray);
      try {
        let directoryURI = "moz-abdavdirectory://" + aPrefId;
        dump("Getting directory at URI: " + directoryURI + "\n");
        //let abManager = Components.classes["@mozilla.org/abmanager;1"]
        //    .getService(Components.interfaces.nsIAbManager);
        //let directory = abManager.getDirectory(directoryURI);
        //let directory = GetDirectoryFromURI(directoryURI);
        let directory = MailServices.ab.getDirectory(directoryURI);
        baseArray.appendElement(directory, false);
      } catch (e) {
        dump("Error in getDirectories(): " + e + "\n");
      }
        let directoryEnum = baseArray.enumerate();

        return directoryEnum;
    },

    //void deleteDirectory ( nsIAbDirectory directory )
    deleteDirectory: function(directory) {
        dump("CardDAVDirectoryFactory.js: deleteDirectory: directory: " + directory + "\n");
        // throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    QueryInterface: function(aIID) {
        if (!aIID.equals(Components.interfaces.nsIAbDirFactory)
            && !aIID.equals(Components.interfaces.nsIClassInfo)
            && !aIID.equals(Components.interfaces.nsISupports)) {
            dump("CardDAVDirectoryFactory.js: NO INTERFACE: "  + aIID + "\n");
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    }
};

/** Module Registration */
function NSGetFactory(cid) {
    return (XPCOMUtils.generateNSGetFactory([CardDAVDirectoryFactory]))(cid);
}
