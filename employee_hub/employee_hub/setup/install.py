# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe
import click
from employee_hub.employee_hub.utils.default_layout import TAB_ROWS, CARD_ROWS


def print_credits():
    """Shows a small branded banner in the terminal during `bench
    install-app` and every `bench migrate` — click is already a bench
    dependency, so this needs nothing extra installed."""
    click.echo("")
    click.secho("=" * 58, fg="cyan")
    click.secho("  Employee Hub", fg="cyan", bold=True)
    click.secho("  Developed by Sebin P Sabu", fg="cyan")
    click.secho("  https://www.linkedin.com/in/sebin-p-sabu", fg="cyan")
    click.secho("=" * 58, fg="cyan")
    click.echo("")


def seed_global_default_layout():
    """Runs on every `bench migrate` (see hooks.py's after_migrate), but is
    a no-op after the first successful run — it only populates the table if
    it's currently empty, so it will never overwrite an admin's later edits
    to the Global Default Layout."""
    settings = frappe.get_single("Employee Hub Settings")

    if settings.global_default_layout:
        return

    for row in TAB_ROWS + CARD_ROWS:
        settings.append("global_default_layout", row)

    settings.save(ignore_permissions=True)
    frappe.db.commit()


def setup_hr_manager_permissions():
    """"HR Manager" is an HRMS-app role, not core Frappe — it will not exist
    on a site that doesn't have HRMS installed. Hardcoding it into a
    DocType's static permissions JSON would make `bench migrate` fail on
    any such site (Frappe validates every role referenced in a doctype's
    permissions actually exists). Granting it here instead, conditionally,
    means this app installs cleanly everywhere, and automatically picks up
    HR Manager access wherever that role genuinely exists.

    Per spec: HR Manager gets read-only access — select + read, no write —
    on both doctypes that carry layout data."""
    if not frappe.db.exists("Role", "HR Manager"):
        return

    from frappe.permissions import add_permission, update_permission_property

    for doctype in ("Employee Hub Settings", "Employee Hub Layout"):
        existing = frappe.db.exists(
            "Custom DocPerm" if frappe.db.exists("DocType", "Custom DocPerm") else "DocPerm",
            {"parent": doctype, "role": "HR Manager"},
        )
        if existing:
            continue
        add_permission(doctype, "HR Manager", 0)
        update_permission_property(doctype, "HR Manager", 0, "select", 1)
        update_permission_property(doctype, "HR Manager", 0, "read", 1)
        update_permission_property(doctype, "HR Manager", 0, "write", 0)

    frappe.clear_cache(doctype="Employee Hub Settings")
    frappe.clear_cache(doctype="Employee Hub Layout")