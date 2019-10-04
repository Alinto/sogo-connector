/* NotificationManager.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

//Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
//Components.utils.import("resource://gre/modules/Services.jsm");

var EXPORTED_SYMBOLS = ["notificationManagerInstance"];

function NotificationManager() {
    this.notifications = {};
    //this.wrappedJSObject = this;
}   

NotificationManager.prototype = {
    /* nsIClassInfo */
    classID: Components.ID("{c9a28da6-f9cd-11dc-9c23-00163e47dbb4}"),
    contractID: "@inverse.ca/context-manager;1",
    classDescription: "Global context manager",

    //getInterfaces: function cDACLM_getInterfaces(count) {
    //    const ifaces = [Components.interfaces.inverseIJSNotificationManager,
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

    /* Components.interfaces.inverseIJSNotificationManager */
    notifications: null,
    //wrappedJSObject: null,

    registerObserver: function(notification, observer) {
        let observers = this.notifications[notification];
        if (!observers) {
            observers = [];
            this.notifications[notification] = observers;
        }

        if (observers.indexOf(observer) < 0
            && observer.handleNotification)
            observers.push(observer);
        else
            throw Components.results.NS_ERROR_FAILURE;
    },
    unregisterObserver: function(notification, observer) {
        let unregistered = false;
        let observers = this.notifications[notification];
        if (observers) {
            let idx = observers.indexOf(observer);
            if (idx > -1) {
                observers.splice(idx, 1);
                unregistered = true;
            }
        }

        if (!unregistered)
            throw Components.results.NS_ERROR_FAILURE;
    },

    postNotification: function(notification, data) {
        //     dump("posting '" + notification + "'\n");
        let observers = this.notifications[notification];
        if (observers)
            for (let i = 0; i < observers.length; i++)
                observers[i].handleNotification(notification, data);
    },

    //QueryInterface: function(aIID) {
    //    if (!aIID.equals(Components.interfaces.inverseIJSNotificationManager)
    //        && !aIID.equals(Components.interfaces.nsISupports))
    //        throw Components.results.NS_ERROR_NO_INTERFACE;
//
  //      return this;
    //}
};

/** Module Registration */
//function NSGetFactory(cid) {
//    return (XPCOMUtils.generateNSGetFactory([NotificationManager]))(cid);
//}

var notificationManagerInstance = new NotificationManager();