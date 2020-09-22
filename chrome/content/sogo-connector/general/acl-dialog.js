/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("acl-dialog.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-connector/content/global/sogo-config.js",
					 "chrome://inverse-library/content/sogoWebDAV.js"]);

var _this = this;
var WL = null;

var folderData = {
 url: null,
 hasPublicAccess: false,
 defaultUserID: null,
 rolesDialogURL: null
};

function openRolesWindowForUser(userID) {
	var listItem = document.getElementById("item-" + userID);
	window.openDialog(folderData.rolesDialogURL,
										"roles",
										"dialog,titlebar,modal",
										_this,
										WL,
										{user: userID, userName: listItem.label, folderURL: folderData.url});
}

function openRolesWindowForUserNode(node) {
	var prefix = "item-";
	var fullID = node.getAttribute("id");
	if (fullID.indexOf(prefix) == 0)
		openRolesWindowForUser(fullID.substr(prefix.length));
}

function editSelectedEntry() {
	var userList = document.getElementById("userList");
	if (userList.selectedItem)
		openRolesWindowForUserNode(userList.selectedItem);
}

function addEntry() {
	window.openDialog("chrome://sogo-connector/content/general/subscription-dialog.xhtml",
										"aclUserAdd",
										"chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
										_this,
										WL);
}

function subscriptionDialogType() {
	return "users";
}

var aclQueryHandler = {
 onDAVQueryComplete: function(status, response, headers, data) {
 		//dump("request: " + data.rqType + "\n");
 		//dump("response: " + response + "\n");
		if (status > 199 && status < 300) {
			if (data.rqType == "user-list") {
				var parser = new DOMParser();
				var xmlResult = parser.parseFromString(response, "text/xml");
				var result = xmlResult.firstChild;
				for (var i = 0; i < result.childNodes.length; i++)
					_parseResultNode(result.childNodes[i]);

				if (folderData.defaultUserID) {
					var defaultUser = { "id": folderData.defaultUserID,
															"displayName": WL.extension.localeData.localizeMessage("Any Authenticated User") };
					_appendUserInList(defaultUser, "any-user");
				}
				if (folderData.hasPublicAccess) {
					var publicUser = { "id": "anonymous",
														 "displayName": WL.extension.localeData.localizeMessage("Public Access") };
					_appendUserInList(publicUser, "anonymous-user");
				}
			}
			else if (data.rqType == "add-user") {
				_appendUserInList(data.node);
			}
			else if (data.rqType == "remove-user") {
				var node = document.getElementById(data.node);
				node.parentNode.removeChild(node);
			}
		}
		showThrobber(false);
	}
};

function deleteEntry() {
	var userList = document.getElementById("userList");
	if (userList.selectedItem) {
		var prefix = "item-";
		var fullID = userList.selectedItem.id;
		var userID = fullID.substr(prefix.length);
		if (!(userID == "anonymous" || userID == folderData.defaultUserID)) {
			showThrobber(true);
			var postQuery = ('<acl-query'
											 + ' xmlns="urn:inverse:params:xml:ns:inverse-dav">'
											 + '<remove-user user="'
											 + userID + '"/>'
											 + '</acl-query>');
			var post = new sogoWebDAV(folderData.url, aclQueryHandler,
																{rqType: "remove-user",
																 node: fullID});
			post.post(postQuery);
		}
	}
}

function showThrobber(busyState) {
	var throbber = document.getElementById("throbber-box");
	var newBusyState = (busyState ? "true" : "false");
	throbber.setAttribute("busy", newBusyState);
}

function onLoad() {
	dump("acl-dialog.js: onLoad()\n");

	WL = window.arguments[1];
	var data = window.arguments[2];
	folderData.url = data.url;
	folderData.rolesDialogURL = data.rolesDialogURL;

	showThrobber(true);

	var handler = {
	onDAVQueryComplete: function(status, response, headers, data) {
			folderData.hasPublicAccess = (status > 199 && status < 300);
			var reportQuery = ('<acl-query'
												 + ' xmlns="urn:inverse:params:xml:ns:inverse-dav">'
												 + '<user-list/>'
												 + '</acl-query>');
			var report = new sogoWebDAV(folderData.url,
																	aclQueryHandler, { rqType: "user-list" });
			report.report(reportQuery, false);
		}
	};

	var options = new sogoWebDAV(sogoBaseURL() + "../public/",
															 handler);
	options.options();
}

function _parseResultNode(node) {
	if (node.tagName == "default-user") {
		var idNode = node.firstChild.firstChild;
		folderData.defaultUserID = idNode.nodeValue;
	}
	else if (node.tagName == "user") {
		var user = {};
		for (var i = 0; i < node.childNodes.length; i++) {
			var key = node.childNodes[i].tagName;
// 			dump("key: " + key + "\n");
			if (node.childNodes[i].firstChild) {
                                var value = node.childNodes[i].firstChild.nodeValue;
// 			        dump("value: " + value + "\n");
			        user[key] = value;
			}
		}
		if (user["id"] != "anonymous") {
			_appendUserInList(user);
		}
	}
	else
		dump("unknown tag '" + node.tagName + "\n");
}

// function _createUserListItem(user) {
// 	var display = user.displayName;
// 	if (display) {
// 		var email = user.email;
// 		if (email)
// 			display += " <" + email + ">";
// 	}
// 	else
// 		display = user.email;

// 	var listItem = document.createElement("richlistitem");
// 	listItem.setAttribute("label", display);
// 	listItem.setAttribute("id", "item-" + user.id);
// 	//listItem.setAttribute("class", "listitem-iconic");
// 	listItem.addEventListener("dblclick", onItemDblClick, false);

// 	return listItem;
// }

function _appendUserInList(user, userClass) {
	if (!userClass) {
		userClass = "normal-user";
	}

	// We format the name properly
	var display = user.displayName;
	if (display) {
		var email = user.email;
		if (email)
			display += " <" + email + ">";
	}
	else
		display = user.email;

	var list = document.getElementById("userList");
	var userItem = list.appendItem(display);
	userItem.setAttribute("id", "item-" + user.id);
	userItem.setAttribute("class", "listitem-iconic");
	userItem.addEventListener("dblclick", onItemDblClick, false);
	userItem.className += " " + userClass;
	
	// var lis = list.getElementsByTagName("richlistitem");
	// var count = lis.length - 1;
	// if (userClass == "normal-user" && lis.length > 0
	// 		&& lis[count].className.indexOf("normal-user") == -1) {
	// 	var nextLi = null;
	// 	while (count > -1 && !nextLi) {
	// 		if (lis[count].className.indexOf("normal-user") > -1) {
	// 			nextLi = lis[count+1];
	// 		}
	// 		else {
	// 			count--;
	// 		}
	// 	}
	// 	if (!nextLi) {
	// 		nextLi = lis[0];
	// 	}
	// 	list.insertBefore(userItem, nextLi);
	// }
	// else {
	// 	list.appendChild(userItem);
	// }

	return true;
}

function onItemDblClick(event) {
	openRolesWindowForUserNode(this);
}

function subscriptionAddUser(node) {
	var result;

	var existingNode = document.getElementById("item-" + node.id);
	if (!existingNode) {
		window.setTimeout(_deferredAddition, 20, node);
		result = true;
	}
	else
		result = false;

	return result;
}

function _deferredAddition(node) {
	showThrobber(true);
	var postQuery = ('<acl-query'
									 + ' xmlns="urn:inverse:params:xml:ns:inverse-dav">'
									 + '<add-user user="' + node.id + '"/>'
									 + '</acl-query>');
	var post = new sogoWebDAV(folderData.url, aclQueryHandler,
														{rqType: "add-user",
														 node: node});
	post.post(postQuery);
}

window.addEventListener("load", onLoad, false);
