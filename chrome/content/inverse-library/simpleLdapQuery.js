/* simpleLdapQuery.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

function simpleLdapQuery() {
	this.mFinished = false;
	this.mAttrCount = null;
	this.mAttrs = null;

	this.mConnection = null;
	this.mOperation = null;
	this.mServerURL = null;
	this.mResults = "";
	this.mProtocolVersion = Components.interfaces.nsILDAPConnection.VERSION3;

	this.proxyMgr = Components.classes["@mozilla.org/xpcomproxy;1"]
		.getService(Components.interfaces.nsIProxyObjectManager);
}

simpleLdapQuery.prototype = {
 _getProxyForObject: function() {
		var qs = Components.classes["@mozilla.org/event-queue-service;1"]
		.getService(Components.interfaces.nsIEventQueueService);
		var currentEventQueue = qs.getSpecialEventQueue(Components.interfaces.nsIEventQueueService.CURRENT_THREAD_EVENT_QUEUE);
		return this.proxyMgr.getProxyForObject(currentEventQueue,
											   Components.interfaces.nsILDAPMessageListener,
											   this,
											   Components.interfaces.nsIProxyObjectManager.INVOKE_ASYNC
											   | Components.interfaces.nsIProxyObjectManager.FORCE_PROXY_CREATION);
	},
 onLDAPMessage: function(aMessage) {
		var messageType;

		dump("onLDAPMessage...\n");

		try {
			messageType = aMessage.GetType();
		}
		catch (e) {
			this.finishLDAPQuery();
			throw e;
		}

		switch (messageType) {
		case Components.interfaces.nsILDAPMessage.RES_BIND: this.OnLDAPBind(aMessage);
		case Components.interfaces.nsILDAPMessage.RES_SEARCH_ENTRY: this.OnLDAPSearchEntry(aMessage);
		case Components.interfaces.nsILDAPMessage.RES_SEARCH_RESULT: this.OnLDAPSearchResult(aMessage);
		default:
		throw("simpleLdapQuery.OnLDAPMessage():"
			  + " unexpected LDAP message received");
		}
		dump("onLDAPMessage: quit\n");
	},
 onLDAPInit: function(aConn, aStatus) {
		dump("onLDAPinit: " + aStatus + "\n");

		try {
			this.mOperation
				= Components.classes["@mozilla.org/network/ldap-operation;1"]
				.createInstance(Components.interfaces.nsILDAPOperation);
			this.mOperation.init(this.mConnection, this._getProxyForObject(),
								 null);
			this.mOperation.simpleBind("");
		}
		catch(e) {
			this.finishLDAPQuery();
			throw(e);
		}
		dump("onLDAPInit: quit\n");
	},
 onLDAPBind: function(aMessage) {
		dump("onLDAPBind\n");
		this.mOperation = null;  // done with bind op; make nsCOMPtr release it

		var errCode;
		try {
			errCode = aMessage.getErrorCode();
		}
		catch(e) {
			this.finishLDAPQuery();
			throw(e);
		}

		if (errCode != Components.interfaces.nsILDAPErrors.SUCCESS) {
			this.finishLDAPQuery();
			throw("simpleLdapQuery: bind unsuccessful");
		}

		dump("onLDAPBind: quit\n");

		// ok, we're starting a search
		//
		return this.startLDAPSearch();
	},
 onLDAPSearchEntry: function(aMessage) {
		dump("onLDAPSearchEntry\n");
		for (var i = 0; i < this.mAttrCount; i++) {
			var vals = {};
			var valueCount = {};

			try {
				vals = aMessage.getValues(this.mAttrs[i], valueCount);
			}
			catch(e) {
				this.finishLDAPQuery();
				throw(e);
			}

			for (var j = 0; j < vals.length; j++) {
				var result = "\n" + this.mAttrs[i] + "=" + vals[j];
				this.mResults += result;
			}
		}
		dump("onLDAPSearchEntry: quit\n");
	},
 onLDAPSearchResult: function(aMessage) {
		dump("onLDAPSearchResult\n");
		this.finishLDAPQuery();
		if (this.mAttrCount) {
			this.mAttrCount = null;
			this.mAttrs = null;
		}

		dump("onLDAPSearchResult: quit\n");
	},
 startLDAPSearch: function() {
		dump("startLDAPSearch\n");

		try {
			this.mOperation
				= Components.classes["@mozilla.org/network/ldap-operation;1"]
				.createInstance(Components.interfaces.nsILDAPOperation);
			this.mOperation.init(this.mConnection, this._getProxyForObject(),
								 null);
			this.mAttrCount = {};
			this.mAttrs = this.mServerURL.getAttributes(this.mAttrCount);
			this.mOperation.searchExt(this.mServerURL.dn,
									  this.mServerURL.scope,
									  this.mServerURL.filter, mAttrCount.value,
									  mAttrs, 0, 0);
		}
		catch(e) {
			this.finishLDAPQuery();
			throw(e);
		}

		dump("startLDAPSearch: quit\n");
	},
 initConnection: function() {
		dump("initConnection\n");

		if (!this.mServerURL) {
			throw("simpleLdapQuery.initConnection():"
				  + " mServerURL is null");
			this.finishLDAPQuery();
		}

		try {
			this.mConnection
			= Components.classes["@mozilla.org/network/ldap-connection;1"]
			.createInstance(Components.interfaces.nsILDAPConnection);
			//     rv = NS_GetProxyForObject(NS_CURRENT_EVENTQ,
			//                               NS_GET_IID(nsILDAPMessageListener),
			//                               NS_STATIC_CAST(nsILDAPMessageListener *, this),
			//                               PROXY_ASYNC | PROXY_ALWAYS,
			//                               getter_AddRefs(selfProxy));
			this.mConnection
			.init(this.mServerURL.host, this.mServerURL.port,
				  ((this.mServerURL.options
					& Components.interfaces.nsILDAPURL.OPT_SECURE)
				   ? true : false),
				  "", this._getProxyForObject(), null, this.mProtocolVersion);
		}
		catch(e) {
			this.finishLDAPQuery();
			throw(e);
		}
		dump("initConnection: quit\n");
	},
 finishLDAPQuery: function() {
		dump("finishLDAPQuery\n");
		mFinished = true;

		mConnection = null;
		mOperation = null;
		mServerURL = null;
		dump("finishLDAPQuery: quit\n");
	},
 getQueryResults: function(aServerURL, aProtocolVersion) {
		dump("getQueryResults\n");
		dump("calFBURL currently not implemented in LDAP\n");
		return "calFBURL="; /* FIXME */

		if (!aServerURL) {
			throw("simpleLdapQuery.GetQueryResults():"
				  + " no LDAP URL specified");
		}
		this.mServerURL = aServerURL;
		this.mProtocolVersion = aProtocolVersion;

		var service = Components.classes["@mozilla.org/event-queue-service;1"]
		.getService(Components.interfaces.nsIEventQueueService);
		var currentThreadQ = service.pushThreadEventQueue();
		try {
			this.initConnection();
			while (!this.mFinished) {
				if (currentThreadQ.pendingEvents())
					currentThreadQ.processPendingEvents();
			}
		}
		catch(e) {
			service.popThreadEventQueue(currentThreadQ);
			throw(e);
		}

		service.popThreadEventQueue(currentThreadQ);
		dump("getQueryResults: done\n");
	}
};

