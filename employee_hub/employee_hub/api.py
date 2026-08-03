import frappe
from frappe import _
from frappe.utils import (
    getdate,
    nowdate,
    add_days,
    formatdate,
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
# Period filter helper — rolling windows ("Last Week/Month/Quarter/Year"),
# shared by every per-card filter dropdown.
# ---------------------------------------------------------------------------
def resolve_period(period=None, from_date=None, to_date=None):
    today = getdate(nowdate())

    if period == "range" and from_date and to_date:
        return getdate(from_date), getdate(to_date)

    if not period or period == "today":
        return today, today

    days_map = {
        "week": 7,
        "month": 30,
        "quarter": 90,
        "half_year": 182,
        "year": 365,
    }
    days = days_map.get(period, 0)
    start = add_days(today, -days)
    return start, today


def list_in_range(doctype, filters, date_field, fields, start, end, limit=5):
    """Fetch up to `limit` records of `doctype` whose `date_field` falls in
    [start, end], most-recently-updated first. Returns (records, total_count)
    — total_count lets the UI show "X of Y" so filtering is visibly working
    even when the card preview is capped. Returns ([], 0) if the doctype
    isn't installed on this site."""
    if not frappe.db.exists("DocType", doctype):
        return [], 0
    filters = dict(filters)
    filters[date_field] = ["between", [start, end]]
    total = frappe.db.count(doctype, filters)
    records = frappe.get_list(doctype, filters=filters, fields=fields, order_by="modified desc", limit=limit)
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

    # The 5 number cards (Attendance/Leaves/Tasks/Timesheets/Salary) keep their
    # original "Last 30 Days" window regardless of the chart/list-card filter
    # default below — they aren't individually filterable, so they shouldn't
    # shrink to a single day just because the filterable cards now default
    # to "Today".
    stats_start, stats_end = resolve_period("month")

    # The Attendance Overview chart *is* individually filterable (has its own
    # mini filter dropdown), and that dropdown's default is "Today" — so its
    # initial data must match that default.
    chart_start, chart_end = resolve_period()

    leave_data = get_leave_summary(employee)

    return {
        "stats": get_stats(employee, user, leave_data, stats_start, stats_end),
        "attendance_chart": get_attendance_chart(chart_start, chart_end),
        "leave_pie": get_leave_pie(leave_data),
        "birthdays": get_upcoming_birthdays(employee),
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
        start, end = resolve_period(period, from_date, to_date)
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
    while cur <= end:
        week_end = min(add_days(cur, 6), end)
        buckets.append({"label": cur.strftime("%d %b"), "start": cur, "end": week_end, "present": 0, "absent": 0, "half_day": 0})
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
                break

    return {
        "labels": [b["label"] for b in buckets],
        "present": [b["present"] for b in buckets],
        "absent": [b["absent"] for b in buckets],
        "half_day": [b["half_day"] for b in buckets],
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


def get_salary_trend(employee):
    rows = frappe.get_list(
        "Salary Slip",
        filters={"employee": employee, "docstatus": 1},
        fields=["end_date", "net_pay"],
        order_by="end_date desc",
        limit=6,
    )
    rows.reverse()
    return {
        "labels": [formatdate(r.end_date, "MMM yy") for r in rows],
        "values": [r.net_pay for r in rows],
    }


def get_task_status_breakdown(user):
    rows = frappe.db.sql(
        """
        select status, count(*) as cnt
        from `tabTask`
        where _assign like %s
        group by status
        """,
        f"%{user}%",
        as_dict=True,
    )
    return {"labels": [r.status for r in rows], "values": [r.cnt for r in rows]}


def get_upcoming_birthdays(employee):
    rows = frappe.db.sql(
        """
        select name, employee_name, image, date_of_birth
        from `tabEmployee`
        where status='Active' and name != %s and date_of_birth is not null
        """,
        employee,
        as_dict=True,
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
    return upcoming[:5]


# ---------------------------------------------------------------------------
# Per-tab bulk data (initial load only — each list's own mini filter then
# calls get_card_list independently, see below)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_tab_data(tab):
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
    if not employee:
        frappe.throw(_("No Employee record linked."))

    start, end = resolve_period()  # default: today (each list card's own mini filter starts on "Today")

    if tab == "attendance":
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
        slips, slips_total = list_in_range(
            "Salary Slip", {"employee": employee}, "end_date",
            ["name", "start_date", "end_date", "net_pay", "status"], start, end,
        )
        claims, claims_total = list_in_range(
            "Expense Claim", {"employee": employee}, "posting_date",
            ["name", "posting_date", "total_claimed_amount", "status"], start, end,
        )
        return {
            "salary_slips": slips,
            "expense_claims": claims,
            "salary_trend": get_salary_trend(employee),
            "counts": {"salary-slip": slips_total, "expense-claim": claims_total},
        }

    if tab == "tasks":
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
            "task_status_breakdown": get_task_status_breakdown(frappe.session.user),
            "counts": {"task": tasks_total, "timesheet": timesheets_total},
        }

    if tab == "performance":
        appraisals, appraisals_total = list_in_range(
            "Appraisal", {"employee": employee}, "creation",
            ["name", "appraisal_cycle", "status"], start, end,
        )
        return {
            "appraisals": appraisals,
            "counts": {"appraisal": appraisals_total},
        }

    if tab == "requests":
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
        "date_field": "end_date",
        "fields": ["name", "start_date", "end_date", "net_pay", "status"],
        "base_filters": {},
    },
    "expense-claim": {
        "doctype": "Expense Claim",
        "date_field": "posting_date",
        "fields": ["name", "posting_date", "total_claimed_amount", "status"],
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
def get_card_list(card_key, period=None, from_date=None, to_date=None):
    cfg = LIST_CARD_CONFIG.get(card_key)
    if not cfg:
        frappe.throw(_("Unknown card: {0}").format(card_key))

    start, end = resolve_period(period, from_date, to_date)

    if cfg.get("assign_based"):
        filters = {"_assign": ["like", f"%{frappe.session.user}%"]}
    else:
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if not employee:
            frappe.throw(_("No Employee record linked."))
        filters = {"employee": employee}

    filters.update(cfg.get("base_filters", {}))

    records, total = list_in_range(cfg["doctype"], filters, cfg["date_field"], cfg["fields"], start, end)
    return {"records": records, "total": total}