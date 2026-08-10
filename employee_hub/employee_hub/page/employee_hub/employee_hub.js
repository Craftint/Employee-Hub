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

// Describes every card well enough to build and populate it on ANY tab —
// this is what makes "Move To" actually work: without this, a moved card's
// data changes correctly but nothing ever draws its HTML on the new tab,
// since each tab's render function only ever knew how to build its own
// original, fixed set of cards.
const CARD_REGISTRY = {
    'stat-attendance': { kind: 'stat' },
    'stat-leaves': { kind: 'stat' },
    'stat-tasks': { kind: 'stat' },
    'stat-timesheets': { kind: 'stat' },
    'stat-salary': { kind: 'stat' },
    'attendance-chart': { kind: 'chart-attendance' },
    'leave-pie': { kind: 'chart-leave-pie' },
    'salary-trend': { kind: 'chart-salary-trend' },
    'task-donut': { kind: 'chart-task-donut' },
    'quick-actions': { kind: 'static-quick-actions' },
    'documents-info': { kind: 'static-documents-info' },
    'leave-balance': { kind: 'leave-balance' },
    'birthdays': { kind: 'birthdays' },
    attendance: { kind: 'list', title: 'Attendance', seeMoreKey: 'attendance' },
    'employee-checkin': { kind: 'list', title: 'Employee Checkin', seeMoreKey: 'employee-checkin' },
    'leave-application': { kind: 'list', title: 'Leave Applications', seeMoreKey: 'leave-application' },
    'attendance-request': { kind: 'list', title: 'Attendance Requests', seeMoreKey: 'attendance-request' },
    'shift-assignment': { kind: 'list', title: 'Shifts Allocated', seeMoreKey: 'shift-assignment', filterable: false },
    'salary-slip': { kind: 'list', title: 'Salary Slips', seeMoreKey: 'salary-slip' },
    'expense-claim': { kind: 'list', title: 'Expense Claims', seeMoreKey: 'expense-claim' },
    task: { kind: 'list', title: 'My Tasks', seeMoreKey: 'task' },
    timesheet: { kind: 'list', title: 'Timesheets', seeMoreKey: 'timesheet' },
    appraisal: { kind: 'list', title: 'Appraisals', seeMoreKey: 'appraisal' },
    'hr-request': { kind: 'list', title: 'My HR Requests', seeMoreKey: 'hr-request' },
};

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
        this.cardPeriods = {}; // cardKey -> {type, from, to}
        this.cardStatusFilters = {}; // cardKey -> selected status/workflow-state string
        this.statusOptionsCache = {}; // cardKey -> {field, options} from get_card_status_options

        // Personalization (Phase 2b)
        this.layoutState = null; // last-saved-or-default layout, as returned by get_effective_layout
        this.pendingLayout = null; // working copy while in Customize Mode; only pushed to server on Save
        this.customizeMode = false;
        this.isDirty = false;

        this.$container = $('<div class="employee-hub">').appendTo(page.body);
        this.init();
    }

    async init() {
        this.$container.html('<div class="hub-loading">Loading your dashboard...</div>');
        // Scope this class to just this page's title (Frappe's own H4), so
        // only Employee Hub gets a responsive/shrinking title, not other pages.
        $(this.page.wrapper).find('.title-text').addClass('hub-page-title');

        const [profileRes, todoRes, commRes, layoutRes] = await Promise.all([
            frappe.call('employee_hub.employee_hub.api.get_profile_data'),
            frappe.call('employee_hub.employee_hub.api.get_my_todos_and_events'),
            frappe.call('employee_hub.employee_hub.api.get_open_communication_count'),
            frappe.call('employee_hub.employee_hub.api.get_effective_layout'),
        ]);
        this.profile = profileRes.message;
        this.employee = this.profile.name;
        this.todoData = todoRes.message;
        this.commCount = commRes.message.count;
        this.layoutState = layoutRes.message;
        this.pendingLayout = JSON.parse(JSON.stringify(this.layoutState.items));

        this.render_shell();
        await this.load_tab(this.first_visible_tab());
    }

    // -----------------------------------------------------------------
    // Personalization (Phase 2b) — layout resolution + Customize Mode
    // -----------------------------------------------------------------
    active_layout_items() {
        return this.customizeMode ? this.pendingLayout : this.layoutState.items;
    }

    tab_layout_map() {
        const map = {};
        this.active_layout_items().forEach((i) => {
            if (i.scope === 'Tab') map[i.tab] = i;
        });
        return map;
    }

    ordered_visible_tabs() {
        const map = this.tab_layout_map();
        return HUB_TABS.filter((t) => !map[t.key] || !map[t.key].is_hidden).sort((a, b) => {
            const seqA = map[a.key] ? map[a.key].sequence : 999;
            const seqB = map[b.key] ? map[b.key].sequence : 999;
            return seqA - seqB;
        });
    }

    first_visible_tab() {
        const visible = this.ordered_visible_tabs();
        return visible.length ? visible[0].key : 'dashboard';
    }

    // Applies is_hidden + sequence from the active layout to the already-
    // rendered DOM — hides/reorders elements in place rather than changing
    // how each tab's render_*_tab function builds its markup. Cards are
    // reordered *within their existing parent* only (each .hub-grid row
    // already groups same-type cards together), matching the "like-kind
    // groups only" reordering constraint.
    apply_layout_to_dom() {
        // Tabs: order + visibility of the tab pills themselves.
        const order = this.ordered_visible_tabs().map((t) => t.key);
        const hiddenTabs = new Set(HUB_TABS.map((t) => t.key).filter((k) => !order.includes(k)));
        const $tabbar = this.$container.find('.hub-tabbar');
        order.forEach((key) => {
            const $tab = $tabbar.find(`.hub-tab[data-key="${key}"]`);
            $tab.show().removeClass('hub-item-hidden');
            $tabbar.append($tab); // re-append in visit order == reorder
        });
        hiddenTabs.forEach((key) => {
            const $tab = $tabbar.find(`.hub-tab[data-key="${key}"]`);
            $tab.toggle(this.customizeMode).addClass('hub-item-hidden');
        });

        // Cards within the currently-rendered tab.
        const cardMap = {};
        this.active_layout_items().forEach((i) => {
            if (i.scope === 'Card') cardMap[`${i.tab}|${i.card_key}`] = i;
        });

        this.$main.find('[data-card-key]').each((_, el) => {
            const $el = $(el);
            const key = $el.attr('data-card-key');
            const item = cardMap[`${this.activeTab}|${key}`];
            if (!item) {
                // No layout item ties this card to the current tab anymore
                // — it's been moved elsewhere via Move To. The tab's own
                // native render function still built it unconditionally
                // (it doesn't know about the move), so it has to be
                // stripped out here rather than left visible with
                // controls that silently do nothing.
                $el.remove();
                return;
            }
            $el.toggle(!item.is_hidden || this.customizeMode);
            $el.toggleClass('hub-item-hidden', !!item.is_hidden);
            $el.attr('data-sequence', item.sequence);
        });

        // Reorder cards within each parent group (a group = a shared
        // parent, e.g. one .hub-grid row) by their sequence number.
        const parents = new Set();
        this.$main.find('[data-card-key]').each((_, el) => parents.add(el.parentElement));
        parents.forEach((parent) => {
            const $children = $(parent).find('> [data-card-key]');
            const sorted = $children.toArray().sort((a, b) => {
                return (parseInt($(a).attr('data-sequence'), 10) || 0) - (parseInt($(b).attr('data-sequence'), 10) || 0);
            });
            sorted.forEach((el) => $(parent).append(el));
        });
    }

    // Finds every card assigned (via layout data) to the current tab that
    // the tab's own hardcoded render function didn't produce — i.e. a card
    // that's been moved here via "Move To" — builds a placeholder for it
    // in the right category row (creating that row if the tab doesn't have
    // one yet), and populates it using whichever endpoint that card type
    // uses. This runs after every tab render, customizing or not, so a
    // saved move shows up correctly even outside Customize Mode.
    async inject_foreign_cards() {
        const assignedKeys = this.active_layout_items()
            .filter((i) => i.scope === 'Card' && i.tab === this.activeTab)
            .map((i) => i.card_key);

        const missing = assignedKeys.filter(
            (key) => CARD_REGISTRY[key] && this.$main.find(`[data-card-key="${key}"]`).length === 0
        );
        if (!missing.length) return;

        const findOrCreateRow = (category, cols, prepend) => {
            let $row = this.$main
                .find('.hub-grid')
                .filter((_, row) => {
                    const $first = $(row).find('[data-card-key]').first();
                    return $first.length && $first.attr('data-category') === category;
                })
                .last();
            if (!$row.length) {
                $row = $(`<div class="hub-grid" data-cols="${cols}"></div>`);
                if (prepend) {
                    this.$main.prepend($row);
                } else {
                    this.$main.append($row);
                }
            }
            return $row;
        };

        for (const key of missing) {
            const meta = CARD_REGISTRY[key];
            // Stat cards get their own row, placed first (matching where
            // they always sit on Dashboard) — everything else (charts,
            // lists, quick actions, etc.) shares the general content row.
            const $row = meta && meta.kind === 'stat' ? findOrCreateRow('stat', 5, true) : findOrCreateRow('list', 2, false);
            await this.inject_one_card(key, $row);
        }

        this.apply_layout_to_dom();
        if (this.customizeMode) {
            this.render_customize_affordances();
            this.init_sortable();
        }
    }

    async inject_one_card(key, $row) {
        const meta = CARD_REGISTRY[key];
        if (!meta) return;

        if (meta.kind === 'list') {
            const $placeholder = $(this.list_card(meta.title, meta.seeMoreKey, key, [], meta.filterable !== false, 0));
            $placeholder.attr('data-category', 'list');
            $row.append($placeholder);
            await this.refresh_card(key);
            return;
        }

        if (meta.kind === 'stat') {
            const r = await frappe.call('employee_hub.employee_hub.api.get_single_stat', { stat_key: key });
            const s = r.message;
            const extra =
                key === 'stat-attendance'
                    ? `<div class="hub-progress"><div class="hub-progress-bar" style="width:${s.percent}%"></div></div>`
                    : '';
            $row.append(`
                <div class="hub-card hub-stat-card" data-card-key="${key}" data-category="stat">
                    <div class="hub-stat-label">${s.label}</div>
                    <div class="hub-stat-value">${s.value}</div>
                    <div class="hub-stat-sub">${s.sub}</div>
                    ${extra}
                    <a class="hub-card-link" data-route-doctype="${s.link}">View ${s.label} &rarr;</a>
                </div>`);
            return;
        }

        if (meta.kind === 'chart-attendance') {
            $row.append(`<div class="hub-card" data-card-key="${key}" data-category="list">
                <div class="hub-card-header"><h4>Attendance Overview</h4>
                    <div class="hub-card-header-right">${this.render_mini_filter('attendance-chart')}</div>
                </div>
                <div class="hub-card-body"><div class="hub-loading">Loading...</div></div>
            </div>`);
            const r = await frappe.call('employee_hub.employee_hub.api.get_attendance_chart', {
                period: (this.cardPeriods['attendance-chart'] || { type: default_period_for('attendance-chart') }).type,
            });
            const $card = this.$main.find(`[data-card-key="${key}"]`);
            $card.find('.hub-card-body').html(this.attendance_chart_body_html(r.message));
            this.init_attendance_chart($card);
            return;
        }

        if (meta.kind === 'chart-leave-pie') {
            const r = await frappe.call('employee_hub.employee_hub.api.get_dashboard_data');
            const pie = r.message.leave_pie;
            $row.append(`<div class="hub-card" data-card-key="${key}" data-category="list">
                <div class="hub-card-header"><h4>Leave Distribution</h4></div>
                <div class="hub-card-body">
                ${
                    pie
                        ? `<div class="hub-chart" id="hub-leave-pie-${key}" data-labels='${JSON.stringify(
                              pie.labels
                          )}' data-values='${JSON.stringify(pie.values)}'></div>` +
                          this.render_swatch_legend(pie.labels, ['#6C5CE7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393'])
                        : '<p class="text-muted hub-empty">No leave allocations found.</p>'
                }
                </div>
            </div>`);
            if (pie) {
                const $el = this.$main.find(`#hub-leave-pie-${key}`);
                new frappe.Chart($el[0], {
                    data: { labels: JSON.parse($el.attr('data-labels')), datasets: [{ values: JSON.parse($el.attr('data-values')) }] },
                    type: 'pie',
                    height: 220,
                    colors: ['#6C5CE7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393'],
                    hideLegend: 1,
                });
            }
            return;
        }

        if (meta.kind === 'chart-salary-trend') {
            $row.append(this.render_salary_trend_section({ labels: [] }));
            const period = this.cardPeriods['salary-trend'] || { type: default_period_for('salary-trend') };
            const r = await frappe.call('employee_hub.employee_hub.api.get_salary_trend_chart', { period: period.type });
            const $card = this.$main.find('[data-card-key="salary-trend"]').last();
            $card.find('.hub-card-body').html(this.salary_trend_body_html(r.message));
            this.init_salary_trend_chart($card);
            return;
        }

        if (meta.kind === 'chart-task-donut') {
            $row.append(this.render_task_donut_section({ labels: [] }));
            const period = this.cardPeriods['task-donut'] || { type: default_period_for('task-donut') };
            const r = await frappe.call('employee_hub.employee_hub.api.get_task_status_chart', { period: period.type });
            const $card = this.$main.find('[data-card-key="task-donut"]').last();
            $card.find('.hub-card-body').html(this.task_donut_body_html(r.message));
            this.init_task_donut_chart($card);
            return;
        }

        if (meta.kind === 'static-quick-actions') {
            $row.append(`
                <div class="hub-card" data-card-key="quick-actions" data-category="list">
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
            return;
        }

        if (meta.kind === 'static-documents-info') {
            $row.append(`
                <div class="hub-card" data-card-key="documents-info" data-category="list">
                    <div class="hub-card-header"><h4>Documents</h4></div>
                    <div class="hub-card-body">
                        <p class="text-muted hub-empty">Document tracking (Visa, Passport, Emirates ID, etc.) isn't wired up yet.
                        For now you can view attachments on your Employee record.</p>
                        <a class="hub-card-link" data-route-doctype="employee-form">Open My Employee Record &rarr;</a>
                    </div>
                </div>`);
            return;
        }

        if (meta.kind === 'leave-balance') {
            const r = await frappe.call('employee_hub.employee_hub.api.get_leave_balance_card');
            $row.append(this.render_leave_balance_card(r.message.leave_balance));
            return;
        }

        if (meta.kind === 'birthdays') {
            const r = await frappe.call('employee_hub.employee_hub.api.get_birthdays_card');
            const birthdays = r.message.birthdays;
            $row.append(`<div class="hub-card" data-card-key="birthdays" data-category="list">
                <div class="hub-card-header"><h4>Upcoming Birthdays</h4></div>
                <div class="hub-card-body">
                ${
                    birthdays.length
                        ? `<div class="hub-scroll-list hub-scroll-4">` +
                          birthdays
                              .map(
                                  (b) => `
                    <div class="hub-list-row hub-birthday-row">
                        ${
                            b.image
                                ? `<img class="hub-avatar-sm" src="${b.image}">`
                                : `<div class="hub-avatar-sm hub-avatar-initials">${this.get_initials(b.employee_name)}</div>`
                        }
                        <div>
                            <div class="hub-list-title">${frappe.utils.escape_html(b.employee_name)}</div>
                            <div class="hub-list-sub">${frappe.datetime.str_to_user(b.next_birthday)}</div>
                        </div>
                    </div>`
                              )
                              .join('') +
                          `</div>`
                        : '<p class="text-muted hub-empty">No birthdays in the next 30 days.</p>'
                }
                </div>
            </div>`);
            return;
        }
    }

    enter_customize_mode() {
        this.customizeMode = true;
        this.pendingLayout = JSON.parse(JSON.stringify(this.layoutState.items));
        this.isDirty = false;
        this.$container.addClass('hub-customizing');
        this.refresh_customize_controls();
        this.apply_layout_to_dom();
        this.render_customize_affordances();
        this.init_sortable();
    }

    // `discard` = true also reverts pendingLayout back to last-saved state
    // (used for both the explicit Discard button and the Done/toggle-off
    // path after confirming an unsaved-changes warning).
    exit_customize_mode(discard) {
        this.customizeMode = false;
        if (discard) {
            this.pendingLayout = JSON.parse(JSON.stringify(this.layoutState.items));
        }
        this.isDirty = false;
        this.$container.removeClass('hub-customizing');
        this.refresh_customize_controls();
        this.apply_layout_to_dom();
        this.render_customize_affordances();
        this.destroy_sortable();
    }

    mark_dirty() {
        if (this.isDirty) return;
        this.isDirty = true;
        this.refresh_customize_controls();
    }

    async save_layout() {
        const r = await frappe.call('employee_hub.employee_hub.api.save_employee_hub_layout', {
            items: JSON.stringify(this.pendingLayout),
        });
        if (!r.message || !r.message.ok) return;
        this.layoutState.items = this.pendingLayout;
        this.layoutState.source = 'personal';
        frappe.show_alert({ message: __('Layout saved'), indicator: 'green' });
        this.exit_customize_mode(false);
    }

    async reset_layout() {
        await frappe.call('employee_hub.employee_hub.api.reset_employee_hub_layout');
        const r = await frappe.call('employee_hub.employee_hub.api.get_effective_layout');
        this.layoutState = r.message;
        this.pendingLayout = JSON.parse(JSON.stringify(this.layoutState.items));
        frappe.show_alert({ message: __('Layout reset to default'), indicator: 'green' });
        this.exit_customize_mode(false);
    }

    // Builds and shows the Move-To dropdown for a single card — lists every
    // tab from the CURRENT (personal/effective) layout except the one this
    // card is already in, per spec. Hidden tabs are still offered (moving a
    // card to a currently-hidden tab is a reasonable thing to want to do —
    // it'll just not be visible until that tab is un-hidden).
    open_move_to_menu($card) {
        this.open_tab_picker_menu($card, 'move');
    }

    open_duplicate_menu($card) {
        this.open_tab_picker_menu($card, 'duplicate');
    }

    open_tab_picker_menu($card, action) {
        this.$container.find('.hub-move-to-menu').remove();

        const cardKey = $card.attr('data-card-key');
        const otherTabs = this.ordered_visible_tabs()
            .concat(HUB_TABS.filter((t) => !this.ordered_visible_tabs().some((v) => v.key === t.key)))
            .filter((t) => t.key !== this.activeTab);

        const $menu = $(`
            <div class="hub-move-to-menu">
                ${otherTabs.map((t) => `<div class="hub-move-to-option" data-tab="${t.key}">${frappe.utils.escape_html(t.label)}</div>`).join('')}
            </div>`);

        $card.css('position', 'relative').append($menu);

        this.$container.off('click.moveToOption').on('click.moveToOption', '.hub-move-to-option', (e) => {
            const targetTab = $(e.currentTarget).attr('data-tab');
            if (action === 'duplicate') {
                this.duplicate_card_to_tab(cardKey, targetTab);
            } else {
                this.move_card_to_tab(cardKey, targetTab);
            }
            $menu.remove();
        });

        // Close on any click outside the menu itself.
        setTimeout(() => {
            $(document)
                .off('click.moveToOutside')
                .on('click.moveToOutside', (e) => {
                    if (!$(e.target).closest('.hub-move-to-menu, .hub-move-to-icon, .hub-duplicate-icon').length) {
                        $menu.remove();
                    }
                });
        }, 0);
    }

    move_card_to_tab(cardKey, targetTab) {
        const item = this.pendingLayout.find(
            (i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key === cardKey
        );
        if (!item) return;

        const remainingInSource = this.pendingLayout.filter(
            (i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key !== cardKey
        );
        if (!remainingInSource.length) {
            frappe.msgprint(
                __('A tab needs at least one card. Either hide the whole tab instead, or add another card here first.')
            );
            return;
        }

        const alreadyThere = this.pendingLayout.find(
            (i) => i.scope === 'Card' && i.tab === targetTab && i.card_key === cardKey
        );
        if (alreadyThere) {
            frappe.msgprint(__('This card is already on that tab — pick a different one.'));
            return;
        }

        const maxSeq = Math.max(
            0,
            ...this.pendingLayout
                .filter((i) => i.scope === 'Card' && i.tab === targetTab)
                .map((i) => i.sequence || 0)
        );
        item.tab = targetTab;
        item.sequence = maxSeq + 1;

        this.mark_dirty();

        // The card no longer belongs on the currently-viewed tab — remove
        // it from view with a quick fade rather than an abrupt disappear.
        const $card = this.$main.find(`[data-card-key="${cardKey}"]`);
        $card.css('transition', 'opacity 0.15s ease').css('opacity', '0');
        setTimeout(() => $card.remove(), 150);

        frappe.show_alert({ message: __('Will move to {0} on Save', [(HUB_TABS.find((t) => t.key === targetTab) || {}).label || targetTab]), indicator: 'blue' });
    }

    duplicate_card_to_tab(cardKey, targetTab) {
        // The original stays exactly as-is — same tab, same position — per
        // spec. Only a new, independent instance is created on the target.
        const original = this.pendingLayout.find(
            (i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key === cardKey
        );
        if (!original) return;

        const alreadyThere = this.pendingLayout.find(
            (i) => i.scope === 'Card' && i.tab === targetTab && i.card_key === cardKey
        );
        if (alreadyThere) {
            frappe.msgprint(__('This card already exists on that tab — pick a different one.'));
            return;
        }

        const maxSeq = Math.max(
            0,
            ...this.pendingLayout
                .filter((i) => i.scope === 'Card' && i.tab === targetTab)
                .map((i) => i.sequence || 0)
        );
        this.pendingLayout.push({
            scope: 'Card',
            tab: targetTab,
            card_key: cardKey,
            is_hidden: 0,
            sequence: maxSeq + 1,
        });

        this.mark_dirty();
        frappe.show_alert({
            message: __('Will also appear on {0} on Save', [(HUB_TABS.find((t) => t.key === targetTab) || {}).label || targetTab]),
            indicator: 'blue',
        });
    }

    // Adds/removes the eye + drag-handle overlay (with text labels above
    // them, per spec) on every visible-or-dimmed tab pill and card, and
    // toggles `draggable` — only called while entering/updating/exiting
    // Customize Mode, not on every normal render.
    render_customize_affordances() {
        this.$container.find('.hub-customize-overlay').remove();

        if (!this.customizeMode) return;

        const tabMap = this.tab_layout_map();
        const cardMap = {};
        this.pendingLayout.forEach((i) => {
            if (i.scope === 'Card') cardMap[`${i.tab}|${i.card_key}`] = i;
        });

        const tabOverlay = (isHidden) => `
            <div class="hub-customize-overlay">
                <span class="hub-eye-icon" title="${isHidden ? 'Show' : 'Hide'}">${
            isHidden ? this.eye_off_icon_svg() : this.eye_icon_svg()
        }</span>
                <span class="hub-drag-handle" title="Drag to reorder">${this.drag_icon_svg()}</span>
            </div>`;

        const cardOverlay = (isHidden) => `
            <div class="hub-customize-overlay">
                <span class="hub-eye-icon" title="${isHidden ? 'Show' : 'Hide'}">${
            isHidden ? this.eye_off_icon_svg() : this.eye_icon_svg()
        }</span>
                <span class="hub-drag-handle" title="Drag to reorder">${this.drag_icon_svg()}</span>
                <span class="hub-duplicate-icon" title="Duplicate to Another Tab">${this.duplicate_icon_svg()}</span>
                <span class="hub-move-to-icon" title="Move to a different tab">${this.move_to_icon_svg()}</span>
            </div>`;

        this.$container.find('.hub-tab').each((_, el) => {
            const key = $(el).attr('data-key');
            const isHidden = !!(tabMap[key] && tabMap[key].is_hidden);
            $(el).append(tabOverlay(isHidden));
        });

        this.$main.find('[data-card-key]').each((_, el) => {
            const key = $(el).attr('data-card-key');
            const item = cardMap[`${this.activeTab}|${key}`];
            $(el).append(cardOverlay(!!(item && item.is_hidden)));
        });
    }

    move_to_icon_svg() {
        // A double-headed arrow, per feedback — visible in any theme since
        // it inherits `currentColor` the same way the other two icons do.
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 8l-4 4 4 4M3 12h18M17 8l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    duplicate_icon_svg() {
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8"/>
        </svg>`;
    }

    eye_icon_svg() {
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
        </svg>`;
    }

    eye_off_icon_svg() {
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.4 18.4 0 0 1 4.22-5.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
    }

    drag_icon_svg() {
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
            <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
            <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
        </svg>`;
    }

    // After a drag-drop reorder, recompute sequence numbers for every
    // sibling in the affected group from their new DOM order, and write
    // them back into pendingLayout.
    recompute_sequences_from_dom() {
        const $tabbar = this.$container.find('.hub-tabbar');
        $tabbar.find('.hub-tab').each((idx, el) => {
            const key = $(el).attr('data-key');
            const item = this.pendingLayout.find((i) => i.scope === 'Tab' && i.tab === key);
            if (item) item.sequence = idx + 1;
        });

        // Recompute per-category (stat / chart / list) across the ENTIRE
        // tab, in document order — not per DOM parent. Cards of the same
        // category can now live in different .hub-grid rows after a
        // cross-row move, so sequence has to reflect their true position
        // across the whole category, not just within whichever row they
        // happen to currently sit in.
        const categories = new Set();
        this.$main.find('[data-card-key]').each((_, el) => categories.add($(el).attr('data-category')));
        categories.forEach((category) => {
            this.$main.find(`[data-card-key][data-category="${category}"]`).each((idx, el) => {
                const key = $(el).attr('data-card-key');
                const item = this.pendingLayout.find(
                    (i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key === key
                );
                if (item) item.sequence = idx + 1;
            });
        });
    }

    // Frappe bundles SortableJS already (it powers the Kanban board), so
    // this normally resolves instantly — the dynamic-load fallback only
    // matters if some version/build doesn't happen to expose it globally.
    load_sortable() {
        if (window.Sortable) return Promise.resolve(window.Sortable);
        if (this._sortableLoadPromise) return this._sortableLoadPromise;
        this._sortableLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
            script.onload = () => resolve(window.Sortable);
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return this._sortableLoadPromise;
    }

    // Tears down every active Sortable instance — called before creating
    // new ones (tab switch, re-entering Customize Mode) and on exit, so
    // stale instances never pile up or fight over the same DOM.
    destroy_sortable() {
        (this._sortableInstances || []).forEach((s) => {
            try {
                s.destroy();
            } catch (e) {
                /* already gone */
            }
        });
        this._sortableInstances = [];
    }

    async init_sortable() {
        this.destroy_sortable();
        if (!this.customizeMode) return;

        const Sortable = await this.load_sortable();
        if (!this.customizeMode) return; // customize mode may have been exited while loading

        const onEnd = () => {
            this.recompute_sequences_from_dom();
            this.mark_dirty();
        };

        // Tab bar — one group, simple reorder.
        const $tabbar = this.$container.find('.hub-tabbar');
        if ($tabbar.length) {
            this._sortableInstances.push(
                new Sortable($tabbar[0], {
                    animation: 180,
                    handle: '.hub-drag-handle',
                    ghostClass: 'hub-sortable-ghost',
                    chosenClass: 'hub-sortable-chosen',
                    dragClass: 'hub-sortable-drag',
                    onEnd,
                })
            );
        }

        // Each .hub-grid row becomes its own Sortable instance, but rows
        // sharing the same category (read from their first card's
        // data-category) share the same `group` name — that's what lets
        // items move freely BETWEEN rows of the same kind (e.g. one chart
        // swapping with another chart in a completely different row),
        // not just within their own row, while still refusing to accept a
        // card from a different category at all.
        this.$main.find('.hub-grid').each((_, row) => {
            const $row = $(row);
            const $firstCard = $row.find('[data-card-key]').first();
            if (!$firstCard.length) return;
            const category = $firstCard.attr('data-category');

            this._sortableInstances.push(
                new Sortable(row, {
                    group: `hub-category-${category}`,
                    animation: 180,
                    handle: '.hub-drag-handle',
                    ghostClass: 'hub-sortable-ghost',
                    chosenClass: 'hub-sortable-chosen',
                    dragClass: 'hub-sortable-drag',
                    onEnd,
                })
            );
        });
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

        this.$container.append(this.render_footer());

        this.bind_events();
    }

    bind_events() {
        this.$container.on('click', '.hub-tab', (e) => {
            this.switch_tab($(e.currentTarget).attr('data-key'));
        });

        this.$container.on('click', '[data-route-doctype]', (e) => {
            if (this.customizeMode) return;
            e.preventDefault();
            this.go_to_list($(e.currentTarget).attr('data-route-doctype'));
        });

        this.$container.on('click', '[data-action]', (e) => {
            if (this.customizeMode) return;
            this.run_quick_action($(e.currentTarget).attr('data-action'));
        });

        // Any list row with data-doc-type + data-doc-name is clickable —
        // except while customizing, where clicks are for hide/drag only.
        this.$container.on('click', '.hub-clickable', (e) => {
            if (this.customizeMode) return;
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

        // ---- Customize Mode ----
        this.$container.on('click', '.hub-customize-toggle', () => {
            if (!this.viewport_allows_customize()) {
                frappe.msgprint(__('Customize Mode needs a larger screen — please switch to a tablet size or wider.'));
                return;
            }
            this.enter_customize_mode();
        });

        this.$container.on('click', '.hub-customize-save', () => {
            if (!this.isDirty) {
                frappe.show_alert({ message: __('No changes to save'), indicator: 'orange' });
                this.exit_customize_mode(false);
                return;
            }
            this.save_layout();
        });
        this.$container.on('click', '.hub-customize-discard', () => {
            if (this.isDirty) {
                frappe.confirm(__('Discard all unsaved layout changes?'), () => this.exit_customize_mode(true));
            } else {
                this.exit_customize_mode(true);
            }
        });
        this.$container.on('click', '.hub-customize-reset', () => {
            frappe.confirm(
                __('Reset your layout back to the default? This removes all of your personal customizations.'),
                () => this.reset_layout()
            );
        });

        // Eye icon — toggles between "visible" and "hidden" states, in the
        // working copy only (nothing hits the server until Save). Icon-only,
        // no visible text label — the title attribute gives a native hover
        // tooltip instead.
        this.$container.on('click', '.hub-eye-icon', (e) => {
            e.stopPropagation();
            const $target = $(e.currentTarget).closest('[data-card-key], .hub-tab');
            const cardKey = $target.attr('data-card-key');
            const tabKey = $target.attr('data-key');
            const item = cardKey
                ? this.pendingLayout.find((i) => i.scope === 'Card' && i.tab === this.activeTab && i.card_key === cardKey)
                : this.pendingLayout.find((i) => i.scope === 'Tab' && i.tab === tabKey);
            if (!item) return;
            item.is_hidden = item.is_hidden ? 0 : 1;
            this.mark_dirty();
            this.apply_layout_to_dom();
            this.render_customize_affordances();
        });

        // Move-To icon — opens a small dropdown of other tabs; picking one
        // moves this card there in the working copy (nothing hits the
        // server until Save). The card disappears from the current tab's
        // view immediately since it no longer belongs here.
        this.$container.on('click', '.hub-move-to-icon', (e) => {
            e.stopPropagation();
            const $card = $(e.currentTarget).closest('[data-card-key]');
            this.open_move_to_menu($card);
        });

        // Duplicate icon — same dropdown, but the original stays exactly
        // where it is; only a new copy is added to the picked tab.
        this.$container.on('click', '.hub-duplicate-icon', (e) => {
            e.stopPropagation();
            const $card = $(e.currentTarget).closest('[data-card-key]');
            this.open_duplicate_menu($card);
        });

        // Reordering itself is handled by SortableJS (see init_sortable) —
        // it's initialized/torn down whenever Customize Mode toggles or
        // the active tab changes, not wired up here.
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

        // ---- Per-card status/workflow filter (funnel icon) ----
        this.$container.on('click', '.hub-status-filter-icon', async (e) => {
            e.stopPropagation();
            const $filter = $(e.currentTarget).closest('.hub-status-filter');
            const cardKey = $filter.attr('data-card-key');
            const wasOpen = $filter.hasClass('open');
            $('.hub-status-filter').removeClass('open');
            $('.hub-mini-filter').removeClass('open');
            if (wasOpen) return;
            $filter.addClass('open');
            await this.ensure_status_options(cardKey);
        });

        this.$container.on('click', '.hub-status-filter-menu', (e) => e.stopPropagation());

        this.$container.on('click', '.hub-status-filter-option', (e) => {
            e.stopPropagation();
            const $option = $(e.currentTarget);
            const $filter = $option.closest('.hub-status-filter');
            const cardKey = $filter.attr('data-card-key');
            const value = $option.attr('data-value');

            if (value) {
                this.cardStatusFilters[cardKey] = value;
            } else {
                delete this.cardStatusFilters[cardKey];
            }
            $filter.removeClass('open');
            this.refresh_status_filter_icon(cardKey);
            this.refresh_card(cardKey);
        });

        $(document).off('click.employeeHubFilters').on('click.employeeHubFilters', () => {
            this.$container.find('.hub-mini-filter').removeClass('open');
            this.$container.find('.hub-status-filter').removeClass('open');
        });
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

    // Small red "Not Saved" badge injected right next to Frappe's own page
    // title ("Employee Hub", top-left) — not part of our topbar at all.
    refresh_dirty_indicator() {
        const $title = $(this.page.wrapper).find('.title-text');
        $title.siblings('.hub-not-saved-badge').remove();
        if (this.isDirty) {
            $title.after('<span class="hub-not-saved-badge">Not Saved</span>');
        }
    }

    // Bottom footer — attribution on the left, Customize/Save/Discard/Reset
    // on the right, positioned after all page content (same placement
    // convention as the standard Workspace "Edit" control), not floating.
    render_footer() {
        const canCustomize = this.layoutState && this.layoutState.allow_personal_customization && this.viewport_allows_customize();
        return `
            <div class="hub-footer">
                <div class="hub-footer-left">Employee Hub — developed by <a href="https://www.linkedin.com/in/sebin-p-sabu" target="_blank" rel="noopener noreferrer" class="hub-footer-link">Sebin P Sabu</a></div>
                <div class="hub-footer-right">${canCustomize ? this.render_customize_controls() : ''}</div>
            </div>`;
    }

    viewport_allows_customize() {
        return window.innerWidth >= 768;
    }

    // Just the Customize toggle, or (while active) Reset/Discard/Save —
    // "Done" removed per feedback: Discard now doubles as "exit without
    // saving" and Save both commits and exits.
    render_customize_controls() {
        if (!this.customizeMode) {
            return `<button class="hub-customize-toggle" title="Customize this page">${this.customize_icon_svg()} Customize</button>`;
        }
        return `
            <div class="hub-customize-active-controls">
                <button class="hub-customize-reset" title="Reset to Default">Reset to Default</button>
                <button class="hub-customize-discard">Discard</button>
                <button class="hub-customize-save">Save</button>
            </div>`;
    }

    refresh_customize_controls() {
        const $target = this.$container.find('.hub-footer-right');
        $target.empty().append(this.render_customize_controls());
        this.refresh_dirty_indicator();
    }

    customize_icon_svg() {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
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

    filter_icon_svg() {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" fill="currentColor"/>
        </svg>`;
    }

    // Funnel icon + dropdown for filtering a card by its status (or, if the
    // doctype has an active Workflow, by the workflow's own state field).
    // Options are fetched lazily on first click (see ensure_status_options)
    // rather than bundled into every initial page load.
    render_status_filter(cardKey) {
        const selected = this.cardStatusFilters[cardKey];
        return `
            <div class="hub-status-filter" data-card-key="${cardKey}">
                <span class="hub-status-filter-icon" title="Filter by status">${this.filter_icon_svg()}</span>
                ${selected ? `<span class="hub-status-filter-badge">${frappe.utils.escape_html(selected)}</span>` : ''}
                <div class="hub-status-filter-menu">
                    <div class="hub-status-filter-loading">Loading...</div>
                </div>
            </div>`;
    }

    refresh_status_filter_icon(cardKey) {
        const $old = this.$container.find(`.hub-status-filter[data-card-key="${cardKey}"]`);
        if ($old.length) $old.replaceWith(this.render_status_filter(cardKey));
    }

    async ensure_status_options(cardKey) {
        if (!this.statusOptionsCache[cardKey]) {
            const r = await frappe.call('employee_hub.employee_hub.api.get_card_status_options', { card_key: cardKey });
            this.statusOptionsCache[cardKey] = r.message || { field: null, options: [] };
        }
        this.render_status_menu(cardKey);
    }

    render_status_menu(cardKey) {
        const $filter = this.$container.find(`.hub-status-filter[data-card-key="${cardKey}"]`);
        const $menu = $filter.find('.hub-status-filter-menu');
        const data = this.statusOptionsCache[cardKey];

        if (!data || !data.field || !data.options.length) {
            $menu.html('<div class="hub-status-filter-empty">No status filter available for this record type.</div>');
            return;
        }

        const current = this.cardStatusFilters[cardKey];
        const allOption = `<div class="hub-status-filter-option ${!current ? 'active' : ''}" data-value="">All Statuses</div>`;
        const options = data.options
            .map(
                (o) =>
                    `<div class="hub-status-filter-option ${current === o ? 'active' : ''}" data-value="${frappe.utils.escape_html(
                        o
                    )}">${frappe.utils.escape_html(o)}</div>`
            )
            .join('');
        $menu.html(allOption + options);
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
        this.activeTab = key;
        this.$main.html('<div class="hub-loading">Loading...</div>');

        if (key === 'dashboard') {
            if (!this.tabCache.dashboard) {
                const r = await frappe.call('employee_hub.employee_hub.api.get_dashboard_data');
                this.tabCache.dashboard = r.message;
            }
            this.render_dashboard_tab(this.tabCache.dashboard);
            this.apply_layout_to_dom();
            await this.inject_foreign_cards();
            this.refresh_customize_controls();
            this.render_customize_affordances();
            this.init_sortable();
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

        this.apply_layout_to_dom();
        await this.inject_foreign_cards();
        this.refresh_customize_controls();
        this.render_customize_affordances();
        this.init_sortable();
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

        const r = await frappe.call('employee_hub.employee_hub.api.get_card_list', {
            card_key: cardKey,
            ...params,
            ...this.status_filter_params(cardKey),
        });
        const { records, total } = r.message || { records: [], total: 0 };
        $body.html(this.render_card_body_html(cardKey, records, total));
    }

    status_filter_params(cardKey) {
        const data = this.statusOptionsCache[cardKey];
        const value = this.cardStatusFilters[cardKey];
        if (data && data.field && value) {
            return { status_field: data.field, status_value: value };
        }
        return {};
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
                            <div class="hub-list-sub">${format_currency(s.net_pay, s.currency)}</div>
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
                            <div class="hub-list-title">${format_currency(e.total_claimed_amount, e.currency)}</div>
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
                         <span class="hub-badge hub-status-${(t.status || '').toLowerCase().replace(/ /g, '-')}">${t.status}</span>`,
                        'hub-list-row-3col'
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

    row(doctype, name, innerHtml, extraClass) {
        return `<div class="hub-list-row hub-clickable ${extraClass || ''}" data-doc-type="${doctype}" data-doc-name="${frappe.utils.escape_html(
            name
        )}">${innerHtml}</div>`;
    }

    // -----------------------------------------------------------------
    // Card wrapper — title, optional mini filter, optional "See more", body
    // -----------------------------------------------------------------
    list_card(title, seeMoreKey, cardKey, records, filterable, total) {
        if (filterable === undefined) filterable = true;
        return `
            <div class="hub-card" data-card-key="${cardKey}" data-category="list">
                <div class="hub-card-header">
                    <h4>${title}</h4>
                    <div class="hub-card-header-right">
                        ${filterable ? this.render_status_filter(cardKey) : ''}
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
            <div class="hub-card" data-card-key="salary-trend" data-category="list">
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
        return '<p class="text-muted hub-empty">No Salary Slips in this period — try a wider filter (e.g. This Year).</p>';
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
            height: 320,
            colors: ['#6C5CE7'],
            hideLegend: 1,
        });
        this.hide_zero_value_labels($line[0]);
    }

    // Shared between Dashboard and the Tasks & Timesheets tab.
    render_task_donut_section(breakdown) {
        return `
            <div class="hub-card" data-card-key="task-donut" data-category="list">
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
        return '<p class="text-muted hub-empty">No tasks in this period — try a wider filter (e.g. This Year).</p>';
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
            <div class="hub-card" data-card-key="attendance-chart" data-category="list">
                <div class="hub-card-header">
                    <h4>Attendance Overview</h4>
                    <div class="hub-card-header-right">${this.render_mini_filter('attendance-chart')}</div>
                </div>
                <div class="hub-card-body">${this.attendance_chart_body_html(d.attendance_chart)}</div>
            </div>`);
        $row.append($attCard);
        $row.append(`
            <div class="hub-card" data-card-key="leave-pie" data-category="list">
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
            <div class="hub-card" data-card-key="quick-actions" data-category="list">
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
            <div class="hub-card" data-card-key="birthdays" data-category="list">
                <div class="hub-card-header"><h4>Upcoming Birthdays</h4></div>
                <div class="hub-card-body">
                ${
                    d.birthdays.length
                        ? `<div class="hub-scroll-list hub-scroll-4">` +
                          d.birthdays
                              .map(
                                  (b) => `
                    <div class="hub-list-row hub-birthday-row">
                        ${
                            b.image
                                ? `<img class="hub-avatar-sm" src="${b.image}">`
                                : `<div class="hub-avatar-sm hub-avatar-initials">${this.get_initials(b.employee_name)}</div>`
                        }
                        <div>
                            <div class="hub-list-title">${frappe.utils.escape_html(b.employee_name)}</div>
                            <div class="hub-list-sub">${frappe.datetime.str_to_user(b.next_birthday)}</div>
                        </div>
                    </div>`
                              )
                              .join('') +
                          `</div>`
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
        return `<div class="hub-chart hub-chart-static-values" id="hub-attendance-chart"
                     data-labels='${JSON.stringify(chart.labels)}'
                     data-present='${JSON.stringify(chart.present)}'
                     data-absent='${JSON.stringify(chart.absent)}'
                     data-half='${JSON.stringify(chart.half_day)}'
                     data-leave='${JSON.stringify(chart.on_leave)}'
                     data-wfh='${JSON.stringify(chart.work_from_home)}'></div>
                <div class="hub-legend">
                    <span><i class="hub-dot" style="background:#2ecc71"></i>Present</span>
                    <span><i class="hub-dot" style="background:#e74c3c"></i>Absent</span>
                    <span><i class="hub-dot" style="background:#f1c40f"></i>Half Day</span>
                    <span><i class="hub-dot" style="background:#3498db"></i>On Leave</span>
                    <span><i class="hub-dot" style="background:#9b59b6"></i>Work From Home</span>
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
                    { name: 'On Leave', chartType: 'bar', values: JSON.parse($el.attr('data-leave')) },
                    { name: 'Work From Home', chartType: 'bar', values: JSON.parse($el.attr('data-wfh')) },
                ],
            },
            type: 'bar',
            height: 220,
            colors: ['#2ecc71', '#e74c3c', '#f1c40f', '#3498db', '#9b59b6'],
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
                cardKey: 'stat-attendance',
                label: 'Attendance',
                value: `${stats.attendance.present}/${stats.attendance.total_days}`,
                sub: 'Days Present (This Month)',
                link: 'attendance',
                extra: `<div class="hub-progress"><div class="hub-progress-bar" style="width:${Math.min(
                    100,
                    (stats.attendance.present / Math.max(stats.attendance.total_days, 1)) * 100
                )}%"></div></div>`,
            },
            { cardKey: 'stat-leaves', label: 'Leaves', value: stats.leaves.available, sub: 'Available Days Left', link: 'leave-application' },
            { cardKey: 'stat-tasks', label: 'Tasks', value: stats.tasks.pending, sub: 'Pending Tasks', link: 'task' },
            { cardKey: 'stat-timesheets', label: 'Timesheets', value: stats.timesheets.hours, sub: 'Hours (This Month)', link: 'timesheet' },
            { cardKey: 'stat-salary', label: 'Salary', value: stats.salary.month, sub: stats.salary.status, link: 'salary-slip' },
        ];
        const html = cards
            .map(
                (c) => `
                <div class="hub-card hub-stat-card" data-card-key="${c.cardKey}" data-category="stat">
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
        return `<div class="hub-card" data-card-key="leave-balance" data-category="list"><div class="hub-card-header"><h4>Leave Balance</h4></div><div class="hub-card-body">${rows}</div></div>`;
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
            <div class="hub-card" data-card-key="documents-info" data-category="list">
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