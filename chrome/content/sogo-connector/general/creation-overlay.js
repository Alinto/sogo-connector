/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function onCreationDialog() {
	var button = document.getElementById("createButton");
	button.addEventListener("click", onCreateButtonClick, false);
	window.addEventListener("dialogaccept", onDialogAccept, false);
}

function onCreateButtonClick(event) {
	_confirmCreation();
}

function onDialogAccept(event) {
	dump("accept\n");
	_confirmCreation();
	event.preventDefault();
}

function _confirmCreation() {
	var createInput = document.getElementById("createInput");
	var folderName = "" + createInput.value;

	if (window.opener
			&& folderName.replace(/(^\s+|\s+$)/g, '').length > 0) {
		window.opener.createFolder(folderName,
															 window.opener.creationGetHandler());
		window.close();
	}
}

window.addEventListener("load", onCreationDialog, false);
