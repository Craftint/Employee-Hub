# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe
from frappe.model.document import Document


class EmployeeHubLayoutItem(Document):
    def validate(self):
        if self.scope == "Card" and not self.card_key:
            frappe.throw(frappe._("Card Key is required when Scope is 'Card'."))
        if self.scope == "Tab" and self.card_key:
            frappe.throw(frappe._("Card Key must be left blank when Scope is 'Tab' (the Tab field already identifies it)."))
        if self.sequence is None or self.sequence < 0:
            frappe.throw(frappe._("Sequence must be a non-negative number."))
