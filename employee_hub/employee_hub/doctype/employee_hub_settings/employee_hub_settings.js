// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

frappe.ui.form.on("Employee Hub Settings", {
    refresh(frm) {
        // Same Preview / Customize / Fetch-or-Reset header used on
        // Employee Hub Role Profile Layout, applied here to the Global
        // Default Layout table. The old standalone "Reset to Default"
        // toolbar button is gone — Reset now lives in this header instead,
        // right above the table it affects.
        build_hub_layout_header(frm, {
            fieldname: "global_default_layout",
            resetConfirmTextEmpty: __("Set the Global Default Layout to the app's original, out-of-the-box structure?"),
            resetConfirmText: __("Reset the Global Default Layout back to its original structure? This will show in this document's version history."),
            resetSuccessText: __("Reset to default"),
            fetchSuccessText: __("Set to default"),
            // reset_global_default_layout does the whole save server-side
            // (including its own System Manager check), so the client
            // just needs to pull the fresh result back in afterward.
            onReset: (frm) => frappe.call("employee_hub.employee_hub.api.reset_global_default_layout").then(() => frm.reload_doc()),
        });

        // Grouped separately (its own dropdown) so it doesn't crowd the
        // header above — always visible regardless of whether
        // personalization / role profile layouts are currently enabled,
        // since these are just navigation shortcuts.
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