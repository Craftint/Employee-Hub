# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate


class MyDocument(Document):
    def validate(self):
        self.validate_document_name_case()
        self.auto_set_status()
        self.validate_no_duplicate()
        self.secure_attachment()

    def validate_document_name_case(self):
        # "First letter caps, then small, and each further word's first
        # letter caps too" — Title Case, enforced rather than just
        # suggested, so "passport", "PASSPORT", and "passPort" all get
        # normalized the same way instead of creating near-duplicates that
        # slip past the duplicate check below.
        if not self.document_name:
            return
        words = self.document_name.strip().split()
        self.document_name = " ".join(w[:1].upper() + w[1:].lower() for w in words if w)

    def auto_set_status(self):
        if self.status == "Invalid":
            return
        if self.expiry_date and getdate(self.expiry_date) < getdate(nowdate()):
            self.status = "Expired"
        elif self.status == "Expired":
            self.status = "Valid"

    def validate_no_duplicate(self):
        # Same employee + same document name (case/spacing-insensitive) —
        # blocked UNLESS every existing match is Expired or Invalid, since
        # a replacement document is exactly what should be allowed then.
        if not (self.employee and self.document_name):
            return

        normalized = re.sub(r"\s+", "", self.document_name).lower()

        existing = frappe.get_all(
            "My Document",
            filters={"employee": self.employee, "name": ["!=", self.name or ""]},
            fields=["name", "document_name", "status"],
        )
        for row in existing:
            if re.sub(r"\s+", "", row.document_name or "").lower() == normalized:
                if row.status == "Valid":
                    frappe.throw(
                        _(
                            "{0} already has a valid '{1}' on file. Mark the existing one as Expired or Invalid before adding a replacement."
                        ).format(self.employee, self.document_name)
                    )

    def secure_attachment(self):
        # Private, not public — Frappe checks has_permission on the
        # attached document (My Document) before ever serving a private
        # file, so this automatically restricts the file to exactly
        # whoever can already read the record itself: System Manager, HR
        # Manager, and the employee it belongs to (see
        # my_document_permissions.py) — no separate access rule to
        # maintain for the file specifically.
        if not self.attachment:
            return
        file_docs = frappe.get_all(
            "File", filters={"file_url": self.attachment, "attached_to_doctype": "My Document"}, limit=1
        )
        if file_docs:
            file_doc = frappe.get_doc("File", file_docs[0].name)
            if not file_doc.is_private:
                file_doc.is_private = 1
                file_doc.save(ignore_permissions=True)
                self.attachment = file_doc.file_url
