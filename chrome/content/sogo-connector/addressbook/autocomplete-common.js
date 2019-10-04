Components.utils.import("resource://gre/modules/Preferences.jsm");

function SCACLoad() {
    //let prefService = Components.classes["@mozilla.org/preferences-service;1"]
    //                            .getService(Components.interfaces.nsIPrefBranch);
    let delay = 0;
    try {
        delay = parseInt(Preferences.getIntPref("sogo-connector.autoComplete.delay"));
    }
    catch(e) {};

    let hasAttribute = false;
    try {
        let attributeName = prefService.getCharPref("sogo-connector.autoComplete.commentAttribute");
        if (attributeName && attributeName.length > 0) {
            hasAttribute = true;
        }
    }
    catch(e) {};

    if (delay || hasAttribute) {
        let done = false;
        let i = 1;
        while (!done) {
            let textbox = document.getElementById(autocompleteWidgetPrefix
                                                  + "#" + i);
            if (textbox) {
                if (hasAttribute) {
                    let acValue = textbox.getAttribute("autocompletesearch");
                    if (acValue && acValue.length > 0) {
                        acValue = acValue.replace(/(^| )addrbook($| )/, "$1addrbook-sogo-connector$2");
                        textbox.setAttribute("autocompletesearch", acValue);
                        textbox.setAttribute("showCommentColumn", "true");
                        textbox.showCommentColumn = true;
                    }
                }
                if (delay) {
                    textbox.setAttribute("timeout", delay);
                }

                i++;
            } else {
                done = true;
            }
        }
    }
}

window.addEventListener("load", SCACLoad, false);
