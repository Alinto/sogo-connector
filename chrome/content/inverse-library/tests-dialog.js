/* tests-dialog.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2010
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

var baseURL =
  "http://evariste.inverse.ca/SOGo/dav/wsourdeau/Contacts/personal/";

function jsInclude(files, target) {
  var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
    .getService(Components.interfaces.mozIJSSubScriptLoader);
  for (var i = 0; i < files.length; i++) {
    try {
      loader.loadSubScript(files[i], target);
    }
    catch(e) {
      dump("tests-dialog.js: failed to include '" + files[i] + "'\n" + e + "\n");
    }
  }
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js"]);

function onTestDialogLoad() {
  var methods = [ "GET", "PUT", "PROPFIND", "REPORT", "POST", "MKCOL",
		  "DELETE", "PROPPATCH" ];
  var vbox = document.getElementById("buttons");
  for (var method of methods) {
      var button = document.createElement("button");
      button.setAttribute("label", "test " + method);
      button.style.margin = "5px;";
      var methodName = "test" + method;
      if (window[methodName])
	button.addEventListener("click", window[methodName], false);
      else
	button.setAttribute("disabled", "true");
      vbox.appendChild(button);
    }
}

function expectCode(received, expected) {
  if (received == expected)
    dump("* return code passed\n");
  else
    dump("** return code expected = " + expected
	 + "; received = " + received + "\n");
}

function expectString(label, received, expected) {
  if (expected) {
    if (received == expected)
      dump("* " + label + " passed\n");
    else
      dump("** " + label + "\n  expected:\n" + expected
	   + "\n  received:\n" + received + "\n");
  }
  else
    dump("* " + label + " ignored\n");
}

function showHeaders(headers) {
  dump("* headers:\n");

  for (var h in headers) {
    dump(h + ": '" + headers[h] + "'\n");
  }
}

function showObject(object, indent) {
  if (typeof indent == "undefined")
    indent = 0;
  var spaces = "";
  for (var i = 0; i < indent; i++) {
    spaces += "  ";
  }
  for (var x in object) {
    dump(spaces + x + ": ");
    var obj = object[x];
    if (typeof obj == "object") {
      dump("{\n");
      showObject(obj, indent + 1);
      dump(spaces + "}\n");
    }
    else
      dump(obj + "\n");
  }
}

function testListener(title, code, response, data) {
  this.title = title;
  this.code = code;
  this.response = response;
  this.data = data;
}

testListener.prototype = {
 onDAVQueryComplete: function(code, response, headers, data) {
    dump(this.title + " start:\n");
    expectCode(code, this.code);
    showHeaders(headers);
    expectString("response", response, this.response);
    expectString("data", data, this.data);
    dump(this.title + " end\n\n");
  }
};

function testPropfindListener(title, code, response, data) {
  this.title = title;
  this.code = code;
  this.response = response;
  this.data = data;
}

testPropfindListener.prototype = {
 onDAVQueryComplete: function(code, response, headers, data) {
    dump(this.title + " start:\n");
    expectCode(code, this.code);
//     showHeaders(headers);
    dump("propfind response:\n");
    showObject(response);
//     expectString("response", response, this.response);
    expectString("data", data, this.data);
    dump(this.title + " end\n\n");
  }
};

function testGET() {
  var existingCard = "543D-488F8A00-11-4D6350E0.vcf";
  var unexistingCard = "thiscarddoesnotexists.blabla";

  var cbData = "poildru";
  var cardContent = ("BEGIN:VCARD\r\n"
		     + "UID:543D-488F8A00-11-4D6350E0.vcf\r\n"
		     + "VERSION:3.0\r\n"
		     + "N:prenom;nom\r\n"
		     + "FN:nom prenom\r\n"
		     + "END:VCARD");

  var getListener
    = new testListener("existing get", 200, cardContent, cbData);
  var wd = new sogoWebDAV(baseURL + existingCard, getListener, cbData);
  wd.get();

  getListener = new testListener("non-existing get", 404, null);
  wd = new sogoWebDAV(baseURL + unexistingCard, getListener);
  wd.get();
}

function testPUT() {
  var newCard = "newTestCard.vcf";

  var cbData = "poildru";
  var cardContent = ("BEGIN:VCARD\r\n"
		     + "UID:inverse.ca-testCard\r\n"
		     + "VERSION:3.0\r\n"
		     + "N:prenom;nom\r\n"
		     + "FN:nom prenom\r\n"
		     + "END:VCARD");

  var putListener = new testListener("new put", 201, null, cbData);
  var wd = new sogoWebDAV(baseURL + newCard, putListener, cbData);
  wd.put(cardContent);

  var updatedContent = ("BEGIN:VCARD\r\n"
			+ "UID:inverse.ca-testCard\r\n"
			+ "VERSION:3.0\r\n"
			+ "N:prenom;nom\r\n"
			+ "FN:nom prenom\r\n"
			+ "END:VCARD");

  var putListener2 = new testListener("updated put", 204, "", cbData);
  var wd = new sogoWebDAV(baseURL + newCard, putListener2, cbData);
  wd.put(updatedContent);
}

function testPROPFIND() {
  var pfListener1 = new testPropfindListener("deep propfind", 207);
  var wd1 = new sogoWebDAV(baseURL, pfListener1);
  wd1.propfind(["DAV: displayname", "DAV: owner"]);

  var pfListener2 = new testPropfindListener("non-deep propfind", 207);
  var wd2 = new sogoWebDAV(baseURL, pfListener2);
  wd2.propfind(["DAV: displayname", "DAV: owner"], false);
}

window.addEventListener("load", onTestDialogLoad, false);
