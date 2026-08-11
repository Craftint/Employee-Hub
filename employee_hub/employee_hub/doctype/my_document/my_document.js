// Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

frappe.ui.form.on("My Document", {
    refresh(frm) {
        render_attachment_preview(frm);
    },
    attachment(frm) {
        render_attachment_preview(frm);
    },
});

function render_attachment_preview(frm) {
    const $wrapper = frm.get_field("attachment_preview").$wrapper;
    if (!frm.doc.attachment) {
        $wrapper.empty();
        return;
    }
    const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(frm.doc.attachment);
    if (isImage) {
        $wrapper.html(
            `<img src="${frm.doc.attachment}" style="max-width:100%;max-height:320px;border-radius:8px;border:1px solid var(--border-color);">`
        );
    } else {
        $wrapper.html(
            `<a href="${frm.doc.attachment}" target="_blank" class="btn btn-default btn-sm">${__("Open Document")}</a>`
        );
    }
}
