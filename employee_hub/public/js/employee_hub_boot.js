// Fallback redirect: if the current user has a linked Employee record
// (frappe.boot.employee_hub_home is set in boot.py) and they land on the
// bare Desk root, send them to Employee Hub instead.
frappe.after_ajax(() => {
    if (frappe.boot && frappe.boot.employee_hub_home) {
        const route = frappe.get_route ? frappe.get_route() : [];
        if (!route || route.length === 0) {
            frappe.set_route('employee-hub');
        }
    }
});