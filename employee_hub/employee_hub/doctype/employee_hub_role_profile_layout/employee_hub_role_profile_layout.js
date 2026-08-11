// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

frappe.ui.form.on("Employee Hub Role Profile Layout", {
    async refresh(frm) {
        // If Role Profile based layouts are turned off site-wide, this
        // form becomes read-only — no Save, no workflow action buttons —
        // rather than letting an admin edit something that isn't actually
        // in effect for anyone right now.
        const enabled = await frappe.db.get_single_value("Employee Hub Settings", "enable_role_profile_layouts");
        if (!enabled) {
            frm.dashboard.set_headline_alert(
                `<div class="row"><div class="col">
                    <span class="indicator-pill red">${__("Role Profile Based Layouts is not enabled in Employee Hub Settings")}</span>
                </div></div>`
            );
            frm.disable_save();
            frm.page.clear_primary_action();
            frm.page.clear_secondary_action();
            return;
        }

        build_hub_layout_header(frm, {
            fieldname: "layout",
            resetConfirmTextEmpty: __("Fetch the current Global Default Layout into this record?"),
            resetConfirmText: __("Replace this layout with the current Global Default Layout? This overwrites everything below and saves immediately."),
            onReset: (frm) =>
                frappe.call("employee_hub.employee_hub.api.get_global_default_layout_items").then((r) => {
                    frm.clear_table("layout");
                    (r.message || []).forEach((item) => frm.add_child("layout", item));
                    frm.refresh_field("layout");
                    return frm.save();
                }),
        });
    },
});