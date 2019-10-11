Components.utils.import("resource://calendar/modules/calUtils.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("calendar-overlay.js: failed to include '" + files[i] + "'\n"
                 + e + "\n");
        }
    }
}

let sogoCalendarsAvailable = false;

jsInclude(["chrome://sogo-connector/content/calendar/folder-handler.js",
           "chrome://sogo-connector/content/general/creation-utils.js",
           "chrome://sogo-connector/content/general/subscription-utils.js",
           "chrome://sogo-connector/content/messenger/folders-update.js",
           "chrome://sogo-connector/content/global/sogo-config.js"]);

function openCalendarCreationDialog() {
    openDialog("chrome://sogo-connector/content/calendar/creation-dialog.xul",
               "calendarSubscribe",
	       "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
               this);
}

function openCalendarSubcriptionDialog() {
    openDialog("chrome://sogo-connector/content/general/subscription-dialog.xul",
               "calendarSubscribe",
	       "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
               this);
}

function manageCalendarACL() {
    let calendar = getSelectedCalendar();
    let entry = calendar.aclEntry;
    if (!entry) {
        /* we expect the calendar acl entry to be cached at this point */
        ASSERT(false, "unexpected!");
    }

    let url = calendar.uri.spec;
    if (entry.userIsOwner) {
        openDialog("chrome://sogo-connector/content/general/acl-dialog.xul",
                   "calendarACL",
	           "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
                   {url: url,
                    rolesDialogURL: "chrome://sogo-connector/content/calendar/roles-dialog.xul"});
    } else {
        entry.refresh();
        calendar.refresh();
    }
}

function _confirmDelete(name) {
    let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);

    let bundle = document.getElementById("bundle_integrator_calendar");

    return promptService.confirm(window,
                                 bundle.getString("deleteCalendarTitle"),
                                 bundle.getString("deleteCalendarMessage"),
                                 {});
}

function openDeletePersonalDirectoryForbiddenDialog() {
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
  let bundle = document.getElementById("bundle_integrator_calendar");

  promptService.confirm(window,
                        bundle.getString("deleteCalendarTitle"),
                        bundle.getString("deletePersonalCalendarError"),
                        {});
}

function openCalendarUnsubscriptionDialog() {
    let calendar = getSelectedCalendar();
    SIpromptDeleteCalendar(calendar); 
}

function SIpromptDeleteCalendar(calendar) {
    let url = calendar.uri.spec;
    let baseURL = sogoBaseURL();
    if (url.indexOf(baseURL) == 0) {
        let parts = url.split("/");
        let offset = 1;
        if (url[url.length-1] == '/')
            offset++;
        let part = parts[parts.length-offset];
        let handler = new CalendarHandler();

        let entry = calendar.aclEntry;
        if (!entry) {
            /* we expect the calendar acl entry to be cached at this point */
            ASSERT(false, "unexpected!");
        }
        if (entry.userIsOwner) {
            dump("url = " + url + " baseURL = " + baseURL + "\n");
            let urlParts = url.split("/");

            // We prevent the removal the "personal" calendar
            if (urlParts[urlParts.length-2] == "personal") {
                openDeletePersonalDirectoryForbiddenDialog();
            }
            else if (_confirmDelete(calendar.name)) {
                deleteFolder(url, handler);
            }
        }
        else {
	    let title = cal.l10n.getCalString("removeCalendarButtonUnsubscribe");
	    let msg = cal.l10n.getCalString("removeCalendarMessageDeleteOrUnsubscribe", [calendar.name]);
            let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                          .getService(Components.interfaces.nsIPromptService);
            if (promptService.confirm(window, title, msg, {})) {
                unsubscribeFromFolder(url, handler);
            }
        }
    }
    else if (_confirmDelete(calendar.name)) {
        let calMgr = cal.getCalendarManager();
        calMgr.unregisterCalendar(calendar);
        calMgr.removeCalendar(calendar);

        let url = calendar.uri.spec;
        if (url[url.length - 1] != '/')
            url = url.concat('/');
    }
}

function subscriptionDialogType() {
    return "calendar";
}

function subscriptionGetHandler() {
    return new CalendarHandler();
}

function toggleShowAllCalendars() {
    let tree = document.getElementById("calendar-list-tree-widget");
    if (tree) {
        let composite = tree.compositeCalendar;

        for (let i = 0; i < tree.rowCount; i++) {
            let calendar = tree.getCalendar(i);
            composite.addCalendar(calendar);
            tree.treebox.invalidateRow(i);
        }
    }
}

function toggleShowOnlyCalendar() {
    let tree = document.getElementById("calendar-list-tree-widget");
    if (tree) {
        let selectedCal = getSelectedCalendar();
        let calIndex = 0;
        let composite = tree.compositeCalendar;
        for (let i = 0; i < tree.rowCount; i++) {
            let calendar = tree.getCalendar(i);
            if (calendar.id == selectedCal.id) {
                calIndex = i;
            } else {
                composite.removeCalendar(calendar);
                tree.treebox.invalidateRow(i);
            }
        }

        composite.addCalendar(selectedCal);
        tree.treebox.invalidateRow(calIndex);
    }
}

function toggleShowOnlyCalendarByCal(cal) {
    let tree = document.getElementById("calendar-list-tree-widget");
    if (tree) {
        let composite = tree.compositeCalendar;
        for (let i = 0; i < tree.rowCount; i++) {
            let calendar = tree.getCalendar(i);
            if (calendar.uri != cal.uri) {
                composite.removeCalendar(calendar);
            }
        }

        composite.addCalendar(cal);
        for (let i = 0; i < tree.rowCount; i++) {
            tree.treebox.invalidateRow(i);
        }
    }
}

function SIOnCalendarOverlayLoad() {
  let popup = document.getElementById("list-calendars-context-menu");

  if (typeof(popup) == "undefined") {
    setTimeout(SIOnCalendarOverlayLoad, 5000);
    return;
  }  
  
  let properties = document.getElementById("list-calendars-context-edit");
  //let showonly = document.getElementById("list-calendars-context-sogo-showonly");
  //let showall = document.getElementById("list-calendars-context-sogo-showall");
  let separator = document.createElement("menuseparator");
  popup.removeChild(properties);
  popup.insertBefore(separator, popup.firstChild);
  popup.insertBefore(properties, popup.firstChild);

  //separator = document.createElement("menuseparator");
  //popup.insertBefore(separator, popup.firstChild);
  //popup.insertBefore(showall, popup.firstChild);
  //popup.insertBefore(showonly, popup.firstChild);

  let list_calendars_context_delete = document.getElementById("list-calendars-context-delete");
  list_calendars_context_delete.setAttribute("deletelabel", deleteLabel);
  list_calendars_context_delete.setAttribute("unsubscribelabel", unsubscribeLabel);
  list_calendars_context_delete.addEventListener("command", openCalendarUnsubscriptionDialog, false);
  
  let acls = document.createElement("menuitem");
  acls.id = "list-calendars-context-sogo-acls";
  //acls.setAttribute("label", "Manage ACLs");
  acls.setAttribute("managelabel", manageLabel);
  acls.setAttribute("reloadlabel", reloadLabel);
  acls.addEventListener("command", manageCalendarACL, false);
  popup.appendChild(acls);
  
  let controller = new SICalendarListTreeController();
  let calendarTree = document.getElementById("calendar-list-tree-widget");
  //calendarTree.tree.controllers.appendController(controller);
  calendarTree.controllers.appendController(controller);
  
  popup.addEventListener("popupshowing", onCalendarTreePopup, false);

  //
  // We create the Export Task menu option
  //
  let taskitem_context_menu = document.getElementById("taskitem-context-menu");
  let task_context_menu_export = document.createElement("menuitem");
  task_context_menu_export.id = "task-context-menu-export";
  task_context_menu_export.setAttribute("label", exportTaskText);
  taskitem_context_menu.appendChild(task_context_menu_export);
  taskitem_context_menu.addEventListener("click", SCExportTask, false);
  
  //
  // We create the toolbar to create, subscribe and delete/unsubscribe calendars
  //
  let calendar_listtree_pane = document.getElementById("calendar-listtree-pane");
  let calendar_list_tree_widget = document.getElementById("calendar-list-tree-widget");
  let subscriptionToolbar = document.createElement("hbox");
  subscriptionToolbar.id = "subscriptionToolbar";

  let addCalendarBtn = document.createElement("toolbarbutton");
  addCalendarBtn.id = "addCalendarBtn";
  addCalendarBtn.setAttribute("image", "chrome://sogo-connector/skin/calendar/add-calendar.png");
  addCalendarBtn.setAttribute("tooltiptext", addTooltipText);
  addCalendarBtn.addEventListener("click", openCalendarCreationDialog, false);

  let subscribeCalendarBtn = document.createElement("toolbarbutton");
  subscribeCalendarBtn.id = "subscribeCalendarBtn";
  subscribeCalendarBtn.setAttribute("image", "chrome://sogo-connector/skin/calendar/add-user-calendar.png");
  subscribeCalendarBtn.setAttribute("tooltiptext", subscribeTooltipText);
  subscribeCalendarBtn.addEventListener("click", openCalendarSubcriptionDialog, false);

  let removeCalendarBtn = document.createElement("toolbarbutton");
  removeCalendarBtn.id = "removeCalendarBtn";
  removeCalendarBtn.setAttribute("image", "chrome://sogo-connector/skin/calendar/remove-calendar.png");
  removeCalendarBtn.setAttribute("tooltiptext", removeTooltipText);
  removeCalendarBtn.addEventListener("click", openCalendarUnsubscriptionDialog, false);

  subscriptionToolbar.appendChild(addCalendarBtn);
  subscriptionToolbar.appendChild(subscribeCalendarBtn);
  subscriptionToolbar.appendChild(removeCalendarBtn);

  calendar_listtree_pane.insertBefore(subscriptionToolbar, calendar_list_tree_widget);
  

  
    let widget = document.getElementById("calendar-list-tree-widget");
    widget.addEventListener("mousedown", SIOnListMouseDown, true);

    /* override lightning's calendar delete function 
     * has to be done when the overlay's load handler since
     * window.promptDeleteCalendar can somehow be overriden by lightning
     * if lightning is loaded after the integrator in extensions.ini
     */
    window.SIOldPromptDeleteCalendar = window.promptDeleteCalendar;
    window.promptDeleteCalendar = window.SIpromptDeleteCalendar;
}

function SCExportTask() {
  let tree = getTaskTree();
  saveEventsToFile(tree.selectedTasks);
}

function SIOnListMouseDown(event) {
    if (event.type == "mousedown" && event.button == 0 && event.shiftKey) {
        let col = {};
        let calendar = this.getCalendarFromEvent(event, col);
        if (calendar && col.value && col.value.index == 0) {
            toggleShowOnlyCalendarByCal(calendar);
            event.stopPropagation();
        }
    }
}


function onCalendarTreePopup(event) {
    goUpdateCommand("calendar_manage_sogo_acls_command");
}

function SICalendarListTreeController() {
}

SICalendarListTreeController.prototype = {
    supportsCommand: function(command) {
        return (command == "calendar_manage_sogo_acls_command");
    },

    isCommandEnabled: function(command) {
        let isEnabled;

        if (command == "calendar_manage_sogo_acls_command") {
            let calendar = getSelectedCalendar();

            let userIsOwner = true;
            let entry = calendar.aclEntry;
            if (entry && entry.hasAccessControl && !entry.userIsOwner) {
                userIsOwner = false;
            }

            let acl_menuitem = document.getElementById("list-calendars-context-sogo-acls");
            let delete_menuitem = document.getElementById("list-calendars-context-delete");
            if (userIsOwner) {
                acl_menuitem.label = acl_menuitem.getAttribute("managelabel");
                delete_menuitem.label = delete_menuitem.getAttribute("deletelabel");
            } else {
                acl_menuitem.label = acl_menuitem.getAttribute("reloadlabel");
                delete_menuitem.label = delete_menuitem.getAttribute("unsubscribelabel");
            }

            let isSOGoEntry = false;
            let length = sogoBaseURL().length;
            if (calendar.uri.spec.substr(0, length) == sogoBaseURL()) {
                isSOGoEntry = true;
            }

            if (isSOGoEntry) {
                if (!sogoCalendarsAvailable) {
                    let CalendarChecker = new directoryChecker("Calendar");
                    let yesCallback = function () {
                        sogoCalendarsAvailable = true;
                        goUpdateCommand("calendar_manage_sogo_acls_command");
                    };
                    CalendarChecker.checkAvailability(yesCallback);
                }
                isEnabled = sogoCalendarsAvailable;
            }
            else {
                isEnabled = false;
            }
        } else {
            isEnabled = true;
        }

        return isEnabled;
    },

    doCommand: function(command) { dump("doCommand\n"); },

    onEvent: function(event) { dump("onEvent\n"); }
};

window.creationGetHandler = subscriptionGetHandler;
window.addEventListener("load", SIOnCalendarOverlayLoad, false);
