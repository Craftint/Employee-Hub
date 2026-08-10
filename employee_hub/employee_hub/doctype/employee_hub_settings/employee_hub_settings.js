// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

frappe.ui.form.on("Employee Hub Settings", {
    refresh(frm) {
        // Visible to anyone who can open this form — the permission check
        // happens on click, not on visibility, per spec: non-admins should
        // see the button exists and get told clearly why they can't use it,
        // rather than it just being invisible with no explanation.
        const $btn = frm.page.add_inner_button(__("Reset to Default"), () => {
            if (!frappe.user.has_role("System Manager")) {
                frappe.msgprint(
                    __("You are not permitted to Reset the Employee Hub Layout. Someone with System Manager access can.")
                );
                return;
            }
            frappe.confirm(
                __("Reset the Global Default Layout back to its original structure? This will show in this document's version history."),
                () => {
                    frappe.call("employee_hub.employee_hub.api.reset_global_default_layout").then(() => {
                        frappe.show_alert({ message: __("Reset to default"), indicator: "green" });
                        frm.reload_doc();
                    });
                }
            );
        });

        $btn.addClass("hub-reset-default-btn");
        $btn.html(
            `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:5px;vertical-align:-2px;">
                <path d="M3 12a9 9 0 1 1 2.64 6.36M3 12V6M3 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>` + __("Reset to Default")
        );

        // Grouped separately (its own dropdown) from Reset to Default so
        // the two don't crowd each other — always visible regardless of
        // whether personalization / role profile layouts are currently
        // enabled, since these are just navigation shortcuts.
        frm.page.add_inner_button(
            __("Personal Layouts"),
            () => frappe.set_route("List", "Employee Hub Layout"),
            __("Manage Layouts")
        );
        frm.page.add_inner_button(
            __("Role Profile Layouts"),
            () => frappe.set_route("List", "Employee Hub Role Profile Layout"),
            __("Manage Layouts")
        );
    },
});