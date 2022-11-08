/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

var acceptedFromObserver = false;
var passwordObserver = null;

function jsInclude(files, target) {
	let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (let i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("common-dialog-overlay.js: failed to include '" + files[i] + "'\n"
					 + e + "\nFile: " + e.fileName + 
					 "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
		}
	}
}

jsInclude(["chrome://sogo-connector/content/global/sogo-config.js"]);

function SICommonDialogOnUnload() {
	let description = document.getElementById("infoBody").textContent;
	let username = document.getElementById("loginTextbox").value;
	let password = document.getElementById("password1Textbox").value;
	let checked = document.getElementById("checkbox").checked;

	//dump("\n\n\n\nValues fromd dialog: " + description + " " + username + " " + password + " " + checked + "\n\n\n\n");

	if (checked && password.length) {
		let loginManager = Components.classes["@mozilla.org/login-manager;1"].
			getService(Components.interfaces.nsILoginManager);

		let logins = loginManager.getAllLogins({});

		// login.hostname has the following potential prefix values
		// SOGo (CalDAV/CardDAV): http://....
		// SMTP: smtp://...
		// IMAP: imap://...
		// POP3: mailbox://...
		let supportedSchemes = ["http", "https", "imap","mailbox", "smtp"];

		for (let i = 0; i < logins.length; i++) {
			let login = logins[i];
			let index = login.hostname.indexOf("://");
			//dump("login.hostname: " + login.hostname + "\n");
			if (index > -1) {
				let scheme = login.hostname.substring(0,index);
				let hostname = login.hostname.substring(index+3);
				//dump("Scheme: " + scheme + " and new hostname: " + hostname + "\n");
				// We strip the TLD of the hostname in case we have foo.com for SMTP/IMAP and foo.net
				// for SOGo, or vice-versa.
				let res = hostname.split(".");
				if (res.length > 1)
					hostname = res[res.length-2]

				if (supportedSchemes.indexOf(scheme) > -1) {

					//dump("\nStored password: " + i + " " + scheme + " " + hostname + " " + login.username + " " + login.password + "\n\n");

					if (description.indexOf(hostname) > -1) {
						// Now comes the tricky part - if the username is the same has the captured one and the hostname is somewhere in the
						// infoBody, we update the password.
						if (username == login.username) {
							//dump("\nFound stored login to update!\n");
							loginManager.removeLogin(login);
							login.password = password;
							loginManager.addLogin(login);
						}
						// We have no username defined, like it's the case for SMTP/IMAP password prompts.
						// In this case, the username is also contained in the description
						else if (username.length == 0 && description.indexOf(login.username) > -1) {
							//dump("\nFound stored login to update!\n");
							loginManager.removeLogin(login);
							login.password = password;
							loginManager.addLogin(login);
						}
					}
				}
			}
		}
	}

	//window.SIOldCommonDialogOnUnload();
}

//window.SIOldCommonDialogOnUnload = window.commonDialogOnUnload;
//window.commonDialogOnUnload = window.SICommonDialogOnUnload;

//function onLoad(activatedWhileWindowOpen) {
//	dump("common-dialog-overlay.js: onLoad()\n");
//	window.SIOldCommonDialogOnUnload = window.commonDialogOnUnload;
//	window.commonDialogOnUnload = window.SICommonDialogOnUnload;
//}


function onUnload(deactivatedWhileWindowOpen) {
	SICommonDialogOnUnload();
}
