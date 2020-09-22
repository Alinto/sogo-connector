/* sogo-config.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var sogoConfig = { username: null, baseURL: null };

function sogoUserName() {
	if (!sogoConfig['username']) {
		var mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
			.getService(Components.interfaces.nsIMsgAccountManager);

		var useEmail = false;
		try {
			useEmail = Services.prefs.getBoolPref("sogo-connector.identification.use_email_address");
		}
		catch(e) {
			useEmail = false;
		}
		try {
			if (useEmail)
				sogoConfig['username'] = mgr.defaultAccount.defaultIdentity.email;
			else
				sogoConfig['username'] = mgr.defaultAccount.incomingServer.realUsername;
		}
		catch(e) {
			sogoConfig['username'] = "";
		}
	}

	return sogoConfig['username'];
}

function sogoHostname() {
	var hostnameArray;
	var baseURL;

	baseURL = sogoBaseURL();
	hostnameArray = baseURL.split("/");

	return hostnameArray[0] + "//" + hostnameArray[2];
}

function sogoBaseURL() {
	// if (!sogoConfig['baseURL']) {
	// 	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
	// 		.getService(Components.interfaces.nsIRDFService);

	// 	var extensions
	// 		= rdf.GetResource("http://inverse.ca/sogo-connector/extensions");
	// 	var updateURLres
	// 		= rdf.GetResource("http://inverse.ca/sogo-connector/updateURL");
	// 	var ds
	// 		= rdf.GetDataSourceBlocking("chrome://sogo-connector/content/global/extensions.rdf");

	// 	var updateArray;
	// 	try {
	// 		var urlNode = ds.GetTarget(extensions, updateURLres, true);
	// 		if (urlNode instanceof Components.interfaces.nsIRDFLiteral) {
	// 			var updateURL = urlNode.Value;
	// 			updateArray = updateURL.split("/");
	// 		}
	// 		else
	// 			throw new Error('');
	// 	}
	// 	catch (e) {
	// 		dump("sogoBaseURL - unable to obtain updateURL from extensions.rdf file: " + e + "\n");
	// 	}

	// 	var sogoPrefix;
	// 	try {
	// 		sogoPrefix = "/" + Services.prefs.getCharPref("sogo-connector.sogo-prefix");
	// 	}
	// 	catch(e) {
	// 		sogoPrefix = "/SOGo";
	// 	}

	// 	sogoConfig['baseURL'] = (updateArray[0] + "//" + updateArray[2]
	// 													 + sogoPrefix + "/dav/" + sogoUserName() + "/");
	// }

	sogoConfig['baseURL'] = "https://sogoludo/SOGo/dav/sogo3/";
	
	return sogoConfig['baseURL'];
}
