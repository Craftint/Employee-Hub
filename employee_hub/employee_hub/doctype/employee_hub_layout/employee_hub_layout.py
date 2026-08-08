# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe
from frappe.model.document import Document
from employee_hub.employee_hub.utils.layout_validations import validate_layout_items


class EmployeeHubLayout(Document):
    def validate(self):
        validate_layout_items(self.layout)

    def before_insert(self):
        # A user can only ever create their own layout, never one on behalf
        # of someone else — even if a request somehow set `user` to a
        # different value, this pins it back to the actual session user.
        self.user = frappe.session.user
