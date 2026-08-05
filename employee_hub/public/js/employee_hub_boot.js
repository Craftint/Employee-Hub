// ---------------------------------------------------------------------------
// One-shot redirect to Employee Hub immediately after login. Server-side,
// on_login (boot.py) sets a short-lived cache flag scoped to this exact
// session; boot_session (also boot.py) picks it up on this very page load
// and deletes it immediately, so frappe.boot.employee_hub_redirect_once can
// only ever be true on the single load right after a fresh login — never on
// a later reload. (A prior version relied solely on Frappe's own
// role_home_page/home_page mechanism, which worked for the first login on a
// browser but not reliably afterward — apparently the client-side router
// can override it in some cases, which is outside anything a hook controls.)
// ---------------------------------------------------------------------------
frappe.after_ajax(() => {
    if (frappe.boot && frappe.boot.employee_hub_redirect_once) {
        frappe.set_route('employee-hub');
    }
});

// ---------------------------------------------------------------------------
// Pinned "Employee Hub" sidebar link, shown above the Workspaces tree on
// every Desk page (not just the Employee Hub page itself). This is a pure
// client-side DOM addition — no Workspace record is created, so it can
// never interfere with Workspace permissions/visibility rules.
//
// NOTE: this depends on Frappe Desk's sidebar markup, which can vary by
// version. It's written defensively (multiple selector fallbacks, and it
// silently does nothing if it can't find a safe place to attach) so a
// markup mismatch on your version just means the link doesn't appear,
// rather than breaking the sidebar. If it doesn't show up, inspect your
// sidebar HTML and tell me the actual class names so I can adjust this.
//
// This runs as a standing interval (not a one-shot retry) because Frappe
// re-renders the sidebar on SPA route changes, which would otherwise wipe
// out a one-time injection and require a full page reload to bring it back
// — exactly the "have to reload again and again" symptom this fixes.
// ---------------------------------------------------------------------------
(function () {
    function build_link() {
        const $link = $(
            '<div class="employee-hub-pinned-link" role="button" tabindex="0">' +
                '<span class="employee-hub-pinned-icon">🏠</span>' +
                '<span class="employee-hub-pinned-label">Employee Hub</span>' +
                '</div>'
        );
        $link.on('click keypress', (e) => {
            if (e.type === 'keypress' && e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            frappe.set_route('employee-hub');
        });
        return $link;
    }

    function inject() {
        if (document.querySelector('.employee-hub-pinned-link')) return; // already present, nothing to do

        // Try a few known containers for the left workspace sidebar across
        // Frappe v14/v15/v16. The first one found wins.
        const containerSelectors = [
            '.body-sidebar .sidebar-items',
            '.body-sidebar',
            '.desk-sidebar .sidebar-items',
            '.desk-sidebar',
            '[data-page-route="app"] .layout-side-section',
        ];

        let container = null;
        for (const sel of containerSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                container = el;
                break;
            }
        }
        if (!container) return;

        const $link = build_link();
        container.insertBefore($link[0], container.firstChild);
    }

    frappe.after_ajax(() => {
        // Keep checking indefinitely (cheap no-op once the link exists) so
        // the link survives Frappe re-rendering the sidebar on route changes,
        // workspace switches, etc. — no reload should ever be required.
        setInterval(inject, 1000);
    });
})();