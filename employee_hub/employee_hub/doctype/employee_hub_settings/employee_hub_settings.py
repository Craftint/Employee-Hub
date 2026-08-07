# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

import frappe
from frappe.model.document import Document

KNOWN_TABS = ["dashboard", "attendance", "salary", "tasks", "performance", "requests", "documents"]


class EmployeeHubSettings(Document):
    def validate(self):
        self.validate_tab_values()
        self.validate_no_duplicate_tab_rows()
        self.validate_no_duplicate_card_rows()
        self.validate_visible_tabs_have_visible_cards()

    def validate_tab_values(self):
        for row in self.global_default_layout:
            if row.tab not in KNOWN_TABS:
                frappe.throw(
                    frappe._("Row #{0}: '{1}' is not a recognized tab. Expected one of: {2}").format(
                        row.idx, row.tab, ", ".join(KNOWN_TABS)
                    )
                )

    def validate_no_duplicate_tab_rows(self):
        seen = set()
        for row in self.global_default_layout:
            if row.scope == "Tab":
                if row.tab in seen:
                    frappe.throw(frappe._("Duplicate Tab row for '{0}' in Global Default Layout.").format(row.tab))
                seen.add(row.tab)

    def validate_no_duplicate_card_rows(self):
        seen = set()
        for row in self.global_default_layout:
            if row.scope == "Card":
                key = (row.tab, row.card_key)
                if key in seen:
                    frappe.throw(
                        frappe._("Duplicate Card row for '{0}' in tab '{1}'.").format(row.card_key, row.tab)
                    )
                seen.add(key)

    def validate_visible_tabs_have_visible_cards(self):
        """A tab that isn't hidden must have at least one card inside it that
        also isn't hidden — otherwise it renders as a blank, broken-looking
        tab for every employee. (Doesn't apply to hidden tabs — their
        cards' visibility is irrelevant since the tab itself never renders.)
        Note: this same check will need to be duplicated in the Phase 2
        `Employee Hub Layout` (personal) and Phase 3 `Employee Hub Role
        Profile Layout` controllers once those exist, since a child table's
        own validate() can only see itself, not sibling rows — this has to
        live on the parent doctype."""
        visible_card_count_by_tab = {}
        for row in self.global_default_layout:
            if row.scope == "Card" and not row.is_hidden:
                visible_card_count_by_tab[row.tab] = visible_card_count_by_tab.get(row.tab, 0) + 1

        for row in self.global_default_layout:
            if row.scope == "Tab" and not row.is_hidden:
                if visible_card_count_by_tab.get(row.tab, 0) == 0:
                    frappe.throw(
                        frappe._(
                            "The '{0}' tab is visible but has no visible cards inside it. "
                            "Either hide the tab itself, or make at least one card in it visible."
                        ).format(row.tab)
                    )