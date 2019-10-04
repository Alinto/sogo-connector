/* CardDAVDirectory.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2018
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

const gCardDavPrefix = "carddav";
const gABPrefix = "moz-abdavdirectory://";

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("CardDAVDirectory.js: failed to include '" + files[i] +
                 "'\n" + e
                 + "\nFile: " + e.fileName
                 + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-connector/content/general/vcards.utils.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js"]);

function CardDAVDirectory() {
    // 	dump("\n\nCardDAVDirectory.js: CardDAVDirectory constructed\n");

    this.mValue = "";
    this.mQuery = "";
    this.mDirPrefId = "";
    this.mDescription = "";
    this.mURI = "";

    this.mCardCache = {};

    this.wrappedJSObject = this;
}

CardDAVDirectory.prototype = {
    wrappedJSObject: null,
    directoryProperties: null,
    mAddressLists: null,
    mCardCache: null,

    mDirPrefId: null,
    mDescription: null,
    mURI: null, /* http uri of carddav ab */
    mValue: null, /* internal tbird uri */

    /* nsIAbCollection (parent of nsIAbDirectory) */
    get readOnly() {
        return true;
    },

    get isRemote() {
        return true;
    },

    get isSecure() {
        let url = this.serverURL;

        return (url && (url.indexOf("https") == 0));
    },

    cardForEmailAddress: function(emailAddress) {
        // dump("CardDAVDirectory: cardForEmailAddress: " + emailAddress + "\n");
    	// FIXME - we return null right away in order to prevent Thunderbird
	// of search in all address books, so all CardDAV address books, when displaying
	// an email. This can be very costly for slow networks. We might eventually add
	// this back when we have proper caching in place.
	return null;

    	// let card = this.mCardCache[emailAddress];
        // if (card) {
        //     if (!(card instanceof Components.interfaces.nsIAbCard)) {
        //         card = null;
        //     }
        // }
        // else {
        //     let card = null;
        //     let httpURL = this.serverURL;
        //     if (httpURL) {
        //         let resultArray = this._serverQuery(httpURL, emailAddress);
        //         if (resultArray.length > 0) {
        //             card = resultArray.queryElementAt(0, Components.interfaces.nsIAbCard);
        //         }
        //     }
        //     this.mCardCache[emailAddress] = (card ? card : "none");
        // }

        // return card;
    },

    getCardFromProperty: function(aProperty, aValue, aCaseSensitive) {
        let card = null;

        if (aProperty == "PrimaryEmail" || aProperty == "SecondEmail") {
            card = this.cardForEmailAddress(aValue);
        }
        else {
            dump("CardDAVDirecory: getCardFromProperty: unimp\n"
                 + "  aProperty: " + aProperty + "\n"
                 + "  aValue: " + aValue + "\n");
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        }

        return card;
    },

    getCardsFromProperty: function(aProperty, aValue, aCaseSensitive) {
        dump("CardDAVDirecory: getCardsFromProperty: unimp\n"
             + "  aProperty: " + aProperty + "\n"
             + "  aValue: " + aValue + "\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    /* nsIAbDirectory */
    propertiesChromeURI: "chrome://sogo-connector/content/addressbook/preferences.addressbook.groupdav.xul",

    get dirName() {
      //let conv = Components.classes["@mozilla.org/intl/utf8converterservice;1"]
      //                     .createInstance(Components.interfaces.nsIUTF8ConverterService);
      //return conv.convertStringToUTF8(this.mDescription, "iso-8859-1", false);
      let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
          .createInstance(Ci.nsIScriptableUnicodeConverter);
      converter.charset = "iso-8859-1";
      return converter.ConvertToUnicode(this.mDescription);
    },
    set dirName(val) {
        if (this.mDescription != val) {
            let oldValue = this.mDescription;
            this.mDescription = String(val);
            let prefName = this.mDirPrefId;
            //let service = Components.classes["@mozilla.org/preferences-service;1"]
            //                        .getService(Components.interfaces.nsIPrefService);
            try {
                let branch = Services.prefs.getBranch(prefName + ".");
                branch.setCharPref("description", this.mDescription);
            }
            catch(e) {
                dump("directory-properties: exception (new directory '" + prefName
                     + "', URI '" + this.mValue + "' ?):" + e + "\n");
            }

            let abManager = Components.classes["@mozilla.org/abmanager;1"]
                                      .getService(Components.interfaces.nsIAbManager);
            abManager.notifyItemPropertyChanged(this, "DirName", oldValue, val);
            dump("notified...\n");
        }
    },

    get dirType() {
        return 0;
    },

    get fileName() {
        dump("CardDAVDirecory: fileName: unimp\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get URI() {
        /* warning: this is now = this.Value and != this.mURI */
        return this.mValue;
    },

    get position() {
        dump("CardDAVDirecory: position: unimp\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get lastModifiedDate() {
        return 0;
    },
    set lastModifiedDate(val) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get isMailList() {
        return false;
    },

    /* retrieve the sub-directories */
    get childNodes() {
        // dump("CardDAVDirecory: childNodes\n");
        let resultArray = Components.classes["@mozilla.org/array;1"]
                                    .createInstance(Components.interfaces.nsIArray);
        return resultArray.enumerate();
    },

    get childCards() {
        // dump("CardDAVDirecory: childCards\n");
        let resultArray = null;

        let criteria = this._extractCriteria();
        if (criteria) {
            let httpURL = this.serverURL;
            if (httpURL) {
                resultArray = this._serverQuery(httpURL, criteria);
            }
        }
        else {
            resultArray = Components.classes["@mozilla.org/array;1"]
                                    .createInstance(Components.interfaces.nsIArray);
        }

        return (resultArray ? resultArray.enumerate() : null);
    },
    _extractCriteria: function() {
        let criteria = null;

        // see http://mxr.mozilla.org/comm-central/source/mailnews/addrbook/src/nsAbQueryStringToExpression.cpp#278

        if (this.mQuery && this.mQuery.length > 0) {
            let prefix = "(DisplayName,c,";
            let dn = this.mQuery.indexOf(prefix);
            if (dn == -1) {
                prefix = "(DisplayName,bw,";
                dn = this.mQuery.indexOf(prefix);
            }
            if (dn > -1) {
                // dump("prefix found\n");
                let start = dn + prefix.length;
                let end = this.mQuery.indexOf(")", start);
                if (end > -1) {
                    // dump("end found\n");
                    // dump("query: " + this.mQuery + "; start: " + start + "; end: " + end + "\n");
                    criteria = this.mQuery.substr(start, end - start);
                    if (criteria.length > 0) {
                        // dump("criteria found\n");
                        criteria = decodeURI(criteria);
                    }
                    else {
                        criteria = null;
                    }
                }
            }
        }

        // dump("extracted criteria: " + criteria);

        return criteria;
    },

    _serverQuery: function(url, criteria) {
        //dump("serverQuery: url: " + url + "; crite: " + criteria + "\n");
        let doc = null;
        var listener = {
            onDAVQueryComplete: function(status, response, headers, data) {
                if (status > 199 && status < 400) {
                    doc = response;
                }
                else {
                    dump("Got invalid status (" + status + ") from server, ignoring response.\n");
                }
            }
        };
        let report = new sogoWebDAV(url, listener, null, true);
        let req = ('<?xml version="1.0" encoding="UTF-8"?>'
                   + '<C:addressbook-query xmlns:D="DAV:"'
                   + ' xmlns:C="urn:ietf:params:xml:ns:carddav">'
                   + '<D:prop><D:getetag/><C:address-data/></D:prop>'
                   + '<C:filter><C:prop-filter name="mail">'
                   + '<C:text-match collation="i;unicasemap" match-type="starts-with">'
                   + xmlEscape(criteria)
                   + '</C:text-match></C:prop-filter></C:filter>'
                   + '</C:addressbook-query>');
        report.requestXMLResponse = true;
        
        // This REPORT call is blocking one.
        report.report(req);

        let resultArray = Components.classes["@mozilla.org/array;1"]
                                    .createInstance(Components.interfaces.nsIMutableArray);
        if (doc) {
            let nodeList = doc.getElementsByTagNameNS("urn:ietf:params:xml:ns:carddav",
                                                      "address-data");
            for (let i = 0; i < nodeList.length; i++) {
                let card = importFromVcard(nodeList[i].textContent);
                resultArray.appendElement(card, null);
            }
        }

        //dump("query finished\n\n\n");

        return resultArray;
    },

    get isQuery() {
        return (this.mQuery && this.mQuery.length > 0);
    },

    init: function(uri) {
        // dump("CardDAVDirectory.js: Init: uri = " + uri + "\n");
        // 	 dump("backtrace: " + backtrace() + "\n\n");
        if (uri.indexOf(gABPrefix) == 0) {
            let prefName = uri.substr(gABPrefix.length);
            let quMark = uri.indexOf("?");
            if (quMark > 1) {
                this.mQuery = uri.substr(quMark);
                prefName = prefName.substr(0, quMark - gABPrefix.length);
            }
            this.mValue = gABPrefix + prefName;
            this.mDirPrefId = prefName;
            this._load();
        }
        else
            throw "unknown uri: " + uri;
    },

    _load: function() {
        let prefName = this.mDirPrefId;
        //let service = Components.classes["@mozilla.org/preferences-service;1"]
        //                        .getService(Components.interfaces.nsIPrefService);
        try {
            let branch = Services.prefs.getBranch(prefName + ".");
            this.mDescription = branch.getCharPref("description");
            let uri = branch.getCharPref("uri");

            /* migration code for old-style URI */
            if (uri.indexOf("carddav://http") == 0) {
                uri = "carddav" + uri.substr(14);
                branch.setCharPref("uri", uri);
            }

            this.mURI = uri;
        }
        catch(e) {
            dump("directory-properties: exception (new directory '" + prefName
                 + "', URI '" + this.mValue + "' ?):" + e + "\n");
        }
    },

    deleteDirectory: function (directory) {
        dump("CardDAVDirectory.js: unimplemented 'deleteDirectory'\n");
        // dump("CardDAVDirectory.js: ============>CALLED deleteDirectory!!!\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    hasCard: function(cards) {
        dump("CardDAVDirectory.js: unimplemented 'hasCard'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    hasDirectory: function(dir) {
        dump("CardDAVDirectory.js: unimplemented 'hasDirectory'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    addCard: function(card) {
        dump("CardDAVDirectory.js: unimplemented 'addCard'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        return null;
    },

    modifyCard: function(modifiedCard) {
        dump("CardDAVDirectory.js: unimplemented 'modifyCard'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    deleteCards: function(cards) {
        dump("CardDAVDirectory.js: unimplemented 'deleteCards'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    dropCard: function(card, needToCopyCard) {
        dump("CardDAVDirectory.js: unimplemented 'dropCard'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    useForAutocomplete: function(aIdentityKey) {
        let rc = false;

        //let prefs = Components.classes["@mozilla.org/preferences-service;1"]
        //                      .getService(Components.interfaces.nsIPrefBranch);
        try {
            let autocompleteLdap = Services.prefs.getBoolPref("ldap_2.autoComplete.useDirectory");
            let autocompleteDirectory = Services.prefs.getCharPref("ldap_2.autoComplete.directoryServer");
            rc = (autocompleteDirectory == this.mDirPrefId);
        }
        catch(e) {}

        return rc;
    },

    get supportsMailingLists() {
        return false;
    },

    get addressLists() {
        return this.mAddressLists;
    },
    set addressLists(val) {
        this.mAddressLists = val;
    },

    addMailList: function(list) {
        dump("CardDAVDirectory.js: unimplemented 'addMailList'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get listNickName() {
        dump("CardDAVDirectory.js: unimplemented 'listNickName'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get description() {
        return this.mDescription;
    },
    set description(val) {
        this.mDescription = val;
    },

    editMailListToDatabase: function(listCard) {
        dump("CardDAVDirectory.js: unimplemented 'editMailListToDatabase'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    copyMailList: function(aSrcList) {
        dump("CardDAVDirectory.js: unimplemented 'copyMailList'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    createNewDirectory: function(aDirName, aURI, aType, aPrefName) {
        dump("CardDAVDirectory.js: unimplemented 'createNewDirectory'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        return null;
    },
    createDirectoryByURI: function(displayName, uri) {
        dump("CardDAVDirectory.js: unimplemented 'createDirectoryByURI'\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get dirPrefId() {
        dump("CardDAVDirectory.js: dirPrefId\n"
             + "  value: " + this.mDirPrefId + "\n");
        return this.mDirPrefId;
    },
    set dirPrefId(val) {
        if (this.mDirPrefId != val) {
            this.mDirPrefId = val;
            dump("new pref id: " + val + "\n");
        }
    },

    getIntValue: function(aName, aDefaultValue) {
        dump("GetLocalizedStringValue\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        return 0;
    },

    getBoolValue: function(aName, aDefaultValue) {
        dump("GetLocalizedStringValue\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        return false;
    },

    getStringValue: function(aName, aDefaultValue) {
        dump("GetLocalizedStringValue\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        return null;
    },
    getLocalizedStringValue: function(aName, aDefaultValue) {
        dump("GetLocalizedStringValue\n");
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        return null;
    },

    setIntValue: function(aName, aValue) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    setBoolValue: function(aName, aValue) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    setStringValue: function(aName, aValue) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    setLocalizedStringValue: function(aName, aValue) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    /* nsISecurityCheckedComponent */
    canCreateWrapper: function(aIID) {
        return ((aIID.equals(Components.interfaces.nsIAbDirectory)
                 || aIID.equals(Components.interfaces.nsISupports))
                ? "AllAccess"
                : "NoAccess");
    },

    canCallMethod: function(aIID, methodName) {
        dump("CardDAVDirectory.js: canCallMethod: aIID: " + aIID + "; methodName: " + methodName + "\n");
        return "AllAccess";
    },

    canGetProperty: function(aIID, propertyName) {
        dump("CardDAVDirectory.js: canGetProperty: aIID: " + aIID + "; methodName: " + methodName + "\n");
        return "AllAccess";
    },

    canSetProperty: function(aIID, propertyName) {
        dump("CardDAVDirectory.js: canSetProperty: aIID: " + aIID + "; methodName: " + methodName + "\n");
        return "AllAccess";
    },

    /* nsIClassInfo */
    getInterfaces: function(aCount) {
        // dump("CardDAVDirectory.js: getInterfaces\n");
        let ifaces = [ Components.interfaces.nsIAbDirectory,
                       Components.interfaces.nsISecurityCheckedComponent,
                       Components.interfaces.nsIClassInfo,
                       Components.interfaces.nsISupports ];
        aCount.value = ifaces.length;

        return ifaces;
    },

    getHelperForLanguage: function(language) {
        // dump("CardDAVDirectory.js: getHelperForLanguage: " + language + "\n");
        return null;
    },

    contractID: "@mozilla.org/addressbook/directory;1?type=moz-abdavdirectory",
    classDescription: "Class description",
    classID: Components.ID("{2e3aa298-a1f9-4aef-9f80-ca430ce6e55b}"),
    //implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    /* nsISupports */
    QueryInterface: function(aIID) {
        if (!aIID.equals(Components.interfaces.nsIAbDirectory)
            && !aIID.equals(Components.interfaces.nsISecurityCheckedComponent)
            && !aIID.equals(Components.interfaces.nsIClassInfo)
            && !aIID.equals(Components.interfaces.nsISupports)) {
            dump("CardDAVDirectory.js: NO INTERFACE: "  + aIID + "\n");
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    },
    //QueryInterface: XPCOMUtils.generateQI([Components.interfaces.CardDAVDirectory]),

    /* additional */
    get serverURL() { 
        let httpURL = null;

        if (this.mURI && this.mURI.indexOf(gCardDavPrefix) == 0) {
            httpURL = this.mURI.replace(/^carddav/, "http");
        }

        return httpURL;
    }
};

/** Module Registration */
function NSGetFactory(cid) {
    return (XPCOMUtils.generateNSGetFactory([CardDAVDirectory]))(cid);
}
