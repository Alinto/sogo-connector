/* mozilla.utils.inverse.ca.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2016
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

String.repeat = function(pattern, times) {
    let newString = "";

    for (let i = 0; i < times; i++) {
        newString += pattern;
    }

    return newString;
};

/* object dumper */
function objectDumper() {
}

objectDumper.prototype = {
    indent: 0,
    dump: function(object) {
        let text = "";

        let oType = typeof object;
        if (oType == "function")
            text += this._dumpFunction(object);
        else if (oType == "string"
                 || oType == "number")
        text += this._dumpString(object);
        else if (oType == "object")
        text += this._dumpObject(object);
        else if (oType == "undefined")
        text += "<undefined>";

        return text;
    },
    _dumpFunction: function(object) {
        return "<function: " + object.name + ">";
    },
    _dumpString: function(object) {
        return "" + object;
    },
    _dumpObject: function(object) {
        let text = "";

        if (object instanceof Array)
            text += this._dumpArray(object);
        else if (object instanceof Object)
        text += this._dumpCustomObject(object);
        else
            text += "<object: " + object + ">";

        return text;
    },
    _dumpArray: function(object) {
        let text = "[";

        if (object.length > 0) {
            text += this.dump(object[0]);
            for (let i = 1; i < object.length; i++) {
                text += ", " + this.dump(object[i]);
            }
        }
        else {
            text += "<empty array>";
        }
        text += "]";

        return text;
    },
    _dumpCustomObject: function(object) {
        let braceIndentation = String.repeat(" ", this.indent);
        let text = "{";

        this.indent += 2;
        let indentation = String.repeat(" ", this.indent);
        for (let key in object) {
            try {
                text += indentation + key + ": " + this.dump(object[key]) + "\n";
            }
            catch(e) {
                text += indentation + key + ":" + " (an exception occured)\n";
            }
        }
        this.indent -= 2;
        text += braceIndentation + "}";

        return text;
    }
};

function dumpObject(object) {
    let dumper = new objectDumper();
    return dumper.dump(object);
}
