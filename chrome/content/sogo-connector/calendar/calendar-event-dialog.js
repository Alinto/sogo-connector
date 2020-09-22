var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function SIOnLoadHandler(event) {
  window.SIOldUpdateAttendees = window.updateAttendees;
  window.updateAttendees = window.SIUpdateAttendees;
  window.SIOldSaveItem = window.saveItem;
  window.saveItem = window.SISaveItem;

  document.addEventListener("dialogaccept", function(event) {
    SIOnAccept(event);
  });

  // We now set the default classification for new tasks/events
  let item = window.arguments[0].calendarEvent;
  
  if (typeof item == "undefined") {
    // TODO: handle Thunderbird 52 with iframe options
    return;
  }

  if (item.id === null) { /* item is new */
    let prefName = null;
    if (cal.item.isEvent(item)) {
      prefName = "calendar.events.default-classification";
    }
    else if (cal.item.isToDo(item)) {
      prefName = "calendar.todos.default-classification";
    }
    if (prefName) {
      window.gConfig.privacy = Services.prefs.getCharPref(prefName, "PUBLIC");
      window.updatePrivacy(window.gConfig);
    }
  }
}

function SIOnAccept(event) {
  let title;

  title = "";

  try {
    title = getElementValue("item-title");
  }  catch (e) {
    let iframe = document.getElementById("lightning-item-panel-iframe");
    title = iframe.contentWindow.document.getElementById("item-title").value;
  }

  if (title.length > 0)
    title = title.replace(/(^\s+|\s+$)/g, "");

  if (title.length == 0) {
    let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);

    let flags = promptService.BUTTON_TITLE_OK *
        promptService.BUTTON_POS_0;

    promptService.confirmEx(null,
                            WL.extension.localeData.localizeMessage("saveComponentTitle"),
                            WL.extension.localeData.localizeMessage("saveComponentMessage"),
                            flags,
                            null,
                            null,
                            null,
                            null,
                            {});

    event.preventDefault(); // Prevent the dialog closing.
    return;
  }
}

function SISaveItem() {
  let item = SIOldSaveItem();

  // We remove this unconditionaly in SOGo
  item.deleteProperty("X-MOZ-SEND-INVITATIONS");

  let notifyCheckbox = document.getElementById("notify-attendees-checkbox");
  if (notifyCheckbox.checked == true) {
    item.deleteProperty("X-SOGo-Send-Appointment-Notifications");
  } else {
    item.setProperty("X-SOGo-Send-Appointment-Notifications", "NO");
  }

  return item;
}

function SIUpdateAttendees() {
  SIOldUpdateAttendees();

  let b = false;

  try {
    b = Services.prefs.getBoolPref("sogo-connector.disable-send-invitations-checkbox");
  } catch (e) {}

  if (b != true) {
    enableElement("notify-attendees-checkbox");
  }
}

//window.addEventListener("load", SIOnLoadHandler, false);
function onLoad(activatedWhileWindowOpen) {
  dump("calendar-event-dialog.js: onLoad()\n");
  SIOnLoadHandler();
}
