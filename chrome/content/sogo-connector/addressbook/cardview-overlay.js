let SCCardViewOverlay = {
  oldDisplayCardViewPane: null,

  displayCardViewPane: function(card) {
    this.oldDisplayCardViewPane.apply(window, arguments);
    let cvCategories = document.getElementById("SCCvCategories");
    let catString = card.getProperty("Categories", "").split("\u001A").join(", ");
    cvSetNodeWithLabel(cvCategories, cvCategories.getAttribute("sc-label-text"), catString);
   }
};

SCCardViewOverlay.oldDisplayCardViewPane = DisplayCardViewPane;
DisplayCardViewPane = function(card) { SCCardViewOverlay.displayCardViewPane(card); };

function onLoad(activatedWhileWindowOpen) {
  dump("cardview-overlay.js: onLoad()\n");

  WL.injectElements(`
  <vbox id="cvbContact">
    <description sc-label-text="&sogo-connector.tabs.categories.label;" id="SCCvCategories" class="CardViewText" insertafter="cvIRC"/>
  </vbox>
                    `,
                    ["chrome://sogo-connector/locale/addressbook/common-card-overlay.dtd"]);
                    
}
