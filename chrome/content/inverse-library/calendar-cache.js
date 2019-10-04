Components.utils.import("resource://gre/modules/Preferences.jsm");

function reloadCalendarCache(aCalendar) {
    if (aCalendar.type == "caldav") {
        let sortOrderPref = Preferences.get("calendar.list.sortOrder", "").split(" ");
        let initialSortOrderPos = null;
        for (let i = 0; i < sortOrderPref.length; ++i) {
            if (sortOrderPref[i] == aCalendar.id) {
                initialSortOrderPos = i;
            }
        }
        
        var mgr = (Components.classes["@mozilla.org/calendar/manager;1"]
                   .getService(Components.interfaces.calICalendarManager)
                   .wrappedJSObject);
        
        mgr.unregisterCalendar(aCalendar);
        mgr.removeCalendar(aCalendar);

        var newCal = mgr.createCalendar(aCalendar.type, aCalendar.uri);
        newCal.name = aCalendar.name;
        
        let propsToCopy = [ "color",
                            "disabled",
                            "auto-enabled",
                            "cache.enabled",
                            "refreshInterval",
                            "suppressAlarms",
                            "calendar-main-in-composite",
                            "calendar-main-default",
                            "readOnly",
                            "imip.identity.key",
                            "aclManagerClass",
                            "calendar.sogo.notify-on-personal-modifications",
                            "calendar.sogo.notify-on-external-modifications",
                            "calendar.sogo.notify-user-on-personal-modifications",
                            "calendar.sogo.notified-user-on-personal-modifications"];

        for (let prop of propsToCopy ) {
            newCal.setProperty(prop,
                               aCalendar.getProperty(prop));
        }
        
        if (initialSortOrderPos != null) {
            newCal.setProperty("initialSortOrderPos",
                               initialSortOrderPos);
        }
        
        mgr.registerCalendar(newCal);
        
        if (aCalendar.wrappedJSObject.setupCachedCalendar) {
            aCalendar.wrappedJSObject.setupCachedCalendar();
        }
        else {
            // Invoked from CalDAVACLManager.js
            aCalendar.superCalendar.wrappedJSObject.setupCachedCalendar();
            aCalendar.aclEntry.refresh();
        }
    }
}
