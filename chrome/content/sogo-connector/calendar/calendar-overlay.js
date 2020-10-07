/* calendar-overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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
var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { notificationManagerInstance } = ChromeUtils.import("resource://sogo-connector/components/NotificationManager.jsm");

var _this = this;

function jsInclude(files, target) {
  //let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
  //                       .getService(Components.interfaces.mozIJSSubScriptLoader);
  for (let i = 0; i < files.length; i++) {
    try {
      Services.scriptloader.loadSubScript(files[i], target, "UTF-8");
    }
    catch(e) {
      dump("calendar-overlay.js: failed to include '" + files[i] + "'\n"
           + e + "\n");
    }
  }
}

function i18n(entity) {
  let msg = entity.slice(1,-1);
  return WL.extension.localeData.localizeMessage(msg);
}

let sogoCalendarsAvailable = false;
let sogoCategoriesChanged = false;
let sogoDefaultClassificationsChanged = false;
let sogoMailsLabelsChanged = false;

jsInclude(["chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/calendar/folder-handler.js",
           "chrome://sogo-connector/content/general/creation-utils.js",
           "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/messenger/folders-update.js",
           "chrome://sogo-connector/content/global/sogo-config.js",
           "chrome://global/content/globalOverlay.js",
           "chrome://global/content/editMenuOverlay.js"], _this);

jsInclude(["chrome://sogo-connector/content/general/subscription-utils.js"], window);

function openCalendarCreationDialog() {
  window.openDialog("chrome://sogo-connector/content/calendar/creation-dialog.xhtml",
                    "calendarCreate",
	            "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
                    _this, WL);
}

function openCalendarSubcriptionDialog() {
  window.openDialog("chrome://sogo-connector/content/general/subscription-dialog.xhtml",
                    "calendarSubscribe",
	            "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes",
                    _this, WL);
}

function manageCalendarACL() {
    let calendar = cal.view.getCompositeCalendar(window).defaultCalendar;
    let entry = calendar.aclEntry;
    if (!entry) {
        /* we expect the calendar acl entry to be cached at this point */
        ASSERT(false, "unexpected!");
    }

    let url = calendar.uri.spec;
    if (entry.userIsOwner) {
      window.openDialog("chrome://sogo-connector/content/general/acl-dialog.xhtml",
                        "calendarACL",
	                "chrome,titlebar,centerscreen,alwaysRaised=yes,dialog=yes,resizable=yes",
                        _this,
                        WL,
                        {url: url,
                         rolesDialogURL: "chrome://sogo-connector/content/calendar/roles-dialog.xhtml"});
    } else {
      entry.refresh();
      calendar.refresh();
    }
}

function _confirmDelete(name) {
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);

  return promptService.confirm(window,
                               WL.extension.localeData.localizeMessage("deleteCalendarTitle"),
                               WL.extension.localeData.localizeMessage("deleteCalendarMessage"),
                               {});
}

function openDeletePersonalDirectoryForbiddenDialog() {
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
  promptService.alert(window,
                      WL.extension.localeData.localizeMessage("deleteCalendarTitle"),
                      WL.extension.localeData.localizeMessage("deletePersonalCalendarError"));
}

function openCalendarUnsubscriptionDialog() {
    let calendar = window.getSelectedCalendar();
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
        window.unsubscribeFromFolder(url, handler);
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

window.subscriptionDialogType = function() {
  return "calendar";
}

window.creationGetHandler = function() {
    return new CalendarHandler();
}

window.subscriptionGetHandler = function() {
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
        let selectedCal = window.getSelectedCalendar();
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
    setTimeout(SIOnCalendarOverlayLoad, 100);
    return;
  }  
  
  let properties = document.getElementById("list-calendars-context-edit");
  //let showonly = document.getElementById("list-calendars-context-sogo-showonly");
  //let showall = document.getElementById("list-calendars-context-sogo-showall");
  let separator = document.createXULElement("menuseparator");
  popup.removeChild(properties);
  popup.insertBefore(separator, popup.firstChild);
  popup.insertBefore(properties, popup.firstChild);

  //separator = document.createElement("menuseparator");
  //popup.insertBefore(separator, popup.firstChild);
  //popup.insertBefore(showall, popup.firstChild);
  //popup.insertBefore(showonly, popup.firstChild);

  let list_calendars_context_delete = document.getElementById("list-calendars-context-delete");
  list_calendars_context_delete.setAttribute("deletelabel", WL.extension.localeData.localizeMessage("calendar.context.sogo-delete.label"));
  list_calendars_context_delete.setAttribute("unsubscribelabel", WL.extension.localeData.localizeMessage("calendar.context.sogo-unsubscribe.label"));
  list_calendars_context_delete.addEventListener("command", openCalendarUnsubscriptionDialog, false);
  
  let acls = document.createXULElement("menuitem");
  acls.id = "list-calendars-context-sogo-acls";
  acls.setAttribute("managelabel", WL.extension.localeData.localizeMessage("calendar.context.sogo-acls.label"));
  acls.setAttribute("reloadlabel", WL.extension.localeData.localizeMessage("calendar.context.sogo-reload-acls.label"));
  acls.addEventListener("command", manageCalendarACL, false);
  popup.appendChild(acls);
  
  let controller = new SICalendarListTreeController();
  //let calendar_list_tree_widget = document.getElementById("calendar-list-tree-widget");
  let calendar_list_tree_widget = document.getElementById("calendar-list");
  calendar_list_tree_widget.controllers.appendController(controller);
  
  popup.addEventListener("popupshowing", onCalendarTreePopup, false);

  //
  // We create the Export Task menu option
  //
  let taskitem_context_menu = document.getElementById("taskitem-context-menu");
  let task_context_menu_export = document.createXULElement("menuitem");
  task_context_menu_export.id = "task-context-menu-export";
  task_context_menu_export.setAttribute("label", WL.extension.localeData.localizeMessage("calendar.context.exporttask.label"));
  taskitem_context_menu.appendChild(task_context_menu_export);
  taskitem_context_menu.addEventListener("click", SCExportTask, false);
  
  //
  // We create the toolbar to create, subscribe and delete/unsubscribe calendars
  //
  let calendar_listtree_pane = document.getElementById("calendar-panel");
  let subscriptionToolbar = document.createXULElement("hbox");
  subscriptionToolbar.id = "subscriptionToolbar";

  let addCalendarBtn = document.createXULElement("toolbarbutton");
  addCalendarBtn.id = "addCalendarBtn";
  addCalendarBtn.setAttribute("image", "resource://sogo-connector/skin/calendar/add-calendar.png");
  addCalendarBtn.setAttribute("tooltiptext", WL.extension.localeData.localizeMessage("calendar-overlay.susbcription.tooltips.add"));
  addCalendarBtn.addEventListener("click", openCalendarCreationDialog, false);

  let subscribeCalendarBtn = document.createXULElement("toolbarbutton");
  subscribeCalendarBtn.id = "subscribeCalendarBtn";
  subscribeCalendarBtn.setAttribute("image", "resource://sogo-connector/skin/calendar/add-user-calendar.png");
  subscribeCalendarBtn.setAttribute("tooltiptext", WL.extension.localeData.localizeMessage("calendar-overlay.susbcription.tooltips.subscribe"));
  subscribeCalendarBtn.addEventListener("click", openCalendarSubcriptionDialog, false);

  let removeCalendarBtn = document.createXULElement("toolbarbutton");
  removeCalendarBtn.id = "removeCalendarBtn";
  removeCalendarBtn.setAttribute("image", "resource://sogo-connector/skin/calendar/remove-calendar.png");
  removeCalendarBtn.setAttribute("tooltiptext", WL.extension.localeData.localizeMessage("calendar-overlay.susbcription.tooltips.remove"));
  removeCalendarBtn.addEventListener("click", openCalendarUnsubscriptionDialog, false);

  subscriptionToolbar.appendChild(addCalendarBtn);
  subscriptionToolbar.appendChild(subscribeCalendarBtn);
  subscriptionToolbar.appendChild(removeCalendarBtn);

  calendar_listtree_pane.insertBefore(subscriptionToolbar, calendar_listtree_pane.firstChild);
  //calendar_listtree_pane.insertBefore(subscriptionToolbar, calendar_list_tree_widget);
  

  //calendar_list_tree_widget.addEventListener("mousedown", SIOnListMouseDown, true);

  /* override lightning's calendar delete function 
   * has to be done when the overlay's load handler since
   * window.promptDeleteCalendar can somehow be overriden by lightning
   * if lightning is loaded after the integrator in extensions.ini
   */
  window.SIOldPromptDeleteCalendar = window.promptDeleteCalendar;
  window.promptDeleteCalendar = window.SIpromptDeleteCalendar;
}

function SCExportTask() {
  let tree = window.getTaskTree();
  window.saveEventsToFile(tree.selectedTasks);
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
  window.goUpdateCommand("calendar_manage_sogo_acls_command");
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
            let calendar = window.getSelectedCalendar();

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
                        window.goUpdateCommand("calendar_manage_sogo_acls_command");
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

/*
 * This overlay adds GroupDAV functionalities to Addressbooks
 * it contains the observers needed by the addressBook and the cards dialog
 */

let groupdavSynchronizationObserver = {
    count: 0,
    handleNotification: function(notification, data) {
        let active = (this.count > 0);
        let throbber = document.getElementById("navigator-throbber");
        /* Throbber may not exist, thus we need to check the returned value. */
        if (notification == "groupdav.synchronization.start") {
            this.count++;
            if (!active) {
                dump("GETTING BUSY\n");
                if (throbber)
                    throbber.setAttribute("busy", true);
            }
        }
        else if (notification == "groupdav.synchronization.stop") {
            this.count--;
            if (active) {
                dump("RESTING\n");
                if (throbber)
                    throbber.setAttribute("busy", false);
            }
        }
    }
};

function OnLoadMessengerOverlay() {
  /* if SOGo Integrator is present, we let it take the startup procedures */
  notificationManagerInstance.registerObserver("groupdav.synchronization.start",
                                               groupdavSynchronizationObserver);
  notificationManagerInstance.registerObserver("groupdav.synchronization.stop",
                                               groupdavSynchronizationObserver);
  cleanupAddressBooks();
  window.addEventListener("unload", SCUnloadHandler, false);
}

function SCUnloadHandler(event) {
  notificationManagerInstance.unregisterObserver("groupdav.synchronization.start",
                                                 groupdavSynchronizationObserver);
  notificationManagerInstance.unregisterObserver("groupdav.synchronization.stop",
                                                 groupdavSynchronizationObserver);
}

function cleanupAddressBooks() {
  let uniqueChildren;

  uniqueChildren = _uniqueChildren("ldap_2.servers", 2);
  _cleanupABRemains(uniqueChildren);

  uniqueChildren = _uniqueChildren("extensions.ca.inverse.addressbook.groupdav.ldap_2.servers", 7);
  _cleanupOrphanDAVAB(uniqueChildren);
  _removeOldCardDAVDirs(uniqueChildren);
}

function _uniqueChildren(path, dots) {
  let count = {};
  let children = Services.prefs.getChildList(path, count);
  let uniqueChildren = {};
  for (let i = 0; i < children.length; i++) {
    let leaves = children[i].split(".");
    uniqueChildren[leaves[dots]] = true;
  }

  return uniqueChildren;
}

function _cleanupABRemains(uniqueChildren) {
  let path = "ldap_2.servers";

  for (let key in uniqueChildren) {
    let branchRef = path + "." + key;
    let count = {};
    let children = Services.prefs.getChildList(branchRef, count);
    if (children.length < 2) {
      if (children[0] == (branchRef + ".position"))
        Services.prefs.deleteBranch(branchRef);
    }
  }
}

function _cleanupOrphanDAVAB(uniqueChildren) {
  var path = "extensions.ca.inverse.addressbook.groupdav.ldap_2.servers";
  for (let key in uniqueChildren) {
    let otherRef = "ldap_2.servers." + key + ".description";
    // 		dump("XXXX otherRef: " + otherRef + "\n");
    try {
      Services.prefs.getCharPref(otherRef);
    }
    catch(e) {
      // 			dump("exception: " + e + "\n");
      dump("deleting orphan: " + path + "." + key + "\n");
      Services.prefs.deleteBranch(path + "." + key);
    }
  }
}

//  If we migrated from Thunderbird v68 to v78, our CardDAV addressbooks would be duplicated.
function _removeOldCardDAVDirs(uniqueChildren) {
  var path = "extensions.ca.inverse.addressbook.groupdav.ldap_2.servers.";
  for (let key in uniqueChildren) {
    try {
      let fullPath = path + key;
      let isCardDAV = (Services.prefs.getCharPref(fullPath + ".url").length > 0);
      if (isCardDAV) {
        let directory = MailServices.ab.getDirectoryFromId("ldap_2.servers." + key);
        SCDeleteDirectory(directory);
      }
    } catch (e) {
        dump("_removeOldCardDAVDirs - failed to remove: " + key + "\n");
    }
  }
}

// TODO : better handling of that var
var SOGO_Timers = [];

function startFolderSync() {
  let abManager = Components.classes["@mozilla.org/abmanager;1"]
      .getService(Components.interfaces.nsIAbManager);

  let children = abManager.directories;
  while (children.hasMoreElements()) {
    let ab = children.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);
    if (isCardDavDirectory(ab.URI)) {
      let dirPrefId = ab.dirPrefId;                
      let groupdavPrefService = new GroupdavPreferenceService(dirPrefId);
      let periodicSync = false;
      let periodicSyncInterval = 60;
      let notifications = false;
      let notificationsOnlyIfNotEmpty = false;
      try {
        periodicSync = groupdavPrefService.getPeriodicSync();
        periodicSyncInterval = groupdavPrefService.getPeriodicSyncInterval();
        notifications = groupdavPrefService.getNotifications();
        notificationsOnlyIfNotEmpty = groupdavPrefService.getNotificationsOnlyIfNotEmpty();            
      } catch(e) {
      }
      
      // handle startup sync
      //sync = GetSyncNotifyGroupdavAddressbook(ab.URI, ab, SOGOC_SYNC_STARTUP);
      //sync.notify();
      SynchronizeGroupdavAddressbook(ab.URI);

      // FIXME
      // if (periodicSync) {
      //   // handle future periodic sync
      //   psync = GetSyncNotifyGroupdavAddressbook(ab.URI, ab, SOGOC_SYNC_PERIODIC);
        
      //   // TODO : handle syncInterval and Notifications in a dynamic way :
      //   // today, we have to restart TB if we change those values.         
      //   // Now it is time to create the timer.
      //   var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
      //   let delay = periodicSyncInterval;
      //   delay = delay *60; // min --> sec
      //   // delay = delay * 3; // min --> sec DEBUG
      //   delay = delay * 1000; // sec --> ms
      //   timer.initWithCallback(psync, delay, Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE_CAN_SKIP);
      //   SOGO_Timers.push(timer);
      // }
    }
  }
}

function SCSynchronizeFromChildWindow(uri) {
    this.setTimeout(SynchronizeGroupdavAddressbook, 100, uri, null, SOGOC_SYNC_WRITE);
}

function injectSOGoConnectorPreferences(win, topic, data) {
  if (topic != "app-handler-pane-loaded") {
    dump("injectSOGoConnectorPreferences: invalid topic, returning\n");
    return;
  }

  dump("Preferences pane loaded!\n");
  win.Preferences.addAll([
    { id: "calendar.events.default-classification", type: "string" },
    { id: "calendar.todos.default-classification", type: "string" },
  ]);

  //
  // Contact categories management
  //
  let paneDeck = win.document.getElementById("paneDeck");
  let contactCategoriesElements = win.MozXULElement.parseXULToFragment(`
 <hbox id="contactCategories"
       class="subcategory"
       data-category="paneGeneral">
    <html:h1>&sogo-connector.preferences.panes.contacts.categories.title;</html:h1>
 </hbox>
 <html:div data-category="paneGeneral">
    <vbox id="SOGoConnectorPreferencesBoxCategories">
            <richlistbox id="SOGoConnectorContactCategoriesList"
                         flex="1"
                         height="180px"
                         seltype="multiple">
            </richlistbox>
            <hbox pack="end">
              <button id="SOGoConnectorAddContactCategoryButton"
                      label="&sogo-connector.preferences.contacts.categories.addButton.label;"
                      accesskey="&sogo-connector.preferences.contacts.categories.addButton.accesskey;"/>
              <button id="SOGoConnectorEditContactCategoryButton"
                      label="&sogo-connector.preferences.contacts.categories.editButton.label;"
                      accesskey="&sogo-connector.preferences.contacts.categories.editButton.accesskey;"/>
              <button id="SOGoConnectorDeleteContactCategoryButton"
                      label="&sogo-connector.preferences.contacts.categories.removeButton.label;"
                      accesskey="&sogo-connector.preferences.contacts.categories.removeButton.accesskey;"/>
            </hbox>
      </vbox>
  </html:div>`.replaceAll(/&(.*?);/g, i18n));
  paneDeck.insertBefore(contactCategoriesElements, win.document.getElementById("tagsCategory"));

  gSOGoConnectorPane.init(win);
  win.document.getElementById("SOGoConnectorContactCategoriesList").addEventListener("select", gSOGoConnectorPane.contactCategoriesPane.updateButtons, false);
  win.document.getElementById("SOGoConnectorContactCategoriesList").addEventListener("dblclick", gSOGoConnectorPane.contactCategoriesPane.onEditCategory, false);
  win.document.getElementById("SOGoConnectorAddContactCategoryButton").addEventListener("command", gSOGoConnectorPane.contactCategoriesPane.onAddCategory, false);
  win.document.getElementById("SOGoConnectorEditContactCategoryButton").addEventListener("command", gSOGoConnectorPane.contactCategoriesPane.onEditCategory, false);
  win.document.getElementById("SOGoConnectorDeleteContactCategoryButton").addEventListener("command", gSOGoConnectorPane.contactCategoriesPane.onDeleteCategory, false);

  //
  // Default events and tasks classification (public, confidential, private)
  //
  let defaultClassificationElements = win.MozXULElement.parseXULToFragment(`
 <hbox id="calendarDefaultClassification"
       class="subcategory"
       data-category="paneCalendar">
   <html:h1>&calendar.preferences.general.classification.caption;</html:h1>
 </hbox>
  <html:div data-category="paneCalendar">
    <vbox>
      <hbox align="center">
        <label value="&calendar.preferences.general.default-events-classification.label;"
          control="default-events-classification"/>
        <menulist id="default-event-classification" crop="none" preference="calendar.events.default-classification">
          <menupopup id="event-classification-popup">
            <menuitem id="event-classification-public-menuitem"
              label="Public" value="PUBLIC"/>
            <menuitem id="event-classification-confidential-menuitem"
              label="&event.menu.options.privacy.confidential.label;" value="CONFIDENTIAL"/>
            <menuitem id="event-classification-private-menuitem"
              label="Private" value="PRIVATE"/>
          </menupopup>
        </menulist>
      </hbox>
      <hbox align="center">
        <label value="&calendar.preferences.general.default-todos-classification.label;"
          control="default-todo-classification"/>
        <menulist id="default-todo-classification" crop="none" preference="calendar.todos.default-classification">
          <menupopup id="todo-classification-popup">
            <menuitem id="todo-classification-public-menuitem"
              label="Pubic" value="PUBLIC"/>
            <menuitem id="todo-classification-confidential-menuitem"
              label="&event.menu.options.privacy.confidential.label;" value="CONFIDENTIAL"/>
            <menuitem id="todo-classification-private-menuitem"
              label="Private" value="PRIVATE"/>
          </menupopup>
        </menulist>
      </hbox>
    </vbox>
  </html:div>`.replaceAll(/&(.*?);/g, i18n));

  paneDeck.insertBefore(defaultClassificationElements, win.document.getElementById("calendarCategoriesCategory"));

  // Track event/task classification changes
  let sogoDefaultClassificationObserver = new SOGoDefaultClassificationObserver();
  Services.prefs.addObserver("calendar.events.default-classification", sogoDefaultClassificationObserver, false);
  Services.prefs.addObserver("calendar.todos.default-classification", sogoDefaultClassificationObserver, false);

  // Track mail label changes
  let labelsObserver = new SIMailsLabelsObserver();
  Services.prefs.addObserver("mailnews.tags.", labelsObserver, false);

  win.addEventListener("unload", function() {
    dump("PREFERENCES CLOSED!\n");

    if (sogoCategoriesChanged) {
      SIContactCategories.synchronizeToServer();
    }
    if (sogoDefaultClassificationsChanged) {
      SICalendarDefaultClassifications.synchronizeToServer();
    }
    if (sogoMailsLabelsChanged) {
      SIMailsLabels.synchronizeToServer();
    }
  }, false);
}

//
// Observer for classification changes, so we sync them back to the server
//
function SOGoDefaultClassificationObserver() {}
SOGoDefaultClassificationObserver.prototype = {
  observe: function(subject, topic, data) {
    sogoDefaultClassificationsChanged = true;
    dump("Default classification changed\n");
  },

  QueryInterface: function(aIID) {
    if (!aIID.equals(Components.interfaces.nsIObserver)
        && !aIID.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

//
// Observer for mail labels changes, so we sync them back to the server
//
function SIMailsLabelsObserver() {}
SIMailsLabelsObserver.prototype = {
  observe: function(subject, topic, data) {
    sogoMailsLabelsChanged = true;
    dump("Mail labels changed\n");
  },

  QueryInterface: function(aIID) {
    if (!aIID.equals(Components.interfaces.nsIObserver)
        && !aIID.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

//
// For managemnet of contact categories (add, edit, delete)
//
var gSOGoConnectorPane = {
  w: null,

  init: function SCP_init(win) {
    w = win;
    this.contactCategoriesPane.init();
  },

  tabSelectionChanged: function SCP_tabSelectionChanged() {
  },

  contactCategoriesPane: {
    mCategoryList: null,
    _this: null,

    init: function SCP_cCP_init() {
      _this = this;
      this.mCategoryList = SCContactCategories.getCategoriesAsArray();
      this.updateCategoryList();
    },

    updateCategoryList: function SCP_cCPupdateCategoryList() {
      _this.mCategoryList = SCContactCategories.getCategoriesAsArray();
      let listbox = w.document.getElementById("SOGoConnectorContactCategoriesList");
      listbox.clearSelection();
      while (listbox.itemCount) {
        listbox.removeChild(listbox.lastChild);
      }

      _this.updateButtons();

      for (let i = 0; i < _this.mCategoryList.length; i++) {
        let newListItem = listbox.appendItem(_this.mCategoryList[i]);
        newListItem.setAttribute("id", _this.mCategoryList[i]);
      }
    },

    updateButtons: function SCP_cCPupdateButtons() {
      let categoriesList = w.document.getElementById("SOGoConnectorContactCategoriesList");
      w.document.getElementById("SOGoConnectorDeleteContactCategoryButton")
        .disabled = (categoriesList.selectedCount == 0);
      w.document.getElementById("SOGoConnectorEditContactCategoryButton")
        .disabled = (categoriesList.selectedCount != 1);
    },

    _addCategory: function SCP_cCP__addCategory(newName) {
      if (_this.mCategoryList.indexOf(newName) < 0) {
        _this.mCategoryList.push(newName);
        SCContactCategories.setCategoriesAsArray(_this.mCategoryList);
        _this.updateCategoryList();
        sogoCategoriesChanged = true;
      }
    },

    _editCategory: function SCP_cCP__editCategory(idx, newName) {
      if (_this.mCategoryList.indexOf(newName) < 0) {
        _this.mCategoryList[idx] = newName;
        SCContactCategories.setCategoriesAsArray(_this.mCategoryList);
        _this.updateCategoryList();
        sogoCategoriesChanged = true;
      }
    },

    /* actions */
    onAddCategory: function SCP_cCP_addCategory() {
      let listbox = w.document.getElementById("SOGoConnectorContactCategoriesList");
      listbox.clearSelection();
      _this.updateButtons();

      let saveObject = {
        setCategoryName: function SCP_cCP_sO_setCategoryName(newName) {
          _this._addCategory(newName);
        }
      };
      window.openDialog("chrome://sogo-connector/content/preferences/edit-category.xhtml",
                        "addCategory", "modal,centerscreen,chrome,resizable=no",
                        "",
                        WL,
                        WL.extension.localeData.localizeMessage("sogo-connector.preferences.contacts.categories.add.title"),
                        saveObject);
    },
    onEditCategory: function SCP_cCP_editCategory() {
      let list = w.document.getElementById("SOGoConnectorContactCategoriesList");
      if (list.selectedCount == 1) {
        let saveObject = {
          setCategoryName: function SCP_cCP_sO_setCategoryName(newName) {
            _this._editCategory(list.selectedIndex, newName);
          }
        };
        window.openDialog("chrome://sogo-connector/content/preferences/edit-category.xhtml",
                          "editCategory", "modal,centerscreen,chrome,resizable=no",
                          _this.mCategoryList[list.selectedIndex],
                          WL,
                          WL.extension.localeData.localizeMessage("sogo-connector.preferences.contacts.categories.edit.title"),
                          saveObject);
      }
    },
    onDeleteCategory: function SCP_cCP_deleteCategory() {
      let list = w.document.getElementById("SOGoConnectorContactCategoriesList");
      if (list.selectedCount > 0) {
        let selection = list.selectedItems;

        for (let i = 0; i < selection.length; i++) {
          list.removeChild(selection[i]);
        }
        _this.updateButtons();

        _this.mCategoryList = [];
        let newNodes = list.childNodes;
        for (let i = 0; i < newNodes.length; i++) {
          if (newNodes[i].tagName == "richlistitem") {
            _this.mCategoryList.push(newNodes[i].getAttribute("id"));
          }
        }
        SCContactCategories.setCategoriesAsArray(_this.mCategoryList);
        sogoCategoriesChanged = true;
      }
    }
  }
};

//
// The original "AddContact" method (./mail/base/content/msgHdrView.js) makes use of
// the default local address book - we overwrite that to use SOGo's personal
// address book by default
//
window.AddContact = function(emailAddressNode)
{
  dump("calendar-overlay.js: AddContact()\n");
  emailAddressNode = emailAddressNode.closest("mail-emailaddress");
  emailAddressNode.setAttribute("updatingUI", true);

  let abManager = Components.classes["@mozilla.org/abmanager;1"]
      .getService(Components.interfaces.nsIAbManager);

  let handler = new AddressbookHandler();
  let existing = handler.getExistingDirectories();
  let personalURL = sogoBaseURL() + "Contacts/personal/";
  let addressBook = existing[personalURL];

  let card = Components.classes["@mozilla.org/addressbook/cardproperty;1"]
      .createInstance(Components.interfaces.nsIAbCard);
  card.displayName = emailAddressNode.getAttribute("displayName");
  card.primaryEmail = emailAddressNode.getAttribute("emailAddress");

  // Just save the new node straight away.
  addressBook.addCard(card);

  emailAddressNode.removeAttribute("updatingUI");
}

function onLoad(activatedWhileWindowOpen) {
  OnLoadMessengerOverlay();
  SIOnCalendarOverlayLoad();
  Services.obs.addObserver(injectSOGoConnectorPreferences, "app-handler-pane-loaded");
}
