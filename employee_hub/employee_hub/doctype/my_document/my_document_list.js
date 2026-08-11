// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

frappe.listview_settings["My Document"] = {
    get_indicator(doc) {
        const colors = { "To Verify": "blue", Valid: "green", Expired: "red", Invalid: "orange" };
        return [__(doc.status), colors[doc.status] || "grey", `status,=,${doc.status}`];
    },
};