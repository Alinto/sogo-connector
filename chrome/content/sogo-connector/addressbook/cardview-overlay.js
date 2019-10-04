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
