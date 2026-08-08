# Employee Hub — ERPNext ESS App

A personalized employee self-service portal that sits above ERPNext,
matching the Product Vision doc: single-click landing page, profile,
attendance, leave, payroll, tasks, HR requests, and notifications.

## 1. Install on your bench

```bash
# copy this folder into your bench's apps/ directory, e.g.
cp -r employee_hub ~/frappe-bench/apps/employee_hub

cd ~/frappe-bench

# register the app with bench (creates the required app.json etc. if missing)
bench get-app employee_hub /path/to/employee_hub   # if using git, or skip if already copied

bench --site your-site.local install-app employee_hub
bench --site your-site.local migrate
bench build --app employee_hub
bench restart
```

(If you prefer starting from a clean `bench new-app employee_hub` scaffold,
just overwrite the generated files with the ones in this package, then
`bench --site your-site.local install-app employee_hub`.)

## 2. Verify the redirect

- Log in as a user linked to an Employee record → should land on
  `/app/employee-hub` automatically (via `role_home_page` + the
  `boot_session` fallback in `employee_hub/boot.py`).
- Log in as Administrator → normal ERPNext Desk, untouched.

## 3. Add the sidebar shortcut

In the Desk, go to **Workspace → Employee Hub** (create it once) and add a
single **Link** shortcut of type "Page" pointing to `employee-hub`, pinned
to the top. Selecting it in the sidebar opens the Page directly — the
Workspace view itself is never shown to employees because they're already
redirected past it.

## 4. What's included

| Piece | File |
|---|---|
| Redirect logic | `employee_hub/hooks.py` (`role_home_page`), `employee_hub/employee_hub/boot.py` |
| Dashboard page | `employee_hub/employee_hub/page/employee_hub/` |
| Dashboard data API | `employee_hub/employee_hub/api.py` |
| HR Request DocType | `employee_hub/employee_hub/doctype/hr_request/` |
| Styling | `employee_hub/public/css/employee_hub.css` |
| Boot/redirect JS | `employee_hub/public/js/employee_hub_boot.js` |

## 5. Next steps to extend

- **Leave application**: wire the "Apply Leave" button in `employee_hub.js`
  to `frappe.new_doc("Leave Application", {employee: ...})`.
- **Document expiry** (Visa/Passport/Emirates ID): add a small child table
  or custom fields on Employee, then extend `get_notifications()` in
  `api.py` to flag anything expiring within N days.
- **Notification bell integration**: add a `notification_config` hook so
  pending HR Requests/approvals show in ERPNext's native bell icon.
- **Richer UI**: once the data contracts in `api.py` are stable, swap the
  vanilla-JS page for a Vue 3 + frappe-ui single-page app (the same
  pattern used by Frappe HR / Helpdesk) without touching the API layer.
- **Permissions**: tighten `hr_request.json` permissions per-workflow if
  you split Visa Renewal / Exit Permit / Warning Letter into a proper
  Frappe Workflow with approval states.

## 6. Design principle reminder

This app makes **zero changes to ERPNext core** — it only adds a new app,
one DocType, one Page, and hooks. It stays upgrade-safe.
