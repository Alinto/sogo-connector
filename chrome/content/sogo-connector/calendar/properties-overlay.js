/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (let i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("properties-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
					 "chrome://sogo-connector/content/global/sogo-config.js"]);

window.addEventListener("load", onLoadOverlay, false);

let folderURL = "";
let originalName = "";
let originalColor = "";
let originalAlarms;
let sogoBoxes = ["notify-on-personal-modifications",
								 "notify-on-external-modifications", 
								 "notify-user-on-personal-modifications"];
let originalSOGoValues = {};

function onLoadOverlay() {
	if (window.arguments && window.arguments[0]) {
		let calendar =  window.arguments[0].calendar;
		if (calendar) {
			let calendarName = document.getElementById("calendar-name");
			originalName = calendarName.value;
			folderURL = document.getElementById("calendar-uri").value;
			originalColor = document.getElementById("calendar-color").value;
			originalAlarms = document.getElementById("fire-alarms").checked;

			let hiddenRows;
			if (folderURL.indexOf(sogoBaseURL()) > -1) {
				let aclEntry = calendar.aclEntry;
				if (aclEntry.userIsOwner) {
					let box = document.getElementById("sogo-calendar-properties");
					box.collapsed = false;
					sizeToContent();

					/* notifications */
					for (let i in sogoBoxes) {
  						let davPropName = sogoBoxes[i];
							let boxId = "sogo-" + davPropName;
							let box = document.getElementById(boxId);
							let propName = "calendar.sogo." + davPropName;
							let propValue = calendar.getProperty(propName);
							if (!propValue) {
								propValue = "false";
							}
							box.checked = (propValue == "true");
							originalSOGoValues[propName] = propValue;
					}
					let propName = "calendar.sogo.notified-user-on-personal-modifications";
					let propValue = calendar.getProperty(propName);
					if (!propValue) {
						propValue = "";
					}
					originalSOGoValues[propName] = propValue;
					let field = document.getElementById("sogo-notified-user-on-personal-modifications");
					field.value = propValue;
				}

				/* standard rows */
				hiddenRows = ["calendar-readOnly-row", "calendar-cache-row"];
			}
			else {
				hiddenRows = ["sogo-calendar-properties"];
			}
			for (let i in hiddenRows) {
					document.getElementById(hiddenRows[i]).setAttribute("collapsed", "true");
   		}

			/* "disable" callback */
			let box = document.getElementById("sogo-notify-user-on-personal-modifications");
			box.addEventListener("click",
													 onSOGoNotifyUserOnPersonalModificationsChanged,
													 false);
			updateSOGoNotifyUserOnPersonalModificationsBox(box);
		}
	}
}

function updateSOGoNotifyUserOnPersonalModificationsBox(box) {
	let field = document.getElementById("sogo-notified-user-on-personal-modifications");
	field.disabled = !box.checked;
}

function onSOGoNotifyUserOnPersonalModificationsChanged(event) {
	updateSOGoNotifyUserOnPersonalModificationsBox(this);
}

function onOverlayAccept() {
	dump("\nonOverlayAccept()\n");

	let newFolderURL = document.getElementById("calendar-uri").value;
	let newName = document.getElementById("calendar-name").value;
	let newColor = document.getElementById("calendar-color").value;
	let newAlarms = document.getElementById("fire-alarms").checked;

	if (newFolderURL.indexOf(sogoBaseURL()) > -1
			&& newFolderURL == folderURL) {
		let calendar = window.arguments[0].calendar;
		let valueChanged = false;
		
		let aclEntry = calendar.aclEntry;
		if (aclEntry.userIsOwner) {
			/* notifications */
			for (let i in sogoBoxes) {
				let davPropName = sogoBoxes[i];
				let boxId = "sogo-" + davPropName;
				let box = document.getElementById(boxId);
				let propName = "calendar.sogo." + davPropName;
				let propValue = box.checked ? "true" : "false";
				if (originalSOGoValues[propName] != propValue) {
					valueChanged = true;
					break;
				}
			}
			if (!valueChanged) {
				let propName = "calendar.sogo.notified-user-on-personal-modifications";
				let field = document.getElementById("sogo-notified-user-on-personal-modifications");
				let propValue = field.value;
				valueChanged = (originalSOGoValues[propName] != propValue);
			}
		}

		let changeName = (newName != originalName);
		let changeColor = (newColor != originalColor);
		let changeAlarms = (newAlarms != originalAlarms);
		valueChanged |= (changeName  || changeColor || changeAlarms);

		if (valueChanged) {
			let proppatch = new sogoWebDAV(newFolderURL, this);
			let query = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
									 + "<propertyupdate xmlns=\"DAV:\">"
									 + "<set><prop>");
			if (changeName)
				query += "<displayname>" + xmlEscape(newName) + "</displayname>";
			if (changeColor)
				query += ("<calendar-color xmlns=\"http://apple.com/ns/ical/\">"
									+ newColor + "FF</calendar-color>");
			if (changeAlarms) {
				query += ("<calendar-show-alarms xmlns=\"urn:inverse:params:xml:ns:inverse-dav\">"
									+ (newAlarms ? "true" : "false")
									+ "</calendar-show-alarms>");
			}

			if (aclEntry.userIsOwner) {
				for (let i in sogoBoxes) {
					let davPropName = sogoBoxes[i];
					let boxId = "sogo-" + davPropName;
					let box = document.getElementById(boxId);
					let propName = "calendar.sogo." + davPropName;
					let propValue = box.checked ? "true" : "false";
					if (originalSOGoValues[propName] != propValue) {
						query += ("<" + davPropName + " xmlns=\"urn:inverse:params:xml:ns:inverse-dav\">"
											+ propValue + "</" + davPropName + ">");
						calendar.setProperty(propName, propValue);
					}
				}
				let davPropName = "notified-user-on-personal-modifications";
				let propName = "calendar.sogo." + davPropName;
				let field = document.getElementById("sogo-" + davPropName);
				let propValue = field.value;
				if (originalSOGoValues[propName] != propValue) {
					calendar.setProperty(propName, propValue);
					query += ("<" + davPropName + " xmlns=\"urn:inverse:params:xml:ns:inverse-dav\">"
										+ propValue + "</" + davPropName + ">");
				}
			}

			query += "</prop></set></propertyupdate>";
			proppatch.proppatch(query);

			event.preventDefault();
		}
		else
			window.onAcceptDialog();
	}
	else
		window.onAcceptDialog();
}

function onDAVQueryComplete(status, result) {
	if (status == 207) {
		window.onAcceptDialog();
		setTimeout("window.close();", 100);
	}
	else {
		let strBundle = document.getElementById("propertiesMessages");
		window.alert(strBundle.getString("serverUpdateFailed") + "\n" + status);
	}
}

function SIOnLoadHandler(event) {
	document.addEventListener("dialogaccept", function(event) {
			onOverlayAccept(event);
		}); 
}

window.addEventListener("load", SIOnLoadHandler, false);
