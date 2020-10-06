/* CalDAVACLManager.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

var { XPCOMUtils } = Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
var { Services } = Components.utils.import("resource://gre/modules/Services.jsm");
var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");
var { Preferences } = Components.utils.import("resource://gre/modules/Preferences.jsm");

function jsInclude(files, target) {
  let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader);
  for (let i = 0; i < files.length; i++) {
    try {
      loader.loadSubScript(files[i], target);
    }
    catch(e) {
      dump("CalDAVACLManager.js: failed to include '" + files[i] +
           "'\n" + e
           + "\nFile: " + e.fileName
           + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
    }
  }
}

jsInclude(["chrome://inverse-library/content/calendar-cache.js"]);


/* helpers */
function doQueryInterface(aSelf, aProto, aIID, aList, aClassInfo) {
  if (aClassInfo) {
    if (aIID.equals(Components.interfaces.nsIClassInfo)) {
      return aClassInfo;
    }
    if (!aList) {
      aList = aClassInfo.getInterfaces({});
    }
  }

  if (aList) {
    for (let iid of aList) {
      if (aIID.equals(iid)) {
        return aSelf;
      }
    }
  }

  if (aIID.equals(Components.interfaces.nsISupports)) {
    return aSelf;
  }

  if (aProto) {
    let base = aProto.__proto__;
    if (base && base.QueryInterface) {
      // Try to QI the base prototype
      return base.QueryInterface.call(aSelf, aIID);
    }
  }

  throw Components.results.NS_ERROR_NO_INTERFACE;
}

function fixURL(url) {
  if (!url) {
    dump("fixURL: no URL! - backtrace\n" + STACK());
    throw("fixURL: no URL!\n");
  }
  let fixedURL = url;
  if (fixedURL[fixedURL.length-1] != '/')
    fixedURL += '/';

  return fixedURL;
}

function ExecuteSimpleStatement(db, stmtText) {
  let stmt = db.createStatement(stmtText);
  try {
    stmt.executeStep();
  }
  catch (exc) {
  }
  finally {
    stmt.reset();
  };
}

/* CalDAVACLOfflineManager */
function CalDAVACLOfflineManager() {
  this.initDB();
  this.wrappedJSObject = this;
}

CalDAVACLOfflineManager.prototype = {
  /* calendar entries:
   * - hasAccessControl
   * - userPrivileges
   * - userAddresses
   * - userIdentities
   * - userPrincipals
   * - ownerAddresses
   * - ownerIdentities
   * - ownerPrincipal
   *
   * item entries:
   * - userPrivileges
   */

  initDB: function CalDAVACLOfflineManage_initDB() {
    let dbFile = cal.provider.getCalendarDirectory();
    dbFile.append("caldav-acl.sqlite");
    this.mDB = Services.storage.openDatabase(dbFile);
    dump("this.mDB = " + this.mDB + "\n");
    dump("this.mDB.createStatement = " + this.mDB.createStatement + "\n");
    let dbVersion = -1;
    if (this.mDB.tableExists("acl_meta")) {
      let stmt = this.mDB.createStatement("SELECT value FROM acl_meta WHERE key = 'version'");
      let txtVersion = null;
      try {
        stmt.executeStep();
        txtVersion = stmt.row.value;
      }
      catch (exc) {
      }
      finally {
        stmt.reset();
      };
      if (txtVersion) {
        dbVersion = parseInt(txtVersion);
      }
    }
    else {
      dump("tables do NOT exists\n");
    }

    let updated = false;
    if (dbVersion < 0) {
      ExecuteSimpleStatement(this.mDB,
                             "CREATE TABLE acl_meta (key TEXT PRIMARY KEY ASC NOT NULL, value TEXT NOT NULL)");
      ExecuteSimpleStatement(this.mDB,
                             "CREATE TABLE acl_calendar_entries (url TEXT PRIMARY KEY ASC NOT NULL, has_access_control INTEGER, user_privileges TEXT, user_addresses TEXT, user_principals TEXT, user_identities TEXT, owner_addresses TEXT, owner_principal TEXT, owner_identities TEXT)");
      ExecuteSimpleStatement(this.mDB,
                             "CREATE TABLE acl_item_entries (url TEXT PRIMARY KEY ASC NOT NULL, user_privileges TEXT)");
      dbVersion = 0;
      updated = true;
    }

    this.prepareStatements();
    if (updated) {
      this.setACLMeta("version", String(dbVersion));
    }
  },

  prepareStatements: function CalDAVACLOfflineManager_prepareStatements() {
    /* meta data */
    this.mGetACLMeta = this.mDB.createStatement("SELECT value FROM acl_meta"
                                                + " WHERE key = :key");
    this.mInsertACLMeta = this.mDB.createStatement("INSERT INTO acl_meta"
                                                   + " (key, value)"
                                                   + " VALUES(:key, :value)");
    this.mUpdateACLMeta = this.mDB.createStatement("UPDATE acl_meta"
                                                   + " SET value = :value"
                                                   + " WHERE key = :key");
    this.mDeleteACLMeta = this.mDB.createStatement("DELETE FROM acl_meta"
                                                   + " WHERE key = :key");

    /* calendar entries */
    this.mSelectCalendarEntry = this.mDB.createStatement("SELECT has_access_control, user_privileges,"
                                                         +"  user_addresses, user_principals, user_identities,"
                                                         +"  owner_addresses, owner_principal, owner_identities"
                                                         + " FROM acl_calendar_entries"
                                                         + " WHERE url = :url");
    this.mInsertCalendarEntry = this.mDB.createStatement("INSERT INTO acl_calendar_entries"
                                                         + " (url, has_access_control, user_privileges,"
                                                         + "  user_addresses, user_principals, user_identities,"
                                                         + "  owner_addresses, owner_principal, owner_identities)"
                                                         + " VALUES(:url, :has_access_control, :user_privileges,"
                                                         + " :user_addresses, :user_principals, :user_identities,"
                                                         + " :owner_addresses, :owner_principal, :owner_identities)");
    this.mUpdateCalendarEntry = this.mDB.createStatement("UPDATE acl_calendar_entries"
                                                         + " SET has_access_control = :has_access_control,"
                                                         + "        user_privileges = :user_privileges,"
                                                         + "         user_addresses = :user_addresses,"
                                                         + "        user_principals = :user_principals,"
                                                         + "        user_identities = :user_identities,"
                                                         + "        owner_addresses = :owner_addresses,"
                                                         + "        owner_principal = :owner_principal,"
                                                         + "       owner_identities = :owner_identities"
                                                         + " WHERE url = :url");
    this.mDeleteCalendarEntry = this.mDB.createStatement("DELETE FROM acl_calendar_entries WHERE url = :url");

    /* item entries */
    this.mSelectItemEntry = this.mDB.createStatement("SELECT user_privileges FROM acl_item_entries"
                                                     + " WHERE url = :url");
    this.mInsertItemEntry = this.mDB.createStatement("INSERT INTO acl_item_entries"
                                                     + " (url, user_privileges)"
                                                     + " VALUES(:url, :user_privileges)");
    this.mUpdateItemEntry = this.mDB.createStatement("UPDATE acl_item_entries"
                                                     + " SET user_privileges = :user_privileges"
                                                     + " WHERE url = :url");
    this.mDeleteItemEntry = this.mDB.createStatement("DELETE FROM acl_item_entries"
                                                     + " WHERE url = :url");
    this.mDeleteItemEntriesLike = this.mDB.createStatement("DELETE FROM acl_item_entries"
                                                           + " WHERE url LIKE :url");
  },

  getACLMeta: function CalDAVACLOfflineManager_getACLMeta(key) {
    let value = null;
    this.mGetACLMeta.params.key = key;
    try {
      this.mGetACLMeta.executeStep();
      value = this.mGetACLMeta.row.value;
    }
    catch(e) {
    }
    finally {
      this.mGetACLMeta.reset();
    };

    return value;
  },
  setACLMeta: function CalDAVACLOfflineManager_getACLMeta(key, value) {
    if (value === null) {
      this.deleteACLMeta(key);
    }
    else {
      let initialValue = this.getACLMeta(key);
      let stmt = null;
      if (initialValue === null) {
        stmt = this.mInsertACLMeta;
      }
      else {
        stmt = this.mUpdateACLMeta;
      }
      stmt.params["key"] = key;
      stmt.params["value"] = value;
      try {
        stmt.executeStep();
      }
      catch(e) {
      }
      finally {
        stmt.reset();
      };
    }
  },
  deleteACLMeta: function CalDAVACLOfflineManager_deleteACLMeta(key) {
    this.mDeleteACLMeta(key);
  },

  _parseStringArray: function CalDAVACLOfflineManager__parseStringArray(data) {
    let result;
    if (data.length > 0) {
      result = data.split("\u001A");
    }
    else {
      result = [];
    }

    return result;
  },

  _deserializeIdentities: function CalDAVACLOfflineManager__deserializeIdentities(mgr, calendar, data, entry) {
    let dataArray = this._parseStringArray(data);
    let identities = [];
    for (let data of dataArray) {
      if (data && data.length > 0) {
        let dict = JSON.parse(data);
        mgr._appendIdentity(identities, dict["displayName"], dict["address"], entry);
      }
    }
    return identities;
  },

  getCalendarEntry: function CalDAVACLOfflineManager_getCalendarEntry(mgr, calendar, listener) {
    //dump("\n\n\ngetCalendarEntry 2\n");
    let url = fixURL(calendar.uri.spec);
    this.mSelectCalendarEntry.params.url = url;
    let entry = null;
    try {
      if (this.mSelectCalendarEntry.executeStep()) {
        let row = this.mSelectCalendarEntry.row;
        entry = new CalDAVAclCalendarEntry(calendar, this);
        entry.hasAccessControl = (row.has_access_control == 1);
        if (entry.hasAccessControl) {
          entry.userPrivileges = this._parseStringArray(row.user_privileges);
          entry.userAddresses = this._parseStringArray(row.user_addresses);
          entry.userPrincipals = this._parseStringArray(row.user_principals);
          entry.ownerAddresses = this._parseStringArray(row.owner_addresses);
          entry.ownerPrincipal = row.owner_principal;
          entry.userIdentities = this._deserializeIdentities(mgr, calendar, row.user_identities, entry);
          entry.ownerIdentities = this._deserializeIdentities(mgr, calendar, row.owner_identities, entry);
        }
      }
    }
    catch(e) {
      dump("getCalendarEntry: " + e + "\n:line: " +  e.lineNumber + "\n");
      throw e;
    }
    finally {
      this.mSelectCalendarEntry.reset();
    }
    listener.onOperationComplete(calendar, (entry ? Components.results.NS_OK : Components.results.NS_ERROR_FAILURE), entry);
  },

  _serializeStringArray: function CalDAVACLOfflineManager__serializeStringArray(strings) {
    let serialized = "";
    if (strings) {
      serialized = strings.join("\u001A");
    }

    return serialized;
  },

  _serializeIdentity: function CalDAVACLOfflineManager__serializeIdentity(identity) {
    let data = { "displayName": identity.fullName,
                 "address": identity.email };
    return JSON.stringify(data);
  },
  _serializeIdentities: function CalDAVACLOfflineManager__serializeIdentities(identities) {
    let strings = [];
    if (identities) {
      for (let identity of identities) {
        strings.push(this._serializeIdentity(identity));
      }
    }

    return this._serializeStringArray(strings);
  },

  setCalendarEntry: function CalDAVACLOfflineManager_setCalendarEntry(calendar, entry, listener) {
    //dump("\n\n\n\nsetCalendarEntry\n\n\n\n");
    let url = fixURL(calendar.uri.spec);
    let queries = [ this.mInsertCalendarEntry, this.mUpdateCalendarEntry ];
    let errors = 0;

    // We first get the data from our cache. We'll use it later to see if we need to mark
    // it as dirty since the value got from the server could be different.
    this.mSelectCalendarEntry.params.url = url;
    let cached_user_privileges = null;
    try {
      if (this.mSelectCalendarEntry.executeStep()) {
        let row = this.mSelectCalendarEntry.row;
        if (row.has_access_control == 1) {
          cached_user_privileges = row.user_privileges;
          //dump("CACHED userPrivileges: " +  cached_user_privileges + "\n");
        }
      }
    }
    catch(e) {
      dump("setCalendarEntry - exception while trying to get cached entry: " + e + "\n:line: " +  e.lineNumber + "\n");
      cached_user_privileges = null;
    }
    finally {
      this.mSelectCalendarEntry.reset();
    }

    for (let query of queries) {
      let params = query.params;
      params.url = url;
      params.has_access_control = (entry.hasAccessControl ? 1 : 0);
      if (entry.hasAccessControl) {
        // dump("has access control...\n");
        let serialized_user_privileges = this._serializeStringArray(entry.userPrivileges);
        params.user_privileges = serialized_user_privileges;
        //dump("PARSED userPrivileges: " +  params.user_privileges  + "\n");

        // Some value examples:
        //
        // {DAV:}read{DAV:}read-current-user-privilege-set{urn:ietf:params:xml:ns:caldav}read-free-busy{urn:inverse:params:xml:ns:inverse-dav}viewwhole-public-records
        // {urn:inverse:params:xml:ns:inverse-dav}modify-public-records{urn:inverse:params:xml:ns:inverse-dav}respondto-public-records
        // {urn:inverse:params:xml:ns:inverse-dav}viewdant-confidential-records
        // 
        // or
        //
        // {DAV:}read{DAV:}read-current-user-privilege-set{urn:ietf:params:xml:ns:caldav}read-free-busy{urn:inverse:params:xml:ns:inverse-dav}viewdant-public-records
        //
        // We check if we had a defined value, and if we ever fetched the 'custom dav' property in the {urn:inverse:params:xml:ns:inverse-dav} namespace and finally,
        // if the values differ from the cached one and the one we're about to set. If so, we'll need to reload all calendar entries for that particular calender.
        //
        if (cached_user_privileges != null &&
            cached_user_privileges.indexOf("{urn:inverse:params:xml:ns:inverse-dav}") >=0 &&
            cached_user_privileges != serialized_user_privileges) {
          entry.dirty = true;
        }

        if (entry.userAddresses) {
          params.user_addresses = entry.userAddresses.join("\u001A");
        }
        else {
          dump("[warning] CalDAVACLManager.js: no user addresses provided\n");
          dump("  STACK: " + cal.STACK() + "\n");
          params.user_addresses = "";
        }
        params.user_principals = this._serializeStringArray(entry.userPrincipals);
        params.user_identities = this._serializeIdentities(entry.userIdentities);
        params.owner_addresses = this._serializeStringArray(entry.ownerAddresses);
        params.owner_principal = entry.ownerPrincipal;
        params.owner_identities = this._serializeIdentities(entry.ownerIdentities);
      }
      else {
        // dump("has NO access control...\n");
      }
      try {
        query.execute();
        break;
      }
      catch(e) {
        errors++;
      }
      finally {
        query.reset();
      }
    } // for (let query of queries)
    
    // dump("acl-db-manager: saved calendar entry, errors = "  + errors + "\n");
    if (listener) {
      listener.onOperationComplete(calendar,
                                   (errors == queries.length
                                    ? Components.results.NS_ERROR_FAILURE
                                    : Components.results.NS_OK),
                                   entry);
    }
  },

  getItemEntry: function CalDAVACLOfflineManager_getItemEntry(calEntry, url) {
    // dump("item entry for url: " + url + "\n");
    let entry = null;
    if (!calEntry.hasAccessControl) {
      dump("No ACL handling -> no cache save required\n");
    }
    else  if (calEntry.userIsOwner) {
      dump("User is owner -> no cache save required\n");
    }
    else {
      this.mSelectItemEntry.params.url = url;
      try {
        if (this.mSelectItemEntry.executeStep()) {
          let row = this.mSelectItemEntry.row;
          entry = new CalDAVAclItemEntry(calEntry);
          entry.userPrivileges = this._parseStringArray(row.user_privileges);
        }
      }
      catch(e) {
        dump("getItemEntry: " + e + "\n:line: " +  e.lineNumber + "\n");
        throw e;
      }
      finally {
        this.mSelectItemEntry.reset();
      }
    }

    return entry;
  },
  setItemEntry: function CalDAVACLOfflineManager_setItemEntry(itemEntry, url) {
    // dump("setItemEntry\n");
    // dump("set item entry for url: " + url + "\n");

    if (!itemEntry.calendarEntry.hasAccessControl) {
      dump("No ACL handling -> no cache save required\n");
      return;
    }
    if (itemEntry.calendarEntry.userIsOwner) {
      dump("User is owner -> no cache save required\n");
      return;
    }

    let queries = [ this.mInsertItemEntry, this.mUpdateItemEntry ];
    let errors = 0;

    for (let query of queries) {
      let params = query.params;
      params.url = url;
      params.user_privileges = this._serializeStringArray(itemEntry.userPrivileges);
      try {
        query.execute();
        break;
      }
      catch(e) {
        errors++;
      }
      finally {
        query.reset();
      }
    }
    // dump("acl-db-manager: saved item entry, errors = "  + errors + "\n");
  },

  dropCalendarEntry: function CalDAVACLOfflineManager_dropCalendarEntry(url) {
    // dump("dropCalendarEntry: " + url + "\n");
    this.mDeleteItemEntriesLike.params["url"] = url + "%";
    try {
      this.mDeleteItemEntriesLike.executeStep();
    }
    catch (exc) {
    }
    finally {
      this.mDeleteItemEntriesLike.reset();
    }

    this.mDeleteCalendarEntry.params["url"] = url;
    try {
      this.mDeleteCalendarEntry.executeStep();
    }
    catch (exc) {
    }
    finally {
      this.mDeleteCalendarEntry.reset();
    }
  }
};

/* CalDAVACLManager */
function CalDAVACLManager() {
  let uuidGenerator = Components.classes["@mozilla.org/uuid-generator;1"]
      .getService(Components.interfaces.nsIUUIDGenerator);
  this.instanceId = uuidGenerator.generateUUID().toString();
  this.calendars = {};
  this.pendingCalendarOperations = {};
  this.pendingItemOperations = {};
  this.identityCount = 0;
  this.accountMgr = null;
  this.mOfflineManager = new CalDAVACLOfflineManager();
  this.wrappedJSObject = this;
}

function xmlEscape(text) {
  return text.replace("&", "&amp;", "g").replace("<", "&lt;", "g");
}

function xmlUnescape(text) {
  let s = String(text).replace(/&lt;/g, "<", "g");
  s = s.replace(/&gt;/g, ">", "g");
  s = s.replace(/&amp;/g, "&",  "g");

  return s;
}

function statusCode(status) {
  let code = -1;

  if (status.indexOf("HTTP/1.1") == 0) {
    let words = status.split(" ");
    code = parseInt(words[1]);
  }

  return code;
}

function cloneData(oldData) {
  if (!oldData) {
    throw("No data to clone");
  }

  let newData = {};
  for (let k in oldData) {
    newData[k] = oldData[k];
  }

  return newData;
}

CalDAVACLManager.prototype = {
  /* nsIClassInfo */
  classID: Components.ID("{c8945ee4-1700-11dd-8e2e-001f5be86cea}"),
  contractID: "@inverse.ca/calendar/caldav-acl-manager;1",
  classDescription: "CalDAV ACL Provider",

  getInterfaces: function cDACLM_getInterfaces(count) {
    const ifaces = [Components.interfaces.calICalendarACLManager,
                    Components.interfaces.nsIClassInfo,
                    Components.interfaces.nsISupports];
    count.value = ifaces.length;
    return ifaces;
  },
  getHelperForLanguage: function cDACLM_getHelperForLanguage(language) {
    return null;
  },
  //implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Components.interfaces.nsIClassInfo.SINGLETON,

  /* default entries */
  mOwnerItemEntry: null,
  mFallbackItemEntry: null,

  /* internal vars */
  mOfflineManager: null,
  calendars: null,
  identityCount: 0,
  accountMgr: null,
  pendingCalendarOperations: null,
  pendingItemOperations: null,

  get isOffline() {
    //var iOService = Components.classes["@mozilla.org/network/io-service;1"]
    //    .getService(Components.interfaces.nsIIOService);
    return Services.io.offline;
  },

  getCalendarEntry: function cDACLM_getCalendarEntry(calendar, listener) {
    //dump("\n\n\ngetCalendarEntry 1\n");
    if (calendar.type != "caldav") {
      Components.utils.reportError("CalDAVACLManager.js: calendar is not caldav");
      listener.onOperationComplete(calendar, Components.results.NS_ERROR_FAILURE,
                                   Components.interfaces.calIOperationListener.GET,
                                   null, null);
      return;
    }

    if (!calendar.uri) {
      dump("fixURL: no URL! - backtrace\n" + STACK());
    }

    let url = fixURL(calendar.uri.spec);

    //dump("getCalendarEntry: " + url + "\n");

    let entry = this.calendars[url];
    if (entry) {
      dump("We notify from success..\n");
      this._notifyListenerSuccess(listener, calendar, entry);
      return;
    }

    let pendingData = { calendar: calendar, listener: listener };
    if (this.pendingCalendarOperations[url]) {
      this.pendingCalendarOperations[url].push(pendingData);
      return;
    }

    this.pendingCalendarOperations[url] = [pendingData];
    let this_ = this;
    let opListener = {
      onGetResult: function cDACLM_getCalendarEntry_oL_onGetResult(opCalendar, opStatus, opItemType, opDetail, opCount, opItems) {
        ASSERT(false, "unexpected!");
      },
      onOperationComplete: function cDACLM_getCalendarEntry_oL_onOperationComplete(opCalendar, opStatus, opType, opId, opDetail) {
        dump("onOperationComplete 1\n");
        let aEntry = opDetail;
        if (Components.isSuccessCode(opStatus)) {
          //dump("acl-manager: we received a valid calendar entry, we cache it\n");
          this_.calendars[url] = aEntry;
        }
        else {
          //dump("acl-manager: we did not receive a valid calendar entry, we FAKE it\n");
          this_._makeFallbackCalendarEntry(aEntry);
        }
        
        dump("getCalendarEntry returned for cal: " + aEntry.uri.spec  + "\n");

        for (let data of this_.pendingCalendarOperations[url]) {
          //this_.mOfflineManager.setCalendarEntry(data.calendar, aEntry, null); // FIXME - should we call it?
          this_._notifyListenerSuccess(data.listener, data.calendar, aEntry);
        }
        delete this_.pendingCalendarOperations[url];

        if (aEntry.dirty) {
          dump("\n\n\nENTRY IS DIRTY FOR URL: " + aEntry.uri.spec + " WE MUST RESTART!!\n\n\n");
          reloadCalendarCache(aEntry.calendar);
        }
      }
    };

    this._queryCalendarEntry(calendar, opListener);
  },

  /* We produce a "fallback" entry when we don't have any means of obtaining the required info, whether online or not.
   * We then assume that ACL are not supported. */
  _makeFallbackCalendarEntry: function cDACLM__makeOfflineCalendarEntry(offlineEntry) {
    // dump("acl-manager: making fallback calendar entry\n");
    offlineEntry.hasAccessControl = false;
    if (!this.accountMgr)
      this._initAccountMgr();
    let defaultAccount = this.accountMgr.defaultAccount;
    let identity = defaultAccount.defaultIdentity;
    if (identity != null) {
      offlineEntry.userAddresses = ["mailto:" + identity.email];
      offlineEntry.userIdentities = [identity];
      offlineEntry.ownerIdentities = [identity];
    }
  },

  getItemEntry: function cDACLM_getItemEntry(item) {
    if (item.calendar.type != "caldav") {
      Components.utils.reportError("CalDAVACLManager.js: calendar of item is not caldav");
      return null;
    }

    let calEntry = item.calendar.aclEntry;
    if (!calEntry) {
      let superCalendar = item.calendar.wrappedJSObject;
      if (superCalendar) {
        let entryCalendar = superCalendar.mUncachedCalendar.wrappedJSObject;
        calEntry = entryCalendar.aclEntry;
      }
    }
    // dump("calEntry: " + calEntry + "\n");
    if (!calEntry) {
      Components.utils.reportError("CalDAVACLManager.js: calendar acl entry not initialized");
      // dump("STACK: " + cal.STACK() + "\n");
      return null;
    }
    calEntry = calEntry.wrappedJSObject;
    if (calEntry.aclManager.wrappedJSObject.instanceId != this.instanceId) {
      Components.utils.reportError("CalDAVACLManager.js: calendar acl entry initialized with a different ACL manager");
      return null;
    }

    let itemEntry = null;
    if (!calEntry.hasAccessControl || calEntry.userIsOwner) {
      itemEntry = this._makeOwnerItemEntry(calEntry);
    }
    else {
      let realCalendar = item.calendar;
      let topCalendar = realCalendar.wrappedJSObject;
      if (topCalendar.mUncachedCalendar) {
        realCalendar = topCalendar.mUncachedCalendar;
      }
      realCalendar = realCalendar.wrappedJSObject;
      let cache = realCalendar.mItemInfoCache;
      if (!cache) {
        Components.utils.reportError("CalDAVACLManager.js: calendar item cache is not available");
      }
      else if (!cache[item.id]) {
        Components.utils.reportError("CalDAVACLManager.js: calendar item cache does not have an entry for this item");
      }
      else {
        let itemURL = cache[item.id].locationPath;
        /* Memory cache */
        // dump("itemURL: " + itemURL + "\n");
        if (itemURL in calEntry.entries) {
          itemEntry = calEntry.entries[itemURL];
        }
        else {
          /* SQLite cache */
          let fullItemURL = fixURL(calEntry.calendar.uri.spec) + itemURL;
          // dump("fullItemURL "+ fullItemURL + "\n");
          itemEntry = this.mOfflineManager.getItemEntry(calEntry, fullItemURL);
          if (!itemEntry) {
            // dump("itemEntry not found in database\n");
            /* network */
            if (this.isOffline) {
              // dump("itemEntry is fallback entry\n");
              itemEntry = this._makeFallbackItemEntry(calEntry);
            }
            else {
              itemEntry = this._queryOnlineItemEntry(calEntry, fullItemURL);
              if (itemEntry) {
                /* disk cache */
                this.mOfflineManager.setItemEntry(itemEntry, fullItemURL);
                // dump("entry put in database\n");

                /* mem cache */
                // dump("storage itemURL:  " + itemURL + "\n");
                calEntry.entries[itemURL] = itemEntry;
                // dump("entry put in memory cache\n");
              }
            }
          }
        }
      }
    }

    return itemEntry;
  },

  _makeOwnerItemEntry: function cDACLM__makeOwnerItemEntry(calEntry) {
    if (!this.mOwnerItemEntry) {
      this.mOwnerItemEntry = new CalDAVAclItemEntry(calEntry);
    }
    let entry = this.mOwnerItemEntry;

    return entry;
  },
  _makeFallbackItemEntry: function cDACLM__makeOfflineCalendarEntry(calEntry) {
    if (!this.mFallbackItemEntry) {
      this.mFallbackItemEntry = new CalDAVAclItemEntry(calEntry);
    }
    let entry = this.mFallbackItemEntry;

    return entry;
  },
  _queryOnlineItemEntry: function cDACLM__queryItem(calEntry, itemURL) {
    let entry = new CalDAVAclItemEntry(calEntry);

    let propfind = ("<?xml version='1.0' encoding='UTF-8'?>\n"
                    + "<D:propfind xmlns:D='DAV:'><D:prop><D:current-user-privilege-set/></D:prop></D:propfind>");

    let callback = function(status, url, headers, response, data, synchronous) {
      if (status == 207) {
        let xParser = new DOMParser();
        let queryDoc = xParser.parseFromString(response, "application/xml");
        entry.userPrivileges = this._parsePrivileges(queryDoc);
      }
      else {
        Components.utils.reportError("CalDAVACLManager.js: online item entry could not be fetched: status = " + response["status"]);
        entry = null;
      }
    };

    let response = this.xmlRequest(itemURL, "PROPFIND", propfind,
                                   {'content-type': "application/xml; charset=utf-8",
                                    'depth': "0"},
                                   {'method': callback}, true);

    return entry;
  },

  onDAVQueryComplete: function cDACLM_onDAVQueryComplete(status, url, headers, response, data, synchronous) {
    /* Warning, the url returned as parameter is not always the calendar URL
       since we also query user principals and items. */
    if (status > 498) {
      dump("an anomally occured during request '" + data.method + "'.\n" + "  Code: " + status + "\n");
      data.listener.onOperationComplete(data.calendar,
                                        Components.results.NS_ERROR_FAILURE,
                                        Components.interfaces.calIOperationListener.GET,
                                        null, null);
    }
    else if (status > 399) {
      this._markWithNoAccessControl(data);
    }
    else {
      if (data.method) {
        //dump("data.method: " + data.method  + "\n");
        //if (data.who) {
        //    dump("  data.who: " + data.who  + "\n");
        //}
        let method = null;
        if (typeof(data.method) == "string") {
          let strMethods = {
            "acl-options": "_optionsCallback",
            "collection-set": "_collectionSetCallback",
            "principal-match": "_principalMatchCallback",
            "user-address-set": "_userAddressSetCallback"
          };
          method = this[strMethods[data.method]];
        }
        else if (typeof(data.method) == "function") {
          method = data.method;
        }
        if (method) {
          method.apply(this, [status, url, headers, response, data, synchronous]);
        }
        else {
          dump("no method\n");
        }
      }
    }
  },

  _notifyListenerSuccess: function cDACLM__notifyListenerSuccess(listener, calendar, entry) {
    listener.onOperationComplete(calendar, Components.results.NS_OK,
                                 Components.interfaces.calIOperationListener.GET,
                                 null,
                                 entry);
  },
  _markWithNoAccessControl: function cDACLM__markWithNoAccessControl(data) {
    // dump("no accesscontrol: " + cal.STACK() + "\n");
    let entry = data.entry;
    entry.hasAccessControl = false;
    this.mOfflineManager.setCalendarEntry(data.calendar, entry, null);
    this._notifyListenerSuccess(data["listener"], data["calendar"], entry);
  },
  _queryCalendarEntry: function cDACLM__queryCalendarEntry(calendar, listener) {
    let this_ = this;
    let offlineListener = {
      onOperationComplete: function cDACLM__queryCalendarEntry_oL_onOperationComplete(opCalendar, opStatus, opEntry) {
        dump("onOperationComplete 2\n");
        
        if (this_.isOffline) {
          if (Components.isSuccessCode(opStatus)) {
            //dump("acl-manager: received calendar entry from db\n");
            opEntry.aclManager = this_.wrappedJSObject;
            this_._notifyListenerSuccess(listener, opCalendar, opEntry);
          }
          else {
            //dump("acl-manager: we did not receive calendar entry from db + offline -> error\n");
            listener.onOperationComplete(opCalendar,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.GET,
                                         null, null);
          }
        } else {
          //dump("acl-manager: we did not receive calendar entry from db -> online query\n");
          //dump("acl-manager: we are online, let's refresh the ACLs\n");
          let entry = new CalDAVAclCalendarEntry(calendar, this_);
          this_._queryOnlineCalendarEntry(entry, listener, false);
        }
      }
    };
    this.mOfflineManager.getCalendarEntry(this, calendar, offlineListener);
  },
  _queryOnlineCalendarEntry: function cDACLM__queryOnlineCalendarEntry(entry, listener, synchronous) {
    /* Steps:
     * 1. acl-options
     * 2. collection-set
     * 3. user-address-set (owner) or markWithNoAccessControl
     * 4. principal-match
     * 5. user-address-set (user)
     */

    let data = {method: "acl-options", calendar: entry.calendar, entry: entry, listener: listener};
    let url = fixURL(entry.calendar.uri.spec);
    this.xmlRequest(url, "OPTIONS", null, null, data, synchronous);
  },
  _optionsCallback: function cDACLM__optionsCallback(status, url, headers, response, data, synchronous) {
    let dav = headers["dav"];
    // dump("options callback: " + url +  " HTTP/1.1 " + status + "\n");
    // dump("headers:\n");
    // for (let k in headers)
    // dump("  " + k + ": " + headers[k] + "\n");
    let calURL = fixURL(url);
    // dump("dav: " + dav + "\n");
    if (dav && dav.indexOf("access-control") > -1) {
      let newData = cloneData(data);
      newData["entry"].hasAccessControl = true;
      let propfind = ("<?xml version='1.0' encoding='UTF-8'?>\n"
                      + "<D:propfind xmlns:D='DAV:'><D:prop><D:principal-collection-set/><D:owner/><D:current-user-privilege-set/></D:prop></D:propfind>");
      newData["method"] = "collection-set";
      this.xmlRequest(url, "PROPFIND", propfind,
                      {'content-type': "application/xml; charset=utf-8",
                       'depth': "0"},
                      newData, synchronous);
    }
    else
      this._markWithNoAccessControl(data);
  },
  _collectionSetCallback: function cDACLM__collectionSetCallback(status, url, headers, response, data, synchronous) {
    if (status == 207) {
      let calURL = fixURL(url);
      let xParser = new DOMParser();
      let queryDoc = xParser.parseFromString(response, "application/xml");
      let nodes = queryDoc.getElementsByTagNameNS("DAV:", "principal-collection-set");
      let address = "";

      if (nodes.length) {
        let node = nodes[0];
        let subnodes = node.childNodes;
        for (let i = 0; i < subnodes.length; i++) {
          if (subnodes[i].nodeType
              == Node.ELEMENT_NODE) {
            let value = subnodes[i].childNodes[0].nodeValue;
            //dump("value = " + value + "\n");
            if (value.indexOf("/") == 0) {
              dump("about to clone uri: " + data["calendar"].uri + "\n");
              //let clone = data["calendar"].uri.clone();
              //dump("close.spec = " +  clone.spec + "\n");
              //clone.path = value;
              //address = clone.spec;
              address = data["calendar"].uri.prePath + value;
            }
            else
              address = value;
          }
        }

        nodes = queryDoc.getElementsByTagNameNS("DAV:", "owner");
        if (nodes.length) {
          //                     dump("owner nodes: " + nodes.length + "\n");
          let subnodes = nodes[0].childNodes;
          for (let i = 0; i < subnodes.length; i++) {
            if (subnodes[i].nodeType
                == Node.ELEMENT_NODE) {
              let owner;
              let value = subnodes[i].childNodes[0].nodeValue;
              if (value.indexOf("/") == 0) {
                //let clone = data["calendar"].uri.clone();
                //clone.path = value;
                //owner = clone.spec;
                owner = data["calendar"].uri.prePath + value;
              }
              else
                owner = value;
              let fixedURL = fixURL(owner);

              let newData = cloneData(data);
              newData["entry"].ownerPrincipal = fixedURL;
              let propfind = ("<?xml version='1.0' encoding='UTF-8'?>\n"
                              + "<D:propfind xmlns:D='DAV:' xmlns:C='urn:ietf:params:xml:ns:caldav'><D:prop><C:calendar-user-address-set/><D:displayname/></D:prop></D:propfind>");
              newData["method"] = "user-address-set";
              newData["who"] = "owner";
              this.xmlRequest(fixedURL, "PROPFIND", propfind,
                              {'content-type': "application/xml; charset=utf-8",
                               'depth': "0"},
                              newData, synchronous);
            }
          }
        }
        if (address && address.length) {
          let newData = cloneData(data);
          newData["entry"].userPrivileges = this._parsePrivileges(queryDoc);
          let report = ("<?xml version='1.0' encoding='UTF-8'?>\n"
                        + "<D:principal-match xmlns:D='DAV:'><D:self/></D:principal-match>");
          newData["method"] = "principal-match";
          this.xmlRequest(address, "REPORT", report,
                          {'depth': "0",
                           'content-type': "application/xml; charset=utf-8" },
                          newData, synchronous);
        }
        else
          this._markWithNoAccessControl(data);
      }
      else {
        // dump("response: " + response + "\n");
        // dump("nodes: " + nodes + "\n");
        this._markWithNoAccessControl(data);
      }
    }
  },
  _principalMatchCallback: function cDACLM__principalMatchCallback(status, url, headers, response, data, synchronous) {
    if (status == 207) {
      let xParser = new DOMParser();
      let queryDoc = xParser.parseFromString(response, "application/xml");
      let hrefs = queryDoc.getElementsByTagNameNS("DAV:", "href");
      let principals = [];

      data["entry"].userPrincipals = principals;
      for (let i = 0; i < hrefs.length; i++) {
        let href = "" + hrefs[i].childNodes[0].nodeValue;
        if (href.indexOf("/") == 0) {
          //let clone = data.calendar.uri.clone();
          //clone.path = href;
          //href = clone.spec;
          href = data.calendar.uri.prePath + href;
        }

        let fixedURL = fixURL(href);
        let propfind = ("<?xml version='1.0' encoding='UTF-8'?>\n"
                        + "<D:propfind xmlns:D='DAV:' xmlns:C='urn:ietf:params:xml:ns:caldav'><D:prop><C:calendar-user-address-set/><D:displayname/></D:prop></D:propfind>");

        let newData = cloneData(data);
        newData["method"] = "user-address-set";
        newData["who"] = "user";
        this.xmlRequest(fixedURL, "PROPFIND", propfind,
                        {'content-type': "application/xml; charset=utf-8",
                         'depth': "0"},
                        newData, synchronous);
        principals.push(fixedURL);
      }
    }
    else if (status == 501) {
      dump("CalDAV: Server does not support ACLs\n");
      this._markWithNoAccessControl(data);
    }
  },
  _userAddressSetCallback: function cDACLM__userAddressSetCallback(status, url, headers, response, data, synchronous) {
    if (status == 207) {
      let entry = data["entry"];
      let xParser = new DOMParser();
      let queryDoc = xParser.parseFromString(response, "application/xml");

      let addressValues = this._parseCalendarUserAddressSet(queryDoc, data.calendar);

      let addressesKey = data.who + "Addresses";
      let identitiesKey = data.who + "Identities";

      dump("\n\n\n\n\n\n\nurl: " + url + " addressesKey: " + addressesKey + " identitiesKey: " + identitiesKey + "\n");

      let addresses = entry[addressesKey];
      if (!addresses) {
        // dump("new addresses\n");
        addresses = [];
        entry[addressesKey] = addresses;
      }
      for (let address in addressValues) {
        if (addresses.indexOf(address) == -1) {
          // dump("added address '" + address + "'\n");
          addresses.push(address);
        }
      }

      dump("identities for calendar: " + data.calendar + "\n");
      dump("  type: " + data.who + "\n");
      let identities = entry[identitiesKey];
      if (!identities) {
        //dump("new identities\n");
        identities = [];
        entry[identitiesKey] = identities;
      }

      let displayName = this._parsePrincipalDisplayName(queryDoc);
      if (displayName != null) {
        for (let address in addressValues) {
          if (address.search("mailto:", "i") == 0) {
            this._appendIdentity(identities, displayName,
                                 address.substr(7), entry);
          }
        }
      }

      if (entry.nbrAddressSets) {
        this.mOfflineManager.setCalendarEntry(data["calendar"], entry, null);
        this._notifyListenerSuccess(data["listener"], data["calendar"], entry);
      } else {
        entry.nbrAddressSets = 1;
      }
    }
  },
  _initAccountMgr: function cDACLM__initAccountMgr() {
    //this.accountMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
    //                            .getService(Components.interfaces.nsIMsgAccountManager);
    let defaultAccount = MailServices.accounts.defaultAccount;
    
    //let identities = this.accountMgr.allIdentities.enumerate().QueryInterface(Components.interfaces.nsISimpleEnumerator);
    let identities = MailServices.accounts.allIdentities;
    let values = [];
    let current = 0;
    let max = 0;

    // We get the identities we use for mail accounts. We also
    // get the highest key which will be used as the basis when
    // adding new identities (so we don't overwrite keys...)
    //while (identities.hasMoreElements()) {
    //  let identity = identities.getNext().QueryInterface(Components.interfaces.nsIMsgIdentity);
    for (let identity of identities) {
      if (identity.key.indexOf("caldav_") == 0) {
        if (identity.email) {
          values.push(identity.key);
          current = parseInt(identity.key.substring(7));
          if (current > max)
            max = current;
        } else {
          //dump("CalDAVACLManager._initAccountMgr: removing stale"
          //     + " identity '" + identity.key + "'\n");
          defaultAccount.removeIdentity(identity);
        }
      }
    }
    this.identityCount = max + 1;

    // We now remove every other caldav_ pref other than the ones we
    // use in our mail accounts.
    let prefBranch = Services.prefs.getBranch("mail.identity.");
    let prefs = prefBranch.getChildList("", {});
    for (let pref of prefs) {
      if (pref.indexOf("caldav_") == 0) {
        let key = pref.substring(0, pref.indexOf("."));
        if (values.indexOf(key) < 0) {
          //dump("CalDAVACLManager._initAccountMgr: removing useless"
          //     +" identity branch: '" + key + "'\n");
          prefBranch.deleteBranch(key);
        }
      }
    }
  },
  _findIdentity: function cDACLM__findIdentity(email, displayName) {
    let identity = null;
    let lowEmail = email.toLowerCase();
    let lowDisplayName = displayName.toLowerCase();

    //let identities = this.accountMgr.allIdentities.enumerate().QueryInterface(Components.interfaces.nsISimpleEnumerator);
    let identities = MailServices.accounts.allIdentities;

    //while (!identity && identities.hasMoreElements()) {
    //    let currentIdentity = identities.getNext()
    //                                    .QueryInterface(Components.interfaces.nsIMsgIdentity);
    for (let currentIdentity of identities) {
      if (currentIdentity.email.toLowerCase() == lowEmail
          && currentIdentity.fullName.toLowerCase() == lowDisplayName) {
        identity = currentIdentity;
        break;
      }
    }

    // dump("identity for " + email + ": " + identity + "\n");
    return identity;
  },
  _identitiesHaveEmail: function cDACLM__identitiesHaveEmail(identities, email) {
    let haveEmail = false;
    let lowEmail = email.toLowerCase();

    let i = 0;
    while (!haveEmail && i < identities.length) {
      if (identities[i].email.toLowerCase() == lowEmail)
        haveEmail = true;
      else
        i++;
    }

    return haveEmail;
  },

  _appendIdentity: function cDACLM__appendIdentity(identities, displayName, email, calendar) {
    if (!this.accountMgr)
      this._initAccountMgr();

    let newIdentity = this._findIdentity(email, displayName);
    if (!newIdentity) {
      newIdentity = Components.classes["@mozilla.org/messenger/identity;1"]
        .createInstance(Components.interfaces.nsIMsgIdentity);
      newIdentity.key = "caldav_" + this.identityCount;
      //newIdentity.identityName = String(displayName + " <" + email + ">");
      newIdentity.fullName = String(displayName);
      newIdentity.email = String(email);
      // dump("added for " + email + ": " + newIdentity + "\n");

      // We add identities associated to this calendar to Thunderbird's
      // list of identities only if we are actually the owner of the calendar.
      //if (calendar.userIsOwner) {
      // this.accountMgr.defaultAccount.addIdentity(newIdentity);
      //}
      this.identityCount++;
    }

    if (!this._identitiesHaveEmail(identities, email))
      identities.push(newIdentity);
  },
  _parseCalendarUserAddressSet: function cDACLM__parseCalendarUserAddressSet(queryDoc, calendar) {
    let values = {};
    let nodes = queryDoc.getElementsByTagNameNS("urn:ietf:params:xml:ns:caldav",
                                                "calendar-user-address-set");
    for (let i = 0; i < nodes.length; i++) {
      let childNodes = nodes[i].childNodes;
      for (let j = 0; j < childNodes.length; j++) {
        if (childNodes[j].nodeType
            == Node.ELEMENT_NODE) {
          let value = "" + childNodes[j].childNodes[0].nodeValue;
          let address;
          if (value.indexOf("/") == 0) {
            //let clone = calendar.uri.clone();
            //clone.path = value;
            //address = "" + clone.spec;
            address = calendar.uri.prePath + value;
          }
          else
            address = value;
          values[address] = true;
        }
      }
    }

    return values;
  },
  _parsePrincipalDisplayName: function cDACLM__parsePrincipalDisplayName(queryDoc) {
    let displayName;

    let nodes = queryDoc.getElementsByTagNameNS("DAV:", "displayname");
    if (nodes.length) {
      displayName = "";
      let childNodes = nodes[0].childNodes;
      // dump ( "childNodes: " + childNodes.length + "\n");
      for (let i = 0; i < childNodes.length; i++) {
        if (childNodes[i].nodeType
            == Node.TEXT_NODE)
          displayName += xmlUnescape(childNodes[i].nodeValue);
      }
    }
    else
      displayName = null;

    return displayName;
  },

  /* component controller */
  _parsePrivileges: function cDACLM__parsePrivileges(queryDoc) {
    let privileges = [];
    let nodes = queryDoc.getElementsByTagNameNS("DAV:", "privilege");
    for (let i = 0; i < nodes.length; i++) {
      let subnodes = nodes[i].childNodes;
      for (let j = 0; j < subnodes.length; j++)
        if (subnodes[j].nodeType
            == Node.ELEMENT_NODE) {
          let ns = subnodes[j].namespaceURI;
          let tag = subnodes[j].localName;
          let privilege = "{" + ns + "}" + tag;
          // dump(arguments.callee.caller.name + " privilege: " + privilege + "\n");
          privileges.push(privilege);
        }
    }

    return privileges;
  },

  xmlRequest: function cDACLM_xmlRequest(url, method, body, headers, data, synchronous) {
    //let channel = Services.io.newChannelFromURIWithLoadInfo(Services.io.newURI(url, null, null), null);

    
    let channel = Services.io.newChannelFromURI(
      Services.io.newURI(url, null, null),
      null,
      Services.scriptSecurityManager.getSystemPrincipal(),
      null,
      Components.interfaces.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_IS_NULL,
      Components.interfaces.nsIContentPolicy.TYPE_OTHER);

    let httpChannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);
    httpChannel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;

    let callbacks = {
      getInterface: cal.provider.InterfaceRequestor_getInterface
    };
    httpChannel.notificationCallbacks = callbacks;

    httpChannel.setRequestHeader("accept", "text/xml", false);
    httpChannel.setRequestHeader("accept-charset", "utf-8,*;q=0.1", false);
    if (headers) {
      for (let header in headers) {
        httpChannel.setRequestHeader(header, headers[header], true);
      }
    }

    if (body) {
      let converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
          .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
      converter.charset = "UTF-8";
      let stream = converter.convertToInputStream(body);
      let contentType = headers["content-type"];
      if (!contentType) {
        contentType = "text/plain; charset=utf-8";
      }
      httpChannel = httpChannel.QueryInterface(Components.interfaces.nsIUploadChannel);
      httpChannel.setUploadStream(stream, contentType, -1);
    }

    httpChannel.requestMethod = method;

    let this_ = this;
    let listener = {
      onStreamComplete: function cDACLM_xmlRequest_l_onStreamComplete(aLoader, aContext, aStatus, aResultLength, aResult) {
        // dump("onStreamComplete...\n");
        let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
        let response = this_._transformResponse(request, aResult, aResultLength);
        this_.onDAVQueryComplete(response["status"], url, response["headers"], response["body"], data, synchronous);
      }
    };

    if (synchronous) {
      let inStream = httpChannel.open();
      let byteStream = Components.classes["@mozilla.org/binaryinputstream;1"]
          .createInstance(Components.interfaces.nsIBinaryInputStream);
      byteStream.setInputStream(inStream);
      let resultLength = 0;
      let result = "";
      let lenBytes;
      while ((lenBytes = inStream.available())) {
        resultLength += lenBytes;
        result += byteStream.readBytes(lenBytes);
      }
      listener.onStreamComplete({ request: httpChannel }, null, null, resultLength, result);
    }
    else {
      let loader = Components.classes["@mozilla.org/network/stream-loader;1"]
          .createInstance(Components.interfaces.nsIStreamLoader);
      loader.init(listener);
      /* If set too early, the method can change to "PUT" when initially set to "PROPFIND"... */
      httpChannel.asyncOpen(loader, httpChannel);
    }

    return null;
  },
  _transformResponse: function cDACLM__transformResponse(request, aResult, aResultLength) {
    let status;
    try {
      status = request.responseStatus;
      if (status == 0) {
        status = 499;
      }
    }
    catch(e) {
      dump("CalDAVACLManager: trapped exception: "
           + e + "\n");
      status = 499;
    }
    let responseText = "";
    let responseHeaders = {};
    try {
      if (status == 499) {
        dump("xmlRequest: received status 499 for url: " + url + "; method: " + method + "\n");
      }
      else {
        if (aResultLength > 0) {
          if (typeof(aResult) == "string") {
            responseText = aResult;
          }
          else {
            let byteArray = new Uint8Array(aResult);
            responseText = (new TextDecoder("UTF-8")).decode(byteArray);
          }
        }
        let visitor = {};
        visitor.visitHeader = function(aHeader, aValue) {
          let key = aHeader.toLowerCase();
          responseHeaders[key] = aValue.replace(/(^[ 	]+|[ 	]+$)/, "", "g");
        };
        request.visitResponseHeaders(visitor);
      }
    }
    catch(e) {
      dump("CalDAVAclManager.js: an exception occured\n" + e + "\n"
           + e.fileName + ":" + e.lineNumber + "\n"
           + "url: " + request.url + "\n");
    }

    return { "status": status, "headers": responseHeaders, "body": responseText };
  },

  refreshCalendarEntry: function cDACLM_refreshCalendarEntry(calEntry) {
    /* The asynchronous design of the "refresh" methods unfortunately
       cause a double fetch of the calendar entry data, one when invoking
       getCalendarEntry and another when invoking "refresh". */

    let url = fixURL(calEntry.calendar.uri.spec);
    this.mOfflineManager.dropCalendarEntry(url);

    let this_ = this;
    let listener = {
      onGetResult: function(opCalendar, opStatus, opItemType, opDetail, opCount, opItems) {
        ASSERT(false, "unexpected!");
      },
      onOperationComplete: function cDACLM_l_onOperationComplete(opCalendar, opStatus, opType, opId, opDetail) {
        dump("onOperationComplete 3\n");
        // dump("refresh backtrace: " + cal.STACK(30) + "\n");
        if (!Components.isSuccessCode(opStatus)) {
          this_._makeFallbackCalendarEntry(calEntry);
        }
      }
    };

    this._queryOnlineCalendarEntry(calEntry, listener, true);
  },

  /* nsISupports */
  QueryInterface: function cDACLM_QueryInterface(aIID) {
    return doQueryInterface(this, CalDAVACLManager.prototype, aIID, null, this);
  }
  //QueryInterface: XPCOMUtils.generateQI([Components.interfaces.CalDAVACLManager])
};

function CalDAVAclCalendarEntry(calendar, manager) {
  if (manager) {
    this.aclManager = manager.wrappedJSObject;
  }
  this.calendar = calendar;
  this.uri = calendar.uri;
  this.entries = {};
  this.userPrivileges = [];
  this.wrappedJSObject = this;
  this.dirty = false;
}

CalDAVAclCalendarEntry.prototype = {
  aclManager: null,
  calendar: null,
  uri: null,
  entries: null,
  hasAccessControl: false,
  userPrivileges: null,
  userAddresses: null,
  userPrincipals: null,
  ownerAddresses: null,
  ownerPrincipal: null,
  userIdentities: null,
  ownerIdentities: null,
  nbrAddressSets: null,
  dirty: false,

  get userIsOwner() {
    let result = false;

    if (this.hasAccessControl) {
      let i = 0;
      while (!result && typeof(this.userPrincipals) != "undefined" && this.userPrincipals && i < this.userPrincipals.length) {
        //                 dump("user: " + this.userPrincipals[i] + "\n");
        if (this.userPrincipals[i] == this.ownerPrincipal)
          result = true;
        else
          i++;
      }
    }
    else
      result = true;

    // dump("userIsOwner: " + result + "\n");

    return result;
  },
  get userCanAddItems() {
    // dump("has access control: " + this.hasAccessControl + "\n");
    // dump("indexof bind: "
    //      + this.userPrivileges.indexOf("{DAV:}bind") + "\n");
    let result = (this.userIsOwner
                  || (this.userPrivileges.indexOf("{DAV:}bind")
                      > -1));
    // dump("userCanAddItems: " + result + "\n");
    // dump("  userPrivileges: " + this.userPrivileges + "\n");

    return result;
  },
  get userCanDeleteItems() {
    // dump("has access control: " + this.hasAccessControl + "\n");
    // if (this.userPrivileges)
    // dump("indexof unbind: "
    //      + this.userPrivileges.indexOf("{DAV:}unbind") + "\n");
    let result = (this.userIsOwner
                  || (this.userPrivileges.indexOf("{DAV:}unbind")
                      > -1));
    // dump("userCanDeleteItems: " + result + "\n");

    return result;
  },

  // _getEntries: function _getEntries(entries, outCount) {
  //     if (!entries) {
  //         entries = [];
  //     }
  //     outCount.value = entries.length;

  //     return entries;
  // },
  getUserAddresses: function getUserAddresses(outCount) {
    //return this._getEntries(this.userAddresses, outCount);
    return this.userAddresses;
  },
  getUserIdentities: function getUserAddresses(outCount) {
    //return this._getEntries(this.userIdentities, outCount);
    return this.userIdentities;
  },
  getOwnerIdentities: function getUserAddresses(outCount) {
    //return this._getEntries(this.ownerIdentities, outCount);
    return this.ownerIdentities;
  },

  refresh: function refresh() {
    this.entries = {};
    this.userPrivileges = [];
    this.userAddresses = null;
    this.userPrincipals = null;
    this.userIdentities = null;
    this.ownerAddresses = null;
    this.ownerPrincipal = null;
    this.ownerIdentities = null;
    this.nbrAddressSets = 0;

    /* we need to flush the item cache from the storage provider caches otherwise getItems will return items with an obsolete ACL entry */
    let jsCalendar = this.calendar.wrappedJSObject;
    let parentCalendar = jsCalendar.superCalendar.wrappedJSObject;
    if (parentCalendar.mCachedCalendar) { /* using calStorageCalendar */
      let storageCalendar = parentCalendar.mCachedCalendar.wrappedJSObject;
      if (storageCalendar.mItemCache) {
        storageCalendar.mItemCache = {};
        dump("emptied cache from storage calendar\n");
      }
      if (storageCalendar.mRecEventCache) {
        storageCalendar.mRecEventCache = {};
      }
      if (storageCalendar.mRecTodoCache) {
        storageCalendar.mRecTodoCache = {};
      }
    }
    else { /* using calMemoryCalendar */
      let offlineStorage = jsCalendar.mOfflineStorage;
      if (offlineStorage) {
        offlineStorage = offlineStorage.wrappedJSObject;
        if (offlineStorage.mItems)  {
          offlineStorage.mItems = {};
          dump("emptied cache from memory calendar\n");
        }
      }
    }

    this.aclManager.refreshCalendarEntry(this);
  },

  /* nsISupports */
  QueryInterface: function(aIID) {
    return doQueryInterface(this, null,
                            aIID, [Components.interfaces.calICalendarACLEntry],
                            null);
  }
};

function CalDAVAclItemEntry(calEntry) {
  if (!calEntry) {
    dump("calEntry is NULL\n" + cal.STACK() + "\n");
  }
  this.calendarEntry = calEntry;
  this.userPrivileges = [];
  this.wrappedJSObject = this;
}

CalDAVAclItemEntry.prototype = {
  calendarEntry: null,
  userPrivileges: null,

  get userCanModify() {
    // dump("userCanModify\n");
    // dump("this.userPrivileges: " + this.userPrivileges + "\n");
    // dump("this.calendarEntry.userPrivileges: "
    // + this.calendarEntry.userPrivileges + "\n");

    if (this.calendarEntry.userIsOwner) {
      return true;
    }

    return (this.userPrivileges.indexOf("{DAV:}write") > -1);
  },
  get userCanRespond() {
    // dump("userCanRespond\n");
    return (this.calendarEntry.userIsOwner
            || (this.userPrivileges.indexOf("{urn:inverse:params:xml:ns:inverse-dav}respond-to-component") > -1));
  },
  get userCanViewAll() {
    // dump("userCanViewAll\n");
    return (this.calendarEntry.userIsOwner
            ||  (this.userPrivileges.indexOf("{urn:inverse:params:xml:ns:inverse-dav}view-whole-component") > -1));
  },
  get userCanViewDateAndTime() {
    // dump("userCanViewDateAndTime\n");
    return (this.calendarEntry.userIsOwner
            || (this.userPrivileges.indexOf("{urn:inverse:params:xml:ns:inverse-dav}view-date-and-time") > -1));
  },

  /* nsISupports */
  //QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calIItemACLEntry])
  QueryInterface: function(aIID) {
    return doQueryInterface(this, null,
                            aIID, [Components.interfaces.calIItemACLEntry],
                            null);
  }
};
