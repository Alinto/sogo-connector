/* sogoWebDAV.js - This file is part of "SOGo Connector".
 *
 * Copyright: Inverse inc., 2006-2020
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
var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");

try { Components.utils.importGlobalProperties(["TextDecoder", "TextEncoder", "DOMParser", "Node"]); } catch(e) {}

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("sogoWebDAV.js: failed to include '" + files[i] +
                 "'\n" + e
                 + "\nFile: " + e.fileName
                 + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://inverse-library/content/uuid.js"]);

function backtrace(aDepth) {
    let depth = aDepth || 10;
    let stack = "";
    let frame = arguments.callee.caller;

    for (let i = 1; i <= depth && frame; i++) {
        stack += i+": "+ frame.name + "\n";
        frame = frame.caller;
    }

    return stack;
}

function XMLToJSONParser(doc) {
    this._buildTree(doc);
}

XMLToJSONParser.prototype = {
    _buildTree: function XMLToJSONParser_buildTree(doc) {
        let nodeName = doc.documentElement.localName;
        this[nodeName] = [this._translateNode(doc.documentElement)];

        // 		dump("Parsed XMLToJSON object: " + dumpObject(this) + "\n");
    },
    _translateNode: function XMLToJSONParser_translateNode(node) {
        let value = null;

        if (node.childNodes.length) {
            let textValue = "";
            let dictValue = {};
            let hasElements = false;
            for (let i = 0; i < node.childNodes.length; i++) {
                let currentNode = node.childNodes[i];
                let nodeName = currentNode.localName;
                if (currentNode.nodeType
                    == Node.TEXT_NODE) {
                    textValue += currentNode.nodeValue;
                }
                else if (currentNode.nodeType
                         == Node.ELEMENT_NODE) {
                    hasElements = true;
                    let nodeValue = this._translateNode(currentNode);
                    if (!dictValue[nodeName])
                        dictValue[nodeName] = [];
                    dictValue[nodeName].push(nodeValue);
                }
            }

            if (hasElements)
                value = dictValue;
            else
                value = textValue;
        }

        return value;
    }
};

function xmlEscape(text) {
  let s = "";

  if (typeof text == "undefined")
    return s;
  
  for (var i = 0; i < text.length; i++) {
    if (text[i] == "&") {
      s += "&amp;";
    }
    else if (text[i] == "<") {
      s += "&lt;";
        }
    else  {
      let charCode = text.charCodeAt(i);
      if (charCode > 127) {
        s += '&#' + charCode + ';';
      }
      else {
        s += text[i];
      }
    }
  }

  return s;
}

function xmlUnescape(text) {
    let s = (""+text).replace(/&lt;/g, "<", "g");
    s = s.replace(/&gt;/g, ">", "g");
    s = s.replace(/&amp;/g, "&",  "g");

    return s;
}

function sogoWebDAV(url, target, data, synchronous, asJSON) {
    this.url = url;
    this.target = target;
    this.cbData = data;
    if (typeof synchronous == "undefined") {
        this.synchronous = false;
    }
    else {
        this.synchronous = synchronous;
    }
    
    this.requestJSONResponse = false;
    this.requestXMLResponse = false;

    if (typeof asJSON != "undefined") {
        this.requestJSONResponse = asJSON;
        this.requestXMLResponse = !asJSON;
    }
}

sogoWebDAV.prototype = {

  getInterface: cal.provider.InterfaceRequestor_getInterface,

  QueryInterface: function(aIID) {
    if (!aIID.equals(Components.interfaces.nsIProgressEventSink)
        && !aIID.equals(Components.interfaces.nsIInterfaceRequestor))
    {
      //dump("sogoWebDAV.js: No interface for: "  + aIID + "\n");
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  },

  onProgress: function sogoWebDAV_onProgress(aRequest, aContext, aProgress, aProgressMax) {},
  onStatus: function sogoWebDAV_onStatus(aRequest, aContext, aStatus, aStatusArg) {},

  _sendHTTPRequest: function(method, body, headers) {
    let channel = Services.io.newChannelFromURI(
        Services.io.newURI(this.url, null, null),
        null,
        Services.scriptSecurityManager.getSystemPrincipal(),
        null,
        Components.interfaces.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_IS_NULL,
        Components.interfaces.nsIContentPolicy.TYPE_OTHER);

        let httpChannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);
        httpChannel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
        httpChannel.notificationCallbacks = this;
        if (headers && headers.accept) {
            httpChannel.setRequestHeader("accept", headers.accept, false);
            delete headers.accept;
        }
        else {
            httpChannel.setRequestHeader("accept", "text/xml", false);
        }
        httpChannel.setRequestHeader("accept-charset", "utf-8,*;q=0.1", false);
        if (headers) {
            for (let header in headers) {
                httpChannel.setRequestHeader(header, headers[header], true);
            }
        }

        if (body) {
            httpChannel = httpChannel.QueryInterface(Components.interfaces.nsIUploadChannel);
            let converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                      .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
            converter.charset = "UTF-8";
            let stream = converter.convertToInputStream(body);
            let contentType = headers["content-type"];
            if (!contentType) {
                contentType = "text/plain; charset=utf-8";
            }
            httpChannel.setUploadStream(stream, contentType, -1);
        }

        /* If set too early, the method can change to "PUT" when initially set to "PROPFIND"... */
        httpChannel.requestMethod = method;
        if (method == "PUT")
        {
            this.synchronous = true;
        }

        if (method == "DELETE")
        {
            this.synchronous = true;
        }
        if (this.synchronous) {
            let inStream = httpChannel.open();
            let byteStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                                       .createInstance(Components.interfaces.nsIBinaryInputStream);
            byteStream.setInputStream(inStream);
            let resultLength = 0;
            let result = "";
            let le;
            while ((le = inStream.available())) {
                resultLength += le;
                result += byteStream.readBytes(le);
            }
            this._handleHTTPResponse(httpChannel, resultLength, result);
        }
        else {
            let this_ = this;
            let listener = {
                onStreamComplete: function(aLoader, aContext, aStatus, aResultLength, aResult) {
                    this_._handleHTTPResponse(httpChannel, aResultLength, aResult);
                }
            };
            let loader = Components.classes["@mozilla.org/network/stream-loader;1"]
                                   .createInstance(Components.interfaces.nsIStreamLoader);
            loader.init(listener);
            httpChannel.asyncOpen(loader, httpChannel);
        }
    },

    _handleHTTPResponse: function(aChannel, aResultLength, aResult) {
        let status;
        try {
            status = aChannel.responseStatus;
            if (status == 0) {
                status = 499;
            }
        }
        catch(e) {
            dump("sogoWebDAV: trapped exception: " + e + "\n");
            setTimeout("throw new Error('sogoWebDAV could not download calendar. Try disabling proxy server.')",0); 
            status = 499;
        }
        dump("GOT STATUS: " + status + "\n");
        try {
            let headers = {};
            let response = null;
            if (status == 499) {
                dump("xmlRequest: received status 499 for url: " + this.url + "\n");
            }
	    else if (status == 412) {
		dump("xmlRequest: received status 412 - precondition failed for url: " + this.url + "\n");
	    }
            else {
                let visitor = {};
                visitor.visitHeader = function(aHeader, aValue) {
                    let key = aHeader.toLowerCase();
                    let array = headers[key];
                    if (!array) {
                        array = [];
                        headers[key] = array;
                    }
                    array.push(aValue.replace(/(^[ 	]+|[ 	]+$)/, "", "g"));
                };
                aChannel.visitResponseHeaders(visitor);
                if (aResultLength > 0) {
                    let responseText;
                    if (typeof(aResult) == "string") {
                        responseText = aResult;
                    }
                    else {
                        let byteArray = new Uint8Array(aResult);
                        responseText = (new TextDecoder("UTF-8")).decode(byteArray);
                    }
                    if (this.requestJSONResponse || this.requestXMLResponse) {
                        let flatCType = (headers["content-type"] ? headers["content-type"][0] : "");

                        if ((flatCType.indexOf("text/xml") == 0 || flatCType.indexOf("application/xml") == 0)
                            && aResultLength > 0) {
                          let xmlParser = new DOMParser();
                            let responseXML = xmlParser.parseFromString(responseText, "text/xml");
                            if (this.requestJSONResponse) {
                                let parser = new XMLToJSONParser(responseXML);
                                response = parser;
                            }
                            else {
                                response = responseXML;
                            }
                        }
                    }
                    else {
                        response = responseText;
                    }
                }
            }
            if (this.target && this.target.onDAVQueryComplete) {
                this.target.onDAVQueryComplete(status, response, headers, this.cbData);
            }
        }
        catch(e) {
            dump("sogoWebDAV.js: an exception occured\n" + e + "\n"
                 + e.fileName + ":" + e.lineNumber + "\n\nstack: " + e.stack + "\n");
            let uri = aChannel.URI;
            if (uri) {
                dump("url: " + uri.spec + "\n");
            }
        }
    },

    load: function(operation, parameters) {
        if (operation == "GET") {
	    var headers = {};
	    if (parameters.accept !== null) {
		headers.accept = parameters.accept;
	    }
            this._sendHTTPRequest(operation, null, headers);
        }
        else if (operation == "PUT" || operation == "POST") {
	    if(parameters.contentType.indexOf("text/vcard") == 0) {
                if (this.cbData.data.getProperty("groupDavKey", "") == "") {
                    dump("NOTICE: uploading new vcard with empty key\n");
                    this._sendHTTPRequest(operation,
                                      parameters.data,
                                      { "content-type": parameters.contentType,
				        "If-None-Match": "*" });
                }
                else {
                    let oldDavVersion = this.cbData.data.getProperty("groupDavVersionPrev", "-1");
                    dump("NOTICE: uploading modified vcard with etag: " + oldDavVersion + "\n");
                    if (oldDavVersion != "-1") {
                        this._sendHTTPRequest(operation,
                                              parameters.data,
                                              { "content-type": parameters.contentType,
				                "If-Match": oldDavVersion });
                    }
                    else {
                        dump("NOTICE: uploading modified vcard without etag\n");
	                this._sendHTTPRequest(operation,
                                              parameters.data,
					      { "content-type": parameters.contentType,
				              "If-None-Match": "*" });
                    }
                }
	    }
	    else {
	        this._sendHTTPRequest(operation,
                                      parameters.data,
                                      { "content-type": parameters.contentType });
	    }
        }
        else if (operation == "PROPFIND") {
            let headers = { "depth": (parameters.deep
                                      ? "1": "0"),
                            "content-type": "application/xml; charset=utf8" };
            let query = this._propfindQuery(parameters.props);
            this._sendHTTPRequest(operation, query, headers);
        }
        else if (operation == "REPORT") {
            let headers = { "depth": (parameters.deep
                                      ? "1": "0"),
                            "Connection": "TE",
                            "TE": "trailers",
                            "content-type": "application/xml; charset=utf8" };
            this._sendHTTPRequest(operation, parameters.query, headers);
        }
        else if (operation == "MKCOL") {
            this._sendHTTPRequest(operation, parameters);
        }
        else if (operation == "DELETE") {
            this._sendHTTPRequest(operation, parameters);
        }
        else if (operation == "PROPPATCH") {
            let headers = { "content-type": "application/xml; charset=utf8" };
            this._sendHTTPRequest(operation, parameters, headers);
        }
        else if (operation == "OPTIONS") {
            this._sendHTTPRequest(operation, parameters);
        }
        else
            throw ("operation '" + operation + "' is not currently supported");
    },
    get: function(accept) {
        this.load("GET", {accept: accept});
    },
    put: function(data, contentType) {
        this.load("PUT", {data: data, contentType: contentType});
    },
    post: function(data, contentType) {
        if (typeof(contentType) == "undefined") {
            contentType = "application/xml; charset=utf8";
        }
        this.load("POST", {data: data, contentType: contentType});
    },
    _propfindQuery: function(props) {
        let nsDict = { "DAV:": "D" };
        let propPart = "";
        let nsCount = 0;
        for (let prop of props) {
            let propParts = prop.split(" ");
            let ns = propParts[0];
            let nsS = nsDict[ns];
            if (!nsS) {
                nsS = "x" + nsCount;
                nsDict[ns] = nsS;
                nsCount++;
            }
            propPart += "<" + nsS + ":" + propParts[1] + "/>";
        }
        let query = ("<?xml version=\"1.0\"?>\n"
                     + "<D:propfind");
        for (let ns in nsDict)
            query += " xmlns:" + nsDict[ns] + "=\"" + ns + "\"";
        query += ("><D:prop>" + propPart + "</D:prop></D:propfind>");

        return query;
    },
    options: function() {
        this.load("OPTIONS");
    },
    propfind: function(props, deep) {
        if (typeof deep == "undefined")
            deep = true;
        this.load("PROPFIND", {props: props, deep: deep});
    },
    mkcol: function() {
        this.load("MKCOL");
    },
    delete: function() {
        this.load("DELETE");
    },
    report: function(query, deep) {
        if (typeof deep == "undefined")
            deep = true;
        this.load("REPORT", {query: query, deep: deep});
    },
    proppatch: function(query) {
        this.load("PROPPATCH", query);
    }
};
