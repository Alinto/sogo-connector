Components.utils.import("resource://gre/modules/Services.jsm");

function CalendarHandler() {
    this.doubles = [];
    this.mgr = (Components.classes["@mozilla.org/calendar/manager;1"]
                          .getService(Components.interfaces.calICalendarManager)
                          .wrappedJSObject);
}

let _topmostWindow = null;

function topmostWindow() {
    if (!_topmostWindow) {
        let currentTop = window;
        while (currentTop.opener)
            currentTop = currentTop.opener;

        _topmostWindow = currentTop;
    }

    return _topmostWindow;
}

CalendarHandler.prototype = {
    getExistingDirectories: function getExistingDirectories() {
        let existing = {};

        let cals = this.mgr.getCalendars({});
        for (let i = 0; i < cals.length; i++) {
            if (cals[i].type == "caldav") {
                if (existing[cals[i].uri.spec]) {
                    this.doubles.push(cals[i]);
                }
                else {
                    existing[cals[i].uri.spec] = cals[i];
                }
            }
        }

        return existing;
    },
    removeHomeCalendar: function removeHomeCalendar() {
        let mgr = this.mgr;
        let cals = mgr.getCalendars({});
        if (cals.length != 1) {
            return;
        }

        let aCal = cals[0];
        if (aCal.uri.spec != "moz-storage-calendar://") {
            return;
        }

        let this_ = this;
        let listener = {
            itemCount: 0,
            onOperationComplete: function(aCalendar, aStatus, aOperationType, aId, aDetail) {
                dump("local calendar: " + aCalendar.uri.spec + "\n");
                dump("this.itemCount: " + this.itemCount + "\n");
                if (!this.itemCount) {
                    dump("removing\n");
                    mgr.unregisterCalendar(aCalendar);
                    mgr.removeCalendar(aCalendar);
                }
            },
            onGetResult: function(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                this.itemCount += aCount;
            }
        };

        aCal.getItems(Components.interfaces.calICalendar.ITEM_FILTER_ALL_ITEMS,
                      0, null, null, listener);
    },
    removeDoubles: function removeDoubles() {
        this.removeDirectories(this.doubles);
    },
    _setDirectoryProperties: function _setDirectoryProperties(directory,
                                                              properties,
                                                              isNew) {
        let displayName = properties['displayName'];
        let color = null;
        let suppressAlarms = false;
        let suppressAlarmsSetFromDAV = false;
        let props = properties.additional;
        if (props) {
            if (props[0]) { /* calendar-color */
                color = props[0].substr(0, 7).toUpperCase();
            }
            if (props[1]) { /* calendar-show-alarms */
                suppressAlarmsSetFromDAV = true;
                suppressAlarms = (props[1] == "false" || props[1] == "0");
            }
            let sogoProps = ["notify-on-personal-modifications",
                             "notify-on-external-modifications",
                             "notify-user-on-personal-modifications",
                             "notified-user-on-personal-modifications"];
            let counter = 2;
            for (let sogoProp in sogoProps) {
                if (props[counter]) {
                    let propName = "calendar.sogo." + sogoProp;
                    directory.setProperty(propName, props[counter]);
                }
                counter++;
            }
        }

        directory.name = displayName;
        if (isNew) {
            let urlArray = directory.uri.spec.split("/");
            let urlFolder = urlArray[7];

            // We enable alarms, today pane and invitations ONLY for "folder"
            // owners.
            // All subscribtions's alarms are ignored by default.
            if (directory.uri.spec.indexOf('_') > -1) {
                directory.setProperty("showInTodayPane", false);
                directory.setProperty("showInvitations", false);
                if (!suppressAlarmsSetFromDAV) {
                    directory.setProperty("suppressAlarms", true);
                }
            }
            else {
                directory.setProperty("showInTodayPane", true);
                directory.setProperty("showInvitations", true);
                if (!suppressAlarmsSetFromDAV) {
                    directory.setProperty("suppressAlarms", false);
                }
            }
            directory.setProperty("cache.enabled", true);
        }
        if (color) {
            directory.setProperty("color", color);
        }
        if (suppressAlarmsSetFromDAV) {
            directory.setProperty("suppressAlarms", suppressAlarms);
        }
        directory.setProperty("aclManagerClass", "@inverse.ca/calendar/caldav-acl-manager;1");
    },
    addDirectories: function addDirectories(newDirs) {
        //let ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
        //                      .getService(Components.interfaces.nsIIOService);

        dump("addDirectories\n");
        for (let i = 0; i < newDirs.length; i++) {
            let newURI = Services.io.newURI(newDirs[i]['url'], null, null);
            let newCalendar = this.mgr.createCalendar("caldav", newURI);
            this._setDirectoryProperties(newCalendar, newDirs[i], true);
            this.mgr.registerCalendar(newCalendar, true);
        }
    },
    renameDirectories: function renameDirectories(dirs) {
        for (let i = 0; i < dirs.length; i++)
            // 			dump("renaming calendar: " + dirs[i]['url'] + "\n");
            this._setDirectoryProperties(dirs[i]['folder'], dirs[i]);
    },
    removeDirectories: function removeDirectories(oldDirs) {
        for (let i = 0; i < oldDirs.length; i++) {
            // 			dump("removing calendar: " + oldDirs[i] + "\n");
            this.mgr.unregisterCalendar(oldDirs[i]);
            this.mgr.removeCalendar(oldDirs[i]);
        }
    },
    urlForParentDirectory: function urlForParentDirectory() {
        return sogoBaseURL() + "Calendar";
    },
    additionalDAVProperties: function additionalDAVProperties() {
        return ["http://apple.com/ns/ical/ calendar-color",
                "urn:inverse:params:xml:ns:inverse-dav calendar-show-alarms",
                "urn:inverse:params:xml:ns:inverse-dav notify-on-personal-modifications",
                "urn:inverse:params:xml:ns:inverse-dav notify-on-external-modifications",
                "urn:inverse:params:xml:ns:inverse-dav notify-user-on-personal-modifications",
                "urn:inverse:params:xml:ns:inverse-dav notified-user-on-personal-modifications"
               ];
    }
};
