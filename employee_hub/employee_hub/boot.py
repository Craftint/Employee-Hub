# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe

REDIRECT_CACHE_PREFIX = "employee_hub_redirect_once:"


def _employee_hub_enabled():
    """The master switch in Employee Hub Settings. Defaults to enabled if
    the setting can't be read for any reason (e.g. mid-migration) — fails
    open rather than silently breaking existing behavior for everyone."""
    try:
        return bool(frappe.db.get_single_value("Employee Hub Settings", "enable_employee_hub_access"))
    except Exception:
        return True


def boot_session(bootinfo):
    """Runs on every page load, including plain reloads. Flags whether the
    current user has a linked Employee record AND the master switch is on
    — this same flag is what employee_hub_boot.js checks before showing
    the sidebar link, so gating it here covers that automatically. Also
    checks for a one-shot redirect flag set by on_login (below) for THIS
    user. If present, it's consumed and deleted immediately, so it can only
    ever trigger a redirect on the single page load right after a fresh
    login, never on any reload after that."""
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    bootinfo.employee_hub_home = bool(employee) and _employee_hub_enabled()

    cache_key = REDIRECT_CACHE_PREFIX + frappe.session.user
    if frappe.cache().get_value(cache_key):
        bootinfo.employee_hub_redirect_once = True
        frappe.cache().delete_value(cache_key)  # one-shot: consumed immediately
    else:
        bootinfo.employee_hub_redirect_once = False


def on_login(login_manager):
    """Runs once, exactly when a user successfully logs in.

    NOTE: frappe.session.sid is NOT yet populated at this point in the login
    flow (an earlier version of this tried to key the cache on it, which
    crashed login entirely with "can only concatenate str (not NoneType)").
    Keying on the username instead — reliably available both here and in
    boot_session — avoids that.

    Sets a short-lived (30s) cache flag. The very next boot_session call
    (i.e. the page load immediately following this login) picks it up,
    redirects once client-side, and the flag is deleted the moment it's
    read — so it's a true one-shot per login.
    """
    user = login_manager.user
    if not _employee_hub_enabled():
        return
    if frappe.db.exists("Employee", {"user_id": user}):
        cache_key = REDIRECT_CACHE_PREFIX + user
        frappe.cache().set_value(cache_key, True, expires_in_sec=30)
        # Keep this too as a first line of defense — harmless if the client
        # router ignores it, and it did work for at least the first login.
        frappe.local.response["home_page"] = "/app/employee-hub"