# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe
from frappe import _
from frappe.utils import (
    getdate,
    nowdate,
    add_days,
    formatdate,
    get_first_day,
)

# ---------------------------------------------------------------------------
# Version note: every API here uses only long-stable Frappe/ERPNext APIs
# (frappe.get_list, frappe.db.sql/count/get_value, frappe.db.exists) and
# core HR doctype field names that are unchanged across ERPNext v14, v15,
# and v16 (with the HRMS app installed, which is required by all three for
# Attendance/Leave/Shift/Expense Claim/Appraisal etc). Every optional
# doctype lookup is guarded with frappe.db.exists("DocType", ...) so a
# missing doctype degrades to an empty list instead of an error.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Period filter helper — calendar-aware windows, shared by every per-card
# filter dropdown.
# ---------------------------------------------------------------------------
def resolve_period(period=None, from_date=None, to_date=None):
    today = getdate(nowdate())

    if period == "range" and from_date and to_date:
        return getdate(from_date), getdate(to_date)

    if not period or period == "today":
        # Literally today only.
        return today, today

    if period == "week":
        # Last 7 days, including today.
        return add_days(today, -6), today

    if period == "month":
        # Current calendar month, from the 1st through today.
        return getdate(get_first_day(today)), today

    if period == "quarter":
        # Current calendar quarter: Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        return today.replace(month=quarter_start_month, day=1), today

    if period == "half_year":
        # Last 6 months, including the current month.
        start_month_index = today.month - 1 - 5  # 0-based, 5 months back from current
        start_year = today.year
        while start_month_index < 0:
            start_month_index += 12
            start_year -= 1
        return today.replace(year=start_year, month=start_month_index + 1, day=1), today

    if period == "year":
        # Since the start of the current fiscal year. Falls back to the
        # calendar year start if no Fiscal Year record covers today (e.g. a
        # fresh site without that year configured yet).
        try:
            from frappe.utils import get_fiscal_year

            fy = get_fiscal_year(today, as_dict=True)
            return getdate(fy.year_start_date), today
        except Exception:
            return today.replace(month=1, day=1), today

    # Unknown period value — safe fallback to today only.
    return today, today


# Each card's own default period (used whenever the client doesn't pass an
# explicit period — i.e. on first load, before the user touches that card's
# filter). Anything not listed here defaults to "today".
CARD_DEFAULT_PERIOD = {
    "attendance-chart": "week",
    "attendance": "week",
    "employee-checkin": "week",
    "leave-application": "week",
    "attendance-request": "week",
    "task": "week",
    "timesheet": "week",
    "task-donut": "week",
    "salary-slip": "month",
    "expense-claim": "month",
    "salary-trend": "quarter",
    "appraisal": "year",
}


def resolve_card_period(card_key, period=None, from_date=None, to_date=None):
    if not period:
        period = CARD_DEFAULT_PERIOD.get(card_key, "today")
    return resolve_period(period, from_date, to_date)


def list_in_range(doctype, filters, date_field, fields, start, end, limit=5):
    """Fetch up to `limit` records of `doctype` whose `date_field` falls in
    [start, end], most recent by that same date field first — so the 5
    shown are always the most recent dates within the selected period, not
    whichever 5 happened to be edited most recently (which could be any
    date at all once the period is wide, e.g. "This Year"). Returns
    (records, total_count) — total_count lets the UI show "X of Y" so
    filtering is visibly working even when the card preview is capped.
    Returns ([], 0) if the doctype isn't installed on this site."""
    if not frappe.db.exists("DocType", doctype):
        return [], 0
    filters = dict(filters)
    filters[date_field] = ["between", [start, end]]
    total = frappe.db.count(doctype, filters)
    records = frappe.get_list(doctype, filters=filters, fields=fields, order_by=f"{date_field} desc", limit=limit)
    return records, total


# ---------------------------------------------------------------------------
# Profile card (persistent across every tab)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_profile_data():
    user = frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not employee:
        frappe.throw(_("No Employee record is linked to your user account."))

    emp = frappe.get_doc("Employee", employee)
    image = emp.image or frappe.db.get_value("User", user, "user_image")

    return {
        "name": emp.name,
        "employee_name": emp.employee_name,
        "designation": emp.designation,
        "department": emp.department,
        "company": emp.company,
        "date_of_joining": emp.date_of_joining,
        "status": emp.status,
        "email": emp.user_id or emp.personal_email or emp.company_email,
        "phone": emp.cell_number,
        "image": image,
        "has_image": bool(image),
    }


# ---------------------------------------------------------------------------
# My ToDos + Upcoming Events (persistent, below the profile card)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_my_todos_and_events():
    user = frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")

    todos = frappe.get_list(
        "ToDo",
        filters={"allocated_to": user, "status": "Open"},
        fields=["name", "description", "reference_type", "reference_name", "priority", "date", "assigned_by"],
        order_by="modified desc",
        limit=8,
    )
    todos_total = frappe.db.count("ToDo", {"allocated_to": user, "status": "Open"})

    events = []
    events_total = 0
    if frappe.db.exists("DocType", "Event"):
        # Event Participants can reference either "User" (reference_docname = email)
        # or "Employee" (reference_docname = employee id) — a participant added as
        # an Employee would never match on user email alone, so both are checked.
        params = {"user": user, "employee": employee, "today": nowdate()}
        where_clause = """
            (
                e.owner = %(user)s
                or (ep.reference_doctype = 'User' and ep.reference_docname = %(user)s)
                or (ep.reference_doctype = 'Employee' and ep.reference_docname = %(employee)s)
            )
            and e.starts_on >= %(today)s
        """
        events = frappe.db.sql(
            f"""
            select distinct e.name, e.subject, e.starts_on, e.event_type
            from `tabEvent` e
            left join `tabEvent Participants` ep on ep.parent = e.name
            where {where_clause}
            order by e.starts_on asc
            limit 5
            """,
            params,
            as_dict=True,
        )
        total_row = frappe.db.sql(
            f"""
            select count(distinct e.name)
            from `tabEvent` e
            left join `tabEvent Participants` ep on ep.parent = e.name
            where {where_clause}
            """,
            params,
        )
        events_total = total_row[0][0] if total_row and total_row[0][0] else 0

    return {"todos": todos, "todos_total": todos_total, "events": events, "events_total": events_total}


# ---------------------------------------------------------------------------
# Open communications count (message icon, top of page)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_open_communication_count():
    user = frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")

    count = 0
    if employee:
        # A Communication can reference an Employee directly (reference_doctype/
        # reference_name), OR only via its "Timeline Links" child table (e.g. when
        # the Communication's primary reference is an Event/Lead/etc. but an
        # Employee was added as a participant/linked party) — both are checked.
        row = frappe.db.sql(
            """
            select count(distinct c.name)
            from `tabCommunication` c
            left join `tabCommunication Link` cl on cl.parent = c.name
            where c.status = 'Open'
              and (
                  (c.reference_doctype = 'Employee' and c.reference_name = %(employee)s)
                  or (cl.link_doctype = 'Employee' and cl.link_name = %(employee)s)
              )
            """,
            {"employee": employee},
        )
        count = row[0][0] if row and row[0][0] else 0
    return {"count": count, "employee": employee}


# ---------------------------------------------------------------------------
# Dashboard tab — stat cards + charts (initial bulk load; each chart/list
# can then be independently re-filtered via its own mini filter, see below)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_dashboard_data():
    user = frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not employee:
        frappe.throw(_("No Employee record is linked to your user account."))

    # The 5 number cards (Attendance/Leaves/Tasks/Timesheets/Salary) — the
    # Attendance/Timesheets ones now say "This Month", matching this window.
    stats_start, stats_end = resolve_period("month")

    # Each filterable card on the dashboard uses its own default period
    # (see CARD_DEFAULT_PERIOD), matched here for the initial (unfiltered)
    # load so the mini filter pill shown matches the data actually loaded.
    chart_start, chart_end = resolve_card_period("attendance-chart")
    salary_start, salary_end = resolve_card_period("salary-trend")
    donut_start, donut_end = resolve_card_period("task-donut")

    leave_data = get_leave_summary(employee)

    return {
        "stats": get_stats(employee, user, leave_data, stats_start, stats_end),
        "attendance_chart": get_attendance_chart(chart_start, chart_end),
        "leave_pie": get_leave_pie(leave_data),
        "birthdays": get_upcoming_birthdays(employee),
        "salary_trend": _salary_trend_rows(employee, salary_start, salary_end),
        "task_status_breakdown": _task_status_breakdown_rows(user, donut_start, donut_end),
    }


def get_stats(employee, user, leave_data, start, end):
    days_in_period = (end - start).days + 1

    present = frappe.db.count(
        "Attendance",
        {"employee": employee, "attendance_date": ["between", [start, end]], "status": "Present", "docstatus": 1},
    )

    total_available = sum([l.get("available", 0) for l in leave_data])

    pending_tasks = frappe.db.count(
        "Task", {"_assign": ["like", f"%{user}%"], "status": ["not in", ["Completed", "Cancelled"]]}
    )

    hours_row = frappe.db.sql(
        """
        select sum(td.hours)
        from `tabTimesheet Detail` td
        inner join `tabTimesheet` t on t.name = td.parent
        where t.employee=%s and t.docstatus < 2 and date(td.from_time) between %s and %s
        """,
        (employee, start, end),
    )
    hours_in_period = hours_row[0][0] if hours_row and hours_row[0][0] else 0

    slip = get_latest_salary_slip(employee)

    return {
        "attendance": {"present": present, "total_days": days_in_period},
        "leaves": {"available": total_available},
        "tasks": {"pending": pending_tasks},
        "timesheets": {"hours": round(hours_in_period, 1)},
        "salary": {
            "month": formatdate(slip.end_date, "MMM yyyy") if slip else "N/A",
            "status": "Paid" if slip else "N/A",
        },
    }


@frappe.whitelist()
def get_attendance_chart(start=None, end=None, period=None, from_date=None, to_date=None):
    """Powers both the initial dashboard load and the Attendance Overview
    card's own mini filter dropdown."""
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    if not employee:
        frappe.throw(_("No Employee record linked."))

    if not start or not end:
        start, end = resolve_card_period("attendance-chart", period, from_date, to_date)
    else:
        start, end = getdate(start), getdate(end)

    records = frappe.db.sql(
        """
        select attendance_date, status
        from `tabAttendance`
        where employee=%s and docstatus=1 and attendance_date between %s and %s
        """,
        (employee, start, end),
        as_dict=True,
    )

    buckets = []
    cur = start
    max_buckets = 60  # ~1 year of weekly buckets; a hard safety cap
    while cur <= end and len(buckets) < max_buckets:
        week_end = min(add_days(cur, 6), end)
        buckets.append(
            {
                "label": cur.strftime("%d %b"),
                "start": cur,
                "end": week_end,
                "present": 0,
                "absent": 0,
                "half_day": 0,
                "on_leave": 0,
                "work_from_home": 0,
            }
        )
        cur = add_days(week_end, 1)

    for r in records:
        r_date = getdate(r.attendance_date)
        for b in buckets:
            if b["start"] <= r_date <= b["end"]:
                if r.status == "Present":
                    b["present"] += 1
                elif r.status == "Absent":
                    b["absent"] += 1
                elif r.status == "Half Day":
                    b["half_day"] += 1
                elif r.status == "On Leave":
                    b["on_leave"] += 1
                elif r.status == "Work From Home":
                    b["work_from_home"] += 1
                break

    return {
        "labels": [b["label"] for b in buckets],
        "present": [b["present"] for b in buckets],
        "absent": [b["absent"] for b in buckets],
        "half_day": [b["half_day"] for b in buckets],
        "on_leave": [b["on_leave"] for b in buckets],
        "work_from_home": [b["work_from_home"] for b in buckets],
    }


def get_leave_pie(leave_data):
    if not leave_data:
        return None
    return {
        "labels": [l["leave_type"] for l in leave_data],
        "values": [l["available"] for l in leave_data],
    }


def get_leave_summary(employee):
    allocations = frappe.db.sql(
        """
        select leave_type, total_leaves_allocated
        from `tabLeave Allocation`
        where employee=%s and docstatus=1 and to_date >= %s
        """,
        (employee, nowdate()),
        as_dict=True,
    )

    result = []
    for a in allocations:
        taken_row = frappe.db.sql(
            """
            select sum(total_leave_days) from `tabLeave Application`
            where employee=%s and leave_type=%s and docstatus=1 and status='Approved'
            """,
            (employee, a.leave_type),
        )
        taken = taken_row[0][0] if taken_row and taken_row[0][0] else 0
        result.append(
            {
                "leave_type": a.leave_type,
                "allocated": a.total_leaves_allocated,
                "used": taken,
                "available": a.total_leaves_allocated - taken,
            }
        )
    return result


def get_latest_salary_slip(employee):
    return frappe.db.get_value(
        "Salary Slip",
        {"employee": employee, "docstatus": 1},
        ["name", "net_pay", "start_date", "end_date"],
        order_by="end_date desc",
        as_dict=True,
    )


def _salary_trend_rows(employee, start, end):
    """Filters Salary Slips by posting_date (when the slip was actually
    created/submitted), not end_date (the payroll period's end date — which
    is very often in the future relative to posting_date, e.g. a slip
    posted today for a period ending at month-end). Filtering by end_date
    made brand-new slips invisible under any near-term filter, including
    "Today". end_date is still used for the chart's period labels/ordering,
    since that's what makes a "trend over pay periods" meaningful."""
    rows = frappe.get_list(
        "Salary Slip",
        filters={"employee": employee, "docstatus": ["<", 2], "posting_date": ["between", [start, end]]},
        fields=["end_date", "net_pay"],
        order_by="end_date desc",
        limit=6,
    )
    rows.reverse()
    return {
        "labels": [formatdate(r.end_date, "MMM yy") for r in rows],
        "values": [r.net_pay for r in rows],
    }


@frappe.whitelist()
def get_salary_trend_chart(period=None, from_date=None, to_date=None):
    """Filterable version of _salary_trend_rows, powering that card's own
    mini filter dropdown."""
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    if not employee:
        frappe.throw(_("No Employee record linked."))

    start, end = resolve_card_period("salary-trend", period, from_date, to_date)
    return _salary_trend_rows(employee, start, end)


def _task_status_breakdown_rows(user, start, end):
    rows = frappe.db.sql(
        """
        select status, count(*) as cnt
        from `tabTask`
        where _assign like %s and modified between %s and %s
        group by status
        """,
        (f"%{user}%", start, end),
        as_dict=True,
    )
    return {"labels": [r.status for r in rows], "values": [r.cnt for r in rows]}


@frappe.whitelist()
def get_task_status_chart(period=None, from_date=None, to_date=None):
    """Filterable version of _task_status_breakdown_rows, powering that
    card's own mini filter dropdown."""
    user = frappe.session.user
    start, end = resolve_card_period("task-donut", period, from_date, to_date)
    return _task_status_breakdown_rows(user, start, end)


def get_upcoming_birthdays(employee):
    # frappe.get_list (not frappe.db.sql / frappe.get_all) specifically
    # because it applies the current session user's actual Employee
    # permissions automatically — any employee they don't have read access
    # to (via User Permissions, employee restrictions, etc.) is correctly
    # excluded. The previous raw-SQL version bypassed all of that.
    rows = frappe.get_list(
        "Employee",
        filters={"status": "Active", "name": ["!=", employee], "date_of_birth": ["is", "set"]},
        fields=["name", "employee_name", "image", "date_of_birth"],
    )
    today_date = getdate(nowdate())
    upcoming = []
    for d in rows:
        dob = getdate(d.date_of_birth)
        try:
            next_bday = dob.replace(year=today_date.year)
        except ValueError:
            continue
        if next_bday < today_date:
            next_bday = dob.replace(year=today_date.year + 1)
        days_away = (next_bday - today_date).days
        if 0 <= days_away <= 30:
            d["days_away"] = days_away
            d["next_birthday"] = next_bday
            upcoming.append(d)
    upcoming.sort(key=lambda x: x["days_away"])
    return upcoming[:10]


# ---------------------------------------------------------------------------
# Per-tab bulk data (initial load only — each list's own mini filter then
# calls get_card_list independently, see below)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_tab_data(tab):
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    if not employee:
        frappe.throw(_("No Employee record linked."))

    if tab == "attendance":
        # Attendance / Employee Checkin / Leave Application / Attendance
        # Request all default to "This Week".
        start, end = resolve_period("week")
        attendance, attendance_total = list_in_range(
            "Attendance", {"employee": employee, "docstatus": 1}, "attendance_date",
            ["name", "attendance_date", "status"], start, end,
        )
        checkins, checkins_total = list_in_range(
            "Employee Checkin", {"employee": employee}, "time",
            ["name", "time", "log_type"], start, end,
        )
        leave_apps, leave_apps_total = list_in_range(
            "Leave Application", {"employee": employee}, "from_date",
            ["name", "leave_type", "from_date", "to_date", "status"], start, end,
        )
        att_req, att_req_total = list_in_range(
            "Attendance Request", {"employee": employee}, "from_date",
            ["name", "from_date", "to_date", "reason"], start, end,
        )
        return {
            "attendance": attendance,
            "checkins": checkins,
            "leave_applications": leave_apps,
            "attendance_requests": att_req,
            "leave_balance": get_leave_summary(employee),
            "shifts": frappe.get_list(
                "Shift Assignment",
                filters={"employee": employee, "docstatus": 1},
                fields=["name", "shift_type", "start_date", "end_date", "status"],
                order_by="modified desc",
                limit=5,
            ) if frappe.db.exists("DocType", "Shift Assignment") else [],
            "counts": {
                "attendance": attendance_total,
                "employee-checkin": checkins_total,
                "leave-application": leave_apps_total,
                "attendance-request": att_req_total,
            },
        }

    if tab == "salary":
        # Salary Slip / Expense Claim default to "This Month"; Net Pay
        # Trend defaults to "This Quarter" — different window, same tab.
        start, end = resolve_period("month")
        slips, slips_total = list_in_range(
            "Salary Slip", {"employee": employee}, "posting_date",
            ["name", "start_date", "end_date", "net_pay", "status", "currency"], start, end,
        )
        claims, claims_total = list_in_range(
            "Expense Claim", {"employee": employee}, "posting_date",
            ["name", "posting_date", "total_claimed_amount", "status", "currency"], start, end,
        )
        trend_start, trend_end = resolve_card_period("salary-trend")
        return {
            "salary_slips": slips,
            "expense_claims": claims,
            "salary_trend": _salary_trend_rows(employee, trend_start, trend_end),
            "counts": {"salary-slip": slips_total, "expense-claim": claims_total},
        }

    if tab == "tasks":
        # My Tasks / Timesheets / Task Status Breakdown all default to "This Week".
        start, end = resolve_period("week")
        tasks, tasks_total = list_in_range(
            "Task", {"_assign": ["like", f"%{frappe.session.user}%"]}, "modified",
            ["name", "subject", "status", "priority", "exp_end_date"], start, end,
        )
        timesheets, timesheets_total = list_in_range(
            "Timesheet", {"employee": employee}, "start_date",
            ["name", "start_date", "total_hours", "status"], start, end,
        )
        return {
            "tasks": tasks,
            "timesheets": timesheets,
            "task_status_breakdown": _task_status_breakdown_rows(frappe.session.user, start, end),
            "counts": {"task": tasks_total, "timesheet": timesheets_total},
        }

    if tab == "performance":
        # Appraisals default to "This Year".
        start, end = resolve_period("year")
        appraisals, appraisals_total = list_in_range(
            "Appraisal", {"employee": employee}, "creation",
            ["name", "appraisal_cycle", "status"], start, end,
        )
        return {
            "appraisals": appraisals,
            "counts": {"appraisal": appraisals_total},
        }

    if tab == "requests":
        # Not specified — keeps the general default (Today).
        start, end = resolve_period()
        requests, requests_total = list_in_range(
            "HR Request", {"employee": employee}, "posting_date",
            ["name", "request_type", "status", "posting_date"], start, end,
        )
        return {
            "requests": requests,
            "counts": {"hr-request": requests_total},
        }

    if tab == "documents":
        return {}

    frappe.throw(_("Unknown tab: {0}").format(tab))


# ---------------------------------------------------------------------------
# Generic per-card endpoint — powers each card's own mini filter dropdown
# ---------------------------------------------------------------------------
LIST_CARD_CONFIG = {
    "attendance": {
        "doctype": "Attendance",
        "date_field": "attendance_date",
        "fields": ["name", "attendance_date", "status"],
        "base_filters": {"docstatus": 1},
    },
    "employee-checkin": {
        "doctype": "Employee Checkin",
        "date_field": "time",
        "fields": ["name", "time", "log_type"],
        "base_filters": {},
    },
    "leave-application": {
        "doctype": "Leave Application",
        "date_field": "from_date",
        "fields": ["name", "leave_type", "from_date", "to_date", "status"],
        "base_filters": {},
    },
    "attendance-request": {
        "doctype": "Attendance Request",
        "date_field": "from_date",
        "fields": ["name", "from_date", "to_date", "reason"],
        "base_filters": {},
    },
    "salary-slip": {
        "doctype": "Salary Slip",
        "date_field": "posting_date",
        "fields": ["name", "start_date", "end_date", "net_pay", "status", "currency"],
        "base_filters": {},
    },
    "expense-claim": {
        "doctype": "Expense Claim",
        "date_field": "posting_date",
        "fields": ["name", "posting_date", "total_claimed_amount", "status", "currency"],
        "base_filters": {},
    },
    "task": {
        "doctype": "Task",
        "date_field": "modified",
        "fields": ["name", "subject", "status", "priority", "exp_end_date"],
        "base_filters": {},
        "assign_based": True,
    },
    "timesheet": {
        "doctype": "Timesheet",
        "date_field": "start_date",
        "fields": ["name", "start_date", "total_hours", "status"],
        "base_filters": {},
    },
    "appraisal": {
        "doctype": "Appraisal",
        "date_field": "creation",
        "fields": ["name", "appraisal_cycle", "status"],
        "base_filters": {},
    },
    "hr-request": {
        "doctype": "HR Request",
        "date_field": "posting_date",
        "fields": ["name", "request_type", "status", "posting_date"],
        "base_filters": {},
    },
}


@frappe.whitelist()
def get_card_list(card_key, period=None, from_date=None, to_date=None, status_field=None, status_value=None):
    cfg = LIST_CARD_CONFIG.get(card_key)
    if not cfg:
        frappe.throw(_("Unknown card: {0}").format(card_key))

    start, end = resolve_card_period(card_key, period, from_date, to_date)

    if cfg.get("assign_based"):
        filters = {"_assign": ["like", f"%{frappe.session.user}%"]}
    else:
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if not employee:
            frappe.throw(_("No Employee record linked."))
        filters = {"employee": employee}

    filters.update(cfg.get("base_filters", {}))

    # Only trust status_field if it's a real field on this doctype — never
    # let the client dictate an arbitrary filter field.
    if status_field and status_value:
        meta = frappe.get_meta(cfg["doctype"])
        if meta.get_field(status_field):
            filters[status_field] = status_value

    records, total = list_in_range(cfg["doctype"], filters, cfg["date_field"], cfg["fields"], start, end)
    return {"records": records, "total": total}


@frappe.whitelist()
def get_card_status_options(card_key):
    """Powers the funnel/status-filter icon on each card. If the doctype has
    an active Workflow, its states become the filter options (filtering on
    the workflow's own state field). Otherwise, falls back to the doctype's
    standard "status" Select field, if it has one. Returns an empty options
    list (hiding the icon client-side) if neither exists."""
    cfg = LIST_CARD_CONFIG.get(card_key)
    if not cfg:
        frappe.throw(_("Unknown card: {0}").format(card_key))

    doctype = cfg["doctype"]

    workflow = frappe.db.get_value(
        "Workflow", {"document_type": doctype, "is_active": 1}, ["name", "workflow_state_field"], as_dict=True
    )
    if workflow:
        states = frappe.get_all(
            "Workflow Document State",
            filters={"parent": workflow.name},
            fields=["state"],
            order_by="idx",
        )
        return {
            "field": workflow.workflow_state_field or "workflow_state",
            "options": [s.state for s in states],
        }

    meta = frappe.get_meta(doctype)
    status_field = meta.get_field("status")
    if status_field and status_field.fieldtype == "Select" and status_field.options:
        options = [o.strip() for o in status_field.options.split("\n") if o.strip()]
        return {"field": "status", "options": options}

    return {"field": None, "options": []}


# ---------------------------------------------------------------------------
# Personalization (Phase 2) — resolving, saving, and resetting a user's
# layout. Resolution order for now is Personal -> Global Default; Phase 3
# inserts a Role Profile tier in between once that doctype exists.
# ---------------------------------------------------------------------------
def _layout_item_to_dict(row):
    return {
        "scope": row.scope,
        "tab": row.tab,
        "card_key": row.card_key,
        "is_hidden": row.is_hidden,
        "sequence": row.sequence,
    }


def _merge_with_defaults(items):
    """Forward-compatibility: any tab/card that exists in the app but isn't
    mentioned in `items` (e.g. added in a later app update, after this
    layout was last saved) is appended at the end of its group, visible by
    default — nothing new silently disappears just because a saved layout
    predates it."""
    from employee_hub.employee_hub.utils.default_layout import TAB_ROWS, CARD_ROWS

    result = [_layout_item_to_dict(i) for i in items]

    existing_tabs = {r["tab"] for r in result if r["scope"] == "Tab"}
    # card_key alone, NOT (tab, card_key) — a card that's been moved to a
    # different tab still has the same card_key, so this correctly
    # recognizes it as already accounted for rather than mistaking the move
    # for a missing card and silently re-adding the default (old tab, card)
    # pair, which is what was undoing every cross-tab move.
    existing_card_keys = {r["card_key"] for r in result if r["scope"] == "Card"}

    max_tab_seq = max([r["sequence"] for r in result if r["scope"] == "Tab"], default=0)
    for row in TAB_ROWS:
        if row["tab"] not in existing_tabs:
            max_tab_seq += 1
            result.append({"scope": "Tab", "tab": row["tab"], "card_key": None, "is_hidden": 0, "sequence": max_tab_seq})

    max_card_seq_by_tab = {}
    for r in result:
        if r["scope"] == "Card":
            max_card_seq_by_tab[r["tab"]] = max(max_card_seq_by_tab.get(r["tab"], 0), r["sequence"])

    for row in CARD_ROWS:
        if row["card_key"] not in existing_card_keys:
            tab = row["tab"]
            max_card_seq_by_tab[tab] = max_card_seq_by_tab.get(tab, 0) + 1
            result.append(
                {
                    "scope": "Card",
                    "tab": tab,
                    "card_key": row["card_key"],
                    "is_hidden": 0,
                    "sequence": max_card_seq_by_tab[tab],
                }
            )

    return result


@frappe.whitelist()
def get_effective_layout():
    """Returns the layout that actually applies to the current user right
    now, already merged with the current default card/tab list, plus which
    tier it came from (so the UI can e.g. show "Reset to Default" only when
    a personal layout is actually in effect).

    Resolution order: Personal -> Role Profile (if enabled site-wide, the
    user has one assigned, and an enabled record exists for it) -> Global
    Default."""
    user = frappe.session.user

    settings = frappe.get_single("Employee Hub Settings")

    # A saved personal layout is only served while personalization is
    # currently enabled. If an admin later turns it off, existing personal
    # layouts are NOT deleted (they stay intact, viewable read-only) — but
    # every affected employee, including whoever made the customization,
    # now sees whichever tier applies next (Role Profile if configured and
    # enabled, otherwise Global Default), exactly as if they'd never
    # personalized anything.
    if settings.allow_personal_customization and frappe.db.exists("Employee Hub Layout", user):
        doc = frappe.get_doc("Employee Hub Layout", user)
        if doc.layout:
            return {
                "source": "personal",
                "allow_personal_customization": bool(settings.allow_personal_customization),
                "items": _merge_with_defaults(doc.layout),
            }
        # A personal layout record exists but has no rows in it (e.g. an
        # earlier test call saved an empty list) — treat that exactly the
        # same as "no personal layout", not as a genuine customization.

    if settings.enable_role_profile_layouts:
        role_profile = frappe.db.get_value("User", user, "role_profile_name")
        if role_profile:
            rp_meta = frappe.db.get_value(
                "Employee Hub Role Profile Layout", role_profile, ["name", "enabled"], as_dict=True
            )
            if rp_meta and rp_meta.enabled:
                rp_doc = frappe.get_doc("Employee Hub Role Profile Layout", role_profile)
                if rp_doc.layout:
                    return {
                        "source": "role_profile",
                        "allow_personal_customization": bool(settings.allow_personal_customization),
                        "items": _merge_with_defaults(rp_doc.layout),
                    }

    return {
        "source": "global",
        "allow_personal_customization": bool(settings.allow_personal_customization),
        "items": _merge_with_defaults(settings.global_default_layout),
    }


@frappe.whitelist()
def save_employee_hub_layout(items):
    """Upserts the current user's personal layout. `items` is a JSON string
    (or already-parsed list) of {scope, tab, card_key, is_hidden, sequence}
    dicts — exactly what the Customize Mode UI builds client-side.

    Matches each incoming item against the doc's EXISTING rows by
    (scope, tab, card_key) and updates matching rows in place, rather than
    clearing the whole table and re-appending everything fresh every time.
    That distinction matters for the version/audit trail specifically —
    wiping and rebuilding made every save look like "all N rows deleted, N
    rows added" regardless of how small the real change was (e.g. toggling
    one card's visibility). Preserving row identity means the audit trail
    now shows the actual field that changed on the actual row that changed."""
    settings = frappe.get_single("Employee Hub Settings")
    if not settings.allow_personal_customization:
        frappe.throw(_("Personal layout customization is currently disabled by your administrator."))

    if isinstance(items, str):
        items = frappe.parse_json(items)

    user = frappe.session.user

    if frappe.db.exists("Employee Hub Layout", user):
        doc = frappe.get_doc("Employee Hub Layout", user)
    else:
        doc = frappe.new_doc("Employee Hub Layout")
        doc.user = user
        doc.layout = []

    existing_by_key = {(row.scope, row.tab, row.card_key or ""): row for row in doc.layout}

    incoming_keys = set()
    for item in items:
        key = (item.get("scope"), item.get("tab"), item.get("card_key") or "")
        incoming_keys.add(key)
        existing_row = existing_by_key.get(key)
        if existing_row:
            existing_row.is_hidden = item.get("is_hidden", 0)
            existing_row.sequence = item.get("sequence", 0)
        else:
            doc.append(
                "layout",
                {
                    "scope": item.get("scope"),
                    "tab": item.get("tab"),
                    "card_key": item.get("card_key"),
                    "is_hidden": item.get("is_hidden", 0),
                    "sequence": item.get("sequence", 0),
                },
            )

    # Anything that existed before but isn't in the incoming list at all
    # (not just hidden — genuinely absent) gets removed, matched by the
    # same identity used above.
    doc.layout = [row for row in doc.layout if (row.scope, row.tab, row.card_key or "") in incoming_keys]

    # The doctype now has create=0/write=0 for every role (including the
    # owner) so nothing can create/edit an Employee Hub Layout except this
    # endpoint — ignore_permissions is safe here specifically because this
    # function never accepts a target user from the client; it always
    # operates on frappe.session.user, so there is no way to write another
    # user's record through it.
    doc.save(ignore_permissions=True)
    return {"ok": True}


@frappe.whitelist()
def reset_employee_hub_layout():
    """Deletes the current user's personal layout entirely, so they fall
    straight back through to the Global Default (or, from Phase 3 onward,
    their Role Profile Layout if one applies)."""
    user = frappe.session.user
    if frappe.db.exists("Employee Hub Layout", user):
        # Same reasoning as save_employee_hub_layout above — this always
        # targets frappe.session.user, never a client-supplied user.
        frappe.delete_doc("Employee Hub Layout", user, ignore_permissions=True)
    return {"ok": True}

# ---------------------------------------------------------------------------
# Single-card fetchers — these let ANY card be rendered on ANY tab, which is
# what "Move To" needs: once a card is moved to a different tab via
# Customize Mode, that tab's renderer needs a way to fetch just that one
# card's data on its own, rather than relying on the bulk per-tab endpoints
# above (which only ever return the cards that tab natively ships with).
# Charts and list-type cards already had this via get_attendance_chart /
# get_salary_trend_chart / get_task_status_chart / get_card_list — these
# fill in the remaining card types that didn't have an equivalent yet.
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_single_stat(stat_key):
    user = frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not employee:
        frappe.throw(_("No Employee record linked."))

    start, end = resolve_period("month")

    if stat_key == "stat-attendance":
        present = frappe.db.count(
            "Attendance",
            {"employee": employee, "attendance_date": ["between", [start, end]], "status": "Present", "docstatus": 1},
        )
        days_in_period = (end - start).days + 1
        return {
            "label": "Attendance",
            "value": f"{present}/{days_in_period}",
            "sub": "Days Present (This Month)",
            "link": "attendance",
            "percent": min(100, (present / max(days_in_period, 1)) * 100),
        }

    if stat_key == "stat-leaves":
        leave_data = get_leave_summary(employee)
        total_available = sum([l.get("available", 0) for l in leave_data])
        return {"label": "Leaves", "value": total_available, "sub": "Available Days Left", "link": "leave-application"}

    if stat_key == "stat-tasks":
        pending_tasks = frappe.db.count(
            "Task", {"_assign": ["like", f"%{user}%"], "status": ["not in", ["Completed", "Cancelled"]]}
        )
        return {"label": "Tasks", "value": pending_tasks, "sub": "Pending Tasks", "link": "task"}

    if stat_key == "stat-timesheets":
        hours_row = frappe.db.sql(
            """
            select sum(td.hours)
            from `tabTimesheet Detail` td
            inner join `tabTimesheet` t on t.name = td.parent
            where t.employee=%s and t.docstatus < 2 and date(td.from_time) between %s and %s
            """,
            (employee, start, end),
        )
        hours = hours_row[0][0] if hours_row and hours_row[0][0] else 0
        return {"label": "Timesheets", "value": round(hours, 1), "sub": "Hours (This Month)", "link": "timesheet"}

    if stat_key == "stat-salary":
        slip = get_latest_salary_slip(employee)
        return {
            "label": "Salary",
            "value": formatdate(slip.end_date, "MMM yyyy") if slip else "N/A",
            "sub": "Paid" if slip else "N/A",
            "link": "salary-slip",
        }

    frappe.throw(_("Unknown stat: {0}").format(stat_key))


@frappe.whitelist()
def get_leave_balance_card():
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    if not employee:
        frappe.throw(_("No Employee record linked."))
    return {"leave_balance": get_leave_summary(employee)}


@frappe.whitelist()
def get_birthdays_card():
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    if not employee:
        frappe.throw(_("No Employee record linked."))
    return {"birthdays": get_upcoming_birthdays(employee)}


@frappe.whitelist()
def reset_global_default_layout():
    """Resets the Global Default Layout back to the app's original,
    out-of-the-box structure. System Manager only — enforced here
    server-side (the client also checks, for a friendlier message without
    a round trip, but this is the check that actually can't be bypassed).
    Goes through a normal doc.save() (not ignore_permissions) so it's
    properly captured in this document's version/audit history."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw(
            _("You are not permitted to Reset the Employee Hub Layout. Someone with System Manager access can."),
            frappe.PermissionError,
        )

    from employee_hub.employee_hub.utils.default_layout import TAB_ROWS, CARD_ROWS

    settings = frappe.get_single("Employee Hub Settings")
    settings.set("global_default_layout", [])
    for row in TAB_ROWS + CARD_ROWS:
        settings.append("global_default_layout", row)
    settings.save()
    return {"ok": True}


@frappe.whitelist()
def get_global_default_layout_items():
    """Powers the 'Fetch Default Layout' button on Employee Hub Role
    Profile Layout — returns the current Global Default Layout's rows as
    plain dicts, ready to populate that form's own layout table."""
    if "System Manager" not in frappe.get_roles():
        frappe.throw(_("Only System Manager can fetch the default layout."), frappe.PermissionError)

    settings = frappe.get_single("Employee Hub Settings")
    return [
        {
            "scope": row.scope,
            "tab": row.tab,
            "card_key": row.card_key,
            "is_hidden": row.is_hidden,
            "sequence": row.sequence,
        }
        for row in settings.global_default_layout
    ]