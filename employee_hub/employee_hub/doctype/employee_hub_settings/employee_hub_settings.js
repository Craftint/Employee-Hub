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

        // Temporary utility — only shows up while the old placeholder
        // "documents-info" card is still present, so it hides itself
        // automatically once you've used it on a given site rather than
        // needing to be manually removed afterward.
        const hasOldDocumentsCard = (frm.doc.global_default_layout || []).some((r) => r.card_key === "documents-info");
        if (hasOldDocumentsCard) {
            const $fetchBtn = frm.page.add_inner_button(__("Fetch Updated Layout"), () => {
                frappe.confirm(
                    __("Replace the old Documents card with the new My Documents cards? This only touches that one card — everything else in the layout stays exactly as it is."),
                    () => {
                        frappe.call("employee_hub.employee_hub.api.fetch_updated_documents_layout").then((r) => {
                            if (r.message.changed) {
                                frappe.show_alert({ message: __("Layout updated"), indicator: "green" });
                                frm.reload_doc();
                            }
                        });
                    }
                );
            });
            $fetchBtn.addClass("hub-fetch-updated-btn");
        }

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