/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
        .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("subscription-dialog.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://sogo-connector/content/general/subscription-utils.js"]);

let gSearchTimer = null;
let resourceType;

window.addEventListener("load", onSubscriptionDialog, false);

function isSubscribed(node) {
    return window.opener.isSubscribedToFolder(node["href"]);
}

function onSubscriptionDialog() {
    resourceType = window.opener.subscriptionDialogType();
    let button = document.getElementById("addButton");
    button.addEventListener("click", onAddButtonClick, false);

    let tree = document.getElementById("subscriptionTree");
    tree.addEventListener("dblclick", onAddButtonClick, false);

    let searchInput = document.getElementById("peopleSearchInput");
    searchInput.addEventListener("input", onSearchInputInput, false);
    searchInput.addEventListener("keypress", onSearchInputKeyPress, false);

    searchInput.showingSearchCriteria = false;
    searchInput.value = "";
    searchInput.select();
}

function onAddButtonClick(event) {
    let tree = document.getElementById("subscriptionTree");

    if (!tree || !tree.treeView)
        return;

    let node = tree.treeView.getSelectedNode();
    if (node) {
        if (resourceType == "users") {

            if (window.opener.subscriptionAddUser(node)) {
                window.setTimeout(close, 1);
            }
        }
        else { 
            let index = tree.treeView.getParentIndex(tree.treeView.selection.currentIndex);
            if (isSubscribed(node)) {
                let strings = document.getElementById("subscription-dialog-strings");
                window.alert(strings.getString("You have already subscribed to that folder!"));
            }
            else {
                let name = (node["displayName"]
                            + " (" + tree.treeView.getCellText(index, 0) + ")");
                let folder = {url: node["href"],
                              owner: node["owner"],
                              displayName: name};
                if (window.opener.subscribeToFolder(folder)) {
                    window.setTimeout(close, 30);
                }
            }
        }
    }
}

function onSearchInputInput(event) {
    // 	dump("this.showingSearchCriteria: " + this.showingSearchCriteria + "\n");
    if (!this.clean) {
        let tree = document.getElementById("subscriptionTree");
        tree.view = null;
        tree.setAttribute("searching", "none");
        this.removeAttribute("searching");
        this.clean = true;
    }

    if (gSearchTimer) {
        clearTimeout(gSearchTimer);
        gSearchTimer = null;
    }

    if (this.value) {
        gSearchTimer = setTimeout(onStartSearch, 800);
    }
}

function onSearchInputKeyPress(event) {
    if (event.keyCode == 13) {
        if (gSearchTimer) {
            clearTimeout(gSearchTimer);
            gSearchTimer = null;
        }
        onStartSearch();
        event.preventDefault();
    }
}

function onClearSearch() {
    let searchInput = document.getElementById("peopleSearchInput");
    searchInput.value = "";
    searchInput.showingSearchCriteria = true;
    searchInput.clean = true;
    searchInput.removeAttribute("searching");
    let tree = document.getElementById("subscriptionTree");
    tree.view = null;
    tree.setAttribute("searching", "none");
    if (gSearchTimer) {
        clearTimeout(gSearchTimer);
        gSearchTimer = null;
    }
    let button = document.getElementById("quick-search-clearbutton");
    button.setAttribute("disabled", "true");
    button.setAttribute("clearButtonHidden", "true");
}

let userReportTarget = {
 onDAVQueryComplete: function(status, result, headers) {
        let searchInput = document.getElementById("peopleSearchInput");
        searchInput.clean = false;
        let throbber = document.getElementById("throbber-box");
        throbber.setAttribute("busy", "false");
        if (result) {
            let parser = new DOMParser();
            let xmlResult = result;
            let treeView;
            if (resourceType == "users")
                treeView = new UsersTreeView(xmlResult);
            else
                treeView = new SubscriptionTreeView(xmlResult, resourceType);
            let tree = document.getElementById("subscriptionTree");
            tree.view = treeView;
            tree.treeView = treeView;
            tree.setAttribute("searching", "done");

            if (treeView.rowCount == 0) {
                searchInput.setAttribute("searching", "notfound");
            } else {
                searchInput.removeAttribute("searching");
            }
        }
        else {
            searchInput.setAttribute("searching", "notfound");
        }
    }
};

let collectionReportTarget = {
 onDAVQueryComplete: function(status, result, headers, data) {
        let parser = new DOMParser();
        let xmlResult = result;
        data.treeView.parseFolders(data.user, xmlResult);
        let tree = document.getElementById("subscriptionTree");
        tree.view = data.treeView;
        tree.treeView = data.treeView;
    }
};

function onStartSearch() {
    let throbber = document.getElementById("throbber-box");
    throbber.setAttribute("busy", "true");

    let searchInput = document.getElementById("peopleSearchInput");

    let query = ("<user-query"
                 + " xmlns=\"urn:inverse:params:xml:ns:inverse-dav\">"
                 + "<users match-name=\""
                 + xmlEscape(searchInput.value)
                 + "\"/>"
                 + "</user-query>");
    let report = new sogoWebDAV(sogoBaseURL(), userReportTarget, undefined, undefined, false);
    report.report("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                  + query, false);
}

function SubscriptionTreeView(queryResult, type) {
    this.data = [];
    this.type = type;
    if (queryResult)
        this.parseUsers(queryResult.getElementsByTagName("users"));
    // 	if (queryResult)
    // 		this.parseTree(queryResult.getElementsByTagName("response"));
}

SubscriptionTreeView.prototype = {
 rowCount: 0,
 selection: 0,
 tree: null,

 images: {"calendar": "chrome://sogo-connector/skin/calendar-folder.png",
          "contact": "chrome://sogo-connector/skin/addressbook-folder.png"},
 parseTree: function(queryResults) {
        for (let i = 0; i < queryResults.length; i++) {
            let node = queryResults[i];
            this._parseTreeNodes(node.childNodes);
        }

        this._recount();
    },
 _parseTreeNodes: function(nodes) {
        let treeNode = {};
        let owner;

        for (let i = 0; i < nodes.length; i++) {
            let currentNode = nodes[i];
            let value = "";
            for (let j = 0; j < currentNode.childNodes.length; j++)
                value += currentNode.childNodes[j].nodeValue;
            // 				dump(currentNode.localName + ": " + value + "\n");
            if (currentNode.localName == "owner")
                owner = value;
            else
                treeNode[currentNode.localName] = value;
        }
        // 			dump("owner:  " + owner + "\n");
        let ownerNodes = this.data[owner];
        if (ownerNodes)
            ownerNodes.push(treeNode);
        else {
            this.data[owner] = [treeNode];
            this.data[owner].open = false;
        }
    },

 parseUsers: function(queryResults) {
        if (queryResults.length)
            this._parseUsersNodes(queryResults[0].childNodes);
    },
 _parseUsersNodes: function(nodes) {
        for (let i = 0; i < nodes.length; i++) {
            let currentNode = nodes[i];
            let nodeDict = {};
            for (let j = 0; j < currentNode.childNodes.length; j++) {
                let subnode = currentNode.childNodes[j];
                let key = subnode.nodeName;
                let value = ((subnode.firstChild)
                             ? subnode.firstChild.nodeValue : "");
                nodeDict[key] = value;
            }
            // dump("pushing: " + nodeDict["id"] + "\n");
            this.data.push(nodeDict);
        }
        this.rowCount = this.data.length;
    },

 parseFolders: function(user, queryResult) {
        let userData = null;
        for (let i = 0; userData == null && i < this.data.length; i++) {
            if (this.data[i].id == user)
                userData = this.data[i];
        }

        let responses = queryResult.getElementsByTagNameNS("DAV:", "response")
        if (responses.length) {
            userData.hasFolders = true;
            userData.folders = [];
            for (let i = 0; i < responses.length; i++) {
                let response = responses[i];
                let href = response.getElementsByTagNameNS("DAV:", "href")[0].childNodes[0].nodeValue;
                let displayName = response.getElementsByTagNameNS("DAV:", "displayname")[0].childNodes[0].nodeValue;
                let parenIndex = displayName.lastIndexOf(" (");
                if (parenIndex > -1) {
                    displayName = displayName.substr(0, parenIndex);
                }
                let folder = { href: href,
                               owner: user,
                               displayName: displayName };
                userData.folders.push(folder);
            }
            this._recount();
        }
        else {
            userData.hasNoFolders = true;
        }
    },

 _recount: function() {
        let count = 0;
        for (let userCount = 0; userCount < this.data.length; userCount++) {
            let userData = this.data[userCount];
            count++;
            if (userData.nodeOpen) {
                if (userData.hasFolders) {
                    count += userData.folders.length;
                }
                else {
                    count++;
                }
            }
        }

        this.rowCount = count;
    },

 canDrop: function(rowIndex, orientation) {
        dump("canDrop\n");
        return false;
    },
 cycleCell: function(rowIndex, col) {
        dump("cycleCell\n");
    },
 cycleHeader: function(col) {
        dump("cycleHeader\n");
    },
 drop: function(rowIndex, orientation) {
        dump("drop\n");
    },
 getCellProperties: function(rowIndex, col, properties) {
        let rows = [];
        let i = 0;

        if (!properties)
            return;

        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            rows[i] = ["userNode"];
            i++;
            if (userData.nodeOpen) {
                rows[i-1].push("open");
                // 				dump("user node " + (i - 1) + " marked open\n");
                if (userData.hasFolders) {
                    for (let folderCount = 0;
                         folderCount < userData.folders.length;
                         folderCount++) {
                        let newProperties = ["folderNode"];
                        if (isSubscribed(userData.folders[folderCount]))
                            newProperties.push("subscribed");
                        rows[i] = newProperties;
                        i++;
                    }
                }
                else {
                    rows[i] = ["messageNode"];
                    i++;
                }
            }
        }

        let svc = Components.classes["@mozilla.org/atom-service;1"]
        .getService(Components.interfaces.nsIAtomService);
        let props = rows[rowIndex];
        for (let i = 0; i < props.length; i++)
            properties.AppendElement(svc.getAtom(props[i]));
    },
 getCellText: function(rowIndex, col) {
        let strings = document.getElementById("subscription-dialog-strings");

        let rows = [];
        let i = 0;
        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            let userRow = (userData["displayName"] + " <"
                           + userData["email"] + ">");
            if (userData["info"] && userData["info"].length) {
                userRow += ", " + userData["info"].split("\n").join("; ");
            }
            rows[i] = userRow;
            i++;
            if (userData.nodeOpen) {
                if (userData.hasFolders) {
                    for (let folderCount = 0;
                         folderCount < userData.folders.length;
                         folderCount++) {
                        rows[i] = userData.folders[folderCount]["displayName"];
                        i++;
                    }
                }
                else if (userData.hasNoFolders) {
                    rows[i] = strings.getString("No possible subscription");
                    i++;
                }
                else {
                    rows[i] = strings.getString("Please wait...");
                    i++;
                }
            }
        }

        return (rows.length > rowIndex) ? rows[rowIndex] : null;
    },
 getCellValue: function(rowIndex, col) {
        // 		dump("getCellValue\n");
        return 0;
    },
 getColumnProperties: function(col, properties) {
        // 		dump("getColumProperties\n");
    },
 getImageSrc: function(rowIndex, col) {
        let rows = [];

        let i = 0;
        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            rows[i] = "chrome://messenger/skin/addressbook/icons/abcard.png";
            i++;
            if (userData.nodeOpen) {
                if (userData.hasFolders) {
                    for (let folderCount = 0;
                         folderCount < userData.folders.length;
                         folderCount++) {
                        rows[i] = this.images[this.type];
                        i++;
                    }
                }
                else if (userData.hasNoFolders) {
                    rows[i] = "null";
                }
                else {
                    rows[i] = "chrome://global/skin/throbber/Throbber-small.gif";
                    i++;
                }
            }
        }

        return (rows.length > rowIndex) ? rows[rowIndex] : null;
    },
 getLevel: function(rowIndex) {
        let rows = [];

        let i = 0;
        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            rows[i] = 0;
            i++;
            if (userData.nodeOpen) {
                if (userData.hasFolders) {
                    for (let folderCount = 0;
                         folderCount < userData.folders.length;
                         folderCount++) {
                        rows[i] = 1;
                        i++;
                    }
                }
                else {
                    rows[i] = 1;
                    i++;
                }
            }
        }

        return (rows.length > rowIndex) ? rows[rowIndex] : null;
    },
 getParentIndex: function(rowIndex) {
        let rows = [];

        let i = 0;
        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            rows[i] = -1;
            let parentIndex = i;
            i++;
            if (userData.nodeOpen) {
                if (userData.hasFolders) {
                    for (let j = 0; j < userData.folders.length; j++) {
                        rows[i] = parentIndex;
                        i++;
                    }
                }
                else {
                    rows[i] = parentIndex;
                    i++;
                }
            }
        }

        // 		dump("getParentIndex: " + rows[index] + "\n");
        return (rows.length > rowIndex) ? rows[rowIndex] : null;
    },
 getProgressMode: function(rowIndex, col) {
        dump("getPRogressMode\n");
    },
 getRowProperties: function(rowIndex, properties) {
        // 		dump("getRowProperties: " + properties.Count() + "\n");
        // 		dump("  index: " + index + "\n");
        // 		properties[0] = "selected";
    },
 hasNextSibling: function(rowIndex, afterIndex) {
        let rows = new Array();
        let i = 0;
        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            rows[i] = true;
            i++;
            if (userData.nodeOpen) {
                if (userData.hasFolders) {
                    for (let folderCount = 1;
                         folderCount < userData.folders.length;
                         folderCount++) {
                        rows[i] = true;
                        i++;
                    }
                    rows[i] = false;
                }
                else {
                    rows[i] = false;
                }
                i++;
            }
        }

        return (rows.length > rowIndex) ? rows[rowIndex] : null;
    },
 isContainer: function(rowIndex) {
        let rows = new Array();
        let i = 0;
        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            rows[i] = true;
            i++;
            if (userData.nodeOpen) {
                if (userData.hasFolders) {
                    for (let folderCount = 0;
                         folderCount < userData.folders.length;
                         folderCount++) {
                        rows[i] = false;
                        i++;
                    }
                }
                else {
                    rows[i] = false;
                    i++;
                }
            }
        }

        return (rows.length > rowIndex) ? rows[rowIndex] : null;
    },
 isContainerEmpty: function(rowIndex) {
        return false;
    },
 isContainerOpen: function(rowIndex) {
        let rows = [];

        let i = 0;
        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            rows[i] = userData.nodeOpen;
            i++;
            if (userData.nodeOpen) {
                if (userData.hasFolders) {
                    for (let folderCount = 0;
                         folderCount < userData.folders.length;
                         folderCount++) {
                        rows[i] = false;
                        i++;
                    }
                }
                else {
                    rows[i] = false;
                    i++;
                }
            }
        }

        return (rows.length > rowIndex) ? rows[rowIndex] : null;
    },
 isEditable: function(rowIndex, col) {
        return false;
    },
 isSeparator: function(rowIndex) {
        return false;
    },
 isSorted: function() {
        // 		dump("isSorted\n");
        return true;
    },
 performAction: function(action) {
        dump("performAction\n");
    },
 performActionOnCell: function(action, row, col) {
        dump("performActionOnCell\n");
    },
 performActionOnRow: function(action, row) {
        dump("performActionOnRow\n");
    },
 selectionChanged: function() {
        dump("selectionChanged: " + this.selection + "\n");
    },
 setCellText: function(rowIndex, col, value) {
        dump("setCellText\n");
    },
 setCellValue: function(rowIndex, col, value) {
        dump("setCellValue\n");
    },
 setTree: function(tree) {
        this.tree = tree;
    },
 toggleOpenState: function(rowIndex) {
        this.tree.beginUpdateBatch();

        let i = 0;
        for (let userCount = 0;
             i <= rowIndex && userCount < this.data.length;
             userCount++) {
            let userData = this.data[userCount];
            let toggled = false;
            if (rowIndex == i) {
                userData.nodeOpen = !userData.nodeOpen;
                toggled = true;

                if (!(userData.hasFolders || userData.hasNoFolders)) {
                    let principalArray = sogoBaseURL().split("/");
                    principalArray[principalArray.length - 2] = userData["id"];
                    let principal = principalArray.join("/");
                    let query = ("<collection-query"
                                 + " xmlns=\"urn:inverse:params:xml:ns:inverse-dav\""
                                 +" xmlns:D=\"DAV:\">"
                                 + "<D:prop><D:href/><D:owner/><ownerdisplayname/>"
                                 + "<D:displayname/></D:prop><collection-filter>"
                                 + "<prop-match name=\"resource-type\">" + resourceType
                                 + "</prop-match></collection-filter>"
                                 + "</collection-query>");
                    let report = new sogoWebDAV(principal, collectionReportTarget,
                                                { treeView: this, user: userData["id"] }, undefined, false);
                    report.report("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                                  + query, false);
                }
            }
            i++;
            if (userData.nodeOpen && !toggled) {
                if (userData.hasFolders) {
                    i += userData.folders.length;
                }
                else {
                    i++;
                }
            }
        }

        this._recount();
        this.tree.endUpdateBatch();
    },
 getSelectedNode: function() {
        let node;

        if (this.selection) {
            let rows = [];

            let i = 0;
            for (let userCount = 0;
                 i <= this.selection.currentIndex
                     && userCount < this.data.length;
                 userCount++) {
                let userData = this.data[userCount];
                rows[i] = {};
                i++;
                if (userData.nodeOpen) {
                    if (userData.hasFolders) {
                        for (let folderCount = 0;
                             folderCount < userData.folders.length;
                             folderCount++) {
                            rows[i] = userData.folders[folderCount];
                            i++;
                        }
                    }
                    else {
                        rows[i] = {};
                        i++;
                    }
                }
            }

            node = rows[this.selection.currentIndex];
        }
        else {
            node = {};
        }

        return node;
    }
};

function UsersTreeView(queryResult) {
    this.data = [];
    if (queryResult)
        this.parseTree(queryResult.getElementsByTagName("users"));
}

UsersTreeView.prototype = {
 data: null,
 rowCount: 0,
 selection: 0,
 tree: null,

 parseTree: function(queryResults) {
        if (queryResults.length)
            this._parseTreeNodes(queryResults[0].childNodes);
    },
 _parseTreeNodes: function(nodes) {
        for (let i = 0; i < nodes.length; i++) {
            let currentNode = nodes[i];
            let nodeDict = {};
            for (let j = 0; j < currentNode.childNodes.length; j++) {
                let subnode = currentNode.childNodes[j];
                let key = subnode.nodeName;
                let value = ((subnode.firstChild)
                             ? subnode.firstChild.nodeValue : "");
                nodeDict[key] = value;
            }
            // dump("pushing: " + nodeDict["id"] + "\n");
            this.data.push(nodeDict);
        }
        this.rowCount = this.data.length;
    },

 canDrop: function(rowIndex, orientation) {
        return false;
    },
 cycleCell: function(rowIndex, col) {
    },
 cycleHeader: function(col) {
    },
 drop: function(rowIndex, orientation) {
    },
 getCellProperties: function(rowIndex, col, properties) {
    },
 getCellText: function(rowIndex, col) {
        let infoText = "";
        if (this.data[rowIndex]["info"]
            && this.data[rowIndex]["info"].length) {
            infoText = ", " + this.data[rowIndex]["info"].split("\n").join("; ");
        }
        return (this.data[rowIndex]["displayName"]
                + " <" + this.data[rowIndex]["email"] + ">"
                + infoText);
    },
 getCellValue: function(rowIndex, col) {
        return this.data[rowIndex]["id"];
    },
 getColumnProperties: function(col, properties) {
    },
 getImageSrc: function(rowIndex, col) {
        return "chrome://messenger/skin/addressbook/icons/abcard.png";
    },
 getLevel: function(rowIndex) {
        return 0;
    },
 getParentIndex: function(rowIndex) {
        return -1;
    },
 getProgressMode: function(rowIndex, col) {
    },
 getRowProperties: function(rowIndex, properties) {
    },
 hasNextSibling: function(rowIndex, afterIndex) {
        return false;
    },
 isContainer: function(rowIndex) {
        return false;
    },
 isContainerEmpty: function(rowIndex) {
        return true;
    },
 isContainerOpen: function(rowIndex) {
        return false;
    },
 isEditable: function(rowIndex, col) {
        return false;
    },
 isSeparator: function(rowIndex) {
        return false;
    },
 isSorted: function() {
        // 		dump("isSorted\n");
        return true;
    },
 performAction: function(action) {
        dump("performAction\n");
    },
 performActionOnCell: function(action, row, col) {
        dump("performActionOnCell\n");
    },
 performActionOnRow: function(action, row) {
        dump("performActionOnRow\n");
    },
 selectionChanged: function() {
        dump("selectionChanged: " + this.selection + "\n");
    },
 setCellText: function(rowIndex, col, value) {
        dump("setCellText\n");
    },
 setCellValue: function(rowIndex, col, value) {
        dump("setCellValue\n");
    },
 setTree: function(tree) {
        this.tree = tree;
    },
 toggleOpenState: function(rowIndex) {
        dump("toggle open state " + index + "\n");
    },
 getSelectedNode: function() {
        let node = null;
        if (this.selection) {
            let index = this.selection.currentIndex;
            node = this.data[index];
        }

        return node;
    }
};
