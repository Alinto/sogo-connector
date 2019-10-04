/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("roles-dialog.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js"]);

var userData = {
 userID: null,
 userName: null
};

var folderURL = null;
var unknownRoles = [];

var menuObjectClasses = [ "Public", "Confidential", "Private" ];

function onLoad() {
	var data = window.arguments[0];

	userData.userID = data.user;
	userData.userName = data.userName;
	folderURL = data.folderURL;

	if (userData.userID == "anonymous") {
		window.resizeTo(500, 186);
		var cbRoles = [ "Creator", "Eraser" ];
		for (var cbRole in cbRoles) {
				var cbId = "roleObject" + cbRole;
				var cb = document.getElementById(cbId);
				cb.collapsed = true;
		}

		var menuRoles = [ "Modifier", "Responder" ];
		for (var menuRole in menuRoles) {
			for (var menuClass in menuObjectClasses) {
				var menuOptionId = "menuOption" + menuClass + menuRole;
				var menuOption = document.getElementById(menuOptionId);
				menuOption.collapsed = true;
			}
		}

		var titleLabel = document.getElementById("titleLabel");
		titleLabel.setAttribute("transparent", "true");
	}

	var titleUserName = document.getElementById("titleUserName");
	titleUserName.value = userData.userName;

	disableWidgets(true);
	var reportQuery = ('<acl-query'
										 + ' xmlns="urn:inverse:params:xml:ns:inverse-dav">'
										 + '<roles user="'
										 + xmlEscape(userData.userID)
										 + '"/></acl-query>');
	var report = new sogoWebDAV(folderURL, this, "load-query");
	report.report(reportQuery, false);
}

function onDAVQueryComplete(status, response, headers, data) {
	if (status > 199 && status < 300) {
		if (data == "load-query") {
			if (response && response.indexOf("<?xml") == 0) {
				var parser = new DOMParser();
				var xmlResult = parser.parseFromString(response, "text/xml");
				var result = xmlResult.documentElement;
				for (var i = 0; i < result.childNodes.length; i++)
					_updateRoleWidget(result.childNodes[i].tagName);
			}
		}
		else if (data == "update-query")
			setTimeout("window.close()", 100);
	}
	else
		dump("Error in completing request: code " + status
				 + "\nResponse:\n" + response + "\n");
 	disableWidgets(false);
}

function _updateRoleWidget(role) {
	var done = false;
	for (var i = 0; i < menuObjectClasses.length && !done; i++) {
		if (role.indexOf(menuObjectClasses[i]) == 0) {
			var menu = document.getElementById("menu" + menuObjectClasses[i]);
			menu.value = role.substr(menuObjectClasses[i].length);
			done = true;
		}
	}
	if (!done) {
		var roleNode = document.getElementById("role" + role);
		if (roleNode)
			roleNode.checked = true;
		else
			unknownRoles.push(role);
	}
}

function disableWidgets(disable) {
	var updateBtn = document.getElementById("updateBtn");
	updateBtn.disabled = disable;
	var cancelBtn = document.getElementById("cancelBtn");
	cancelBtn.disabled = disable;
	var menus = document.getElementsByTagName("menulist");
	for (var i = 0; i < menus.length; i++)
		menus[i].disabled = disable;
	var checkBoxes = document.getElementsByTagName("checkbox");
	for (var i = 0; i < checkBoxes.length; i++)
		checkBoxes[i].disabled = disable;
}

function updateCurrentUser() {
	disableWidgets(true);

	var xmlRoles = "";

	for (var i = 0; i < menuObjectClasses.length; i++) {
		var menu = document.getElementById("menu" + menuObjectClasses[i]);
		if (menu.value)
			xmlRoles += "<" + xmlEscape(menuObjectClasses[i] + menu.value) + "/>";
	}

	var checkBoxes = document.getElementsByTagName("checkbox");
	var roleCBPrefix = "role";
	for (var i = 0; i < checkBoxes.length; i++)
		if (checkBoxes[i].checked) {
			var id = checkBoxes[i].getAttribute("id");
			xmlRoles += "<" + xmlEscape(id.substr(roleCBPrefix.length)) + "/>";
		}
	if (unknownRoles.length > 0)
		xmlRoles += "<" + unknownRoles.join("/><") + "/>";

	var updateQuery = ('<acl-query'
										 + ' xmlns="urn:inverse:params:xml:ns:inverse-dav">'
										 + '<set-roles user="'
										 + xmlEscape(userData.userID)
										 + '">'
										 + xmlRoles
										 + '</set-roles>'
										 + '</acl-query>');
	var post = new sogoWebDAV(folderURL, this, "update-query");
	post.post(updateQuery);
}

window.addEventListener("load", onLoad, false);
