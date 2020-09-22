// (function() {
//   let clazz = customElements.get("calendar-invitations-richlistitem");
//   clazz.prototype.setCalendarItemOld = clazz.prototype.setCalendarItem;
//   clazz.prototype.setCalendarItem = function(item) {
//     this.setCalendarItemOld(item);
//     let titleLabel = this.querySelector(".calendar-invitations-richlistitem-title");
//     titleLabel.setAttribute("value", item.title + " (" + item.calendar.name + ")");
//   };
// })();

function onLoad(activatedWhileWindowOpen) {
  dump("calendar-invitations-dialog.js: onLoad()\n");

  let clazz = customElements.get("calendar-invitations-richlistitem");
  clazz.prototype.setCalendarItemOld = clazz.prototype.setCalendarItem;
  clazz.prototype.setCalendarItem = function(item) {
    this.setCalendarItemOld(item);
    let titleLabel = this.querySelector(".calendar-invitations-richlistitem-title");
    titleLabel.setAttribute("value", item.title + " (" + item.calendar.name + ")");
  };
}
