// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

frappe.ui.form.on("Role Profile", {
    async refresh(frm) {
        if (frm.is_new()) return;

        const enabled = await frappe.db.get_single_value("Employee Hub Settings", "enable_role_profile_layouts");
        if (!enabled) return;

        const $btn = frm.page.add_inner_button(__("Employee Hub Layout"), () => {
            frappe.db.exists("Employee Hub Role Profile Layout", frm.doc.name).then((exists) => {
                if (exists) {
                    frappe.set_route("Form", "Employee Hub Role Profile Layout", frm.doc.name);
                } else {
                    frappe.new_doc("Employee Hub Role Profile Layout", { role_profile: frm.doc.name });
                }
            });
        });

        $btn.addClass("hub-role-profile-link-btn");
        $btn.html(
            `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:5px;vertical-align:-2px;">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
            </svg>` + __("Employee Hub Layout")
        );
    },
});