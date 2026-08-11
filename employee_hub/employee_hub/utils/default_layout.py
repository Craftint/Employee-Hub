# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)
#
# Single source of truth for "what the app looks like out of the box" —
# used both by setup/install.py (to seed the Global Default Layout on
# first migrate) and by api.py (to merge any saved layout — global, role
# profile, or personal — with cards/tabs that didn't exist when that
# layout was last saved, so nothing new silently disappears).

KNOWN_TABS = ["dashboard", "attendance", "salary", "tasks", "performance", "requests", "documents"]

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
    {"scope": "Card", "tab": "documents", "card_key": "my-documents-valid", "sequence": 1},
    {"scope": "Card", "tab": "documents", "card_key": "my-documents-expiring", "sequence": 2},
]