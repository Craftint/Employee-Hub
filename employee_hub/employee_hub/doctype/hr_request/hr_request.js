frappe.ui.form.on('HR Request', {
    refresh(frm) {
        // Employees can create/read their own requests but not change status
        if (!frappe.user.has_role('HR Manager') && !frappe.user.has_role('HR User')) {
            frm.set_df_property('status', 'read_only', 1);
        }
    }
});
