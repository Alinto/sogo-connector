/* categories.js - This file is part of "SOGo Connector".
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

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("categories.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-connector/content/global/sogo-config.js"]);

let SCContactCategories = {
    getCategoriesAsString: function SCCC_getCategoriesAsString() {
        let cats = null;

        try {
            cats = Services.prefs.getCharPref("sogo-connector.contacts.categories");
            cats = decodeURIComponent(escape(cats));
        }
        catch(e) {
          cats = [];
        }

        return cats;
    },

    setCategoriesAsString: function SCCC_setCategoriesAsString(cats) {
        Services.prefs.setCharPref("sogo-connector.contacts.categories", unescape(encodeURIComponent(cats)));
    },

    getCategoriesAsArray: function SCCC_getCategoriesAsArray() {
        let valuesArray = [];

        let multiValue = this.getCategoriesAsString();
        let max = multiValue.length;
        if (multiValue.length > 0) {
            let escaped = false;
            let current = "";
            for (let i = 0; i < max; i++) {
                if (escaped) {
                    current += multiValue[i];
                    escaped = false;
                }
                else {
                    if (multiValue[i] == "\\") {
                        escaped = true;
                    }
                    else if (multiValue[i] == ",") {
                        valuesArray.push(current.replace(/(^[ ]+|[ ]+$)/, "", "g"));
                        current = "";
                    }
                    else {
                        current += multiValue[i];
                    }
                }
            }
            if (current.length > 0) {
                valuesArray.push(current.replace(/(^[ ]+|[ ]+$)/, "", "g"));
            }
        }

        return valuesArray;
    },

    _sortArray: function SCCC__sortArray(catsArray) {
      //let localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
      //                              .getService(Components.interfaces.nsILocaleService);
      //let collator = Components.classes["@mozilla.org/intl/collation-factory;1"]
      //                         .getService(Components.interfaces.nsICollationFactory)
      //                         .CreateCollation(localeService.getApplicationLocale());
      let collator = Components.classes["@mozilla.org/intl/collation-factory;1"]
          .getService(Components.interfaces.nsICollationFactory)
          .CreateCollation();
      function compare(a, b) { return collator.compareString(0, a, b); }
      catsArray.sort(compare);
    },

    setCategoriesAsArray: function SCCC_getCategoriesAsArray(catsArray) {
        this._sortArray(catsArray);

        let initted = false;
        let cats = "";
        for (let i = 0; i < catsArray.length; i++) {
            if (catsArray[i] && catsArray[i].length > 0) {
                let escaped = catsArray[i].replace(",", "\\,").replace(/(^[ ]+|[ ]+$)/, "", "g");
                if (escaped.length > 0) {
                    if (initted) {
                        cats += "," + escaped;
                    }
                    else {
                        cats += escaped;
                        initted = true;
                    }
                }
            }
        }

        this.setCategoriesAsString(cats);
    }
};

let SIContactCategories = {
    synchronizeToServer: function SICC_synchronizeToServer() {
        let cats = SCContactCategories.getCategoriesAsArray();
        if (cats) {
            let collectionURL = sogoBaseURL() + "Contacts/";
	    let proppatch = new sogoWebDAV(collectionURL, null, null, true, true);
            let catxml = "<i:contacts-categories>";
            for (let i = 0; i < cats.length; i++) {
                catxml += "<i:category>" + xmlEscape(cats[i]) + "</i:category>";
            }
            catxml += "</i:contacts-categories>";

            let proppatchxml = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
		                + "<propertyupdate xmlns=\"DAV:\""
                                + " xmlns:i=\"urn:inverse:params:xml:ns:inverse-dav\">"
			        + "<set>"
			        + "<prop>" + catxml + "</prop>"
                                + "</set></propertyupdate>");
	    proppatch.proppatch(proppatchxml);
        }
    },
    synchronizeFromServer: function SICC_synchronizeFromServer() {
        let categoriesListener = {
            onDAVQueryComplete: function onDAVQueryComplete(status, response, headers) {
                if (status == 207) {
                    let jsonResponse = response["multistatus"][0]["response"][0];
                    let propstats = jsonResponse["propstat"];
                    for (let i = 0; i < propstats.length; i++) {
                        let propstat = propstats[i];
                        if (propstat["status"][0].indexOf("200") > 0
                            && propstat["prop"][0]
                            && propstat["prop"][0]["contacts-categories"][0]) {
                            let cats = propstat["prop"][0]["contacts-categories"][0]["category"];
                            SCContactCategories.setCategoriesAsArray(cats);
                        }
                    }
                }
            }
        };

        let properties = ["urn:inverse:params:xml:ns:inverse-dav contacts-categories"];
        let propfind = new sogoWebDAV(sogoBaseURL() + "Contacts", categoriesListener, undefined, undefined, true);
        propfind.propfind(properties, false);
    }
};
