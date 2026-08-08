import frappe
from frappe.model.document import Document


class HRRequest(Document):
    def before_save(self):
        # Notify the employee when HR changes the status
        if self.has_value_changed("status") and self.status in ("Approved", "Rejected"):
            user = frappe.db.get_value("Employee", self.employee, "user_id")
            if user:
                frappe.sendmail(
                    recipients=[user],
                    subject=f"Your HR Request {self.name} is {self.status}",
                    message=f"Your {self.request_type} request has been <b>{self.status}</b>.",
                )


def set_default_employee(doc, method=None):
    """doc_events before_insert: auto-fill Employee from the logged-in user."""
    if not doc.employee:
        doc.employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
