# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

from frappe.model.document import Document
from employee_hub.employee_hub.utils.layout_validations import validate_layout_items


class EmployeeHubSettings(Document):
    def validate(self):
        validate_layout_items(self.global_default_layout)
