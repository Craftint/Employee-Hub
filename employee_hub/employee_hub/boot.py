import frappe


def boot_session(bootinfo):
    """Flag whether the current user has a linked Employee record.
    Used by employee_hub_boot.js as a client-side redirect fallback."""
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    bootinfo.employee_hub_home = bool(employee)
