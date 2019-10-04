/* SyncProgressManager.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

//Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
//Components.utils.import("resource://gre/modules/Services.jsm");

var EXPORTED_SYMBOLS = ["syncProgressManagerInstance"];

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { notificationManagerInstance } = ChromeUtils.import("resource://sogo-connector/NotificationManager.jsm");

function SyncProgressManager() {
    this.addressbooks = {};
    this.nservice = notificationManagerInstance;
    this.nrAddressBooks = 0;
    //this.wrappedJSObject = this;
}

SyncProgressManager.prototype = {
    /* nsIClassInfo */
    classID: Components.ID("{72d92fb6-f9e1-11dc-9794-00163e47dbb4}"),
    contractID: "@inverse.ca/sync-progress-manager;1",
    classDescription: "A global object that receives sync notifications for SOGo Connector",

    //getInterfaces: function cDACLM_getInterfaces(count) {
    //    const ifaces = [Components.interfaces.inverseIJSSyncProgressManager,
    //                    Components.interfaces.nsIClassInfo,
    //                    Components.interfaces.nsISupports];
    //    count.value = ifaces.length;
    //    return ifaces;
    //},
    getHelperForLanguage: function cDACLM_getHelperForLanguage(language) {
        return null;
    },
    //implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    /* */
    //wrappedJSObject: null,
    addressbooks: null,
    nservice: null,
    nrAddressBooks: 0,

    registerAddressBook: function(url, total) {
        //     dump("register: " + url + " (" + total + ")\n");
        if (!this.nrAddressBooks)
            this.nservice.postNotification("groupdav.synchronization.start");
        let newAddressBook = {count: 0, total: total};
        this.addressbooks[url] = newAddressBook;
        this.nrAddressBooks++;
        this.nservice.postNotification("groupdav.synchronization.addressbook.registered", url);
    },
    unregisterAddressBook: function(url) {
        //     dump("unregister: " + url + "\n");
        let addressbook = this.addressbooks[url];

        if (addressbook) {
            delete this.addressbooks[url];
            this.nrAddressBooks--;
            this.nservice.postNotification("groupdav.synchronization.addressbook.unregistered", url);
        }
        else
            throw Components.results.NS_ERROR_FAILURE;

        if (!this.nrAddressBooks)
            this.nservice.postNotification("groupdav.synchronization.stop");
    },
    updateAddressBook: function(url) {
        //     dump("update: " + url + "\n");
        let addressbook = this.addressbooks[url];

        if (addressbook) {
            this.addressbooks[url].count++;
            //       dump("count: " + this.addressbooks[url].count + "\n");
            this.nservice.postNotification("groupdav.synchronization.addressbook.updated",
                                           url);
        }
        else
            throw Components.results.NS_ERROR_FAILURE;
    },

    hasAddressBook: function(url) {
        let addressbook = this.addressbooks[url];

        return (addressbook != null);
    },
    progressForAddressBook: function(url) {
        let progress = -1;

        let addressbook = this.addressbooks[url];
        if (addressbook)
            progress = (addressbook.count / addressbook.total);
        else
            throw Components.results.NS_ERROR_FAILURE;

        return progress;
    },
    globalProgress: function() {
        let progress = -1;

        let globalCount = 0;
        let globalTotal = 0;

        for (let url in this.addressbooks) {
            let addressbook = this.addressbooks[url];
            globalCount += addressbook.count;
            globalTotal += addressbook.total;
        }

        if (globalTotal > 0)
            progress = (globalCount / globalTotal);

        return progress;
    },

    //QueryInterface: function(aIID) {
    //    if (!aIID.equals(Components.interfaces.inverseIJSSyncProgressManager)
    //        && !aIID.equals(Components.interfaces.nsISupports))
    //        throw Components.results.NS_ERROR_NO_INTERFACE;
//
  //      return this;
    //}
};

/** Module Registration */
//function NSGetFactory(cid) {
//    return (XPCOMUtils.generateNSGetFactory([SyncProgressManager]))(cid);
//}

var syncProgressManagerInstance = new SyncProgressManager();