/* calendar-invitations-dialog.js - This file is part of "SOGo Connector", a Thunderbird extension.
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
function onLoad(activatedWhileWindowOpen) {
  dump("calendar-invitations-dialog.js: onLoad()\n");

  let clazz = window.customElements.get("calendar-invitations-richlistitem");
  clazz.prototype.setCalendarItemOld = clazz.prototype.setCalendarItem;
  clazz.prototype.setCalendarItem = function(item) {
    this.setCalendarItemOld(item);
    let titleLabel = this.querySelector(".calendar-invitations-richlistitem-title");
    titleLabel.setAttribute("value", item.title + " (" + item.calendar.name + ")");
  };
}
