/* ContextManager.jsm - This file is part of "SOGo Connector", a Thunderbird extension.
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

var EXPORTED_SYMBOLS = ["contextManagerInstance"];

var { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function ContextManager() {
    this.contexts = {};
    //this.wrappedJSObject = this;
}

ContextManager.prototype = {
    /* nsIClassInfo */
    classID: Components.ID("{dc93fc98-bec6-11dc-b37a-00163e47dbb4}"),
    contractID: "@inverse.ca/context-manager;1",
    classDescription: "Global context manager",

  /*getInterfaces: function cDACLM_getInterfaces(count) {
    dump("ContextManager getInterfaces()\n");
        const ifaces = [Components.interfaces.inverseIJSContextManager,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },*/
    getHelperForLanguage: function cDACLM_getHelperForLanguage(language) {
        return null;
    },
    //implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    /* inverseIJSContextManager */
    contexts: null,
    //wrappedJSObject: null,

    getContext: function(name) {
      dump("ContextManager getContext()\n");

      let context = this.contexts[name];
        if (!context) {
            context = {};
            this.contexts[name] = context;
        }

        return context;
    },
  resetContext: function(name) {
    dump("ContextManager resetContext()\n");
    
        let context = this.contexts[name];
        if (context)
            this.contexts[name] = null;
    }
  /*QueryInterface: function(aIID) {
    dump("ContextManager QueryInterface()\n");
    
        if (!aIID.equals(Components.interfaces.inverseIJSContextManager)
            && !aIID.equals(Components.interfaces.nsISupports))
            throw Components.results.NS_ERROR_NO_INTERFACE;

        return this;
    }
*/
  /*QueryInterface: ChromeUtils.generateQI([Ci.inverseIJSContextManager])*/
};

var contextManagerInstance = new ContextManager();

/** Module Registration */
//function NSGetFactory(cid) {
//    return (XPCOMUtils.generateNSGetFactory([ContextManager]))(cid);
//}
//this.NSGetFactory = XPCOMUtils.generateNSGetFactory([ContextManager]);
