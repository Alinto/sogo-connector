/* mail-labels.js - This file is part of "SOGo Connector".
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
  let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Components.interfaces.mozIJSSubScriptLoader);
  for (let i = 0; i < files.length; i++) {
    try {
      loader.loadSubScript(files[i], target);
    }
    catch(e) {
      dump("mails-labels.js: failed to include '" + files[i] + "'\n" + e + "\n");
    }
  }
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
           "chrome://sogo-connector/content/global/sogo-config.js"]);

let SIMailsLabels = {
  synchronizeToServer: function SIML_synchronizeToServer() {

    let collectionURL = sogoBaseURL() + "Mail/";
    let proppatch = new sogoWebDAV(collectionURL, null, null, true);
    let labelsxml = "<i:mails-labels>";
    let tagArray = MailServices.tags.getAllTags({});

    for (let j = 0; j < tagArray.length; j++) {
      let key = tagArray[j].key;
      let name = MailServices.tags.getTagForKey(key);
      let color =  MailServices.tags.getColorForKey(key);

      if (!color) {
        color = "#000000";
      }

      labelsxml += "<i:label id=\"" + key + "\" color=\"" + color + "\">" + xmlEscape(name) +  "</i:label>";
    }

    labelsxml += "</i:mails-labels>";

    let proppatchxml = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                        + "<propertyupdate xmlns=\"DAV:\""
                        + " xmlns:i=\"urn:inverse:params:xml:ns:inverse-dav\">"
                        + "<set>"
                        + "<prop>" + labelsxml + "</prop>"
                        + "</set></propertyupdate>");
    proppatch.proppatch(proppatchxml);
  },

  synchronizeFromServer: function SIML_synchronizeFromServer() {
    let mailsLabelsListener = {
      onDAVQueryComplete: function onDAVQueryComplete(status, response, headers) {
        if (status == 207) {
          let tagArray = MailServices.tags.getAllTags({});

          for (let j = 0; j < tagArray.length; j++) {
            MailServices.tags.deleteKey( tagArray[j].key );
          }

          // We'll get something like that:
          //
          //  <n1:label color="#f00" id="$label1">Important</n1:label>
          //  <n1:label color="#ff9a00" id="$label2">Work</n1:label>
          //  <n1:label color="#009a00" id="$label3">Personal</n1:label>
          //  <n1:label color="#3130ff" id="$label4">To Do</n1:label>
          //  <n1:label color="#9c309c" id="$label5">Later</n1:label>
          //
          let multistatus = response.documentElement;
          let labels = multistatus.getElementsByTagName("n1:label");

          for (let i = 0; i < labels.length; i++) {
            let label = labels.item(i);
            let id = label.getAttribute("id");
            let color = label.getAttribute("color");
            let name = label.innerHTML;
            let tag = null;

            try {
              tag = MailServices.tags.getTagForKey(id);
            } catch (ex) {
              dump("Unable to get mail tag for key: " + id + "\n");
            }

            if (tag != null) {
              let current_color =  MailServices.tags.getColorForKey(id);
              let current_name = MailServices.tags.getTagForKey(id);

              if (name.toUpperCase() != current_name.toUpperCase()) {
                MailServices.tags.setTagForKey(id, name);
              }

              if (color.toUpperCase() != current_color.toUpperCase()) {
                MailServices.tags.setColorForKey(id, color);
              }
            } else {
              MailServices.tags.addTagForKey(id, name, color, '');
            }
          }
        }
      }
    }

    let properties = ["urn:inverse:params:xml:ns:inverse-dav mails-labels"];
    let propfind = new sogoWebDAV(sogoBaseURL() + "Mail", mailsLabelsListener, undefined, undefined, false);
    propfind.propfind(properties, false);
  }
};
