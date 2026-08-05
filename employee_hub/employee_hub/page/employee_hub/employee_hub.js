frappe.pages['employee-hub'].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Employee Hub',
        single_column: true,
    });

    new EmployeeHub(page);
};

const HUB_TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'attendance', label: 'Attendance & Leaves' },
    { key: 'salary', label: 'Salary & Expenses' },
    { key: 'tasks', label: 'Tasks & Timesheets' },
    { key: 'performance', label: 'Performance' },
    { key: 'requests', label: 'Requests' },
    { key: 'documents', label: 'Documents' },
];

const LIST_ROUTE_MAP = {
    attendance: 'Attendance',
    'employee-checkin': 'Employee Checkin',
    'leave-application': 'Leave Application',
    'attendance-request': 'Attendance Request',
    'shift-assignment': 'Shift Assignment',
    'salary-slip': 'Salary Slip',
    'expense-claim': 'Expense Claim',
    task: 'Task',
    timesheet: 'Timesheet',
    appraisal: 'Appraisal',
    'hr-request': 'HR Request',
    communication: 'Communication',
    'event-list': 'Event',
    'todo-list': 'ToDo',
};

// Preset options in the mini filter dropdown. "Select Date Range" is
// handled separately (opens a frappe.ui.Dialog) so its label can reflect
// the currently-applied custom range.
const PRESET_PERIOD_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'half_year', label: 'Half Yearly' },
    { value: 'year', label: 'This Year' },
];
const PERIOD_LABELS = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    quarter: 'This Quarter',
    half_year: 'Half Yearly',
    year: 'This Year',
};

// Each card's own default period — must match CARD_DEFAULT_PERIOD in
// api.py, so the mini filter pill shown always matches the data actually
// loaded for that card on first render.
const CARD_DEFAULT_PERIOD = {
    'attendance-chart': 'week',
    attendance: 'week',
    'employee-checkin': 'week',
    'leave-application': 'week',
    'attendance-request': 'week',
    task: 'week',
    timesheet: 'week',
    'task-donut': 'week',
    'salary-slip': 'month',
    'expense-claim': 'month',
    'salary-trend': 'quarter',
    appraisal: 'year',
};
function default_period_for(cardKey) {
    return CARD_DEFAULT_PERIOD[cardKey] || 'today';
}
// NOTE ON LAYOUT: column widths are driven entirely by CSS ([data-cols]
// attribute selectors + media queries), not JS. This is deliberate — a
// previous version set grid-template-columns via JS *after* the charts
// were created, so frappe.Chart measured the wrong (pre-layout) container
// width and never resized, causing horizontal overflow. CSS applies
// synchronously on DOM insertion, so by the time a chart reads its
// container's width, the column layout is already final.
class EmployeeHub {
    constructor(page) {
        this.page = page;
        this.activeTab = 'dashboard';
        this.tabCache = {};
        this.cardPeriods = {}; // cardKey -> {type, from, to}, defaults to 'month' (last 30 days)
        this.$container = $('<div class="employee-hub">').appendTo(page.body);
        this.init();
    }

    async init() {
        this.$container.html('<div class="hub-loading">Loading your dashboard...</div>');
        // Scope this class to just this page's title (Frappe's own H4), so
        // only Employee Hub gets a responsive/shrinking title, not other pages.
        $(this.page.wrapper).find('.title-text').addClass('hub-page-title');

        const [profileRes, todoRes, commRes] = await Promise.all([
            frappe.call('employee_hub.employee_hub.api.get_profile_data'),
            frappe.call('employee_hub.employee_hub.api.get_my_todos_and_events'),
            frappe.call('employee_hub.employee_hub.api.get_open_communication_count'),
        ]);
        this.profile = profileRes.message;
        this.employee = this.profile.name;
        this.todoData = todoRes.message;
        this.commCount = commRes.message.count;

        this.render_shell();
        await this.load_tab('dashboard');
    }

    // -----------------------------------------------------------------
    render_shell() {
        this.$container.empty();
        this.$container.append(this.render_topbar());

        const $body = $('<div class="hub-body"></div>').appendTo(this.$container);
        this.$main = $('<div class="hub-main" id="hub-main"></div>').appendTo($body);
        const $side = $('<div class="hub-side"></div>').appendTo($body);
        $side.append(this.render_profile_card(this.profile));
        $side.append(this.render_todo_card(this.todoData.todos, this.todoData.todos_total));
        $side.append(this.render_events_card(this.todoData.events, this.todoData.events_total));

        this.bind_events();
    }

    bind_events() {
        this.$container.on('click', '.hub-tab', (e) => {
            this.switch_tab($(e.currentTarget).attr('data-key'));
        });

        this.$container.on('click', '[data-route-doctype]', (e) => {
            e.preventDefault();
            this.go_to_list($(e.currentTarget).attr('data-route-doctype'));
        });

        this.$container.on('click', '[data-action]', (e) => {
            this.run_quick_action($(e.currentTarget).attr('data-action'));
        });

        // Any list row with data-doc-type + data-doc-name is clickable
        this.$container.on('click', '.hub-clickable', (e) => {
            const doctype = $(e.currentTarget).attr('data-doc-type');
            const name = $(e.currentTarget).attr('data-doc-name');
            if (doctype && name) frappe.set_route('Form', doctype, name);
        });

        this.$container.on('click', '.hub-comm-icon', () => {
            frappe.set_route('List', 'Communication', { reference_doctype: 'Employee', reference_name: this.employee });
        });

        // ---- Mobile hamburger drawer ----
        this.$container.on('click', '.hub-hamburger', (e) => {
            e.stopPropagation();
            this.$container.find('.hub-tabbar').toggleClass('mobile-open');
            this.$container.find('.hub-mobile-overlay').toggleClass('open');
        });
        this.$container.on('click', '.hub-mobile-overlay', () => this.close_mobile_nav());

        // ---- Per-card mini filter dropdown ----
        this.$container.on('click', '.hub-mini-filter', function (e) {
            e.stopPropagation();
            const $this = $(this);
            const wasOpen = $this.hasClass('open');
            $('.hub-mini-filter').removeClass('open');
            if (!wasOpen) $this.addClass('open');
        });

        this.$container.on('click', '.hub-mini-filter-menu', (e) => e.stopPropagation());

        this.$container.on('click', '.hub-mini-filter-option', (e) => {
            e.stopPropagation();
            const $option = $(e.currentTarget);
            const $filter = $option.closest('.hub-mini-filter');
            const cardKey = $filter.attr('data-card-key');
            const value = $option.attr('data-value');

            $filter.removeClass('open');

            if (value === 'range') {
                this.open_date_range_dialog(cardKey);
                return;
            }
            this.cardPeriods[cardKey] = { type: value };
            this.refresh_mini_filter(cardKey);
            this.refresh_card(cardKey);
        });

        $(document)
            .off('click.employeeHubFilters')
            .on('click.employeeHubFilters', () => this.$container.find('.hub-mini-filter').removeClass('open'));
    }

    render_topbar() {
        return `
            <div class="hub-topbar">
                <button class="hub-hamburger" title="Menu">&#9776;</button>
                <div class="hub-tabbar">
                    ${HUB_TABS.map(
                        (t) =>
                            `<div class="hub-tab ${t.key === this.activeTab ? 'active' : ''}" data-key="${t.key}">${frappe.utils.escape_html(
                                t.label
                            )}</div>`
                    ).join('')}
                </div>
                <div class="hub-comm-icon" title="Open communications">
                    ${this.comm_icon_svg()}
                    ${this.commCount > 0 ? `<span class="hub-comm-badge">${this.commCount}</span>` : ''}
                </div>
            </div>
            <div class="hub-mobile-overlay"></div>`;
    }

    // Instagram-DM-style outline icon instead of a mail emoji.
    comm_icon_svg() {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 3L2 10.5L10.5 13.5L13.5 22L22 3Z" stroke="currentColor" stroke-width="1.8"
                  stroke-linejoin="round" stroke-linecap="round"/>
        </svg>`;
    }

    render_mini_filter(cardKey) {
        const period = this.cardPeriods[cardKey] || { type: default_period_for(cardKey) };
        const isRange = period.type === 'range' && period.from && period.to;
        const rangeText = isRange
            ? `${frappe.datetime.str_to_user(period.from)} - ${frappe.datetime.str_to_user(period.to)}`
            : null;

        const pillLabel = isRange ? rangeText : PERIOD_LABELS[period.type] || PERIOD_LABELS[default_period_for(cardKey)] || 'Today';

        const presetOptions = PRESET_PERIOD_OPTIONS.map(
            (o) => `<div class="hub-mini-filter-option ${o.value === period.type ? 'active' : ''}" data-value="${o.value}">${o.label}</div>`
        ).join('');

        return `
            <div class="hub-mini-filter" data-card-key="${cardKey}">
                <span class="hub-mini-filter-icon">&#9660;</span>
                <span class="hub-mini-filter-label">${pillLabel}</span>
                <div class="hub-mini-filter-menu">
                    <div class="hub-mini-filter-option ${period.type === 'range' ? 'active' : ''}" data-value="range">${
            isRange ? rangeText : 'Select Date Range'
        }</div>
                    ${presetOptions}
                </div>
            </div>`;
    }

    // Re-render just one card's mini filter (header) — used after a
    // preset click or after applying a custom date range.
    refresh_mini_filter(cardKey) {
        const $old = this.$container.find(`.hub-mini-filter[data-card-key="${cardKey}"]`);
        if ($old.length) $old.replaceWith(this.render_mini_filter(cardKey));
    }

    // Date range picker as a real dialog — avoids being clipped by any
    // card's layout/overflow, unlike an inline dropdown sub-panel.
    open_date_range_dialog(cardKey) {
        const current = this.cardPeriods[cardKey] || {};
        const dialog = new frappe.ui.Dialog({
            title: 'Select Date Range',
            fields: [
                { fieldtype: 'Date', fieldname: 'from_date', label: 'From Date', reqd: 1, default: current.from || null },
                { fieldtype: 'Date', fieldname: 'to_date', label: 'To Date', reqd: 1, default: current.to || null },
            ],
            primary_action_label: 'Apply',
            primary_action: (values) => {
                this.cardPeriods[cardKey] = { type: 'range', from: values.from_date, to: values.to_date };
                this.refresh_mini_filter(cardKey);
                this.refresh_card(cardKey);
                dialog.hide();
            },
        });
        dialog.show();
    }

    // -----------------------------------------------------------------
    async switch_tab(key) {
        if (key === this.activeTab) return;
        this.activeTab = key;
        this.$container.find('.hub-tab').removeClass('active');
        this.$container.find(`.hub-tab[data-key="${key}"]`).addClass('active');
        this.close_mobile_nav();
        await this.load_tab(key);
    }

    close_mobile_nav() {
        this.$container.find('.hub-tabbar').removeClass('mobile-open');
        this.$container.find('.hub-mobile-overlay').removeClass('open');
    }

    async load_tab(key) {
        this.$main.html('<div class="hub-loading">Loading...</div>');

        if (key === 'dashboard') {
            if (!this.tabCache.dashboard) {
                const r = await frappe.call('employee_hub.employee_hub.api.get_dashboard_data');
                this.tabCache.dashboard = r.message;
            }
            this.render_dashboard_tab(this.tabCache.dashboard);
            return;
        }

        if (!this.tabCache[key]) {
            const r = await frappe.call('employee_hub.employee_hub.api.get_tab_data', { tab: key });
            this.tabCache[key] = r.message;
        }
        const data = this.tabCache[key];

        if (key === 'attendance') this.render_attendance_tab(data);
        else if (key === 'salary') this.render_salary_tab(data);
        else if (key === 'tasks') this.render_tasks_tab(data);
        else if (key === 'performance') this.render_performance_tab(data);
        else if (key === 'requests') this.render_requests_tab(data);
        else if (key === 'documents') this.render_documents_tab();
    }

    // -----------------------------------------------------------------
    // Refresh a single card in place when its mini filter changes —
    // every other card on the tab is untouched.
    // -----------------------------------------------------------------
    async refresh_card(cardKey) {
        const $card = this.$container.find(`[data-card-key="${cardKey}"]`);
        if (!$card.length) return;
        const $body = $card.find('.hub-card-body');
        $body.html('<p class="text-muted hub-empty">Loading...</p>');

        const period = this.cardPeriods[cardKey] || { type: default_period_for(cardKey) };
        const params =
            period.type === 'range' ? { period: 'range', from_date: period.from, to_date: period.to } : { period: period.type };

        if (cardKey === 'attendance-chart') {
            const r = await frappe.call('employee_hub.employee_hub.api.get_attendance_chart', params);
            $body.html(this.attendance_chart_body_html(r.message));
            this.init_attendance_chart($card);
            return;
        }

        if (cardKey === 'salary-trend') {
            const r = await frappe.call('employee_hub.employee_hub.api.get_salary_trend_chart', params);
            $body.html(this.salary_trend_body_html(r.message));
            this.init_salary_trend_chart($card);
            return;
        }

        if (cardKey === 'task-donut') {
            const r = await frappe.call('employee_hub.employee_hub.api.get_task_status_chart', params);
            $body.html(this.task_donut_body_html(r.message));
            this.init_task_donut_chart($card);
            return;
        }

        const r = await frappe.call('employee_hub.employee_hub.api.get_card_list', { card_key: cardKey, ...params });
        const { records, total } = r.message || { records: [], total: 0 };
        $body.html(this.render_card_body_html(cardKey, records, total));
    }

    // Shared by both the initial tab render and refresh_card, so a card
    // always looks the same regardless of which path filled it. Shows a
    // "Showing X of Y" note whenever the period contains more than the
    // 5 rows displayed — proof the filter is actually working even when
    // the visible list looks unchanged.
    render_card_body_html(cardKey, records, total) {
        const def = this.cardDefs()[cardKey];
        const rowsHtml = records.length ? records.map(def.render).join('') : `<p class="text-muted hub-empty">${def.emptyMsg}</p>`;
        const footer = total && total > records.length ? `<p class="hub-count-note">Showing ${records.length} of ${total}</p>` : '';
        return rowsHtml + footer;
    }

    // Row renderers shared between initial tab render and refresh_card,
    // so both stay perfectly in sync.
    cardDefs() {
        return {
            attendance: {
                emptyMsg: 'No attendance records in this period.',
                render: (a) =>
                    this.row(
                        'Attendance',
                        a.name,
                        `<div class="hub-list-title">${frappe.datetime.str_to_user(a.attendance_date)}</div>
                         <span class="hub-badge hub-status-${(a.status || '').toLowerCase().replace(/ /g, '-')}">${a.status}</span>`
                    ),
            },
            'employee-checkin': {
                emptyMsg: 'No check-in records in this period.',
                render: (c) =>
                    this.row(
                        'Employee Checkin',
                        c.name,
                        `<div class="hub-list-title">${frappe.datetime.str_to_user(c.time)}</div>
                         <span class="hub-badge hub-status-${c.log_type === 'IN' ? 'approved' : 'open'}">${c.log_type}</span>`
                    ),
            },
            'leave-application': {
                emptyMsg: 'No leave applications in this period.',
                render: (l) =>
                    this.row(
                        'Leave Application',
                        l.name,
                        `<div>
                            <div class="hub-list-title">${frappe.utils.escape_html(l.leave_type)}</div>
                            <div class="hub-list-sub">${frappe.datetime.str_to_user(l.from_date)} – ${frappe.datetime.str_to_user(l.to_date)}</div>
                         </div>
                         <span class="hub-badge hub-status-${(l.status || '').toLowerCase().replace(/ /g, '-')}">${l.status}</span>`
                    ),
            },
            'attendance-request': {
                emptyMsg: 'No attendance requests in this period.',
                render: (r) =>
                    this.row(
                        'Attendance Request',
                        r.name,
                        `<div>
                            <div class="hub-list-title">${frappe.datetime.str_to_user(r.from_date)} – ${frappe.datetime.str_to_user(r.to_date)}</div>
                            <div class="hub-list-sub">${frappe.utils.escape_html(r.reason || '')}</div>
                         </div>`
                    ),
            },
            'salary-slip': {
                emptyMsg: 'No salary slips in this period.',
                render: (s) =>
                    this.row(
                        'Salary Slip',
                        s.name,
                        `<div>
                            <div class="hub-list-title">${frappe.datetime.str_to_user(s.start_date)} – ${frappe.datetime.str_to_user(s.end_date)}</div>
                            <div class="hub-list-sub">${format_currency(s.net_pay)}</div>
                         </div>
                         <span class="hub-badge hub-status-${(s.status || '').toLowerCase()}">${s.status}</span>`
                    ),
            },
            'expense-claim': {
                emptyMsg: 'No expense claims in this period.',
                render: (e) =>
                    this.row(
                        'Expense Claim',
                        e.name,
                        `<div>
                            <div class="hub-list-title">${format_currency(e.total_claimed_amount)}</div>
                            <div class="hub-list-sub">${frappe.datetime.str_to_user(e.posting_date)}</div>
                         </div>
                         <span class="hub-badge hub-status-${(e.status || '').toLowerCase()}">${e.status}</span>`
                    ),
            },
            task: {
                emptyMsg: 'No tasks in this period.',
                render: (t) =>
                    this.row(
                        'Task',
                        t.name,
                        `<div>
                            <div class="hub-list-title">${frappe.utils.escape_html(t.subject)}</div>
                            <div class="hub-list-sub">Due ${t.exp_end_date ? frappe.datetime.str_to_user(t.exp_end_date) : 'N/A'}</div>
                         </div>
                         <span class="hub-badge hub-badge-${(t.priority || 'low').toLowerCase()}">${t.priority || 'Low'}</span>
                         <span class="hub-badge hub-status-${(t.status || '').toLowerCase().replace(/ /g, '-')}">${t.status}</span>`
                    ),
            },
            timesheet: {
                emptyMsg: 'No timesheets in this period.',
                render: (t) =>
                    this.row(
                        'Timesheet',
                        t.name,
                        `<div>
                            <div class="hub-list-title">${frappe.datetime.str_to_user(t.start_date)}</div>
                            <div class="hub-list-sub">${t.total_hours} hrs</div>
                         </div>
                         <span class="hub-badge hub-status-${(t.status || '').toLowerCase()}">${t.status}</span>`
                    ),
            },
            appraisal: {
                emptyMsg: 'No appraisals in this period.',
                render: (a) =>
                    this.row(
                        'Appraisal',
                        a.name,
                        `<div class="hub-list-title">${frappe.utils.escape_html(a.appraisal_cycle || a.name)}</div>
                         <span class="hub-badge hub-status-${(a.status || '').toLowerCase()}">${a.status}</span>`
                    ),
            },
            'hr-request': {
                emptyMsg: 'No requests in this period.',
                render: (r) =>
                    this.row(
                        'HR Request',
                        r.name,
                        `<div>
                            <div class="hub-list-title">${frappe.utils.escape_html(r.request_type)}</div>
                            <div class="hub-list-sub">${frappe.datetime.str_to_user(r.posting_date)}</div>
                         </div>
                         <span class="hub-badge hub-status-${(r.status || '').toLowerCase().replace(/ /g, '-')}">${r.status}</span>`
                    ),
            },
            'shift-assignment': {
                emptyMsg: 'No shifts allocated.',
                render: (s) =>
                    this.row(
                        'Shift Assignment',
                        s.name,
                        `<div>
                            <div class="hub-list-title">${frappe.utils.escape_html(s.shift_type || '')}</div>
                            <div class="hub-list-sub">${frappe.datetime.str_to_user(s.start_date)} ${
                            s.end_date ? '– ' + frappe.datetime.str_to_user(s.end_date) : ''
                        }</div>
                         </div>
                         <span class="hub-badge hub-status-${(s.status || '').toLowerCase()}">${s.status || ''}</span>`
                    ),
            },
        };
    }

    row(doctype, name, innerHtml) {
        return `<div class="hub-list-row hub-clickable" data-doc-type="${doctype}" data-doc-name="${frappe.utils.escape_html(
            name
        )}">${innerHtml}</div>`;
    }

    // -----------------------------------------------------------------
    // Card wrapper — title, optional mini filter, optional "See more", body
    // -----------------------------------------------------------------
    list_card(title, seeMoreKey, cardKey, records, filterable, total) {
        if (filterable === undefined) filterable = true;
        return `
            <div class="hub-card" data-card-key="${cardKey}">
                <div class="hub-card-header">
                    <h4>${title}</h4>
                    <div class="hub-card-header-right">
                        ${filterable ? this.render_mini_filter(cardKey) : ''}
                        ${seeMoreKey ? `<a class="hub-view-all" data-route-doctype="${seeMoreKey}">See more</a>` : ''}
                    </div>
                </div>
                <div class="hub-card-body">${this.render_card_body_html(cardKey, records, total)}</div>
            </div>`;
    }

    // -----------------------------------------------------------------
    // Profile card
    // -----------------------------------------------------------------
    render_profile_card(emp) {
        const circleStyle =
            'width:96px;height:96px;border-radius:50%;object-fit:cover;display:block;border:3px solid #F7F7FC;';
        const placeholderStyle =
            'width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
            'font-size:30px;font-weight:700;color:#fff;background:linear-gradient(135deg,#6C5CE7,#a29bfe);';

        const photoHtml = emp.image
            ? `<img class="hub-profile-photo" style="${circleStyle}" src="${emp.image}">`
            : `<div class="hub-profile-photo hub-profile-photo-placeholder" style="${placeholderStyle}">${this.get_initials(
                  emp.employee_name
              )}</div>`;

        const status = emp.status || '';
        const statusBadge = status
            ? `<span class="hub-badge hub-status-${status.toLowerCase()}">${status}</span>`
            : '';

        const info_row = (icon, label, value, is_date) => {
            let display = value;
            if (value && is_date) display = frappe.datetime.str_to_user(value);
            const has_value = !!value;
            return `
                <div class="hub-profile-info-row">
                    <span class="hub-profile-info-icon">${icon}</span>
                    <span class="hub-profile-info-label">${label}</span>
                    <span class="hub-profile-info-value ${has_value ? '' : 'hub-not-updated'}">${
                has_value ? frappe.utils.escape_html(display) : 'Not updated in Employee'
            }</span>
                </div>`;
        };

        return `
            <div class="hub-card hub-profile-card">
                <div style="display:flex;justify-content:center;margin-bottom:10px;">${photoHtml}</div>
                ${!emp.has_image ? '<p class="hub-photo-note">📷 Update your profile picture in Employee master</p>' : ''}
                <div class="hub-profile-name-row">
                    <h3 class="hub-profile-name">${frappe.utils.escape_html(emp.employee_name || '')}</h3>
                    ${statusBadge}
                </div>
                <div class="hub-profile-info">
                    ${info_row('💼', 'Position', emp.designation)}
                    ${info_row('🏢', 'Department', emp.department)}
                    ${info_row('🏬', 'Company', emp.company)}
                    ${info_row('✉️', 'Email', emp.email)}
                    ${info_row('📞', 'Phone', emp.phone)}
                    ${info_row('📅', 'Joined', emp.date_of_joining, true)}
                </div>
                <a class="hub-card-link hub-profile-view-link" data-route-doctype="employee-form">View Full Profile &rarr;</a>
            </div>`;
    }

    get_initials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        const first = parts[0] ? parts[0][0] : '';
        const second = parts[1] ? parts[1][0] : '';
        return (first + second).toUpperCase();
    }

    // ToDo descriptions come from a rich-text field and contain raw HTML
    // (e.g. "<div class=...><p><strong>...") — strip tags down to plain text.
    strip_html(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
    }

    truncate_words(text, maxWords, maxChars) {
        maxChars = maxChars || 70;
        let result = text;
        const words = text.split(' ').filter(Boolean);
        if (words.length > maxWords) {
            result = words.slice(0, maxWords).join(' ') + '…';
        }
        // Guards against a single very long "word" with no spaces (e.g. typed
        // without spacing) which would otherwise overflow the row untouched.
        if (result.length > maxChars) {
            result = result.slice(0, maxChars) + '…';
        }
        return result;
    }

    // -----------------------------------------------------------------
    // My ToDos + Upcoming Events (persistent, below profile card)
    // -----------------------------------------------------------------
    render_todo_card(todos, todosTotal) {
        const rows = todos.length
            ? todos
                  .map((t) => {
                      const doctype = t.reference_type || 'ToDo';
                      const name = t.reference_name || t.name;
                      const plainText = this.strip_html(t.description) || t.name;
                      const preview = this.truncate_words(plainText, 10, 70);
                      return this.row(
                          doctype,
                          name,
                          `<div>
                                <div class="hub-list-title">${frappe.utils.escape_html(preview)}</div>
                                <div class="hub-list-sub">Assigned by ${frappe.utils.escape_html(t.assigned_by || 'N/A')}${
                              t.date ? ' · Due ' + frappe.datetime.str_to_user(t.date) : ''
                          }</div>
                           </div>
                           <span class="hub-badge hub-badge-${(t.priority || 'low').toLowerCase()}">${t.priority || 'Low'}</span>`
                      );
                  })
                  .join('')
            : '<p class="text-muted hub-empty">No open to-dos.</p>';

        const seeMore = `<a class="hub-view-all" data-route-doctype="todo-list">See more${todosTotal ? ` (${todosTotal})` : ''}</a>`;

        return `
            <div class="hub-card">
                <div class="hub-card-header">
                    <h4>My To-Dos</h4>
                    <div class="hub-card-header-right">
                        ${todosTotal ? `<span class="hub-tag hub-count-badge">${todosTotal}</span>` : ''}
                        <span class="hub-tag hub-only-yours">Only yours</span>
                    </div>
                </div>
                <div class="hub-scroll-list hub-scroll-4">${rows}</div>
                <div style="text-align:center;margin-top:8px;">${seeMore}</div>
            </div>`;
    }

    render_events_card(events, eventsTotal) {
        const rows = events.length
            ? events
                  .map((e) =>
                      this.row(
                          'Event',
                          e.name,
                          `<div>
                                <div class="hub-list-title">${frappe.utils.escape_html(e.subject)}</div>
                                <div class="hub-list-sub">${frappe.datetime.str_to_user(e.starts_on)}</div>
                           </div>`
                      )
                  )
                  .join('')
            : '<p class="text-muted hub-empty">No upcoming events.</p>';

        const seeMore = `<a class="hub-view-all" data-route-doctype="event-list">See more${eventsTotal ? ` (${eventsTotal})` : ''}</a>`;

        return `
            <div class="hub-card">
                <div class="hub-card-header">
                    <h4>Upcoming Events</h4>
                    <div class="hub-card-header-right">
                        ${eventsTotal ? `<span class="hub-tag hub-count-badge">${eventsTotal}</span>` : ''}
                    </div>
                </div>
                <div class="hub-scroll-list hub-scroll-3">${rows}</div>
                <div style="text-align:center;margin-top:8px;">${seeMore}</div>
            </div>`;
    }

    // Shared between Dashboard and the Salary & Expenses tab, so both show
    // the exact same card/chart instead of duplicated markup.
    render_salary_trend_section(salaryTrend) {
        return `
            <div class="hub-card" data-card-key="salary-trend">
                <div class="hub-card-header">
                    <h4>Net Pay Trend</h4>
                    <div class="hub-card-header-right">${this.render_mini_filter('salary-trend')}</div>
                </div>
                <div class="hub-card-body">${this.salary_trend_body_html(salaryTrend)}</div>
            </div>`;
    }

    salary_trend_body_html(salaryTrend) {
        if (salaryTrend && salaryTrend.labels.length) {
            return `<div class="hub-chart" id="hub-salary-trend"
                         data-labels='${JSON.stringify(salaryTrend.labels)}'
                         data-values='${JSON.stringify(salaryTrend.values)}'></div>`;
        }
        return '<p class="text-muted hub-empty">No Salary Slips in this period — try a wider filter (e.g. Last Year).</p>';
    }

    init_salary_trend_chart($scope) {
        $scope = $scope || this.$main;
        const $line = $scope.find('#hub-salary-trend');
        if (!$line.length) return;
        new frappe.Chart($line[0], {
            data: {
                labels: JSON.parse($line.attr('data-labels')),
                datasets: [{ name: 'Net Pay', chartType: 'line', values: JSON.parse($line.attr('data-values')) }],
            },
            type: 'line',
            height: 200,
            colors: ['#6C5CE7'],
            lineOptions: { regionFill: 1 },
            hideLegend: 1,
            valuesOverPoints: 1,
        });
        this.hide_zero_value_labels($line[0]);
    }

    // Shared between Dashboard and the Tasks & Timesheets tab.
    render_task_donut_section(breakdown) {
        return `
            <div class="hub-card" data-card-key="task-donut">
                <div class="hub-card-header">
                    <h4>Task Status Breakdown</h4>
                    <div class="hub-card-header-right">${this.render_mini_filter('task-donut')}</div>
                </div>
                <div class="hub-card-body">${this.task_donut_body_html(breakdown)}</div>
            </div>`;
    }

    task_donut_body_html(breakdown) {
        if (breakdown && breakdown.labels.length) {
            return `<div class="hub-chart" id="hub-task-donut"
                         data-labels='${JSON.stringify(breakdown.labels)}'
                         data-values='${JSON.stringify(breakdown.values)}'></div>
                    ${this.render_swatch_legend(breakdown.labels, [
                        '#6C5CE7',
                        '#00b894',
                        '#fdcb6e',
                        '#e17055',
                        '#0984e3',
                        '#e84393',
                    ])}`;
        }
        return '<p class="text-muted hub-empty">No tasks in this period — try a wider filter (e.g. Last Year).</p>';
    }

    init_task_donut_chart($scope) {
        $scope = $scope || this.$main;
        const $donut = $scope.find('#hub-task-donut');
        if (!$donut.length) return;
        new frappe.Chart($donut[0], {
            data: {
                labels: JSON.parse($donut.attr('data-labels')),
                datasets: [{ values: JSON.parse($donut.attr('data-values')) }],
            },
            type: 'donut',
            height: 200,
            colors: ['#6C5CE7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393'],
            hideLegend: 1,
        });
    }

    // -----------------------------------------------------------------
    // Dashboard tab
    // -----------------------------------------------------------------
    render_dashboard_tab(d) {
        this.$main.empty();
        this.$main.append(this.render_stat_cards(d.stats));

        const $row = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
        const $attCard = $(`
            <div class="hub-card" data-card-key="attendance-chart">
                <div class="hub-card-header">
                    <h4>Attendance Overview</h4>
                    <div class="hub-card-header-right">${this.render_mini_filter('attendance-chart')}</div>
                </div>
                <div class="hub-card-body">${this.attendance_chart_body_html(d.attendance_chart)}</div>
            </div>`);
        $row.append($attCard);
        $row.append(`
            <div class="hub-card">
                <div class="hub-card-header"><h4>Leave Distribution</h4></div>
                <div class="hub-card-body">
                ${
                    d.leave_pie
                        ? `<div class="hub-chart" id="hub-leave-pie" data-labels='${JSON.stringify(
                              d.leave_pie.labels
                          )}' data-values='${JSON.stringify(d.leave_pie.values)}'></div>` +
                          this.render_swatch_legend(d.leave_pie.labels, [
                              '#6C5CE7',
                              '#00b894',
                              '#fdcb6e',
                              '#e17055',
                              '#0984e3',
                              '#e84393',
                          ])
                        : '<p class="text-muted hub-empty">No leave allocations found.</p>'
                }
                </div>
            </div>`);

        const $row2 = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
        $row2.append(`
            <div class="hub-card">
                <div class="hub-card-header"><h4>Quick Actions</h4></div>
                <div class="hub-card-body">
                    <div class="hub-quick-actions">
                        <button class="hub-qa-btn hub-qa-blue" data-action="apply-leave">✓ Apply for Leave</button>
                        <button class="hub-qa-btn hub-qa-cyan" data-action="log-timesheet">🕐 Log Timesheet</button>
                        <button class="hub-qa-btn hub-qa-orange" data-action="view-payslip">💰 View Payslip</button>
                        <button class="hub-qa-btn hub-qa-pink" data-action="raise-request">✎ Raise Request</button>
                    </div>
                </div>
            </div>`);
        $row2.append(`
            <div class="hub-card">
                <div class="hub-card-header"><h4>Upcoming Birthdays</h4></div>
                <div class="hub-card-body">
                ${
                    d.birthdays.length
                        ? d.birthdays
                              .map(
                                  (b) => `
                    <div class="hub-list-row">
                        <img class="hub-avatar-sm" src="${b.image || '/assets/frappe/images/ui/avatar.png'}">
                        <div>
                            <div class="hub-list-title">${frappe.utils.escape_html(b.employee_name)}</div>
                            <div class="hub-list-sub">${frappe.datetime.str_to_user(b.next_birthday)}</div>
                        </div>
                    </div>`
                              )
                              .join('')
                        : '<p class="text-muted hub-empty">No birthdays in the next 30 days.</p>'
                }
                </div>
            </div>`);

        const $row3 = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
        $row3.append(this.render_salary_trend_section(d.salary_trend));
        $row3.append(this.render_task_donut_section(d.task_status_breakdown));

        this.init_attendance_chart($attCard);
        this.init_pie_chart();
        this.init_salary_trend_chart();
        this.init_task_donut_chart();
    }

    attendance_chart_body_html(chart) {
        return `<div class="hub-chart" id="hub-attendance-chart"
                     data-labels='${JSON.stringify(chart.labels)}'
                     data-present='${JSON.stringify(chart.present)}'
                     data-absent='${JSON.stringify(chart.absent)}'
                     data-half='${JSON.stringify(chart.half_day)}'></div>
                <div class="hub-legend">
                    <span><i class="hub-dot" style="background:#2ecc71"></i>Present</span>
                    <span><i class="hub-dot" style="background:#e74c3c"></i>Absent</span>
                    <span><i class="hub-dot" style="background:#f1c40f"></i>Half Day</span>
                </div>`;
    }

    // Reusable colored-swatch legend for pie/donut charts, matching the
    // attendance bar chart's custom legend style — used instead of each
    // chart's own auto-legend (which is hidden via hideLegend:1) to avoid
    // the duplicate-legend/clipping issue that caused.
    render_swatch_legend(labels, colors) {
        if (!labels || !labels.length) return '';
        return `<div class="hub-legend">${labels
            .map(
                (l, i) =>
                    `<span><i class="hub-dot" style="background:${colors[i % colors.length]}"></i>${frappe.utils.escape_html(l)}</span>`
            )
            .join('')}</div>`;
    }

    init_attendance_chart($card) {
        const $el = $card.find('#hub-attendance-chart');
        if (!$el.length) return;
        new frappe.Chart($el[0], {
            data: {
                labels: JSON.parse($el.attr('data-labels')),
                datasets: [
                    { name: 'Present', chartType: 'bar', values: JSON.parse($el.attr('data-present')) },
                    { name: 'Absent', chartType: 'bar', values: JSON.parse($el.attr('data-absent')) },
                    { name: 'Half Day', chartType: 'bar', values: JSON.parse($el.attr('data-half')) },
                ],
            },
            type: 'bar',
            height: 220,
            colors: ['#2ecc71', '#e74c3c', '#f1c40f'],
            axisOptions: { xIsSeries: true },
            hideLegend: 1,
            // The hover tooltip kept getting clipped no matter which CSS fix
            // was tried (card overflow, chart overflow, viewport edge — it's
            // an absolutely-positioned element from the charting library
            // itself, outside our layout's control). Showing the values
            // permanently above each bar sidesteps the problem entirely —
            // no hover interaction needed, nothing to clip.
            valuesOverPoints: 1,
        });
        this.hide_zero_value_labels($el[0]);
    }

    // frappe-charts' valuesOverPoints has no built-in "skip zero" option, so
    // this hides them after the fact. Axis tick labels are deliberately left
    // alone (their "0" baseline label should stay visible) by skipping any
    // <text> that sits inside a D3-style ".axis" group; anything else with
    // exactly "0" as its content is one of our permanent value labels.
    hide_zero_value_labels(container) {
        setTimeout(() => {
            container.querySelectorAll('svg text').forEach((el) => {
                const isAxisLabel = el.closest('.x.axis, .y.axis, .axis');
                if (!isAxisLabel && el.textContent.trim() === '0') {
                    el.style.display = 'none';
                }
            });
        }, 50);
    }

    init_pie_chart() {
        const $pie = this.$main.find('#hub-leave-pie');
        if (!$pie.length) return;
        new frappe.Chart($pie[0], {
            data: {
                labels: JSON.parse($pie.attr('data-labels')),
                datasets: [{ values: JSON.parse($pie.attr('data-values')) }],
            },
            type: 'pie',
            height: 220,
            colors: ['#6C5CE7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393'],
            hideLegend: 1,
        });
    }

    render_stat_cards(stats) {
        const cards = [
            {
                label: 'Attendance',
                value: `${stats.attendance.present}/${stats.attendance.total_days}`,
                sub: 'Days Present (This Month)',
                link: 'attendance',
                extra: `<div class="hub-progress"><div class="hub-progress-bar" style="width:${Math.min(
                    100,
                    (stats.attendance.present / Math.max(stats.attendance.total_days, 1)) * 100
                )}%"></div></div>`,
            },
            { label: 'Leaves', value: stats.leaves.available, sub: 'Available Days Left', link: 'leave-application' },
            { label: 'Tasks', value: stats.tasks.pending, sub: 'Pending Tasks', link: 'task' },
            { label: 'Timesheets', value: stats.timesheets.hours, sub: 'Hours (This Month)', link: 'timesheet' },
            { label: 'Salary', value: stats.salary.month, sub: stats.salary.status, link: 'salary-slip' },
        ];
        const html = cards
            .map(
                (c) => `
                <div class="hub-card hub-stat-card">
                    <div class="hub-stat-label">${c.label}</div>
                    <div class="hub-stat-value">${c.value}</div>
                    <div class="hub-stat-sub">${c.sub}</div>
                    ${c.extra || ''}
                    <a class="hub-card-link" data-route-doctype="${c.link}">View ${c.label} &rarr;</a>
                </div>`
            )
            .join('');
        return `<div class="hub-grid" data-cols="5">${html}</div>`;
    }

    // -----------------------------------------------------------------
    // Attendance & Leaves tab
    // -----------------------------------------------------------------
    render_attendance_tab(d) {
        this.$main.empty();

        const $row1 = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
        $row1.append(this.render_leave_balance_card(d.leave_balance));
        $row1.append(this.list_card('Shifts Allocated', 'shift-assignment', 'shift-assignment', d.shifts, false));

        const $row2 = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
        $row2.append(this.list_card('Attendance', 'attendance', 'attendance', d.attendance, true, d.counts['attendance']));
        $row2.append(
            this.list_card('Employee Checkin', 'employee-checkin', 'employee-checkin', d.checkins, true, d.counts['employee-checkin'])
        );

        const $row3 = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
        $row3.append(
            this.list_card(
                'Leave Applications', 'leave-application', 'leave-application', d.leave_applications, true, d.counts['leave-application']
            )
        );
        $row3.append(
            this.list_card(
                'Attendance Requests', 'attendance-request', 'attendance-request', d.attendance_requests, true, d.counts['attendance-request']
            )
        );
    }

    render_leave_balance_card(leaves) {
        const rows = leaves.length
            ? leaves
                  .map((l) => {
                      const pct = l.allocated ? Math.min(100, (l.used / l.allocated) * 100) : 0;
                      return `
                    <div class="hub-leave-row">
                        <div class="hub-leave-top">
                            <span>${frappe.utils.escape_html(l.leave_type)}</span>
                            <span>${l.available} / ${l.allocated} days</span>
                        </div>
                        <div class="hub-progress"><div class="hub-progress-bar" style="width:${pct}%"></div></div>
                    </div>`;
                  })
                  .join('')
            : '<p class="text-muted hub-empty">No leave allocations found.</p>';
        return `<div class="hub-card"><div class="hub-card-header"><h4>Leave Balance</h4></div><div class="hub-card-body">${rows}</div></div>`;
    }

    // -----------------------------------------------------------------
    // Salary & Expenses tab
    // -----------------------------------------------------------------
    render_salary_tab(d) {
        this.$main.empty();
        const $row = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
        $row.append(this.list_card('Salary Slips', 'salary-slip', 'salary-slip', d.salary_slips, true, d.counts['salary-slip']));
        $row.append(this.list_card('Expense Claims', 'expense-claim', 'expense-claim', d.expense_claims, true, d.counts['expense-claim']));

        const $row2 = $('<div class="hub-grid" data-cols="1"></div>').appendTo(this.$main);
        $row2.append(this.render_salary_trend_section(d.salary_trend));
        this.init_salary_trend_chart();
    }

    // -----------------------------------------------------------------
    // Tasks & Timesheets tab
    // -----------------------------------------------------------------
    render_tasks_tab(d) {
        this.$main.empty();
        const $row = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
        $row.append(this.list_card('My Tasks', 'task', 'task', d.tasks, true, d.counts['task']));
        $row.append(this.list_card('Timesheets', 'timesheet', 'timesheet', d.timesheets, true, d.counts['timesheet']));

        const $row2 = $('<div class="hub-grid" data-cols="1"></div>').appendTo(this.$main);
        $row2.append(this.render_task_donut_section(d.task_status_breakdown));
        this.init_task_donut_chart();
    }

    // -----------------------------------------------------------------
    // Performance tab
    // -----------------------------------------------------------------
    render_performance_tab(d) {
        this.$main.empty();
        const $row = $('<div class="hub-grid" data-cols="1"></div>').appendTo(this.$main);
        $row.append(this.list_card('Appraisals', 'appraisal', 'appraisal', d.appraisals, true, d.counts['appraisal']));
    }

    // -----------------------------------------------------------------
    // Requests tab
    // -----------------------------------------------------------------
    render_requests_tab(d) {
        this.$main.empty();
        const $row = $('<div class="hub-grid" data-cols="1"></div>').appendTo(this.$main);
        const $card = $(this.list_card('My HR Requests', 'hr-request', 'hr-request', d.requests, true, d.counts['hr-request']));
        $card.find('.hub-card-header-right').prepend('<button class="btn btn-xs btn-primary" data-action="raise-request">+ New</button>');
        $row.append($card);
    }

    // -----------------------------------------------------------------
    render_documents_tab() {
        this.$main.empty();
        this.$main.append(`
            <div class="hub-card">
                <div class="hub-card-header"><h4>Documents</h4></div>
                <div class="hub-card-body">
                    <p class="text-muted hub-empty">Document tracking (Visa, Passport, Emirates ID, etc.) isn't wired up yet.
                    For now you can view attachments on your Employee record.</p>
                    <a class="hub-card-link" data-route-doctype="employee-form">Open My Employee Record &rarr;</a>
                </div>
            </div>`);
    }

    // -----------------------------------------------------------------
    go_to_list(key) {
        if (key === 'employee-form') {
            frappe.set_route('Form', 'Employee', this.employee);
            return;
        }
        if (key === 'event-list') {
            frappe.set_route('List', 'Event');
            return;
        }
        if (key === 'todo-list') {
            frappe.set_route('List', 'ToDo', { allocated_to: frappe.session.user, status: 'Open' });
            return;
        }
        const doctype = LIST_ROUTE_MAP[key];
        if (!doctype) return;
        frappe.set_route('List', doctype, { employee: this.employee });
    }

    run_quick_action(action) {
        const employee = this.employee;
        if (action === 'apply-leave') frappe.new_doc('Leave Application', { employee });
        else if (action === 'log-timesheet') frappe.new_doc('Timesheet', { employee });
        else if (action === 'view-payslip') frappe.set_route('List', 'Salary Slip', { employee });
        else if (action === 'raise-request') frappe.new_doc('HR Request', { employee });
    }
}