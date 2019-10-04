window.addEventListener("load", SIOnCalendarSummaryDialogLoad, false);

function SIOnCalendarSummaryDialogLoad() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    item = item.clone(); // use an own copy of the passed item
    var calendar = item.calendar;

    var label = document.getElementById("calendar-name-label");
    label.value = calendar.name;
}
