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
//Components.utils.import("resource://calendar/modules/calUtils.jsm");
var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");

let SICalendarDefaultClassifications = {
    synchronizeToServer: function SICC_synchronizeToServer() {
        let collectionURL = sogoBaseURL() + "Calendar/";
	let proppatch = new sogoWebDAV(collectionURL, null, null, true, true);
        let values = { "events-default-classification": "events",
                       "tasks-default-classification": "todos" };
        let classxml = "";
        for (let tag in values) {
            let prefName = "calendar." + values[tag] + ".default-classification";
            let value = cal.getPrefSafe(prefName, "PUBLIC");
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
                                //cal.setPref(branchName, value);
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
