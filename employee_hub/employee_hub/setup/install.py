# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe

# Mirrors the app's current, already-shipped structure exactly — this is
# what "Global Default Layout" is seeded to. Sequence is a simple ascending
# counter per tab; Phase 2's renderer applies it *within* whatever group a
# card naturally belongs to (stat cards among stat cards, charts among
# charts, list cards among list cards), not as one global ordering, so it
# doesn't need to reset per group here.
TAB_ROWS = [
    {"scope": "Tab", "tab": "dashboard", "sequence": 1},
    {"scope": "Tab", "tab": "attendance", "sequence": 2},
    {"scope": "Tab", "tab": "salary", "sequence": 3},
    {"scope": "Tab", "tab": "tasks", "sequence": 4},
    {"scope": "Tab", "tab": "performance", "sequence": 5},
    {"scope": "Tab", "tab": "requests", "sequence": 6},
    {"scope": "Tab", "tab": "documents", "sequence": 7},
]

CARD_ROWS = [
    # Dashboard
    {"scope": "Card", "tab": "dashboard", "card_key": "stat-attendance", "sequence": 1},
    {"scope": "Card", "tab": "dashboard", "card_key": "stat-leaves", "sequence": 2},
    {"scope": "Card", "tab": "dashboard", "card_key": "stat-tasks", "sequence": 3},
    {"scope": "Card", "tab": "dashboard", "card_key": "stat-timesheets", "sequence": 4},
    {"scope": "Card", "tab": "dashboard", "card_key": "stat-salary", "sequence": 5},
    {"scope": "Card", "tab": "dashboard", "card_key": "attendance-chart", "sequence": 6},
    {"scope": "Card", "tab": "dashboard", "card_key": "leave-pie", "sequence": 7},
    {"scope": "Card", "tab": "dashboard", "card_key": "quick-actions", "sequence": 8},
    {"scope": "Card", "tab": "dashboard", "card_key": "birthdays", "sequence": 9},
    {"scope": "Card", "tab": "dashboard", "card_key": "salary-trend", "sequence": 10},
    {"scope": "Card", "tab": "dashboard", "card_key": "task-donut", "sequence": 11},
    # Attendance & Leaves
    {"scope": "Card", "tab": "attendance", "card_key": "leave-balance", "sequence": 1},
    {"scope": "Card", "tab": "attendance", "card_key": "shift-assignment", "sequence": 2},
    {"scope": "Card", "tab": "attendance", "card_key": "attendance", "sequence": 3},
    {"scope": "Card", "tab": "attendance", "card_key": "employee-checkin", "sequence": 4},
    {"scope": "Card", "tab": "attendance", "card_key": "leave-application", "sequence": 5},
    {"scope": "Card", "tab": "attendance", "card_key": "attendance-request", "sequence": 6},
    # Salary & Expenses
    {"scope": "Card", "tab": "salary", "card_key": "salary-slip", "sequence": 1},
    {"scope": "Card", "tab": "salary", "card_key": "expense-claim", "sequence": 2},
    {"scope": "Card", "tab": "salary", "card_key": "salary-trend", "sequence": 3},
    # Tasks & Timesheets
    {"scope": "Card", "tab": "tasks", "card_key": "task", "sequence": 1},
    {"scope": "Card", "tab": "tasks", "card_key": "timesheet", "sequence": 2},
    {"scope": "Card", "tab": "tasks", "card_key": "task-donut", "sequence": 3},
    # Performance
    {"scope": "Card", "tab": "performance", "card_key": "appraisal", "sequence": 1},
    # Requests
    {"scope": "Card", "tab": "requests", "card_key": "hr-request", "sequence": 1},
    # Documents
    {"scope": "Card", "tab": "documents", "card_key": "documents-info", "sequence": 1},
]


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
