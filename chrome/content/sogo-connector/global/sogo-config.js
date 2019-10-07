/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

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
	if (!sogoConfig['baseURL']) {
		var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
												.getService(Components.interfaces.nsIRDFService);
		var extensions
			= rdf.GetResource("http://inverse.ca/sogo-connector/extensions");
		var updateURLres
			= rdf.GetResource("http://inverse.ca/sogo-connector/updateURL");
		var ds
			= rdf.GetDataSourceBlocking("chrome://sogo-connector/content/global/extensions.rdf");

		var updateArray;
		try {
			var urlNode = ds.GetTarget(extensions, updateURLres, true);
			if (urlNode instanceof Components.interfaces.nsIRDFLiteral) {
				var updateURL = urlNode.Value;
				updateArray = updateURL.split("/");
			}
			else
				throw new Error('');
		}
		catch (e) {
			dump("sogoBaseURL - unable to obtain updateURL from extensions.rdf file: " + e + "\n");
		}

		var sogoPrefix;
		try {
			sogoPrefix = "/" + Services.prefs.getCharPref("sogo-connector.sogo-prefix");
		}
		catch(e) {
			sogoPrefix = "/SOGo";
		}

		sogoConfig['baseURL'] = (updateArray[0] + "//" + updateArray[2]
														 + sogoPrefix + "/dav/" + sogoUserName() + "/");
	}

	return sogoConfig['baseURL'];
}
