/* creation-utils.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

function jsInclude(files, target) {
  var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader);
  for (var i = 0; i < files.length; i++) {
    try {
      loader.loadSubScript(files[i], target);
    }
    catch(e) {
      dump("creation-utils.js: failed to include '" + files[i] + "'\n" + e + "\n");
    }
  }
}

jsInclude(["chrome://sogo-connector/content/global/sogo-config.js",
	   "chrome://inverse-library/content/sogoWebDAV.js",
	   "chrome://inverse-library/content/uuid.js"]);

function createOperation(folderURL, displayName, handler) {
  this.folderURL = folderURL;
  this.displayName = displayName;
  this.handler = handler;
}

createOperation.prototype = {
  start: function cO_start() {
    this.onDAVQueryComplete = this.onMkColQueryComplete;
    var mkcol = new sogoWebDAV(this.folderURL, this, undefined, undefined, true);
    mkcol.mkcol();
  },

 onDAVQueryComplete: null,
  onMkColQueryComplete: function(status, result) {
    if (status == 201) {
      this.onDAVQueryComplete = this.onPropPatchQueryComplete;
      var proppatch = new sogoWebDAV(this.folderURL, this, undefined, undefined, true);
      proppatch.proppatch("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
			  + "<propertyupdate xmlns=\"DAV:\">"
			  + "<set>"
			  + "<prop><displayname>" + xmlEscape(this.displayName) + "</displayname>"
			  + "</prop></set></propertyupdate>");
    }
  },
  onPropPatchQueryComplete: function(status, jsonResult) {
    if (status == 207) {
      var _this = this;
      var responses = jsonResult["multistatus"][0]["response"];
      responses.forEach(function(response) {
	var url = response["href"][0];
	if (_this.folderURL.indexOf(url) > -1) {
	  var propstats = response["propstat"];
	  propstats.forEach(function(propstat) {
	    if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
	      if (propstat["prop"][0]["displayname"]) {
		var newFolder = {url: _this.folderURL,
				 owner: sogoUserName(),
				 displayName: _this.displayName};
		_this.handler.addDirectories([newFolder]);
	      }
	    }
	  });
	}
      });
    }
  }
};

function createFolder(displayName, handler) {
  //window.setTimeout(_realCreateFolder, 100, displayName, handler);
  _realCreateFolder(displayName, handler);
}

function _realCreateFolder(displayName, handler) {
  var newURL = handler.urlForParentDirectory() + "/" + new UUID() + "/";
  var creation = new createOperation(newURL, displayName, handler);
  creation.start();
}

function deleteFolder(nodeURL, handler) {
  dump("deleteFolder: " + nodeURL + "\n");
  var existingFolder = null;
  var existing = handler.getExistingDirectories();
  for (var url in existing) {
    var oldURL = url;
    if (url[url.length - 1] != '/')
      url = url.concat('/');
    if (url == nodeURL) {
      existingFolder = existing[oldURL];
      break;
    }
  }

  if (existingFolder) {
    // 		dump("found existing\n");
    var target = {};
    target.onDAVQueryComplete = function(status, result) {
      // 			dump("onDavQueryComplette...." + status + "\n");
      if ((status > 199 && status < 400)
	  || status == 404)
	handler.removeDirectories([existingFolder]);
    };

    var deleteOP = new sogoWebDAV(nodeURL, target);
    deleteOP.delete();
  }
  else
    dump("not existing?!\n");
}
