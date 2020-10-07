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
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

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

function lightningItemPanelHasLoaded(win, value) {
  let iframe = document.getElementById("lightning-item-panel-iframe");

  // Wait some more...
  if (iframe.contentWindow.onLoad.hasLoaded == false) {
    win.setTimeout(lightningItemPanelHasLoaded, 100, win, value);
  }

  win.gConfig.privacy = value;
  win.updatePrivacy(win.gConfig);

  let b = false;

  try {
    b = Services.prefs.getBoolPref("sogo-connector.disable-send-invitations-checkbox");
  } catch (e) {}

  if (b != true) {
    iframe.contentWindow.document.getElementById("notify-attendees-checkbox").removeAttribute("disabled");
  }
}

window.SIOnLoadLightningItemPanel = function() {
  dump("calendar-event-dialog.js: SIOnLoadLightningItemPanel()\n");
  window.SIOldOnLoadLightningItemPanel();

  // We now set the default classification for new tasks/events
  let item = window.arguments[0].calendarEvent;
  let iframe = document.getElementById("lightning-item-panel-iframe");

  iframe.contentWindow.addEventListener("load", function() {
    if (item.id === null) { /* item is new */
      let prefName = null;
      if (cal.item.isEvent(item)) {
        prefName = "calendar.events.default-classification";
      }
      else if (cal.item.isToDo(item)) {
        prefName = "calendar.todos.default-classification";
      }
      if (prefName) {
        let value = Services.prefs.getCharPref(prefName, "PUBLIC");
        if (iframe.contentWindow.onLoad.hasLoaded == false) {
          window.setTimeout(lightningItemPanelHasLoaded, 100, window, value);
        }
      }
    }
  });
}

function onLoad(activatedWhileWindowOpen) {
  dump("calendar-event-dialog.js: onLoad()\n");

  window.SIOldOnLoadLightningItemPanel = window.onLoadLightningItemPanel;
  window.onLoadLightningItemPanel = window.SIOnLoadLightningItemPanel;

  document.addEventListener("dialogaccept", function(event) {
    SIOnAccept(event);
  });
}
