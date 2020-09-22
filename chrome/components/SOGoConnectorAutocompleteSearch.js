/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org Address Book code
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/* initial code from Mozilla Thundebird 3.1
 * - 2010-09-20: info@inverse.ca: cloned and modified to use comment
     column from "sogo-connector.autoComplete.commentAttribute"
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

let commentColumn = null;

const ACR = Components.interfaces.nsIAutoCompleteResult;
const nsIAbAutoCompleteResult = Components.interfaces.nsIAbAutoCompleteResult;

function SOGoConnectorAutocompleteResult(aSearchString) {
    this._searchResults = [];
    this.searchString = aSearchString;
}

SOGoConnectorAutocompleteResult.prototype = {
    _searchResults: null,

    // nsIAutoCompleteResult

    searchString: null,
    searchResult: ACR.RESULT_NOMATCH,
    defaultIndex: -1,
    errorDescription: null,

    get matchCount() {
        return this._searchResults.length;
    },

    getValueAt: function getValueAt(aIndex) {
        return this._searchResults[aIndex].value;
    },

    getLabelAt: function getLabelAt(aIndex) {
        return this.getValueAt(aIndex);
    },

    getCommentAt: function getCommentAt(aIndex) {
        return this._searchResults[aIndex].comment;
    },

    getStyleAt: function getStyleAt(aIndex) {
        return "local-abook";
    },

    getImageAt: function getImageAt(aIndex) {
        return "";
    },

    getFinalCompleteValueAt: function(aIndex) {
        return this.getValueAt(aIndex);
    },

    removeValueAt: function removeValueAt(aRowIndex, aRemoveFromDB) {
    },

    // nsIAbAutoCompleteResult

    getCardAt: function getCardAt(aIndex) {
        return this._searchResults[aIndex].card;
    },

    getEmailToUse: function getEmailToUse(aIndex) {
        return this._searchResults[aIndex].emailToUse;
    },

    /* nsISupports */

    //QueryInterface: XPCOMUtils.generateQI([ACR, nsIAbAutoCompleteResult])
};

function SOGoConnectorAutocompleteSearch() {}

SOGoConnectorAutocompleteSearch.prototype = {
    // This is set from a preference,
    // 0 = no comment column, 1 = name of address book this card came from
    // Other numbers currently unused (hence default to zero)
    _parser: MailServices.headerParser,
    _abManager: MailServices.ab,
    applicableHeaders: new Set(["addr_to", "addr_cc", "addr_bcc", "addr_reply"]),

    // Private methods

    /**
     * Returns the popularity index for a given card. This takes account of a
     * translation bug whereby Thunderbird 2 stores its values in mork as
     * hexadecimal, and Thunderbird 3 stores as decimal.
     *
     * @param aDirectory  The directory that the card is in.
     * @param aCard       The card to return the popularity index for.
     */
    _getPopularityIndex: function _getPopularityIndex(aDirectory, aCard) {
        let popularityValue = aCard.getProperty("PopularityIndex", "0");
        let popularityIndex = parseInt(popularityValue);

        // If we haven't parsed it the first time round, parse it as hexadecimal
        // and repair so that we don't have to keep repairing.
        if (isNaN(popularityIndex)) {
            popularityIndex = parseInt(popularityValue, 16);

            // If its still NaN, just give up, we shouldn't ever get here.
            if (isNaN(popularityIndex))
                popularityIndex = 0;

            // Now store this change so that we're not changing it each time around.
            if (!aDirectory.readOnly) {
                aCard.setProperty("PopularityIndex", popularityIndex);
                try {
                    aDirectory.modifyCard(aCard);
                }
                catch (ex) {
                    Components.utils.reportError(e);
                }
            }
        }
        return popularityIndex;
    },

    /**
     * Searches cards in the given directory. It is not expected to search against
     * email addresses (use _searchWithinEmails). If a card is matched (and isn't
     * a mailing list) then the function will add a result for each email address
     * that exists.
     *
     * @param searchQuery  The boolean search query to use.
     * @param directory    An nsIAbDirectory to search.
     * @param result       The result element to append results to.
     */
    _searchCards: function _searchCards(searchQuery, directory, result) {
        let childCards =
            this._abManager.getDirectory(directory.URI + searchQuery).childCards;

        // Now iterate through all the cards.
        while (childCards.hasMoreElements()) {
            let card = childCards.getNext();

            if (card instanceof Components.interfaces.nsIAbCard) {
                if (card.isMailList)
                    this._addToResult(directory, card, "", true, result);
                else {
                    let email = card.primaryEmail;
                    if (email)
                        this._addToResult(directory, card, email, true, result);

                    email = card.getProperty("SecondEmail", "");
                    if (email)
                        this._addToResult(directory, card, email, false, result);
                }
            }
        }
    },

    /**
     * Searches for cards in a directory matching against email addresses only.
     * When matches are found it will add them to the results.
     *
     * @param searchQuery  The boolean search query to use.
     * @param fullString   The full string that is being searched against. This
     *                     is used as a "Begins with" check against the email
     *                     addresses to ensure only matching results are added.
     * @param directory    An nsIAbDirectory to search.
     * @param result       The result element to append results to.
     */
    _searchWithinEmails: function _searchWithinEmails(searchQuery, fullString,
                                                      directory, result) {
        let childCards =
            this._abManager.getDirectory(directory.URI + searchQuery).childCards;

        // Now iterate through all the cards.
        while (childCards.hasMoreElements()) {
            let card = childCards.getNext();

            if (card instanceof Components.interfaces.nsIAbCard) {
                if (card.isMailList)
                    this._addToResult(directory, card, "", false, result);
                else {
                    let email = card.primaryEmail;
                    if (email && email.toLocaleLowerCase()
                                      .lastIndexOf(fullString, 0) == 0)
                        this._addToResult(directory, card, email, true, result);

                    email = card.getProperty("SecondEmail", "");
                    if (email && email.toLocaleLowerCase()
                                      .lastIndexOf(fullString, 0) == 0)
                        this._addToResult(directory, card, email, false, result);
                }
            }
        }
    },

    /**
     * Checks a card against the search parameters to see if it should be
     * included in the result.
     *
     * @param card        The card to check.
     * @param emailToUse  The email address to check against.
     * @param fullString  The full search string.
     * @param firstWord   The first word of the search string.
     * @param rest        Anything after the first word.
     * @return            True if the card matches the search parameters, false
     *                    otherwise.
     */
    _checkEntry: function _checkEntry(card, emailToUse, fullString, firstWord,
                                      rest) {
        let i;
        if (card.isMailList) {
            return card.displayName.toLocaleLowerCase().lastIndexOf(fullString, 0) == 0 ||
                card.getProperty("Notes", "").toLocaleLowerCase().lastIndexOf(fullString, 0) == 0 ||
                card.getProperty("NickName", "").toLocaleLowerCase().lastIndexOf(fullString, 0) == 0;
        }

        let firstName = card.firstName.toLocaleLowerCase();
        let lastName = card.lastName.toLocaleLowerCase();
        if (card.displayName.toLocaleLowerCase().lastIndexOf(fullString, 0) == 0 ||
            firstName.lastIndexOf(fullString, 0) == 0 ||
            lastName.lastIndexOf(fullString, 0) == 0 ||
            emailToUse.toLocaleLowerCase().lastIndexOf(fullString, 0) == 0)
            return true;

        if (firstWord && rest &&
            ((firstName.lastIndexOf(firstWord, 0) == 0 &&
              lastName.lastIndexOf(rest, 0) == 0) ||
             (firstName.lastIndexOf(rest, 0) == 0 &&
              lastName.lastIndexOf(firstWord, 0) == 0)))
            return true;

        if (card.getProperty("NickName", "").toLocaleLowerCase().lastIndexOf(fullString, 0) == 0)
            return true;

        return false;
    },

    /**
     * Checks to see if an emailAddress (name/address) is a duplicate of an
     * existing entry already in the results. If the emailAddress is found, it
     * will remove the existing element if the popularity of the new card is
     * higher than the previous card.
     *
     * @param directory       The directory that the card is in.
     * @param card            The card that could be a duplicate.
     * @param emailAddress    The emailAddress (name/address combination) to check
     *                        for duplicates against.
     * @param currentResults  The current results list.
     */
    _checkDuplicate: function _checkDuplicate(directory, card, emailAddress,
                                              currentResults) {
        let lcEmailAddress = emailAddress.toLocaleLowerCase();

        let popIndex = this._getPopularityIndex(directory, card);
        for (let i = 0; i < currentResults._searchResults.length; ++i) {
            if (currentResults._searchResults[i].value.toLocaleLowerCase() ==
                lcEmailAddress)
            {
                // It's a duplicate, is the new one is more popular?
                if (popIndex > currentResults._searchResults[i].popularity) {
                    // Yes it is, so delete this element, return false and allow
                    // _addToResult to sort the new element into the correct place.
                    currentResults._searchResults.splice(i, 1);
                    return false;
                }
                // Not more popular, but still a duplicate. Return true and _addToResult
                // will just forget about it.
                return true;
            }
        }
        return false;
    },

    /**
     * Adds a card to the results list if it isn't a duplicate. The function will
     * order the results by popularity.
     *
     * @param directory      The directory that the card is in.
     * @param card           The card being added to the results.
     * @param emailToUse     The email address from the card that should be used
     *                       for this result.
     * @param isPrimaryEmail Is the emailToUse the primary email? Set to true if
     *                       it is the case. For mailing lists set it to true.
     * @param result         The result to add the new entry to.
     */
    _addToResult: function _addToResult(directory, card, emailToUse,
                                        isPrimaryEmail, result) {
        let emailAddress =
            this._parser.makeMailboxObject(card.displayName,
                                           card.isMailList ?
                                           card.getProperty("Notes", "") || card.displayName :
                                           emailToUse).toString();

        // The old code used to try it manually. I think if the parser can't work
        // out the address from what we've supplied, then its busted and we're not
        // going to do any better doing it manually.
        if (!emailAddress)
            return;

        // If it is a duplicate, then just return and don't add it. The
        // _checkDuplicate function deals with it all for us.
        if (this._checkDuplicate(directory, card, emailAddress, result))
            return;

        // Find out where to insert the card.
        let insertPosition = 0;
        let cardPopularityIndex = this._getPopularityIndex(directory, card);

        while (insertPosition < result._searchResults.length &&
               cardPopularityIndex <
               result._searchResults[insertPosition].popularity)
            ++insertPosition;

        // Next sort on full address
        while (insertPosition < result._searchResults.length &&
               cardPopularityIndex ==
               result._searchResults[insertPosition].popularity &&
               ((card == result._searchResults[insertPosition].card &&
                 !isPrimaryEmail) ||
                emailAddress > result._searchResults[insertPosition].value))
            ++insertPosition;

        let comment = "";
        if (commentColumn != "none") {
            dump("commentColumn: " + commentColumn + "\n");
            comment = card.getProperty(commentColumn, "");
        }

        result._searchResults.splice(insertPosition, 0, {
                                         value: emailAddress,
                                         comment: comment,
                                         card: card,
                                         emailToUse: emailToUse,
                                         popularity: cardPopularityIndex
                                     });
    },

    // nsIAutoCompleteSearch

    /**
     * Starts a search based on the given parameters.
     *
     * @see nsIAutoCompleteSearch for parameter details.
     *
     * It is expected that aSearchParam contains the identity (if any) to use
     * for determining if an address book should be autocompleted against.
     */
    startSearch: function startSearch(aSearchString, aSearchParam,
                                      aPreviousResult, aListener) {
        let result = new SOGoConnectorAutocompleteResult(aSearchString);

        //let prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
        //                        .getService(Components.interfaces.nsIPrefBranch);

        // Find out about the comment column
        if (!commentColumn) {
            try {
                commentColumn = Services.prefs.getCharPref("sogo-connector.autoComplete.commentAttribute");
                if (!commentColumn || commentColumn.length == 0) {
                    commentColumn = "none";
                }
            } catch(e) {
                commentColumn = "none";
            }
        }

        // If the search string isn't value, or contains a comma, or the user
        // hasn't enabled autocomplete, then just return no matches / or the
        // result ignored.
        // The comma check is so that we don't autocomplete against the user
        // entering multiple addresses.
        if (!aSearchString || /,/.test(aSearchString)) {
            result.searchResult = ACR.RESULT_IGNORED;
            aListener.onSearchResult(this, result);
            return;
        }

        // Craft this by hand - we want the first item to contain the full string,
        // the second item with just the first word, and the third item with
        // anything after the first word.
        let fullString = aSearchString.toLocaleLowerCase();
        let firstWord = "";
        let rest = "";
        let pos = fullString.indexOf(" ");

        if (pos != -1) {
            firstWord = fullString.substr(0, pos);
            rest = fullString.substr(pos + 1, fullString.length - pos - 1);
        }

        if (aPreviousResult instanceof nsIAbAutoCompleteResult &&
            aSearchString.lastIndexOf(aPreviousResult.searchString, 0) == 0 &&
            aPreviousResult.searchResult == ACR.RESULT_SUCCESS) {
            // We have successful previous matches, therefore iterate through the
            // list and reduce as appropriate
            for (let i = 0; i < aPreviousResult.matchCount; ++i) {
                if (this._checkEntry(aPreviousResult.getCardAt(i),
                                     aPreviousResult.getEmailToUse(i), fullString,
                                     firstWord, rest))
                    // If it matches, just add it straight onto the array, these will
                    // already be in order because the previous search returned them
                    // in the correct order.
                    result._searchResults.push({
                                                   value: aPreviousResult.getValueAt(i),
                                                   comment: aPreviousResult.getCommentAt(i),
                                                   card: aPreviousResult.getCardAt(i),
                                                   emailToUse: aPreviousResult.getEmailToUse(i),
                                                   popularity: parseInt(aPreviousResult.getCardAt(i).getProperty("PopularityIndex", "0"))
                                               });
            }
        }
        else
        {
            // Construct the search query; using a query means we can optimise
            // on running the search through c++ which is better for string
            // comparisons (_checkEntry is relatively slow).
            let searchQuery = "(or(DisplayName,bw,@V)(FirstName,bw,@V)(LastName,bw,@V)(NickName,bw,@V)(and(IsMailList,=,TRUE)(Notes,bw,@V)))";
            searchQuery = searchQuery.replace(/@V/g, encodeURIComponent(fullString));

            if (firstWord && rest) {
                let searchFNLNPart = "(or(and(FirstName,bw,@V1)(LastName,bw,@V2))(and(FirstName,bw,@V2)(LastName,bw,@V1)))";
                searchFNLNPart = searchFNLNPart.replace(/@V1/g, encodeURIComponent(firstWord));
                searchFNLNPart = searchFNLNPart.replace(/@V2/g, encodeURIComponent(rest));

                searchQuery = "(or" + searchQuery + searchFNLNPart + ")";
            }

            searchQuery = "?" + searchQuery;

            let emailSearchQuery = "?(or(PrimaryEmail,bw,@V)(SecondEmail,bw,@V))";
            emailSearchQuery = emailSearchQuery.replace(/@V/g, encodeURIComponent(fullString));

            // Now do the searching
            let allABs = this._abManager.directories;

            // We're not going to bother searching sub-directories, currently the
            // architecture forces all cards that are in mailing lists to be in ABs as
            // well, therefore by searching sub-directories (aka mailing lists) we're
            // just going to find duplicates.
            while (allABs.hasMoreElements()) {
                let dir = allABs.getNext();

                if (dir instanceof Components.interfaces.nsIAbDirectory &&
                    dir.useForAutocomplete(aSearchParam)) {
                    this._searchCards(searchQuery, dir, result);
                    this._searchWithinEmails(emailSearchQuery, fullString, dir, result);
                }
            }
        }

        if (result.matchCount) {
            result.searchResult = ACR.RESULT_SUCCESS;
            result.defaultIndex = 0;
        }

        aListener.onSearchResult(this, result);
    },

    stopSearch: function stopSearch() {
    },

    /* nsIClassInfo */
    getInterfaces: function(aCount) {
        let ifaces = [ Components.interfaces.nsIAutoCompleteSearch,
                       Components.interfaces.nsIClassInfo,
                       Components.interfaces.nsISupports ];
        aCount.value = ifaces.length;

        return ifaces;
    },

    getHelperForLanguage: function(language) {
        return null;
    },

    contractID: "@mozilla.org/autocomplete/search;1?name=addrbook-sogo-connector",
    classDescription: "Class description",
    classID: Components.ID("{688f57fc-2ac6-42df-38b1-8df9f4bafed4}"),
    //implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    // nsISupports

    QueryInterface: function(aIID) {
        if (!aIID.equals(Components.interfaces.nsIAutoCompleteSearch)
            && !aIID.equals(Components.interfaces.nsIClassInfo)
            && !aIID.equals(Components.interfaces.nsISupports))
            throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
    }
};

/** Module Registration */
function NSGetFactory(cid) {
    return (XPCOMUtils.generateNSGetFactory([SOGoConnectorAutocompleteSearch]))(cid);
}
