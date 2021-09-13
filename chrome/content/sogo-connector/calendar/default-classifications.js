/* default-classification.js - This file is part of "SOGo Connector".
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
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("default-classification.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-connector/content/global/sogo-config.js"]);

Components.utils.import("resource://gre/modules/Preferences.jsm");

let SICalendarDefaultClassifications = {
  synchronizeToServer: function SICC_synchronizeToServer() {
    let collectionURL = sogoBaseURL() + "Calendar/";
    let proppatch = new sogoWebDAV(collectionURL, null, null, true, true);
    let values = { "events-default-classification": "events",
                   "tasks-default-classification": "todos" };
    let classxml = "";
    for (let tag in values) {
      let prefName = "calendar." + values[tag] + ".default-classification";
      let value = Preferences.get(prefName, "PUBLIC");
      classxml += "<i:" + tag + ">" + xmlEscape(value) + "</i:" + tag + ">";
    }

    let proppatchxml = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
		        + "<propertyupdate xmlns=\"DAV:\""
                        + " xmlns:i=\"urn:inverse:params:xml:ns:inverse-dav\">"
			+ "<set>"
			+ "<prop>" + classxml + "</prop>"
                        + "</set></propertyupdate>");
    proppatch.proppatch(proppatchxml);
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
                && propstat["prop"].length > 0) {
              let prefBranches = { "events-default-classification": "events",
                                   "tasks-default-classification": "todos" };
              for (let k in propstat["prop"][0]) {
                let branch = prefBranches[k];
                let branchName = "calendar." + branch + ".default-classification";
                let value = propstat["prop"][0][k][0];
                Preferences.set(branchName, value);
              }
            }
          }
        }
      }
    };

    let properties = ["urn:inverse:params:xml:ns:inverse-dav events-default-classification",
                      "urn:inverse:params:xml:ns:inverse-dav tasks-default-classification"];
    let propfind = new sogoWebDAV(sogoBaseURL() + "Calendar/", categoriesListener, undefined, undefined, true);
    propfind.propfind(properties, false);
  }
};
