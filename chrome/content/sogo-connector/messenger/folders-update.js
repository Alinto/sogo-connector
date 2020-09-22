/* folders-handler.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

var { contextManagerInstance } = ChromeUtils.import("resource://sogo-connector/components/ContextManager.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            //dump("folders-update.js: failed to include '" + files[i] + "'\n" + e +
            //     "\nFile: " + e.fileName +
            //     "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js",
           "chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-connector/content/addressbook/folder-handler.js",
           "chrome://sogo-connector/content/calendar/folder-handler.js",
           "chrome://sogo-connector/content/calendar/default-classifications.js",
           "chrome://sogo-connector/content/messenger/mails-labels.js",
           "chrome://sogo-connector/content/addressbook/categories.js",
           "chrome://sogo-connector/content/calendar/calendar-overlay.js"]);

function directoryChecker(type, handler) {
    this.type = type;
    this.handler = handler;
    this.additionalProperties = null;
}

directoryChecker.prototype = {
    additionalProperties: null,
    baseURL: sogoBaseURL(),
  _checkHTTPAvailability: function checkAvailability(yesCallback) {
    dump("directoryChecker: _checkHTTPAvailability()\n");
        try {
            let target = {
                onDAVQueryComplete: function(aStatus, aResponse, aHeaders, aData) {
                    if (aStatus != 0 && aStatus != 404 && yesCallback) {
                        yesCallback();
                    }
                }
            };
            let options = new sogoWebDAV(this.baseURL + this.type, target);
            options.options();
        }
        catch(e) {
            if (yesCallback) {
                yesCallback();
            }
        }
    },
    checkAvailability: function checkAvailability(yesCallback) {
        //let manager = Components.classes['@inverse.ca/context-manager;1']
        //                        .getService(Components.interfaces.inverseIJSContextManager).wrappedJSObject;
        let context = contextManagerInstance.getContext("inverse.ca/folders-update");
        if (!context.availability)
            context.availability = {};
        let available = context.availability[this.type];
        if (typeof(available) == "undefined") {
            let this_ = this;
            this._checkHTTPAvailability(function() { context.availability[this_.type] = true; if (yesCallback) yesCallback(); } );
        }
        else {
            if (available && yesCallback) {
                yesCallback();
            }
        }
    },
    start: function start() {
        let propfind = new sogoWebDAV(this.baseURL + this.type, this, undefined, undefined, true);
        let baseProperties = ["DAV: owner", "DAV: resourcetype",
                              "DAV: displayname"];
        let properties;
        if (this.handler.additionalDAVProperties) {
            this.additionalProperties = this.handler.additionalDAVProperties();
            properties = baseProperties.concat(this.additionalProperties);
        }
        else
            properties = baseProperties;
        propfind.propfind(properties);
    },
    removeAllExisting: function removeAllExisting() {
        let existing = this.handler.getExistingDirectories();
        let remove = [];
        for (let k in existing)
            remove.push(existing[k]);
        this.handler.removeDirectories(remove);
    },
    fixedExisting: function fixedExisting(oldExisting) {
        let newExisting = {};

        let length = this.baseURL.length;
        for (let url in oldExisting) {
            if (url.substr(0, length) == this.baseURL) {
                let oldURL = url;
                if (url[url.length - 1] != '/')
                    url = url.concat('/');
                newExisting[url] = oldExisting[oldURL];
            }
        }

        return newExisting;
    },
    _fixedOwner: function _fixedOwner(firstOwner) {
        let ownerArray = firstOwner.split("/");
        let ownerIdx = (ownerArray.length
                        - ((firstOwner[firstOwner.length-1] == "/") ? 2 : 1));

        return ownerArray[ownerIdx];
    },
    _fixedURL: function _fixedURL(firstURL) {
        let fixedURL;

        if (firstURL[0] == "/") {
            let baseURLArray = sogoBaseURL().split("/");
            fixedURL = baseURLArray[0] + "//" + baseURLArray[2] + firstURL;
        }
        else
            fixedURL = firstURL;

        if (fixedURL[fixedURL.length - 1] != '/')
            fixedURL = fixedURL.concat('/');

        // 		if (firstURL != fixedURL)
        // 			dump("fixed url: " + fixedURL + "\n");

        return fixedURL;
    },
    _isCollection: function _isCollection(resourcetype) {
        let isCollection = false;
        if (resourcetype) {
            for (let k in resourcetype) {
                if (k == "collection") {
                    isCollection = true;
                }
            }
        }

        return isCollection;
    },
    foldersFromResponse: function foldersFromResponse(jsonResponse) {
        let folders = {};
        let username = sogoUserName();
        let responses = jsonResponse["multistatus"][0]["response"];
        for (let i = 0; i < responses.length; i++) {
            if (typeof(responses[i]["href"]) == "undefined")
                continue;
            let url = this._fixedURL(responses[i]["href"][0]);
            let propstats = responses[i]["propstat"];
            for (let j = 0; j < propstats.length; j++) {
                if (propstats[j]["status"][0].indexOf("HTTP/1.1 200") == 0) {
                    let urlArray = url.split("/");
                    if (urlArray[urlArray.length-3] == this.type) {
                        let prop = propstats[j]["prop"][0];
                        if (this._isCollection(prop["resourcetype"][0])) {
                            let owner = this._fixedOwner("" + prop["owner"][0]["href"][0]);
                            let additionalProps = [];

                            if (this.additionalProperties) {
                                for (let k = 0; k < this.additionalProperties.length; k++) {
                                    let pName = this.additionalProperties[k].split(" ")[1];

                                    let newValue;
                                    if (prop[pName])
                                        newValue = xmlUnescape(prop[pName][0]);
                                    else
                                        newValue = null;

                                    additionalProps.push(newValue);
                                }
                            }
                            let newEntry = {owner: owner,
                                            displayName: xmlUnescape(prop["displayname"][0]),
                                            url: url,
                                            additional: additionalProps};
                            folders[url] = newEntry;
                        }
                    }
                }
            }
        }

        return folders;
    },
    onDAVQueryComplete: function onDAVQueryComplete(status, response) {
        if (status > 199 && status < 400) {
            let existing
                = this.fixedExisting(this.handler.getExistingDirectories());
            this.handler.removeDoubles();
            if (response) {
                let folders = this.foldersFromResponse(response);
                let comparison = this.compareDirectories(existing, folders);
                if (comparison['removed'].length)
                    this.handler.removeDirectories(comparison['removed']);
                if (comparison['renamed'].length)
                    this.handler.renameDirectories(comparison['renamed']);
                if (comparison['added'].length)
                    this.handler.addDirectories(comparison['added']);
            }
            else
                dump("an empty response was returned, we therefore do nothing\n");
        }
        else
            dump("the status code (" + status + ") was not acceptable, we therefore do nothing\n");
    },
    compareDirectories: function compareDirectories(existing, result) {
        let comparison = { removed: [], renamed: [], added: [] };
        for (let url in result) {
            if (url[url.length - 1] != '/')
                url = url.concat('/');
            if (!existing.hasOwnProperty(url)) {
                dump(result[url] + "; " + url + " registered for addition\n");
                comparison['added'].push(result[url]);
            }
        }
        for (let url in existing) {
            if (url[url.length - 1] != '/')
                url = url.concat('/');
            if (result.hasOwnProperty(url)) {
                dump(result[url] + "; " + url + " registered for renaming\n");
                comparison['renamed'].push({folder: existing[url],
                                            displayName: result[url]['displayName'],
                                            additional: result[url].additional});
            }
            else {
                dump(url + " registered for removal\n");
                comparison['removed'].push(existing[url]);
            }
        }

        return comparison;
    }
};

function checkFolders() {

  var accountMgr =
      Components.classes["@mozilla.org/messenger/account-manager;1"]
      .getService(Components.interfaces.nsIMsgAccountManager);
  var accounts = accountMgr.accounts;

  //dump("NUMBER OF ACCOUNTS: " + accounts.length + "\n");
  
  //if (accounts.length <= 1) {
  //  return;
  //}
          
  let console = Components.classes["@mozilla.org/consoleservice;1"]
      .getService(Components.interfaces.nsIConsoleService);
    
  let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader);

  cleanupAddressBooks();

  let abHandler = new AddressbookHandler();
  let abChecker = new directoryChecker("Contacts", abHandler);
  dump("abChecker type 1: " + abChecker.type + "\n");

  abChecker.checkAvailability(function() {
    abChecker.start();
    //FIXME - no longer permitted by TB abHandler.ensurePersonalIsRemote();
    abHandler.ensureAutoComplete();
    SIContactCategories.synchronizeFromServer();
    startFolderSync();
  });

  //
  // We synchronize mail labels
  //
  SIMailsLabels.synchronizeFromServer();

  //
  //
  //
  let calHandler;
  try {
    calHandler = new CalendarHandler();
  }
  catch(e) {
    // if lightning is not installed, an exception will be thrown so we
    // need to catch it to keep the synchronization process alive
    calHandler = null;
  }
  if (calHandler) {
    SICalendarDefaultClassifications.synchronizeFromServer();
    calHandler.removeHomeCalendar();

    let CalendarChecker = new directoryChecker("Calendar", calHandler);
    CalendarChecker.start();
  }

  //   let CalendarChecker = new directoryChecker("Calendar", calHandler);
  //   CalendarChecker.checkAvailability(function() {
  //     if (document) {
  //       let toolbar = document.getElementById("subscriptionToolbar");
  //       if (toolbar) {
  //         toolbar.collapsed = false;
  //       }
  //     }
  //     //let prefService = (Components.classes["@mozilla.org/preferences-service;1"]
  //     //                   .getService(Components.interfaces.nsIPrefBranch));
  //     let disableCalendaring;
  //     try {
  //       disableCalendaring
  //         = Services.prefs.getBoolPref("sogo-connector.disable-calendaring");
  //     }
  //     catch(e) {
  //       disableCalendaring = false;
  //     }
  //     if (disableCalendaring) {
  //       CalendarChecker.removeAllExisting();
  //               hideLightningWidgets("true");
  //     }
  //     else {
  //       SICalendarDefaultClassifications.synchronizeFromServer();
  //       calHandler.removeHomeCalendar();
  //       CalendarChecker.start();
  //       // hideLightningWidgets("false");
  //     }
  //   });
  // }

  dump("startup done\n");
}

// function hideLightningWidgets(hide) {
//     let widgets = [ "mode-toolbar", "today-splitter", "today-pane-panel",
//                     "ltnNewEvent", "ltnNewTask", "ltnNewCalendar",
//                     "ltnMenu_calendar", "ltnMenu_tasks", "invitations-pane" ];
//     for (let name in widgets) {
//         let widget = document.getElementById(name);
//         if (widget) {
//             if (hide == "true") {
//                 widget.removeAttribute("persist");
//                 widget.removeAttribute("command");
//                 widget.removeAttribute("name");
//                 widget.setAttribute("collapsed", hide);
//             } else if (!widget.getAttribute("persist")) {
//                 widget.setAttribute("collapsed", hide);
//             }
//         }
//         else
//             dump("widget not found '" + name + "'\n");
//     }
// }
