// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

frappe.ui.form.on("Employee Hub Role Profile Layout", {
    async refresh(frm) {
        // If Role Profile based layouts are turned off site-wide, this
        // form becomes read-only — no Save, no workflow action buttons —
        // rather than letting an admin edit something that isn't actually
        // in effect for anyone right now.
        const enabled = await frappe.db.get_single_value("Employee Hub Settings", "enable_role_profile_layouts");
        if (!enabled) {
            frm.disable_save();
            frm.page.clear_primary_action();
            frm.page.clear_secondary_action();
            return; // Fetch Default would only fail validation on save anyway
        }

        const $btn = frm.page.add_inner_button(__("Fetch Default Layout"), () => {
            frappe.confirm(
                __("Replace this layout with the current Global Default Layout? This overwrites everything below and saves immediately."),
                () => {
                    frappe.call("employee_hub.employee_hub.api.get_global_default_layout_items").then((r) => {
                        frm.clear_table("layout");
                        (r.message || []).forEach((item) => {
                            frm.add_child("layout", item);
                        });
                        frm.refresh_field("layout");
                        frm.save().then(() => {
                            frappe.show_alert({ message: __("Fetched the default layout"), indicator: "green" });
                        });
                    });
                }
            );
        });

        $btn.addClass("hub-fetch-default-btn");
        $btn.html(
            `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:5px;vertical-align:-2px;">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>` + __("Fetch Default Layout")
        );
    },
});