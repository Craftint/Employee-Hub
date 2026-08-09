# Employee Hub — ERPNext ESS App

A personalized Employee Self-Service portal for ERPNext: one page bringing
together profile, attendance, leave, payroll, tasks/timesheets,
performance, HR requests, and documents into a single dashboard — with a
built-in personalization layer so each employee (or role) can hide,
reorder, and relocate cards to match how they actually work.

Developed by **Sebin P Sabu** — [linkedin.com/in/sebin-p-sabu](https://www.linkedin.com/in/sebin-p-sabu)

---

## 1. What's included

### Dashboard & tabs
Seven tabs — **Dashboard, Attendance & Leaves, Salary & Expenses, Tasks &
Timesheets, Performance, Requests, Documents** — each built from small,
independent cards (stat cards, charts, list cards). Every filterable card
has its own period filter (Today / This Week / This Month / This Quarter /
Half Yearly / This Year / custom date range) and, where applicable, a
status/workflow funnel filter that adapts automatically to any Workflow
configured on that doctype.

### Personalization (Customize Mode)
Employees can hide cards/tabs, reorder them freely within two groups (stat
cards, and everything else), and move any card to a different tab
entirely — all live, with drag handled by SortableJS for reliable
cross-container reordering. Nothing is written to the server until **Save**
is pressed; **Discard** reverts instantly with no server round-trip, and
**Reset to Default** clears all personalization back to the site's global
default.

### Custom DocTypes
| DocType | Purpose |
|---|---|
| `Employee Hub Settings` (Single) | Site-wide on/off switches + the **Global Default Layout** every employee falls back to |
| `Employee Hub Layout` | One record per user — their personal customization, created only once they actually change something |
| `Employee Hub Layout Item` | Shared child table (tabs + cards, hide/reorder/tab-assignment) used by both of the above |
| `HR Request` | Lightweight custom request type (Visa Renewal, Exit Permit, Warning Letter, etc.) |

**Resolution order:** Personal layout (if it exists) → Global Default.
*(A Role Profile tier is scaffolded — see Roadmap below.)*

### HR Request
A simple custom doctype for HR request types not natively modeled in
ERPNext/HRMS, auto-filling the requesting employee on creation.

---

## 2. Access control

Two independent master switches, both in **Employee Hub Settings**:

- **Enable Employee Hub Access** — turns off the login redirect *and* the
  sidebar shortcut entirely. Off → completely normal ERPNext for everyone,
  nothing about this app is visible or active.
- **Allow Employees to Customize Their Own Layout** — turns off Customize
  Mode specifically, while the dashboard itself still works normally.

Login redirect and sidebar visibility are both scoped to users who have a
linked **Employee** record — a plain System User with no Employee record
never sees either, regardless of the switches above.

**Permissions** on the personalization doctypes are deliberately tight:
- `Employee Hub Layout` — **nobody** can create/edit records manually (not
  even System Manager) — `create: 0` / `write: 0` for every role, and the
  "+ Add" button is removed outright via a dedicated list view script.
  The *only* way a record is ever created or modified is through Customize
  Mode, via a whitelisted API method that always operates on
  `frappe.session.user` and can never target another user's record.
  System Manager can still **view** any employee's saved layout (read-only)
  for support purposes; a plain Employee can only ever see their own.
- `Employee Hub Settings` — System Manager only, full access, changes are
  version-tracked.
- The child table's `card_key` field is validated server-side against the
  actual set of known cards, so a typo or made-up value is rejected
  immediately rather than silently doing nothing.

---

## 3. Version compatibility

Targets **Frappe/ERPNext v14, v15, and v16**. Two things specifically
needed care to support all three cleanly:

- **`HR Manager`** is an HRMS-app role, not core Frappe — it won't exist on
  a site without HRMS installed. Rather than hardcode it into any DocType's
  static permissions (which would break `bench migrate` on such a site),
  it's granted **conditionally** at migrate time, only if
  `frappe.db.exists("Role", "HR Manager")` is true (see
  `employee_hub/setup/install.py`).
- **Frappe Cloud specifically** (as opposed to local `bench get-app`)
  expects a `pyproject.toml` at the repo root declaring
  `[tool.bench.frappe-dependencies]` with the supported Frappe version
  range — this is present and set to `>=14.0.0,<17.0.0`.

---

## 4. Install

```bash
cd frappe-bench
bench get-app <this repo's URL>
bench --site your-site.local install-app employee_hub
bench --site your-site.local migrate
bench build --app employee_hub --force
bench restart
```

`migrate` runs two things automatically (both idempotent — safe on every
future migrate, won't overwrite anything you've since edited):
- Seeds `Employee Hub Settings`' Global Default Layout to match the app's
  current default structure, the first time it's empty.
- Grants `HR Manager` its intended read-only access, if that role exists.

No manual sidebar/Workspace setup needed — the pinned "Employee Hub" link
is injected automatically for any logged-in user with a linked Employee
record (assuming the access switch above is on).

---

## 5. File structure

| Piece | Path |
|---|---|
| Hooks / app config | `employee_hub/hooks.py` |
| Login redirect + sidebar visibility flag | `employee_hub/employee_hub/boot.py` |
| All whitelisted API endpoints | `employee_hub/employee_hub/api.py` |
| Dashboard page (all client logic) | `employee_hub/employee_hub/page/employee_hub/` |
| Personalization doctypes | `employee_hub/employee_hub/doctype/employee_hub_settings/`, `employee_hub_layout/`, `employee_hub_layout_item/` |
| Canonical default layout data | `employee_hub/employee_hub/utils/default_layout.py` |
| Shared child-table validation | `employee_hub/employee_hub/utils/layout_validations.py` |
| Install/migrate-time setup | `employee_hub/employee_hub/setup/install.py` |
| HR Request doctype | `employee_hub/employee_hub/doctype/hr_request/` |
| Styling | `employee_hub/public/css/employee_hub.css` |
| Sidebar injection + login redirect (client) | `employee_hub/public/js/employee_hub_boot.js` |
| Frappe Cloud packaging | `pyproject.toml` (repo root) |

---

## 6. Design principles

- **Zero changes to ERPNext core** — only additive: new doctypes, one Page,
  hooks. Upgrade-safe.
- **Version-agnostic code** wherever possible; the one place a version
  branch might eventually be needed (Phase 4, see below) is explicitly
  flagged and isolated rather than guessed at in advance.
- **Forward-compatible layouts** — any card/tab added in a future update
  that a saved layout doesn't yet know about is automatically merged in at
  its default position, rather than silently missing.
- **Minimal server load** — hide/reorder/move actions during Customize
  Mode are pure client-side state; the only network calls are one fetch on
  load and one batched save on demand, never one call per action.

---

## 7. Roadmap

- **Role Profile Layout** — an admin-defined layout override shared by
  everyone with a given Role Profile, sitting between Personal and Global
  Default in the resolution order. The settings field
  (`enable_role_profile_layouts`) is already scaffolded, hidden until this
  ships.
- **Custom Dashboard Chart / Number Card / Shortcut integration** — letting
  users add real ERPNext charts into their layout via Customize Mode,
  rendered through the app's existing `frappe.Chart` wrapper for automatic
  theme/responsive consistency with everything else already on the page.