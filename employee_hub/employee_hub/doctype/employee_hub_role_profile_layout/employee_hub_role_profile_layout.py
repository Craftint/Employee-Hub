# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe
from frappe.model.document import Document
from employee_hub.employee_hub.utils.layout_validations import validate_layout_items


class EmployeeHubRoleProfileLayout(Document):
    def validate(self):
        # Same protection Employee Hub Layout already has via its save
        # endpoint — this doctype is edited directly through the Desk
        # form instead, so the check has to live here rather than in a
        # whitelisted API. Client-side (employee_hub_role_profile_layout.js)
        # already hides Save when this is off, but that's just UX — this
        # is the actual enforcement.
        settings = frappe.get_single("Employee Hub Settings")
        if not settings.enable_role_profile_layouts:
            frappe.throw(
                frappe._("Role Profile Based Layouts are currently disabled in Employee Hub Settings.")
            )

        if not self.layout:
            frappe.throw(
                frappe._(
                    "Add at least one row to the layout before saving — use Fetch Default Layout to get started."
                )
            )

        # Reuses the exact same checks already applied to Employee Hub
        # Settings and Employee Hub Layout — duplicate tab/card detection,
        # unknown tab values, and "a visible tab needs at least one visible
        # card" — since this doctype shares the same child table.
        validate_layout_items(self.layout)