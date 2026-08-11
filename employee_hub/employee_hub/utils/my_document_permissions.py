# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe

# Real row-level security for My Document — an Employee should only ever
# see their own documents, never anyone else's, regardless of whether
# User Permissions happen to be configured on this site. Deliberately not
# relying on if_owner (that matches whoever CREATED the record, typically
# HR/Admin, not the `employee` field) or on User Permissions alone (not
# guaranteed to be set up on every site) — this is enforced directly.


def get_permission_query_conditions(user=None):
    user = user or frappe.session.user
    roles = frappe.get_roles(user)
    if "System Manager" in roles or "HR Manager" in roles:
        return ""

    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not employee:
        return "1=0"
    return f"`tabMy Document`.employee = {frappe.db.escape(employee)}"


def has_permission(doc, user=None, permission_type=None):
    user = user or frappe.session.user
    roles = frappe.get_roles(user)
    if "System Manager" in roles or "HR Manager" in roles:
        return True

    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    return bool(employee) and doc.employee == employee