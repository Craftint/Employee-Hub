// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

// Shared preview/customize engine — used by both the Employee Hub Role
// Profile Layout form and the Employee Hub Settings form (Global Default
// Layout). Loaded globally (app_include_js) so either form's own smaller
// script can build on it, rather than each maintaining a separate copy.

const HUB_PREVIEW_TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'attendance', label: 'Attendance & Leaves' },
    { key: 'salary', label: 'Salary & Expenses' },
    { key: 'tasks', label: 'Tasks & Timesheets' },
    { key: 'performance', label: 'Performance' },
    { key: 'requests', label: 'Requests' },
    { key: 'documents', label: 'Documents' },
];

// What every card needs to render a believable preview with fake data —
// same card_key set as the real app's CARD_REGISTRY, but with sample
// content baked in instead of a live API call, since there's no real
// employee to fetch data for here. No filter pills / status funnels /
// "See more" links anywhere — those imply real, live, filterable data,
// which this deliberately isn't.
const HUB_PREVIEW_CARD_REGISTRY = {
    'stat-attendance': { kind: 'stat', category: 'stat', label: 'Attendance', value: '18/22', sub: 'Days Present (This Month)' },
    'stat-leaves': { kind: 'stat', category: 'stat', label: 'Leaves', value: '12', sub: 'Available Days Left' },
    'stat-tasks': { kind: 'stat', category: 'stat', label: 'Tasks', value: '5', sub: 'Pending Tasks' },
    'stat-timesheets': { kind: 'stat', category: 'stat', label: 'Timesheets', value: '34.5', sub: 'Hours (This Month)' },
    'stat-salary': { kind: 'stat', category: 'stat', label: 'Salary', value: 'Aug 2026', sub: 'Paid' },
    'attendance-chart': { kind: 'chart-bar', category: 'list', title: 'Attendance Overview' },
    'leave-pie': { kind: 'chart-pie', category: 'list', title: 'Leave Distribution' },
    'salary-trend': { kind: 'chart-line', category: 'list', title: 'Net Pay Trend' },
    'task-donut': { kind: 'chart-donut', category: 'list', title: 'Task Status Breakdown' },
    'quick-actions': { kind: 'quick-actions', category: 'list', title: 'Quick Actions' },
    birthdays: { kind: 'birthdays', category: 'list', title: 'Upcoming Birthdays' },
    'my-documents-valid': { kind: 'my-documents-valid', category: 'list', title: 'My Documents' },
    'my-documents-expiring': { kind: 'my-documents-expiring', category: 'list', title: 'Expiring Soon' },
    'leave-balance': { kind: 'leave-balance', category: 'list', title: 'Leave Balance' },
    attendance: { kind: 'list', category: 'list', title: 'Attendance' },
    'employee-checkin': { kind: 'list', category: 'list', title: 'Employee Checkin' },
    'leave-application': { kind: 'list', category: 'list', title: 'Leave Applications' },
    'attendance-request': { kind: 'list', category: 'list', title: 'Attendance Requests' },
    'shift-assignment': { kind: 'list', category: 'list', title: 'Shifts Allocated' },
    'salary-slip': { kind: 'list', category: 'list', title: 'Salary Slips' },
    'expense-claim': { kind: 'list', category: 'list', title: 'Expense Claims' },
    task: { kind: 'list', category: 'list', title: 'My Tasks' },
    timesheet: { kind: 'list', category: 'list', title: 'Timesheets' },
    appraisal: { kind: 'list', category: 'list', title: 'Appraisals' },
    'hr-request': { kind: 'list', category: 'list', title: 'My HR Requests' },
};

// Varied row counts on purpose (2 to 6), with a spread of different
// statuses/badges per row rather than uniform repeats — a more honest
// preview of what a real, mixed set of records tends to look like.
const HUB_PREVIEW_SAMPLE_LIST_ROWS = {
    attendance: [
        ['01 Aug 2026', 'Present', 'status-present'],
        ['02 Aug 2026', 'Present', 'status-present'],
        ['03 Aug 2026', 'Half Day', 'status-half-day'],
        ['04 Aug 2026', 'Absent', 'status-absent'],
        ['05 Aug 2026', 'Work From Home', 'status-in-progress'],
    ],
    'employee-checkin': [
        ['02 Aug 2026, 09:02', 'IN', 'status-approved'],
        ['02 Aug 2026, 18:11', 'OUT', 'status-open'],
        ['03 Aug 2026, 09:14', 'IN', 'status-approved'],
    ],
    'leave-application': [
        ['Annual Leave · 05–07 Aug', 'Approved', 'status-approved'],
        ['Sick Leave · 12 Aug', 'Pending', 'status-pending'],
        ['Annual Leave · 20–21 Aug', 'Rejected', 'status-rejected'],
    ],
    'attendance-request': [
        ['09–10 Aug · Forgot to check in', '', ''],
        ['15 Aug · System downtime', '', ''],
    ],
    'shift-assignment': [['Morning Shift · from 01 Aug 2026', '', '']],
    'salary-slip': [
        ['01–31 Jul 2026 · AED 9,500.00', 'Submitted', 'status-submitted'],
        ['01–31 Aug 2026 · AED 9,500.00', 'Draft', 'status-draft'],
    ],
    'expense-claim': [
        ['AED 240.00 · 03 Aug 2026', 'Unpaid', 'status-unpaid'],
        ['AED 85.00 · 07 Aug 2026', 'Paid', 'status-paid'],
    ],
    task: [
        ['Prepare monthly report · Due 15 Aug', 'Working', 'status-working'],
        ['Review vendor invoices · Due 20 Aug', 'Open', 'status-open'],
        ['Fix onboarding checklist · Due 22 Aug', 'Pending Review', 'status-pending-review'],
        ['Update org chart · Due 25 Aug', 'Completed', 'status-completed'],
    ],
    timesheet: [
        ['05 Aug 2026 · 8 hrs', 'Submitted', 'status-submitted'],
        ['06 Aug 2026 · 7.5 hrs', 'Draft', 'status-draft'],
        ['07 Aug 2026 · 8 hrs', 'Submitted', 'status-submitted'],
    ],
    appraisal: [
        ['Q2 2026 Appraisal Cycle', 'Completed', 'status-completed'],
        ['Q3 2026 Appraisal Cycle', 'Draft', 'status-draft'],
    ],
    'hr-request': [
        ['Visa Renewal', 'Open', 'status-open'],
        ['Exit Permit', 'Approved', 'status-approved'],
        ['Warning Letter Acknowledgement', 'Closed', 'status-closed'],
    ],
};

const HUB_PREVIEW_SAMPLE_BIRTHDAYS = [
    { name: 'Fatima Beevi', date: '18 Aug 2026', color: '#5B8DEF' },
    { name: 'Rania Ahmed', date: '22 Aug 2026', color: '#EF6FA1' },
    { name: 'Dana Khalid', date: '29 Aug 2026', color: '#43AA8B' },
    { name: 'Sample Employee', date: '01 Sep 2026', color: '#F4A259' },
];

class HubLayoutPreview {
    constructor(frm, fieldname) {
        this.frm = frm;
        this.fieldname = fieldname;
        this.activeTab = null;
        this.pendingLayout = this.load_from_doc();
        this.customizeMode = false; // opens in plain view first, not customize
        this._sortableInstances = [];
        this._dragSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
            <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
            <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
        </svg>`;
        this._eyeSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
        </svg>`;
        this._eyeOffSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.4 18.4 0 0 1 4.22-5.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
        this._moveSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 8l-4 4 4 4M3 12h18M17 8l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        this._dupSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8"/>
        </svg>`;
        this._deleteSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    load_from_doc() {
        return (this.frm.doc[this.fieldname] || []).map((row) => ({
            scope: row.scope,
            tab: row.tab,
            card_key: row.card_key,
            is_hidden: row.is_hidden,
            sequence: row.sequence,
        }));
    }

    sync_to_doc() {
        // Matches by (scope, tab, card_key) and updates existing rows in
        // place rather than wiping and rebuilding the whole table on every
        // single interaction — wiping-and-rebuilding made every
        // hide/reorder/move/duplicate look like "N rows removed, N rows
        // added" in the version history, regardless of how small the
        // actual change was.
        const existingByKey = {};
        (this.frm.doc[this.fieldname] || []).forEach((row) => {
            existingByKey[`${row.scope}|${row.tab}|${row.card_key || ''}`] = row;
        });

        const resultRows = [];
        this.pendingLayout.forEach((item) => {
            const key = `${item.scope}|${item.tab}|${item.card_key || ''}`;
            const existing = existingByKey[key];
            if (existing) {
                existing.is_hidden = item.is_hidden;
                existing.sequence = item.sequence;
                resultRows.push(existing);
            } else {
                resultRows.push(
                    this.frm.add_child(this.fieldname, {
                        scope: item.scope,
                        tab: item.tab,
                        card_key: item.card_key,
                        is_hidden: item.is_hidden,
                        sequence: item.sequence,
                    })
                );
            }
        });

        resultRows.forEach((row, idx) => {
            row.idx = idx + 1;
        });
        this.frm.doc[this.fieldname] = resultRows;

        this.frm.refresh_field(this.fieldname);
        this.frm.dirty(); // native "Not Saved" state — same mechanism Frappe already uses everywhere
    }

    tab_map() {
        const map = {};
        this.pendingLayout.forEach((i) => {
            if (i.scope === 'Tab') map[i.tab] = i;
        });
        return map;
    }

    ordered_visible_tabs() {
        const map = this.tab_map();
        return HUB_PREVIEW_TABS.filter((t) => !map[t.key] || !map[t.key].is_hidden).sort((a, b) => {
            const sa = map[a.key] ? map[a.key].sequence : 999;
            const sb = map[b.key] ? map[b.key].sequence : 999;
            return sa - sb;
        });
    }

    render_root($wrapper) {
        this.$root = $wrapper;
        this.$root.empty().addClass('employee-hub hub-rp-preview');
        this.$root.toggleClass('hub-customizing', this.customizeMode);

        this.$root.append(`
            <div class="hub-topbar">
                <button class="hub-hamburger" title="Menu">&#9776;</button>
                <div class="hub-tabbar"></div>
            </div>
            <div class="hub-mobile-overlay"></div>`);

        this.$root.on('click.rpHamburger', '.hub-hamburger', (e) => {
            e.stopPropagation();
            this.$root.find('.hub-tabbar').toggleClass('mobile-open');
            this.$root.find('.hub-mobile-overlay').toggleClass('open');
        });
        this.$root.on('click.rpHamburgerOverlay', '.hub-mobile-overlay', () => {
            this.$root.find('.hub-tabbar').removeClass('mobile-open');
            this.$root.find('.hub-mobile-overlay').removeClass('open');
        });

        this.$main = $('<div class="hub-rp-main"></div>').appendTo(this.$root);
        this.$root.append(
            `<div class="hub-attribution">${
                this.customizeMode
                    ? 'Customizing — sample data shown, no real employee data is fetched here.'
                    : 'Preview — sample data shown, no real employee data is fetched here.'
            }</div>`
        );

        this.bind_events();
        if (!this.activeTab || !this.ordered_visible_tabs().some((t) => t.key === this.activeTab)) {
            const visible = this.ordered_visible_tabs();
            this.activeTab = visible.length ? visible[0].key : 'dashboard';
        }
        this.render_tabbar();
        this.render_tab();
    }

    render_tabbar() {
        const $tabbar = this.$root.find('.hub-tabbar');
        const map = this.tab_map();
        $tabbar.empty();
        HUB_PREVIEW_TABS.forEach((t) => {
            const item = map[t.key];
            const isHidden = !!(item && item.is_hidden);
            if (isHidden && !this.customizeMode) return; // plain view respects hidden tabs like the real dashboard does
            const $tab = $(`<div class="hub-tab ${t.key === this.activeTab ? 'active' : ''} ${isHidden ? 'hub-item-hidden' : ''}" data-key="${t.key}">${frappe.utils.escape_html(t.label)}</div>`);
            if (this.customizeMode) {
                $tab.append(`
                    <div class="hub-customize-overlay">
                        <span class="hub-eye-icon" title="${isHidden ? 'Show' : 'Hide'}">${isHidden ? this._eyeOffSvg : this._eyeSvg}</span>
                        <span class="hub-drag-handle" title="Drag to reorder">${this._dragSvg}</span>
                    </div>`);
            }
            $tabbar.append($tab);
        });
        if (this.customizeMode) this.init_tab_sortable();
    }

    render_tab() {
        this.$main.empty();

        let statItems = this.pendingLayout.filter((i) => i.scope === 'Card' && i.tab === this.activeTab && HUB_PREVIEW_CARD_REGISTRY[i.card_key] && HUB_PREVIEW_CARD_REGISTRY[i.card_key].category === 'stat');
        let listItems = this.pendingLayout.filter((i) => i.scope === 'Card' && i.tab === this.activeTab && HUB_PREVIEW_CARD_REGISTRY[i.card_key] && HUB_PREVIEW_CARD_REGISTRY[i.card_key].category !== 'stat');
        if (!this.customizeMode) {
            statItems = statItems.filter((i) => !i.is_hidden);
            listItems = listItems.filter((i) => !i.is_hidden);
        }
        statItems = statItems.sort((a, b) => a.sequence - b.sequence);
        listItems = listItems.sort((a, b) => a.sequence - b.sequence);

        if (statItems.length) {
            const $row = $('<div class="hub-grid" data-cols="5"></div>').appendTo(this.$main);
            statItems.forEach((item) => this.render_card($row, item));
        }
        if (listItems.length) {
            const $row = $('<div class="hub-grid" data-cols="2"></div>').appendTo(this.$main);
            listItems.forEach((item) => this.render_card($row, item));
        }
        if (!statItems.length && !listItems.length) {
            this.$main.append('<p class="text-muted hub-empty" style="padding:20px;">No cards on this tab.</p>');
        }

        if (this.customizeMode) this.init_card_sortable();
    }

    render_card($row, item) {
        const meta = HUB_PREVIEW_CARD_REGISTRY[item.card_key];
        if (!meta) return;
        const isHidden = !!item.is_hidden;

        let bodyHtml = '';
        if (meta.kind === 'stat') {
            bodyHtml = `
                <div class="hub-stat-label">${meta.label}</div>
                <div class="hub-stat-value">${meta.value}</div>
                <div class="hub-stat-sub">${meta.sub}</div>`;
        } else if (meta.kind.startsWith('chart-')) {
            bodyHtml = `<div class="hub-card-header"><h4>${meta.title}</h4></div><div class="hub-card-body">${this.sample_chart_html(meta.kind)}</div>`;
        } else if (meta.kind === 'quick-actions') {
            bodyHtml = `<div class="hub-card-header"><h4>Quick Actions</h4></div>
                <div class="hub-card-body"><div class="hub-quick-actions">
                    <button class="hub-qa-btn hub-qa-blue" disabled>✓ Apply for Leave</button>
                    <button class="hub-qa-btn hub-qa-cyan" disabled>🕐 Log Timesheet</button>
                    <button class="hub-qa-btn hub-qa-orange" disabled>💰 View Payslip</button>
                    <button class="hub-qa-btn hub-qa-pink" disabled>✎ Raise Request</button>
                </div></div>`;
        } else if (meta.kind === 'birthdays') {
            const rows = HUB_PREVIEW_SAMPLE_BIRTHDAYS.map(
                (b) => `<div class="hub-list-row">
                    <div class="hub-avatar-sm hub-avatar-initials" style="background:${b.color};">${b.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div><div class="hub-list-title">${b.name}</div><div class="hub-list-sub">${b.date}</div></div>
                </div>`
            ).join('');
            bodyHtml = `<div class="hub-card-header"><h4>Upcoming Birthdays</h4></div><div class="hub-card-body">${rows}</div>`;
        } else if (meta.kind === 'my-documents-valid') {
            const sample = [
                ['Passport', 'Valid', '#2ecc71', '12 Jun 2028'],
                ['Emirates Id', 'Valid', '#2ecc71', '01 Mar 2027'],
                ['Visa Copy', 'Valid', '#2ecc71', '20 Nov 2026'],
            ];
            const rows = sample
                .map(
                    ([name, status, color, date]) => `<div class="hub-list-row">
                        <div><div class="hub-list-title">${name}</div><div class="hub-list-sub">Expires ${date}</div></div>
                        <span class="hub-badge" style="background:${color}22;color:${color};">${status}</span>
                    </div>`
                )
                .join('');
            bodyHtml = `<div class="hub-card-header"><h4>My Documents</h4></div><div class="hub-card-body">${rows}</div>`;
        } else if (meta.kind === 'my-documents-expiring') {
            bodyHtml = `<div class="hub-card-header"><h4>Expiring Soon</h4></div><div class="hub-card-body">${hub_preview_expiry_chart_html()}</div>`;
        } else if (meta.kind === 'leave-balance') {
            bodyHtml = `<div class="hub-card-header"><h4>Leave Balance</h4></div>
                <div class="hub-card-body">
                    <div class="hub-leave-row">
                        <div class="hub-leave-top"><span>Annual Leave</span><span>8 / 14 days</span></div>
                        <div class="hub-progress"><div class="hub-progress-bar" style="width:57%"></div></div>
                    </div>
                    <div class="hub-leave-row">
                        <div class="hub-leave-top"><span>Sick Leave</span><span>4 / 7 days</span></div>
                        <div class="hub-progress"><div class="hub-progress-bar" style="width:43%"></div></div>
                    </div>
                </div>`;
        } else {
            const sampleRows = HUB_PREVIEW_SAMPLE_LIST_ROWS[item.card_key] || [['Sample row 1', '', ''], ['Sample row 2', '', '']];
            const rows = sampleRows
                .map(
                    ([title, badge, badgeClass]) => `<div class="hub-list-row">
                        <div class="hub-list-title">${frappe.utils.escape_html(title)}</div>
                        ${badge ? `<span class="hub-badge ${badgeClass}">${frappe.utils.escape_html(badge)}</span>` : ''}
                    </div>`
                )
                .join('');
            bodyHtml = `<div class="hub-card-header"><h4>${meta.title}</h4></div><div class="hub-card-body">${rows}</div>`;
        }

        const cardClass = meta.kind === 'stat' ? 'hub-card hub-stat-card' : 'hub-card';
        const $card = $(`<div class="${cardClass} ${isHidden ? 'hub-item-hidden' : ''}" data-card-key="${item.card_key}" data-category="${meta.category}">${bodyHtml}</div>`);
        if (this.customizeMode) {
            const isDuplicated = this.pendingLayout.filter((i) => i.scope === 'Card' && i.card_key === item.card_key).length > 1;
            $card.append(`
                <div class="hub-customize-overlay">
                    <span class="hub-eye-icon" title="${isHidden ? 'Show' : 'Hide'}">${isHidden ? this._eyeOffSvg : this._eyeSvg}</span>
                    <span class="hub-drag-handle" title="Drag to reorder">${this._dragSvg}</span>
                    <span class="hub-duplicate-icon" title="Duplicate to Another Tab">${this._dupSvg}</span>
                    <span class="hub-move-to-icon" title="Move to a different tab">${this._moveSvg}</span>
                    ${isDuplicated ? `<span class="hub-delete-duplicate-icon" title="Remove this duplicate">${this._deleteSvg}</span>` : ''}
                </div>`);
        }
        $row.append($card);
    }

    sample_chart_html(kind) {
        const id = 'rp-chart-' + Math.random().toString(36).slice(2);
        setTimeout(() => this.init_sample_chart(id, kind), 0);
        return `<div class="hub-chart" id="${id}" style="min-height:180px;"></div>`;
    }

    init_sample_chart(id, kind) {
        const el = document.getElementById(id);
        if (!el || !window.frappe || !frappe.Chart) return;
        try {
            if (kind === 'chart-bar') {
                new frappe.Chart(el, {
                    data: { labels: ['22 Jul', '29 Jul', '05 Aug'], datasets: [
                        { name: 'Present', chartType: 'bar', values: [5, 4, 5] },
                        { name: 'Absent', chartType: 'bar', values: [0, 1, 0] },
                        { name: 'Half Day', chartType: 'bar', values: [1, 0, 1] },
                    ] },
                    type: 'bar', height: 180, colors: ['#2ecc71', '#e74c3c', '#f1c40f'], hideLegend: 1,
                });
            } else if (kind === 'chart-pie') {
                new frappe.Chart(el, {
                    data: { labels: ['Annual Leave', 'Sick Leave'], datasets: [{ values: [8, 4] }] },
                    type: 'pie', height: 180, colors: ['#6C5CE7', '#00b894'], hideLegend: 1,
                });
            } else if (kind === 'chart-line') {
                new frappe.Chart(el, {
                    data: { labels: ['Jun', 'Jul', 'Aug'], datasets: [{ name: 'Net Pay', chartType: 'line', values: [9500, 9500, 10200] }] },
                    type: 'line', height: 180, colors: ['#6C5CE7'], hideLegend: 1,
                });
            } else if (kind === 'chart-donut') {
                new frappe.Chart(el, {
                    data: { labels: ['Open', 'Working', 'Pending Review', 'Completed'], datasets: [{ values: [3, 2, 1, 5] }] },
                    type: 'donut', height: 180, colors: ['#6C5CE7', '#fdcb6e', '#e17055', '#00b894'], hideLegend: 1,
                });
            }
        } catch (e) {
            /* sample chart is cosmetic only — safe to skip on any render hiccup */
        }
    }

    bind_events() {
        this.$root.off('click.rpHub');

        this.$root.on('click.rpHub', '.hub-tab', (e) => {
            if ($(e.target).closest('.hub-customize-overlay').length) return;
            this.activeTab = $(e.currentTarget).attr('data-key');
            this.$root.find('.hub-tabbar').removeClass('mobile-open');
            this.$root.find('.hub-mobile-overlay').removeClass('open');
            this.render_tabbar();
            this.render_tab();
        });

        this.$root.on('click.rpHub', '.hub-eye-icon', (e) => {
            e.stopPropagation();
            const $target = $(e.currentTarget).closest('[data-card-key], .hub-tab');
            const cardKey = $target.attr('data-card-key');
            const tabKey = $target.attr('data-key');
            const item = cardKey
                ? this.pendingLayout.find((i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key === cardKey)
                : this.pendingLayout.find((i) => i.scope === 'Tab' && i.tab === tabKey);
            if (!item) return;
            item.is_hidden = item.is_hidden ? 0 : 1;
            this.sync_to_doc();
            this.render_tabbar();
            this.render_tab();
        });

        this.$root.on('click.rpHub', '.hub-move-to-icon', (e) => {
            e.stopPropagation();
            this.open_tab_picker($(e.currentTarget).closest('[data-card-key]'), 'move');
        });
        this.$root.on('click.rpHub', '.hub-duplicate-icon', (e) => {
            e.stopPropagation();
            this.open_tab_picker($(e.currentTarget).closest('[data-card-key]'), 'duplicate');
        });

        this.$root.on('click.rpHub', '.hub-delete-duplicate-icon', (e) => {
            e.stopPropagation();
            const cardKey = $(e.currentTarget).closest('[data-card-key]').attr('data-card-key');
            this.delete_duplicate_card(cardKey);
        });
    }

    open_tab_picker($card, action) {
        this.$root.find('.hub-move-to-menu').remove();
        const cardKey = $card.attr('data-card-key');
        const otherTabs = this.ordered_visible_tabs()
            .concat(HUB_PREVIEW_TABS.filter((t) => !this.ordered_visible_tabs().some((v) => v.key === t.key)))
            .filter((t) => t.key !== this.activeTab);

        const $menu = $(`<div class="hub-move-to-menu">${otherTabs.map((t) => `<div class="hub-move-to-option" data-tab="${t.key}">${frappe.utils.escape_html(t.label)}</div>`).join('')}</div>`);
        $card.css('position', 'relative').append($menu);

        this.$root.off('click.rpTabPick').on('click.rpTabPick', '.hub-move-to-option', (e) => {
            const targetTab = $(e.currentTarget).attr('data-tab');
            if (action === 'duplicate') this.duplicate_card(cardKey, targetTab);
            else this.move_card(cardKey, targetTab);
            $menu.remove();
        });
        setTimeout(() => {
            $(document).off('click.rpOutside').on('click.rpOutside', (e) => {
                if (!$(e.target).closest('.hub-move-to-menu, .hub-move-to-icon, .hub-duplicate-icon').length) $menu.remove();
            });
        }, 0);
    }

    move_card(cardKey, targetTab) {
        const item = this.pendingLayout.find((i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key === cardKey);
        if (!item) return;
        const remaining = this.pendingLayout.filter((i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key !== cardKey);
        if (!remaining.length) {
            frappe.msgprint(__('A tab needs at least one card. Either hide the whole tab instead, or add another card here first.'));
            return;
        }
        if (this.pendingLayout.find((i) => i.scope === 'Card' && i.tab === targetTab && i.card_key === cardKey)) {
            frappe.msgprint(__('This card is already on that tab — pick a different one.'));
            return;
        }
        const maxSeq = Math.max(0, ...this.pendingLayout.filter((i) => i.scope === 'Card' && i.tab === targetTab).map((i) => i.sequence || 0));
        item.tab = targetTab;
        item.sequence = maxSeq + 1;
        this.sync_to_doc();
        this.render_tab();
    }

    duplicate_card(cardKey, targetTab) {
        if (this.pendingLayout.find((i) => i.scope === 'Card' && i.tab === targetTab && i.card_key === cardKey)) {
            frappe.msgprint(__('This card already exists on that tab — pick a different one.'));
            return;
        }
        const maxSeq = Math.max(0, ...this.pendingLayout.filter((i) => i.scope === 'Card' && i.tab === targetTab).map((i) => i.sequence || 0));
        this.pendingLayout.push({ scope: 'Card', tab: targetTab, card_key: cardKey, is_hidden: 0, sequence: maxSeq + 1 });
        this.sync_to_doc();
        frappe.show_alert({ message: __('Also added to {0}', [(HUB_PREVIEW_TABS.find((t) => t.key === targetTab) || {}).label || targetTab]), indicator: 'blue' });
    }

    delete_duplicate_card(cardKey) {
        const remaining = this.pendingLayout.filter(
            (i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key !== cardKey
        );
        if (!remaining.length) {
            frappe.msgprint(__('A tab needs at least one card. Hide the whole tab instead if you want it empty.'));
            return;
        }
        this.pendingLayout = this.pendingLayout.filter(
            (i) => !(i.scope === 'Card' && i.tab === this.activeTab && i.card_key === cardKey)
        );
        this.sync_to_doc();
        this.render_tab();
        frappe.show_alert({ message: __('Removed from this tab'), indicator: 'blue' });
    }

    recompute_sequences() {
        this.$root.find('.hub-tabbar .hub-tab').each((idx, el) => {
            const key = $(el).attr('data-key');
            const item = this.pendingLayout.find((i) => i.scope === 'Tab' && i.tab === key);
            if (item) item.sequence = idx + 1;
        });
        ['stat', 'list'].forEach((category) => {
            this.$main.find(`[data-card-key][data-category="${category}"]`).each((idx, el) => {
                const key = $(el).attr('data-card-key');
                const item = this.pendingLayout.find((i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key === key);
                if (item) item.sequence = idx + 1;
            });
        });
    }

    destroy_sortable() {
        (this._sortableInstances || []).forEach((s) => {
            try { s.destroy(); } catch (e) { /* already gone */ }
        });
        this._sortableInstances = [];
    }

    init_tab_sortable() {
        if (!window.Sortable) return;
        const $tabbar = this.$root.find('.hub-tabbar');
        if (!$tabbar.length) return;
        this._sortableInstances.push(new Sortable($tabbar[0], {
            animation: 180, handle: '.hub-drag-handle',
            ghostClass: 'hub-sortable-ghost', chosenClass: 'hub-sortable-chosen', dragClass: 'hub-sortable-drag',
            onEnd: () => { this.recompute_sequences(); this.sync_to_doc(); },
        }));
    }

    init_card_sortable() {
        this.destroy_sortable();
        if (!window.Sortable) return;
        const onEnd = () => { this.recompute_sequences(); this.sync_to_doc(); };
        this.$main.find('.hub-grid').each((_, row) => {
            this._sortableInstances.push(new Sortable(row, {
                group: `rp-hub-category-${$(row).find('[data-card-key]').first().attr('data-category')}`,
                animation: 180, handle: '.hub-drag-handle',
                ghostClass: 'hub-sortable-ghost', chosenClass: 'hub-sortable-chosen', dragClass: 'hub-sortable-drag',
                onEnd,
            }));
        });
        this.init_tab_sortable();
    }
}

// Auto-collapses the form's own left sidebar (Assigned To / Attachments /
// Tags / Share) when entering Preview, for more width — the user brings
// it back with Frappe's own existing sidebar toggle (the ☰ icon next to
// the breadcrumb), not a separate control of ours.
// Sample version of the real app's Expiring Soon radial chart, using fixed
// illustrative days-remaining values instead of live data — same arc math,
// same SVG-native label positioning (so it scales responsively the same
// way), same click-through wiring where a real doc name would normally go.
function hub_preview_expiry_chart_html() {
    const sample = [
        { name: 'Driving License', days: 12, color: '#e84393' },
        { name: 'Health Insurance', days: 25, color: '#3498db' },
        { name: 'Visa Copy', days: 40, color: '#8e7dbe' },
        { name: 'Emirates Id', days: 58, color: '#f39c12' },
        { name: 'Passport', days: 70, color: '#00b894' },
    ];
    const maxDays = Math.max(...sample.map((d) => d.days), 1);
    const cx = 200,
        cy = 200;
    const startAngle = -140;
    const maxSweep = 260;
    const maxRadius = 172;
    const ringGap = 28;

    const polarToCartesian = (r, angleDeg) => {
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    const describeArc = (r, a1, a2) => {
        const start = polarToCartesian(r, a2);
        const end = polarToCartesian(r, a1);
        const largeArc = a2 - a1 <= 180 ? 0 : 1;
        return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
    };

    const n = sample.length;
    let arcs = '';
    let guides = '';
    let labels = '';

    sample.forEach((d, i) => {
        const ringIndex = n - 1 - i;
        const radius = maxRadius - ringGap * (n - 1 - ringIndex);
        const sweep = Math.max(18, maxSweep * (d.days / maxDays));

        guides += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" class="hub-expiry-guide"></circle>`;
        arcs += `<path d="${describeArc(radius, startAngle, startAngle + sweep)}" fill="none" stroke="${d.color}" stroke-width="13" stroke-linecap="round" class="hub-expiry-arc"><title>${d.name} — ${d.days}d</title></path>`;

        const labelPos = polarToCartesian(radius, startAngle);
        labels += `
            <circle cx="${labelPos.x}" cy="${labelPos.y}" r="15" fill="${d.color}" class="hub-expiry-badge"></circle>
            <text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="12" font-weight="700" class="hub-expiry-badge">${d.days}</text>
            <text x="${labelPos.x}" y="${labelPos.y + 24}" text-anchor="middle" font-size="11" font-weight="600" class="hub-expiry-doc-label">${d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name}</text>`;
    });

    return `<div class="hub-expiry-chart-wrap">
        <svg viewBox="0 0 400 400" class="hub-expiry-chart-svg">
            ${guides}
            ${arcs}
            ${labels}
            <circle cx="${cx}" cy="${cy}" r="46" class="hub-expiry-center-halo"></circle>
            <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="15" font-weight="700" class="hub-expiry-center-title">Expiring Soon</text>
            <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="11" class="hub-expiry-center-sub">Next ${n} Documents</text>
        </svg>
    </div>`;
}

function hub_collapse_form_sidebar(collapse) {
    const selectors = [
        '.layout-side-section',
        '.form-sidebar',
        '.form-page .layout-side-section',
        '[data-fieldname="sidebar"]',
        '.form-sidebar-stats-area',
    ];
    selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
            el.classList.toggle('hub-rp-sidebar-collapsed', collapse);
        });
    });
}

const HUB_PREVIEW_FETCH_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const HUB_PREVIEW_RESET_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12a9 9 0 1 1 2.64 6.36M3 12V6M3 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Builds the full header strip (Preview / Customize / Fetch-or-Reset) for
// any doctype form with a layout-item child table, and wires all of its
// behavior. `opts`:
//   - fieldname: the child table fieldname on this doctype (e.g. "layout"
//     or "global_default_layout")
//   - resetConfirmText / resetConfirmTextEmpty: confirm dialog wording
//   - onReset(frm): async — performs the actual fetch/reset action;
//     resolve once frm.doc[fieldname] + save (if needed) is complete
//   - resetSuccessText / fetchSuccessText: alert text after onReset resolves
function build_hub_layout_header(frm, opts) {
    const fieldname = opts.fieldname;
    if (!frm.fields_dict[fieldname] || !frm.fields_dict[fieldname].$wrapper) return;
    const $gridWrapper = frm.fields_dict[fieldname].$wrapper;

    if (frm._hub_header) return; // built once per form instance

    frm._hub_header = $(`
        <div class="hub-rp-header">
            <button type="button" class="hub-rp-btn hub-rp-toggle-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
                </svg>
                <span>${__("Preview")}</span>
            </button>
            <button type="button" class="hub-rp-btn hub-rp-customize-btn" style="display:none;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>${__("Customize")}</span>
                <span class="hub-rp-customize-dot"></span>
            </button>
            <button type="button" class="hub-rp-btn hub-rp-reset-btn">
                <span class="hub-rp-reset-icon"></span>
                <span class="hub-rp-reset-label"></span>
            </button>
        </div>`);
    $gridWrapper.before(frm._hub_header);

    frm._hub_preview_wrapper = $('<div class="hub-rp-preview-wrapper" style="display:none;"></div>');
    $gridWrapper.after(frm._hub_preview_wrapper);

    frm.hub_preview = new HubLayoutPreview(frm, fieldname);

    const $toggleBtn = frm._hub_header.find('.hub-rp-toggle-btn');
    const $customizeBtn = frm._hub_header.find('.hub-rp-customize-btn');

    const setToggleLabel = () => {
        $toggleBtn.find('span').first().text(frm._hub_in_preview ? __("Table View") : __("Preview"));
        $toggleBtn.toggleClass('hub-rp-btn-active', !!frm._hub_in_preview);
    };
    const setCustomizeLabel = () => {
        $customizeBtn.toggleClass('hub-rp-btn-active', !!(frm.hub_preview && frm.hub_preview.customizeMode));
    };

    $toggleBtn.on('click', () => {
        if ($toggleBtn.attr('data-empty')) {
            frappe.msgprint(__('There\'s nothing to preview yet — use {0} first.', [opts.fetchLabel || __('Fetch Default Layout')]));
            return;
        }
        frm._hub_in_preview = !frm._hub_in_preview;
        if (frm._hub_in_preview) {
            $gridWrapper.hide();
            frm._hub_preview_wrapper.show();
            frm.hub_preview.customizeMode = false;
            frm.hub_preview.render_root(frm._hub_preview_wrapper);
            $customizeBtn.show();
            hub_collapse_form_sidebar(true);
        } else {
            frm._hub_preview_wrapper.hide();
            $gridWrapper.show();
            $customizeBtn.hide();
            hub_collapse_form_sidebar(false);
        }
        setToggleLabel();
        setCustomizeLabel();
    });

    $customizeBtn.on('click', () => {
        if (!frm.hub_preview) return;
        frm.hub_preview.customizeMode = !frm.hub_preview.customizeMode;
        frm.hub_preview.render_root(frm._hub_preview_wrapper);
        setCustomizeLabel();
    });

    frm._hub_header.find('.hub-rp-reset-btn').on('click', () => {
        const isEmpty = !(frm.doc[fieldname] || []).length;
        frappe.confirm(
            isEmpty
                ? opts.resetConfirmTextEmpty || __("Fetch the current Global Default Layout into this record?")
                : opts.resetConfirmText || __("Replace this layout with the current Global Default Layout? This overwrites everything below and saves immediately."),
            () => {
                opts.onReset(frm).then(() => {
                    frappe.show_alert({
                        message: isEmpty ? opts.fetchSuccessText || __("Fetched the default layout") : opts.resetSuccessText || __("Reset to the default layout"),
                        indicator: 'green',
                    });
                    if (frm.hub_preview) {
                        frm.hub_preview.pendingLayout = frm.hub_preview.load_from_doc();
                        if (frm._hub_in_preview) frm.hub_preview.render_root(frm._hub_preview_wrapper);
                    }
                    hub_update_header_state(frm, fieldname);
                });
            }
        );
    });

    // Re-checked continuously (not just after Save) so Preview/Customize
    // become available and the Fetch/Reset button's label switches the
    // instant a row exists — whether it got there by fetching, or by the
    // user adding one directly into the raw grid themselves.
    frm._hub_state_interval = setInterval(() => hub_update_header_state(frm, fieldname), 700);
    hub_update_header_state(frm, fieldname);
    setToggleLabel();
}

function hub_update_header_state(frm, fieldname) {
    if (!frm._hub_header || !document.body.contains(frm._hub_header[0])) {
        clearInterval(frm._hub_state_interval); // form navigated away from — stop checking
        return;
    }

    const hasRows = (frm.doc[fieldname] || []).length > 0;

    const $resetBtn = frm._hub_header.find('.hub-rp-reset-btn');
    $resetBtn.find('.hub-rp-reset-icon').html(hasRows ? HUB_PREVIEW_RESET_ICON : HUB_PREVIEW_FETCH_ICON);
    $resetBtn.find('.hub-rp-reset-label').text(hasRows ? __("Reset to Default") : __("Fetch Default Layout"));

    // Preview (and therefore Customize) only makes sense once there's at
    // least one row — an empty table has no tabs to show at all.
    const $toggleBtn = frm._hub_header.find('.hub-rp-toggle-btn');
    const $customizeBtn = frm._hub_header.find('.hub-rp-customize-btn');
    $toggleBtn.attr('data-empty', !hasRows ? '1' : '').toggleClass('hub-rp-btn-disabled', !hasRows);
    if (!hasRows && frm._hub_in_preview) {
        // Data was removed while previewing — drop back to the table view.
        frm._hub_in_preview = false;
        frm._hub_preview_wrapper.hide();
        frm.fields_dict[fieldname].$wrapper.show();
        $customizeBtn.hide();
        hub_collapse_form_sidebar(false);
        $toggleBtn.find('span').first().text(__("Preview"));
        $toggleBtn.removeClass('hub-rp-btn-active');
    }
}