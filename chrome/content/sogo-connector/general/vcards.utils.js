/* vcards.utils.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

let kPhotoImageCache = "SOGoImageCache";

Components.utils.import("resource://gre/modules/Services.jsm");

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("vcards.utils.js: failed to include '" + files[i] +
                 "'\n" + e
                 + "\nFile: " + e.fileName
                 + "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://inverse-library/content/uuid.js",
           "chrome://inverse-library/content/quoted-printable.js"]);

function escapedForCard(theString) {
    theString = theString.replace(/\\/g, "\\\\");
    theString = theString.replace(/,/g, "\\,");
    theString = theString.replace(/;/g, "\\;");
    // according to http://tools.ietf.org/html/rfc2426#page-37
    // colons need not to be escaped.
    // --> removed: theString = theString.replace(/:/g, "\\:");
    theString = theString.replace(/\r\n/g, "\\n");
    theString = theString.replace(/\n/g, "\\n");

    return theString;
}

/* multivalue -> nsIAbCard format, != versit format */
function arrayToMultiValue(valueArray) {
    let value;

    let max = valueArray.length;
    if (max > 0) {
        value = escapedForCard(valueArray[0]);
        for (let i = 1; i < max; i++) {
            value += "\u001A" + escapedForCard(valueArray[i]);
        }
    }
    else {
        value = "";
    }

    return value;
}

function multiValueToArray(multiValue) {
    return multiValue.split("\u001A");
}

function unescapedFromCard(theString) {
    theString = theString.replace(/\\\\/g, "\\");
    theString = theString.replace(/\\,/g, ",");
    theString = theString.replace(/\\:/g, ":");
    theString = theString.replace(/\\;/g, ";");
    theString = theString.replace(/\\n/g, "\n");
    theString = theString.replace(/\\r/g, "\r");

    return theString;
}

/* this method parses a versit directory:
 - normalizing the charset and encodings;
 - returning the lines as hashes filled with the tag, parameters and values
 accurately separated;
 No support yet for embedded directories (VCALENDAR) */
function versitParse(versitString) {
    let parseResult = new Array();
    let currentLine = {};
    let isEscaped = false;
    let type = 0; /* 0 = tag, 1 = parameters, 2 = value */
    let parameters = {};
    let values = new Array();

    let tag = "";
    let parameterName = "type";
    let parameter = "";
    let value = "";

    let currentChar = 0;
    while (currentChar < versitString.length) {
        let character = versitString[currentChar];
        if (isEscaped) {
            let lowerChar = character.toLowerCase();
            if (lowerChar == "n")
                character = "\n";
            else if (lowerChar == "r")
            character = "\r";
            else if (lowerChar == "t")
            character = "\t";
            else if (lowerChar == "b")
            character = "\b";

            if (type == 0)
                tag += character;
            else if (type == 1)
            parameter += character;
            else
                value += character;
            isEscaped = false;
        }
        else {
            if (character == "\\")
                isEscaped = true;
            else {
                if (type == 0) {
                    if (character == ";") {
                        let dotIdx = tag.indexOf(".");
                        if (dotIdx > -1) {
                            tag = tag.substr(dotIdx + 1);
                        }
                        currentLine["tag"] = tag.toLowerCase();
                        parameters = {};
                        parameterName = "type";
                        parameter = "";
                        type = 1;
                    }
                    else if (character == ":") {
                        let dotIdx = tag.indexOf(".");
                        if (dotIdx > -1) {
                            tag = tag.substr(dotIdx + 1);
                        }
                        currentLine["tag"] = tag.toLowerCase();
                        values = new Array();
                        value = "";
                        type = 2;
                    }
                    else if (character == "\r" && versitString[currentChar+1] == "\n") {
                        /* some implementations do not comply and fold their lines
                         qp-style but without escaping their crlf... */
                        let lastLine = parseResult[parseResult.length-1];
                        let values = lastLine["values"];
                        let lastValue = values[values.length-1];
                        if (lastValue[lastValue.length-1] == "=") {
                            values[values.length-1]
                                = lastValue.substr(0, lastValue.length-1) + tag;
                            tag = "";
                            currentChar++;
                        }
                        else
                            tag+=character;
                    }
                    else
                        tag += character;
                }
                else if (type == 1) {
                    if (character == "=") {
                        parameterName = parameter.toLowerCase();
                        parameter = "";
                    }
                    else if (character == ";") {
                        if (typeof parameters[parameterName] == "undefined")
                            parameters[parameterName] = new Array();
                        parameters[parameterName].push(parameter);
                        parameterName = "type";
                        parameter = "";
                    }
                    else if (character == ":") {
                        if (typeof parameters[parameterName] == "undefined")
                            parameters[parameterName] = new Array();
                        parameters[parameterName].push(parameter);
                        currentLine["parameters"] = parameters;
                        values = new Array();
                        value = "";
                        type = 2;
                    }
                    else
                        parameter += character;
                }
                else {
                    if (character != "\r") {
                        if (character == ";") {
                            values.push(value);
                            value = "";
                        }
                        else if (character == "\n") {
                            let nextChar = versitString[currentChar+1];
                            if (typeof nextChar != "undefined" && nextChar == " ")
                                currentChar++;
                            else {
                                // dump("tag: ^" + currentLine["tag"] + "$\n");
                                // dump("value: ^" + value + "$\n");
                                values.push(value);
                                currentLine["values"] = values;
                                parseResult.push(currentLine);
                                currentLine = {};
                                tag = "";
                                type = 0;
                            }
                        }
                        else
                            value += character;
                    }
                }
            }
        }
        currentChar++;
    }

    return parseResult;
}

/* VCARD */
function importFromVcard(vCardString) {
    let card = null;
    if (!vCardString || vCardString == "")
        dump("'vCardString' is empty\n" + backtrace() + "\n");
    else {
        let vcard = versitParse(vCardString);
        // let cardDump = dumpObject(vcard);
        // logInfo("vcard dump:\n" + cardDump);
        card = CreateCardFromVCF(vcard);
    }

    // dump("card content:\n" + vCardString + "\n");

    return card;
}

function CreateCardFromVCF(vcard) {
  let version = "2.1";
  let defaultCharset = "iso-8859-1"; /* 0 = latin 1, 1 = utf-8 */
  
  let card = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance(
    Ci.nsIAbCard
  );
  
    for (let i = 0; i < vcard.length; i++) {
        if (vcard[i]["tag"] == "version") {
            version = vcard[i]["values"][0];
        }
    }
    if (version[0] >= "3")
        defaultCharset = "utf-8";

    for (let i = 0; i < vcard.length; i++) {
        let tag = vcard[i]["tag"];
        let charset = defaultCharset;
        let encoding = null;

        let parameters = vcard[i]["parameters"];
        if (parameters) {
            for (let parameter in parameters) {
                if (parameter == "encoding")
                    encoding = parameters[parameter][0].toLowerCase();
                if (parameter == "charset")
                    charset = parameters[parameter][0].toLowerCase();
            }
        }
        else
            parameters = {};

        if (tag == "photo" && !encoding) {
            /* Apple: what are standards for, right?
             iOS specifies the encoding as a vcard 2.1-style type attribute.
             Therefore, no "encoding" parameter is provided. */
            encoding = "b";
        }

        let values = decodedValues(vcard[i]["values"], charset, encoding);
        InsertCardData(card, tag, parameters, values);
    }

    return card;
}

let _insertCardMethods = {
    _upperTypes: function(types) {
        let upperTypes = [];
        if (types && types.length > 0) {
            let preTypes = types.join(",").split(",");
            for (let i = 0; i < preTypes.length; i++)
                upperTypes.push(preTypes[i].toUpperCase());
        }

        return upperTypes;
    },

    n: function(props, parameters, values) {
        props.extend({ "LastName": values[0],
                       "FirstName": values[1] });
    },
    fn: function(props, parameters, values) {
        props.extend({ "DisplayName": values[0] });
    },
    nickname: function(props, parameters, values) {
        props.extend({ "NickName": values[0] });
    },
    org: function(props, parameters, values) {
        props.extend({ "Company": values[0],
                       "Department": values[1] });
    },
    tel: function(props, parameters, values) {
        let abTypes = { "FAX": "FaxNumber",
                        "CELL": "CellularNumber",
                        "PAGER": "PagerNumber",
                        "HOME": "HomePhone",
                        "WORK": "WorkPhone" };
        /* This array guarantees the order in which the keys will be checked */
        let knownType = false;
        let cardCheckTypes = [ "FAX", "CELL", "PAGER", "HOME", "WORK" ];
        if (parameters["type"] && parameters["type"].length > 0) {
            let types = this._upperTypes(parameters["type"]);

            for (let i = 0; !knownType && i < cardCheckTypes.length; i++) {
                let type = cardCheckTypes[i];
                if (types.indexOf(type) > -1) {
                    let abType = abTypes[type];
                    if ((type != "WORK" && types.indexOf("WORK") > -1)
                        || (!props[abType] || props[abType].length == 0)) {
                        props[abType] = values[0];
                    }
                    knownType = true;
                }
            }
        }

        if (!knownType) {
            let addTypes = [ "WorkPhone", "HomePhone" ];
            for (let i = 0; !knownType && i < addTypes.length; i++) {
                let type = addTypes[i];
                if (!props[type] || props[type].length == 0) {
                    props[type] = values[0];
                    knownType = true;
                }
            }
        }
    },
    adr: function(props, parameters, values) {
        let types = this._upperTypes(parameters["type"]);
        /* Concat multi-line(feed) address field with commas (quirk for iOS) */
        values[1] = values[1].split("\n").join(", ");
        values[2] = values[2].split("\n").join(", ");
        if (types.indexOf("WORK") > -1) {
            props.extend({ "WorkAddress2": values[1],
                           "WorkAddress": values[2],
                           "WorkCity": values[3],
                           "WorkState": values[4],
                           "WorkZipCode": values[5],
                           "WorkCountry": values[6] });
        }
        else {
            props.extend({ "HomeAddress2": values[1],
                           "HomeAddress": values[2],
                           "HomeCity": values[3],
                           "HomeState": values[4],
                           "HomeZipCode": values[5],
                           "HomeCountry": values[6] });
        }

        return props;
    },
    email: function(props, parameters, values) {
        let types = this._upperTypes(parameters["type"]);
        if (types.indexOf("PREF") > -1 || types.indexOf("WORK") > -1) {
            props["PrimaryEmail"] = values[0];
        }
        else if (types.indexOf("HOME") > -1) {
            props["SecondEmail"] = values[0];
        }
        else {
            props["PrimaryEmail"] = values[0];
        }
    },
    url: function(props, parameters, values) {
        let types = this._upperTypes(parameters["type"]);
        let propName = ((types.indexOf("WORK") > -1)
                        ? "WebPage1"
                        : "WebPage2" );
        props[propName] = values[0];
    },
    title: function(props, parameters, values) {
        props["JobTitle"] = values[0];
    },
    bday: function(props, parameters, values) {
        if (values[0].length > 0) {
            let value = values[0].replace(/-/g, "", "g");
            props.extend({ "BirthYear": value.substr(0, 4),
                           "BirthMonth": value.substr(4, 2),
                           "BirthDay": value.substr(6, 2) });
        }
    },
    "x-aim": function(props, parameters, values) {
        props["_AimScreenName"] = values[0];
    },
    "x-mozilla-html": function(props, parameters, values) {
        let value = ((values[0].toLowerCase() == "true")
                     ? 2
                     : 1);
        props["PreferMailFormat"] = value;
    },
    categories: function(props, parameters, values) {
        let commaValues = values[0];
        let newValues = [];
        if (commaValues.length > 0) {
            let escaped = false;
            let currentValue = "";
            for (let i = 0; i < commaValues.length; i++) {
                if (escaped) {
                    currentValue += commaValues[i];
                    escaped = false;
                }
                else {
                    if (commaValues[i] == "\\") {
                        escaped = true;
                    }
                    else if (commaValues[i] == ",") {
                        newValues.push(currentValue);
                        currentValue = "";
                    }
                    else {
                        currentValue += commaValues[i];
                    }
                }
            }
            newValues.push(currentValue);
        }
        props["Categories"] = newValues.join("\u001A");
        // props["Categories"] = arrayToMultiValue(values);
    },
    note: function(props, parameters, values) {
        props["Notes"] = values.join(";");
    },
    photo: function(props, parameters, values) {
        /* "PhotoName" is used for the image displayed in the card view, by
         picking the corresponding file from the image cache. "PhotoURI" is
         the original filename of the image and is used to display the image
         in the card edition window and to (re)attach the image file to the
         card being editted.
         */
        if (values.length > 0) {
            if (parameters["value"] && parameters["value"] == "uri") {
                props["PhotoType"] = "web";
                props["PhotoURI"] = values[0];
                props["PhotoName"] = "(void)";
            }
            else {
                let photoFile = importPhoto(parameters["type"],
                                            values[0]);
                if (photoFile) {
                    props["PhotoType"] = "file";
                    props["PhotoURI"] = "file://" + photoFile.path;
                    props["PhotoName"] = photoFile.leafName;
                }
            }
        }
    },
    custom1: function(props, parameters, values) {
        props["Custom1"] = values[0];
    },
    custom2: function(props, parameters, values) {
        props["Custom2"] = values[0];
    },
    custom3: function(props, parameters, values) {
        props["Custom3"] = values[0];
    },
    custom4: function(props, parameters, values) {
        props["Custom4"] = values[0];
    },

    /* external properties */
    uid: function(props, parameters, values) {
        props["CardUID"] = values[0];
    },

    fburl: function(props, parameters, values) {
        props["CalFBURL"] = values[0];
    },

    /* ignored properties */
    begin: function(props, parameters, values) {
    },
    end: function(props, parameters, values) {
    },
    prodid: function(props, parameters, values) {
    },
    version: function(props, parameters, values) {
    }
};

function InsertCardData(card, tag, parameters, values) {
    // dump("InsertCardData: " + tag + "\n");
    // dump("  values: " + values.join("|") + "\n");

    let properties = {};
    properties.extend = function Object_extend(otherObj) {
        for (let k in otherObj) {
            this[k] = otherObj[k];
        }
    };

    if (typeof _insertCardMethods[tag] != "undefined")
        _insertCardMethods[tag](properties, parameters, values);
    else {
        let joined = values.join("\u001A");
        if (joined.length > 0) {
            properties["unprocessed:" + tag] = joined;
        }
    }

    delete (properties["extend"]);

    for (let k in properties) {
        if (properties[k] && properties[k].length > 0) {
            // if (k == "PhotoURI" || k == "PhotoName") {
            //     dump(k + ": " + properties[k] + "\n");
            // }
            if (properties[k] == "(void)") {
                card.deleteProperty(k);
            }
            else {
                let tmpPrimaryEmail = card.getProperty("PrimaryEmail", "");
                let tmpSecondEmail = card.getProperty("SecondEmail", "");
                if (k == "PrimaryEmail") {
                    if (tmpPrimaryEmail.length == 0) {
                        card.setProperty(k, properties[k]);
                    }
                    else if (tmpSecondEmail.length == 0) {
                        card.setProperty("SecondEmail", properties[k]);
                    }
                }
                else if (k == "SecondEmail" && tmpSecondEmail.length == 0) {
                    card.setProperty("SecondEmail", properties[k]);
                }
                else {
                    card.setProperty(k, properties[k]);
                }
            }
            // if (k == "PhotoURI" || k == "PhotoName") {
            //     dump("  card value: " + card.getProperty(k, "(nil)") + "\n");
            // }
        }
    }
}

function sanitizeBase64(value) {
    // dump("oldValue:\n" + value + "\n");
    value = value.replace("\r", "", "g");
    value = value.replace("\n", "", "g");
    value = value.replace("\t", "", "g");
    value = value.replace(" ", "", "g");

    // dump("newValue:\n" + value + "\n");

    return value;
}

function decodedValues(values, charset, encoding) {
    let newValues = [];

    let decoder = new QuotedPrintableDecoder();
    decoder.charset = charset;

    for (let i = 0; i < values.length; i++) {
        let decodedValue = null;
        if (encoding) {
            // dump("encoding: " + encoding + "\n");
            // dump("initial value: ^" + values[i] + "$\n");
            if (encoding == "quoted-printable") {
                decodedValue = decoder.decode(values[i]);
            }
            else if (encoding == "b" || encoding == "base64") {
                let saneb64Value = sanitizeBase64(values[i]);
                try {
                    decodedValue = atob(saneb64Value);
                }
                catch(e) {
                    dump("vcards.utils.js: failed to decode '" + saneb64Value +
                         "'\n" + e + "\n\n Stack:\n" + e.stack + "\n\n");
                }
            }
            else {
                dump("Unsupported encoding for vcard value: " + encoding + "\n");
                decodedValue = values[i];
            }
            // dump("decoded: " + decodedValue + "\n");
        }
        else
            decodedValue = values[i];
        if (charset == "utf-8"
            || (encoding && (encoding == "base64" || encoding == "b"))) {
            newValues.push(decodedValue);
        }
        else {
          //let converter = Components.classes["@mozilla.org/intl/utf8converterservice;1"]
          //                          .getService(Components.interfaces.nsIUTF8ConverterService);
          //newValues.push(converter.convertStringToUTF8(decodedValue, charset, false));
          let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
              .createInstance(Ci.nsIScriptableUnicodeConverter);
          converter.charset = charset;
          newValues.push(converter.ConvertToUnicode(decodedValue));
        }
    }

    // logInfo("newValues: " + dumpObject(newValues));

    return newValues;
}

function foldedLine(line) {
    var linePart = line.substr(0, 75);
    var newLine = linePart;
    var pos = linePart.length;
    var length = line.length - linePart.length;
    while (length > 0) {
        linePart = line.substr(pos, 74);
        newLine += "\r\n " + linePart;
        pos += linePart.length;
        length -= linePart.length;
    }

    return newLine;
}

function card2vcard(card) {
    let vCard = ("BEGIN:VCARD\r\n"
                 + "VERSION:3.0\r\n"
                 + "PRODID:-//Inverse inc.//SOGo Connector 1.0//EN\r\n");
    let uid = card.getProperty("CardUID", "");
    if (!uid.length) {
        uid = card.getProperty("groupDavKey", "");
        card.setProperty("CardUID", uid);
    }
    if (!uid.length) {
        uid = new UUID();
        card.setProperty("CardUID", uid);
    }
    vCard += foldedLine("UID:" + uid) + "\r\n";

    let lastName = card.getProperty("LastName", "");
    let firstName = card.getProperty("FirstName", "");
    if (lastName.length || firstName.length)
        vCard += foldedLine("N:" + escapedForCard(lastName)
                            + ";" + escapedForCard(firstName)) + "\r\n";

    let displayName = card.getProperty("DisplayName", "");
    if (displayName.length)
        vCard += foldedLine("FN:" + escapedForCard(displayName)) + "\r\n";

    let company = card.getProperty("Company", "");
    let department = card.getProperty("Department", "");
    if (company.length || department.length)
        vCard += foldedLine("ORG:" + escapedForCard(company)
                            + ";" + escapedForCard(department)) + "\r\n";

    let nickName = card.getProperty("NickName", "");
    if (nickName.length)
        vCard += foldedLine("NICKNAME:" + escapedForCard(nickName)) + "\r\n";

    let categories = card.getProperty("Categories", "");
    if (categories.length)
        vCard += foldedLine("CATEGORIES:" + categories.split("\u001A").join(",")) + "\r\n";

    let workAddress = card.getProperty("WorkAddress", "");
    let workAddress2 = card.getProperty("WorkAddress2", "");
    let workCity = card.getProperty("WorkCity", "");
    let workState = card.getProperty("WorkState", "");
    let workZipCode = card.getProperty("WorkZipCode", "");
    let workCountry = card.getProperty("WorkCountry", "");
    if ((workAddress + workAddress2 + workCity + workState + workZipCode
         + workCountry).length)
        vCard += foldedLine("ADR;TYPE=work:;" + escapedForCard(workAddress2)
                            + ";" + escapedForCard(workAddress)
                            + ";" + escapedForCard(workCity)
                            + ";" + escapedForCard(workState)
                            + ";" + escapedForCard(workZipCode)
                            + ";" + escapedForCard(workCountry)) + "\r\n";

    let homeAddress = card.getProperty("HomeAddress", "");
    let homeAddress2 = card.getProperty("HomeAddress2", "");
    let homeCity = card.getProperty("HomeCity", "");
    let homeState = card.getProperty("HomeState", "");
    let homeZipCode = card.getProperty("HomeZipCode", "");
    let homeCountry = card.getProperty("HomeCountry", "");
    if ((homeAddress + homeAddress2 + homeCity + homeState + homeZipCode
         + homeCountry).length)
        vCard += foldedLine("ADR;TYPE=home:;" + escapedForCard(homeAddress2)
                            + ";" + escapedForCard(homeAddress)
                            + ";" + escapedForCard(homeCity)
                            + ";" + escapedForCard(homeState)
                            + ";" + escapedForCard(homeZipCode)
                            + ";" + escapedForCard(homeCountry)) + "\r\n";

    let workPhone = card.getProperty("WorkPhone", "");
    if (workPhone.length)
        vCard += foldedLine("TEL;TYPE=work:" + escapedForCard(workPhone)) + "\r\n";

    let homePhone = card.getProperty("HomePhone", "");
    if (homePhone.length)
        vCard += foldedLine("TEL;TYPE=home:" + escapedForCard(homePhone)) + "\r\n";

    let cellularNumber = card.getProperty("CellularNumber", "");
    if (cellularNumber.length)
        vCard += foldedLine("TEL;TYPE=cell:"
                            + escapedForCard(cellularNumber)) + "\r\n";

    let faxNumber = card.getProperty("FaxNumber", "");
    if (faxNumber.length)
        vCard += foldedLine("TEL;TYPE=fax:"
                            + escapedForCard(faxNumber)) + "\r\n";

    let pagerNumber = card.getProperty("PagerNumber", "");
    if (pagerNumber.length)
        vCard += foldedLine("TEL;TYPE=pager:"
                            + escapedForCard(pagerNumber)) + "\r\n";

    let preferMailFormat = card.getProperty("PreferMailFormat", 0);
    if (preferMailFormat) {
        let value = ((preferMailFormat == 2)
                     ? "TRUE"
                     : "FALSE");
        vCard += "X-MOZILLA-HTML:" + value + "\r\n";
    }

    let primaryEmail = card.getProperty("PrimaryEmail", "");
    let secondEmail = card.getProperty("SecondEmail", "");

    if (primaryEmail.length) {
        vCard += foldedLine("EMAIL;TYPE=work:"
                            + escapedForCard(primaryEmail)) + "\r\n";
        if (secondEmail.length)
            vCard += foldedLine("EMAIL;TYPE=home:"
                                + escapedForCard(secondEmail)) + "\r\n";
    }
    else if (secondEmail.length) {
        vCard += foldedLine("EMAIL;TYPE=work:"
                            + escapedForCard(secondEmail)) + "\r\n";
    }

    let webPage1 = card.getProperty("WebPage1", "");
    if (webPage1.length)
        vCard += foldedLine("URL;TYPE=work:"
                            + escapedForCard(webPage1)) + "\r\n";

    let webPage2 = card.getProperty("WebPage2", "");
    if (webPage2.length)
        vCard += foldedLine("URL;TYPE=home:" + escapedForCard(webPage2)) + "\r\n";

    let jobTitle = card.getProperty("JobTitle", "");
    if (jobTitle.length)
        vCard += foldedLine("TITLE:" + jobTitle) + "\r\n";

    function pad(num, count) {
        let padNum = num + '';
        while(padNum.length < count) {
            padNum = "0" + padNum;
        }
        return padNum;
    }
    let birthYear = card.getProperty("BirthYear", 0);
    let birthMonth = pad(card.getProperty("BirthMonth", 0), 2);
    let birthDay = pad(card.getProperty("BirthDay", 0), 2);
    if (birthYear && birthMonth && birthDay)
        vCard += foldedLine("BDAY:" + escapedForCard(birthYear)
                            + "-" + escapedForCard(birthMonth)
                            + "-" + escapedForCard(birthDay)) + "\r\n";

    for (let i = 1; i < 5; i++) {
        let custom = card.getProperty("Custom" + i, "");
        if (custom.length)
            vCard += foldedLine("CUSTOM" + i + ":"
                                + escapedForCard(custom)) + "\r\n";
    }

    let notes = card.getProperty("Notes", "");
    if (notes.length) {
        vCard += foldedLine("NOTE:"
                            + escapedForCard(notes.replace(/\n/g, "\r\n"))) + "\r\n";
    }

    let aimScreenName = card.getProperty("_AimScreenName", "");
    if (aimScreenName.length)
        vCard += foldedLine("X-AIM:"
                            + escapedForCard(aimScreenName)) + "\r\n";

    let fbUrl = card.getProperty("CalFBURL", "");
    if (fbUrl.length) {
        vCard += foldedLine("FBURL:"
                            + escapedForCard(fbUrl)) + "\r\n";
    }

    /*   - PhotoName : filename in Photos/
     *   - PhotoType : web or file
     *   - PhotoURI : uri (file:// or http://)
     */

    let photoUri = card.getProperty("PhotoURI", null);
    let photoType = card.getProperty("PhotoType", "file");
    if (photoType == "web") {
        if (photoUri) {
            vCard += foldedLine("PHOTO;VALUE=uri:"
                                + escapedForCard(photoUri)) + "\r\n";
        }
    }
    else if (photoType == "file") { /* always "file" */
        if (photoUri) {
            let photoType = deducePhotoTypeFromExt(photoUri);
            if (photoType) {
                let content = photoContent(photoUri);
                if (content) {
                    vCard += foldedLine("PHOTO;ENCODING=b;TYPE=" + photoType
                                        + ":" + btoa(content)) + "\r\n";
                }
            }
        }
    }

    let remainingProps = card.properties;
    while (remainingProps.hasMoreElements()) {
        let prop = remainingProps.getNext().QueryInterface(Components.interfaces.nsIProperty);
        let propName = String(prop.name);
        /* A bug in Thunderbird prevents the old unprocessed props from being removed, yay!
         Hence the 3 last cases in this if clause...  */
        if (propName.indexOf("unprocessed:") == 0
            && propName.indexOf("unprocessed:prodid") == -1
            && propName.indexOf("unprocessed:version") == -1
            && propName.indexOf("unprocessed:.") == -1) {
            let line = propName.substr(12).toUpperCase() + ":";
            let joined = String(prop.value);
            if (joined.length > 0) {
                let values = joined.split("\u001A");
                line += escapedForCard(values[0]);
                for (let i = 1; i < values.length; i++) {
                    line += ";" + escapedForCard(values[i]);
                }
                vCard += foldedLine(line) + "\r\n";
            }
        }
    }

    vCard += "END:VCARD\r\n\r\n";

    return vCard;
}

function deducePhotoTypeFromExt(photoName) {
    let type = null;

    let dotParts = photoName.split(".");
    if (dotParts.length > 1) {
        let lastPart = (dotParts[dotParts.length - 1]).toUpperCase();
        if (lastPart == "JPG" || lastPart == "JPEG") {
            type = "JPEG";
        }
        else if (lastPart == "PNG") {
            type = "PNG";
        }
        else if (lastPart == "GIF") {
            type = "GIF";
        }
        else
            dump("vcards.utils.js: unhandled image extension: "
                 + lastPart + "\n");
    }

    return type;
}

function photoFileFromName(photoName, inSOGoCache) {
    let file = Components.classes["@mozilla.org/file/directory_service;1"]
                         .getService(Components.interfaces.nsIProperties)
                         .get("ProfD", Components.interfaces.nsIFile);
    file.append(inSOGoCache ? kPhotoImageCache : "Photos");
    if (photoName) {
        //dump("photoFileFromName() got photoName = " +photoName+ "\n");
        try {
            file.append(photoName);
        }
        catch(e) {
            dump("vcards.utils.js: could not get photo from photoName '" + photoName + "'. This might happen if photoName contains absolute file path.\n");
            dump("Exception: " + e + "\n");
            dump("Re-throwing this exception.\n");
            throw e;
        }
    }
    //dump("photoFileFromName() is returning "+file.path +"\n");
    return file;
}

function photoContent(uri) {
    let content = null;

    //let ios = Components.classes["@mozilla.org/network/io-service;1"]
    //                    .getService(Components.interfaces.nsIIOService);
    let fileURL = Services.io.newURI(uri, null, null);
    let file = fileURL.QueryInterface(Components.interfaces.nsIFileURL).file;

    let rd;
    try {
        /* If the file does not exists, the following does not return but
         throws an exception. Too simple otherwise... */
        rd = file.isReadable();
    }
    catch(e) {
        rd = false;
    }
    if (rd) {
        let fileStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                                   .createInstance(Components.interfaces.nsIFileInputStream);
        fileStream.init(file, -1, -1, false);
        let byteStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                                   .createInstance(Components.interfaces.nsIBinaryInputStream);
        byteStream.setInputStream(fileStream);
        content = byteStream.readBytes(byteStream.available());
        dump("vcards.utils.js: content of file '" + uri + "' read successfully\n");
        byteStream.close();
        fileStream.close();
    }
    else {
        dump("vcards.utils.js: '" + uri + "' cannot be read\n");
    }

    return content;
}

function importPhoto(photoType, content) {
    let photoFile = null;

    if (content && content.length > 0) {
        if (photoType) {
            let ext = deducePhotoExtFromTypes(photoType);
            if (ext) {
                photoFile = saveImportedPhoto(content, ext);
            }
            else {
                dump("vcards.utils: no extension returned for photo file\n");
            }
        }
        else {
          dump("vcards.utils: no photo type provided, assuming jpg\n");
          photoFile = saveImportedPhoto(content, 'jpg');
       }
    }
    else {
        dump("vcards.utils: no content provided\n");
    }

    return photoFile;
}

function deducePhotoExtFromTypes(photoTypes) {
    let ext = null;

    if (photoTypes && photoTypes.length > 0) {
        let upperType = photoTypes[0].toUpperCase();
        if (upperType == "JPEG"
            || upperType == "BASE64" /* Apple: what are standards for,
                                      right? */) {
            ext = "jpg";
        }
        else if (upperType == "PNG") {
            ext = "png";
        }
        else if (upperType == "GIF") {
            ext = "gif";
        }
        else
            dump("vcards.utils.js: unhandled image type: "
                 + upperType + "\n");
    }

    return ext;
}

function saveImportedPhoto(content, ext) {
    let photoName = (new UUID()) + "." + ext;

    /* ensure the kPhotoImageCache exists */
    let dir = photoFileFromName(null, true);
    if (!dir.exists()) {
        dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE,
                   parseInt("0700", 8));
    }

    /* we create a copy in the regular cache for display in the card view and
     in the SOGo cache as a separate file which will not be destroyed by a
     further save operation */
    let lastFile = null;
    for (let bool of [false, true]) {
        let file = photoFileFromName(photoName, bool);
        /* 0700 is specified here because Thunderbird is too self-sufficient
         to respect the environment umask */
        file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0x1c8 /* octal 0700 in hex */);
        let fileStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                                   .createInstance(Components.interfaces.nsIFileOutputStream);

        try {
            fileStream.init(file, -1, -1, false);
        }
        catch(e) {
            dump("photoName: " + photoName + "\n");
            dump("file: " + file + "\n");
            dump("Exception: " + e + "\n");
            return null;
        }

        let byteStream = Components.classes["@mozilla.org/binaryoutputstream;1"]
                                   .createInstance(Components.interfaces.nsIBinaryOutputStream);
        byteStream.setOutputStream(fileStream);
        byteStream.writeBytes(content, content.length);
        dump("vcards.utils.js: content of file '" + photoName + "' written successfully\n");
        byteStream.close();
        fileStream.close();

        lastFile = file;
    }

    return lastFile;
}

function urlIsInSOGoImageCache(url) {
    /* warning: this might not work on windows, due to the accessing of files via uris */

    let dir = photoFileFromName(false, true);
    if (url.indexOf("file://") > -1) {
        url = url.substr(7);
    }
    return (url.indexOf(dir.path) > -1);
}

function deletePhotoFile(photoName, inSOGoCache) {
    /* warning: this might not work on windows, due to the accessing of files via uris */

    let file = photoFileFromName(photoName, inSOGoCache);
    try {
        file.remove(false);
    }
    catch(e) {
        dump("vcards.utils.js: photo named '" + photoName + "' could not be"
             + " deleted (ignored)\n");
        //dump("Exception: " + e + "\n");
    }
}

/* VLIST */
function updateListFromVList(listCard, vListString, cards) {
    let abManager = Components.classes["@mozilla.org/abmanager;1"]
                              .getService(Components.interfaces.nsIAbManager);
    let listURI = listCard.mailListURI;
    let list = abManager.getDirectory(listURI);
    let listUpdated = false;

    list.addressLists.clear();
    let parsedString = versitParse(vListString);
    for (let i = 0; i < parsedString.length; i++) {
        let line = parsedString[i];
        if (line.tag == "fn") {
            listCard.displayName = line.values[0];
            listCard.lastName = line.values[0];
            list.dirName = line.values[0];
        }
        else if (line.tag == "nickname") {
            listCard.setProperty("NickName", line.values[0]);
            list.listNickName = line.values[0];
        }
        else if (line.tag == "description") {
            listCard.setProperty("Notes", line.values[0]);
            list.description = line.values[0];
        }
        else if (line.tag == "card") {
            let card = cards[line.values[0]];
            // dump("card '" + line.values[0] + "': ");
            if (!card) {
                let email = line.parameters["email"][0];
                if (email) {
                    listUpdated = true;
                    card = _findCardWithEmail(cards, email);
                }
            }
            if (card)
                list.addressLists.appendElement(card, false);
            else {
                listUpdated = true;
                dump("card with uid '" + line.values[0]
                     + "' was not found in directory");
            }
        }
    }

    // list.editMailListToDatabase(list.QueryInterface(Components.interfaces.nsIAbCard));

    return listUpdated;
}

function _findCardWithEmail(cards, email) {
    let card = null;

    let cmpEmail = email.toLowerCase();

    for (let k in cards) {
        if (cards[k].primaryEmail.toLowerCase() == cmpEmail)
            card = cards[k];
    }

    return card;
}

function list2vlist(uid, listCard) {
    let vList = ("BEGIN:VLIST\r\n"
                 + "PRODID:-//Inverse inc.//SOGo Connector 1.0//EN\r\n"
                 + "VERSION:1.0\r\n"
                 + "UID:" + uid + "\r\n");
    vList += "FN:" + listCard.getProperty("DisplayName", "") + "\r\n";
    let data = listCard.getProperty("NickName", "");
    if (data.length)
        vList += "NICKNAME:" + data + "\r\n";
    data = "" + listCard.getProperty("Notes", "");
    if (data.length)
        vList += "DESCRIPTION:" + data + "\r\n";

    let abManager = Components.classes["@mozilla.org/abmanager;1"]
                              .getService(Components.interfaces.nsIAbManager);
    let listDir = abManager.getDirectory(listCard.mailListURI);
    let cards = listDir.childCards;
    dump("cards: " + cards + "\n");
    while (cards.hasMoreElements()) {
        let card = cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
        let key = card.getProperty("groupDavKey", "");
        if (key.length) {
            let entry = "CARD";
            if (card.primaryEmail.length) {
                entry += ";EMAIL=" + card.primaryEmail;
            }
            if (card.displayName.length) {
                entry += ";FN=" + card.displayName;
            }
            entry += ":" + key + "\r\n";
            vList += entry;
        }
        else {
            dump("*** card has no GroupDAV identifier key\n"
                 + "  primaryEmail: " + card.primaryEmail + "\n"
                 + "  displayName: " + card.displayName + "\n");
        }
    }

    vList += "END:VLIST";

    // dump("vList:\n" + vList + "\n");

    return vList;
}
