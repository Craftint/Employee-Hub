# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe
from frappe.model.document import Document
from employee_hub.employee_hub.utils.default_layout import CARD_ROWS

VALID_CARD_KEYS = {row["card_key"] for row in CARD_ROWS}


class EmployeeHubLayoutItem(Document):
    def validate(self):
        if self.scope == "Card":
            if not self.card_key:
                frappe.throw(frappe._("Card Key is required when Scope is 'Card'."))
            if self.card_key not in VALID_CARD_KEYS:
                frappe.throw(
                    frappe._("'{0}' isn't a real card. Please pick one of the existing cards.").format(self.card_key)
                )
        if self.scope == "Tab" and self.card_key:
            # Auto-clear rather than block saving — Card Key is meaningless
            # once Scope is Tab, so just quietly ignore whatever was typed
            # there instead of making the user go back and delete it.
            self.card_key = ""
        if self.sequence is None or self.sequence < 0:
            frappe.throw(frappe._("Sequence must be a non-negative number."))