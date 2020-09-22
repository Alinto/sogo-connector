/* subscription-utils.js - This file is part of "SOGo Connector", a Thunderbird extension.
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
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("subscription-utils.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-connector/content/global/sogo-config.js",
					 "chrome://inverse-library/content/sogoWebDAV.js"]);

function escapedUserName(original) {
	var conversionTable = {"_": "_U_",
												 "\\.": "_D_",
												 "#": "_H_",
												 "@": "_A_",
												 "\\*": "_S_",
												 ":": "_C_",
												 ",": "_CO_",
												 " ": "_SP_",
												 "\\+": "_P_"};
	
	var escapedString = original;
	var re;
	for (let conversionChar in conversionTable) {
		re = new RegExp(conversionChar, 'g');
		escapedString = escapedString.replace(re, conversionTable[conversionChar]);
	}

	return escapedString;
}

function subscriptionURL(url) {
	var currentUser = sogoUserName();
	var urlArray = url.split("/");
	var urlUser = urlArray[5];
	urlArray[5] = currentUser;
	var urlFolder = urlArray[7];
	urlArray[7] = encodeURIComponent(escapedUserName(urlUser) + "_" + urlFolder);

	return urlArray.join("/");
}

function _subscriptionTarget(handler, folderURL, node) {
	this.handler = handler;
	this.folderURL = folderURL;
	this.node = node;
}

_subscriptionTarget.prototype = {
 handler: null,
 folderURL: null,
 node: null,
 target: null,
 onDAVQueryComplete: function(status, result) {
 		//dump("onDavQueryComplete - status: " + status + "\n");
		//dump("onDavQueryComplete - result: " + result + "\n");
		if (status > 199 && status < 400) {
			var rawOwner = "" + this.node["owner"];
			var start = rawOwner.indexOf("http");
			var davOwner = rawOwner.substr(start,
																		 this.node["owner"].lastIndexOf("</D:href>")
																		 -start);
			var serverBaseURL = sogoBaseURL();
			var owner = serverBaseURL.substr(serverBaseURL.indexOf("/SOGo/dav/")
																			 + "/SOGo/dav/".length);
			if (owner[owner.length-1] == '/')
				owner = owner.substr(0, owner.length-1);

			var formattedName = this.node["displayName"];
			
			// If we received a payload, use this as the display name. Since SOGo v2.2.7,
			// we return a 200 (instead of a 204) and the folder name in the response.
			if (status == 200) {
				formattedName = result;
			}
			
			this.handler.addDirectories([{url: this.folderURL, owner: owner,
							displayName: formattedName}])
		}
	}
};

function subscribeToFolder(node) {
	var result = false;
	var nodeURL = node["url"];

	if (!nodeURL)
		return result;

	if (nodeURL[nodeURL.length - 1] != '/')
		nodeURL = nodeURL.concat('/');

	if (nodeURL[0] == '/')
		nodeURL = sogoHostname() + nodeURL;

	var folderURL = subscriptionURL(nodeURL);

	var doesExist = false;
	if (subscriptionGetHandler) {
		var handler = subscriptionGetHandler();
		var existing = handler.getExistingDirectories();
		for (var url in existing) {
			if (url[url.length - 1] != '/')
				url = url.concat('/');
			if (url == nodeURL || url == folderURL) {
				doesExist = true;
				break;
			}
		}

		if (!doesExist) {
			window.setTimeout(_deferredSubscription, 1, nodeURL,
												new _subscriptionTarget(handler, folderURL, node));
			result = true;
		}
	}
	else
		throw("subscription-utils.js: subscriptionGetHandler not implemented\n");

	return result;
}

function _deferredSubscription(nodeURL, target) {
	var post = new sogoWebDAV(nodeURL, target);
	post.post("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
						+ "<subscribe xmlns=\"urn:inverse:params:xml:ns:inverse-dav\"/>");
}

function isSubscribedToFolder(folderURL) {
	var result = false;

	if (!folderURL)
		return result;

	if (folderURL[0] == '/')
		folderURL = sogoHostname() + folderURL;

	var testURL = subscriptionURL(folderURL);

	if (subscriptionGetHandler) {
		var handler = subscriptionGetHandler();
		var existing = handler.getExistingDirectories();
		for (var url in existing) {
			var oldURL = url;
			if (url[url.length - 1] != '/')
				url = url.concat('/');
			if (url == testURL) {
				result = true;
				break;
			}
		}
	}

	return result;
}

function unsubscribeFromFolder(nodeURL, handler) {
	var existingFolder = null;
  var existing = handler.getExistingDirectories();
	for (var url in existing) {
		var oldURL = url;
		if (url[url.length - 1] != '/')
			url = url.concat('/');
		if (url == nodeURL) {
			existingFolder = existing[oldURL];
			break;
		}
	}

	if (existingFolder) {
		var target = {};
		target.onDAVQueryComplete = function(status, result) {
			// 		dump("onDavQueryComplette...." + status + "\n");
			if ((status > 199 && status < 400)
					|| status == 404)
				handler.removeDirectories([existingFolder]);
		};

		var post = new sogoWebDAV(nodeURL, target);
		post.post("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
							+ "<unsubscribe xmlns=\"urn:inverse:params:xml:ns:inverse-dav\"/>");
	}
}
