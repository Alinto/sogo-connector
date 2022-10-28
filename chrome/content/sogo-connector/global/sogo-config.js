/* sogo-config.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

var sogoConfig = { username: null, baseURL: null };

function sogoUserName() {
  if (!sogoConfig['username']) {
    var mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
	.getService(Components.interfaces.nsIMsgAccountManager);

    var useEmail = false;
    try {
      useEmail = Services.prefs.getBoolPref("sogo-connector.identification.use_email_address");
    }
    catch(e) {
      useEmail = false;
    }
    try {
      if (useEmail)
	      sogoConfig['username'] = mgr.defaultAccount.defaultIdentity.email;
      else
        sogoConfig['username'] = mgr.defaultAccount.incomingServer.username;
    }
    catch(e) {
      sogoConfig['username'] = "";
    }
  }

  return sogoConfig['username'];
}

function sogoHostname() {
  var hostnameArray;
  var baseURL;

  baseURL = sogoBaseURL();
  hostnameArray = baseURL.split("/");

  return hostnameArray[0] + "//" + hostnameArray[2];
}

function sogoBaseURL() {
  if (!sogoConfig['baseURL']) {
    let prefix = Services.prefs.getCharPref("sogo-connector.baseURL");
    sogoConfig['baseURL'] = (prefix + "/dav/" + sogoUserName() + "/");
  }

  return sogoConfig['baseURL'];
}
