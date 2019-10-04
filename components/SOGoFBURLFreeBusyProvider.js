/* SOGoFBURLFreeBusyProvider.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2010
 *    Author: Robert Bolduc, Wolfgang Sourdeau
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

const SOGOFBURLExpiration = 20; /* seconds */

function jsInclude(files, target) {
    var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (var i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("SOGoFBURLFreeBusyProvider.js: failed to include '" + files[i]
                 + "'\n" + e
                 + "\nFile: " + e.fileName
                 + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://inverse-library/content/simpleLdapQuery.js",
           "chrome://sogo-connector/content/general/webdav.inverse.ca.js",
           "chrome://sogo-connector/content/common/common-dav.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js"]);

let autoCompleteDirectoryPreferencesPrefix = "ldap_2.autoComplete.";

function getAutoCompleteCardDAVUri(){
    let result = null;
    let prefsService = Components.classes["@mozilla.org/preferences;1"]
                                 .getService(Components.interfaces.nsIPref);

    // 	dump("prefix: " + autoCompleteDirectoryPreferencesPrefix + "\n");
    let directoryServerPrefix = prefsService.GetCharPref(autoCompleteDirectoryPreferencesPrefix + "directoryServer");
    if (directoryServerPrefix
        && directoryServerPrefix.length > 0)
        result = "moz-abdavdirectory://" + directoryServerPrefix;

    return result;
}

function isAutoCompleteDirectoryServerCardDAV() {
    let result = false;

    let uri = getAutoCompleteCardDAVUri(autoCompleteDirectoryPreferencesPrefix);
    // dump("uri: " + uri + "\n");
    if (uri)
        result = isCardDavDirectory(uri);

    return result;
}

function SOGoFBURLFreeBusyProvider() {
    this.rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                                .getService(Components.interfaces.nsIRDFService);

    this.mPrefsService = Components.classes["@mozilla.org/preferences;1"]
                                   .getService(Components.interfaces.nsIPref);

    this.fbCache = {};
    this.wrappedJSObject = this;
}

SOGoFBURLFreeBusyProvider.prototype = {
    _registered: false,
    wrappedJSObject: null,
    fbCache: null,
    rdfService: null,
    mPrefsService: null,

    register: function() {
        if (!this._registered) {
            dump("registering calfb url provider\n");
            var svc = Components.classes["@mozilla.org/calendar/freebusy-service;1"]
                                .getService(Components.interfaces.calIFreeBusyService);
            svc.addProvider(this);
            this._registered = true;
        }
    },

    // (in AUTF8String aCalId,
    //  in calIDateTime aRangeStart,
    //  in calIDateTime aRangeEnd,
    //  in unsigned long aBusyTypes,
    //  in calIGenericOperationListener aListener)
    getFreeBusyIntervals: function(aCalId,
                                   aRangeStart,
                                   aRangeEnd,
                                   aBusyTypes,
                                   aListener) {
        var cachedData = this.fbCache[aCalId];
        var now = new Date();

        if (cachedData
            && (cachedData != -1
                && ((cachedData.lastUpdate.getTime()
                     + SOGOFBURLExpiration * 1000)
                    > now.getTime()))) {
            if (cachedData != -1) {
                dump("direct answer to the listener!!!");
                this._provideResponse(cachedData, [aRangeStart, aRangeEnd],
                                      aBusyTypes, aListener);
            }
        }
        else {
            this.fbCache[aCalId] = -1;

            var fbUrl = this._GetFBURL(aCalId);
            if (fbUrl) {
                var rq = new sogoWebDAV(fbUrl, this, { calid: aCalId,
                                                       range: [aRangeStart, aRangeEnd],
                                                       busyTypes: aBusyTypes,
                                                       listener: aListener });
                rq.get();
            }
        }
    },

    _queryDirectory: function(directory, mail, results) {
        var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                            .getService(Components.interfaces.nsIRDFService);
        var ds = Components.classes["@mozilla.org/rdf/datasource;1?name=addressdirectory"]
                           .getService(Components.interfaces.nsIRDFDataSource);
        var childSrc = rdf.GetResource("http://home.netscape.com/NC-rdf#CardChild");
        var cards = ds.GetTargets(directory, childSrc, false);
        while (cards.hasMoreElements()) {
            var protoCard = cards.getNext().QueryInterface(Components.interfaces.nsIAbMDBCard);
            var card = protoCard.QueryInterface(Components.interfaces.nsIAbCard);
            var matchMail = "";
            if (card.primaryEmail.toLowerCase() == mail)
                matchMail = card.primaryEmail;
            else if (card.secondEmail.toLowerCase() == mail)
            matchMail = card.secondEmail;
            if (matchMail.length > 0) {
                try {
                    var fbUrl = protoCard.getStringAttribute("calFBURL");
                    //                     dump("matchMail: " + matchMail + "\n");
                    //                     dump("fbURL: " + fbUrl + "\n");
                }
                catch(e) {
                    dump("exception occured: " + e + "\n");
                }
                if (fbUrl && fbUrl.length > 0)
                    results.push({ mail: matchMail,
                                   calFBURL: fbUrl });
            }
        }
    },

    _GetFBURLInLocalAddressBook: function(mail) {
        //           dump ("calFB (local): " + mail + "\n");
        var results = new Array();
        var RDF = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                            .getService(Components.interfaces.nsIRDFService);
        var parentDir = RDF.GetResource("moz-abdirectory://")
                           .QueryInterface(Components.interfaces.nsIAbDirectory);
        var dirs = parentDir.childNodes;
        while (dirs.hasMoreElements()) {
            var dir = dirs.getNext()
                          .QueryInterface(Components.interfaces.nsIAbDirectory);
            if (!dir.isRemote && !dir.isMailList)
                this._queryDirectory(dir, mail, results);
        }

        return results;
    },

    _parseLDAPQueryResults: function(results) {
        var resultArray = results.split("\n");
        var parsedResults = new Array();
        for (var i = 0; i < resultArray.length; i++) {
            var line = resultArray[i];
            if (line.length > 0) {
                var lineArray = line.split("=");
                resultArray[lineArray[0]] = lineArray[1];
            }
        }

        return resultArray;
    },

    _GetFBURLInLDAPAddressBook: function(mail, prefsPrefix) {
        //           dump ("calFB (ldap): " + mail + "\n");
        var results = new Array();

        try {
            //                dump("branch: " + prefsPrefix + "directoryServer\n");
            var branch = this.mPrefsService.GetCharPref(prefsPrefix
                                                        + "directoryServer");
            var uriSpec = this.mPrefsService.GetCharPref(branch + ".uri");
            var uri = Components.classes["@mozilla.org/network/ldap-url;1"]
                                .createInstance(Components.interfaces.nsILDAPURL);
            uri.spec = uriSpec;
            var filter = "(mail=" + mail + ")";
            uri.filter = filter;
            uri.setAttributes(2, ["mail", "calFBURL"]);
            //var ldapQuery = Components.classes["@mozilla.org/ldapsyncquery;1"]
            //                .createInstance(Components.interfaces.nsILDAPSyncQuery);
            var ldapQuery = new simpleLdapQuery();
            var queryResults = ldapQuery.getQueryResults(uri, 3);
            if (queryResults && queryResults.length > 0) {
                var activeResult = this._parseLDAPQueryResults(queryResults);
                if (activeResult["calFBURL"]
                    && activeResult["calFBURL"].length > 0)
                    results.push(activeResult);
            }
        }
        catch(e) {
            dump("calendar-event-dialog-freebusy.xml: " + e + "\n");
        }

        return results;
    },

    _GetFBURLInCardDAVAddressBook: function(criteria) {
        //              dump ("calFB (carddav): " + criteria + "\n");
        //              dump("criteria: " + criteria + "\n");
        var results = new Array();
        if (criteria.search("@") > -1) {
            var encoded = criteria;
            //                dump("encoded crit: " + encoded + "\n");
            var uri = (getAutoCompleteCardDAVUri()
                       + "?(or(PrimaryEmail,c," + encoded
                       + ")(DisplayName,c," + encoded
                       + ")(FirstName,c," + encoded
                       + ")(LastName,c," + encoded + "))");
            //                dump("ac uri: " + uri + "\n");
            var directory = this.rdfService.GetResource(uri)
                                .QueryInterface(Components.interfaces.nsIAbDirectory);
            this._queryDirectory(directory, criteria, results);
        }

        return results;
    },

    _GetFBURL: function(calid) {
        var mail = calid;

        var fbUrl = null;
        if (mail.indexOf(":") > -1)
            mail = mail.split(":")[1];
        mail = mail.toLowerCase();
        var results;
        var prefsPrefix = "ldap_2.autoComplete.";
        if (this.mPrefsService.GetBoolPref(prefsPrefix + "useAddressBooks"))
            results = this._GetFBURLInLocalAddressBook(mail);
        else
            results = new Array();

        if (this.mPrefsService.GetBoolPref(prefsPrefix + "useDirectory")){
            if (isAutoCompleteDirectoryServerCardDAV())
                results = results.concat(this._GetFBURLInCardDAVAddressBook(mail));
            else //LDAP
                results = results.concat(this._GetFBURLInLDAPAddressBook(mail, prefsPrefix));
        }

        //             this.mConsoleService.logStringMessage("tes cn: " + cn);
        //             this.mConsoleService.logStringMessage("test mail: " + mail);
        if (results.length > 0) {
            var i = 0;
            while (!(fbUrl && fbUrl.length > 0)
                && i < results.length) {
                var result = results[i];
                if (result) {
                    //                 this.mConsoleService.logStringMessage("cn: " + result["cn"]);
                    //                 this.mConsoleService.logStringMessage("mail: " + result["mail"]);
                    if (result["mail"] == mail)
                        fbUrl = result["calFBURL"];
                    else
                        i++;
                }
            }
            if (!fbUrl)
                fbUrl = results[0]["calFBURL"];
        }

        return fbUrl;
    },

    _joinLines: function(originalText) {
        var originalLines = originalText.split("\n");
        var lines = new Array();
        for (var i = 0; i < originalLines.length; i++) {
            var line = originalLines[i];
            if (line.length > 0 && line[0] != "\r") {
                if (line[0] == ' ') {
                    var oldLine = lines[lines.length-1];
                    if (oldLine[oldLine.length-1] == "\r")
                        oldLine = oldLine.substr(0, oldLine.length - 1);
                    oldLine += line.substr(1, line.length - 2);
                    lines[lines.length-1] = oldLine;
                }
                else
                    lines.push(line);
            }
        }

        return lines;
    },
    _preparse: function(lines) {
        var newLines = new Array();

        for (var i = 0; i < lines.length; i++) {
            if (lines[i].indexOf("FREEBUSY") == 0) {
                var separator = lines[i].indexOf(":");
                var lineStart = lines[i].substr(0, separator);
                var data = lines[i].substr(separator+1).split(",");
                for (var j = 0; j < data.length; j++)
                    newLines.push(lineStart + ":" + data[j]);
            }
            else
                newLines.push(lines[i]);
        }

        return newLines.join("\n");
    },
    _getEntryType: function(fb) {
        var fbType = Components.interfaces.calIFreeBusyInterval.BUSY;

        var fbTypeString = fb.getParameter("FBTYPE");
        if (fbTypeString) {
            if (fbTypeString == "FREE")
                fbType = Components.interfaces.calIFreeBusyInterval.FREE;
            else if (fbTypeString == "BUSY-UNAVAILABLE")
            fbType = Components.interfaces.calIFreeBusyInterval.BUSY_UNAVAILABLE;
            else if (fbTypeString == "BUSY-TENTATIVE")
            fbType = Components.interfaces.calIFreeBusyInterval.BUSY_TENTATIVE;
        }

        return fbType;
    },
    _getEntry: function(fb) {
        var clazz = Components.classes["@mozilla.org/calendar/datetime;1"];
        var iface = Components.interfaces.calIDateTime;

        var fbEntry = { freeBusyType: this._getEntryType(fb),
                        interval: { start: clazz.createInstance(iface),
                                    end: null } };
        var duration = fb.value.split("/");
        fbEntry.interval.start.icalString = duration[0];
        var end = null;
        if (duration[1].toUpperCase().charAt(0) == 'P') {
            end = fbEntry.interval.start.clone();
            var fbDuration = Components.classes["@mozilla.org/calendar/duration;1"]
                                       .createInstance(Components.interfaces.calIDuration);
            fbDuration.icalString = duration[1];
            end.addDuration(fbDuration);
        }
        else {
            end = clazz.createInstance(iface);
            end.icalString = duration[1];
        }
        fbEntry.interval.end = end;

        return fbEntry;
    },

    _provideResponse: function(freebusy, range, busytypes, listener) {
        var ranges = [];

        for (var i = 0; i < freebusy.length; i++) {
            if ((freebusy[i].freeBusyType & busytypes)) {
                ranges.push(freebusy[i]);
            }
        }
        listener.onResult(null, ranges);
    },

    onDAVQueryComplete: function(aStatusCode, fbText, headers, data) {
        if (aStatusCode > 199 && aStatusCode < 300) {
            fbText = this._preparse(this._joinLines(fbText));
            var ics = Components.classes["@mozilla.org/calendar/ics-service;1"]
                                .getService(Components.interfaces.calIICSService);
            var cal = ics.parseICS(fbText, null);
            var vfb = cal.getFirstSubcomponent("VFREEBUSY");

            var entries = new Array();
            var fb = vfb.getFirstProperty("FREEBUSY");
            while (fb) {
                var entry = this._getEntry(fb);
                entry.calId = data.calid;
                entries.push(entry);
                fb = vfb.getNextProperty("FREEBUSY");
            }

            this.fbCache[data.calid] = entries;
            this.fbCache[data.calid].lastUpdate = new Date();
            this._provideResponse(this.fbCache[data.calid], data.range,
                                  data.busyTypes, data.listener);
        }
    },

    QueryInterface: function(aIID) {
        if (!aIID.equals(Components.interfaces.nsISupports) &&
            !aIID.equals(Components.interfaces.calIFreeBusyProvider)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    }
};

/** Module Registration */
function NSGetFactory(cid) {
    return (XPCOMUtils.generateNSGetFactory([SOGoFBURLFreeBusyProvider]))(cid);
}
