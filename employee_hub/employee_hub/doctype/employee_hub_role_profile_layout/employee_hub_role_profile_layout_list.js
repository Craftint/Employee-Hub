// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

frappe.listview_settings["Employee Hub Role Profile Layout"] = {
    onload(listview) {
        frappe.db.get_single_value("Employee Hub Settings", "enable_role_profile_layouts").then((enabled) => {
            if (!enabled) {
                listview.page.clear_primary_action();
            }
        });
    },
};
