# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)
#
# Shared validation logic for any doctype holding a "layout" child table
# (Employee Hub Settings' global_default_layout now; Employee Hub Layout's
# personal layout from this phase onward; Employee Hub Role Profile Layout
# in Phase 3). A child table row's own validate() can only see itself, not
# its siblings, so these checks have to run from the parent doctype's
# validate() — call validate_layout_items(self.<table_fieldname>) from there.

import frappe
from employee_hub.employee_hub.utils.default_layout import KNOWN_TABS


def validate_layout_items(items):
    _validate_tab_values(items)
    _validate_no_duplicate_tab_rows(items)
    _validate_no_duplicate_card_rows(items)
    _validate_visible_tabs_have_visible_cards(items)


def _validate_tab_values(items):
    for row in items:
        if row.tab not in KNOWN_TABS:
            frappe.throw(
                frappe._("Row #{0}: '{1}' is not a recognized tab. Expected one of: {2}").format(
                    row.idx, row.tab, ", ".join(KNOWN_TABS)
                )
            )


def _validate_no_duplicate_tab_rows(items):
    seen = set()
    for row in items:
        if row.scope == "Tab":
            if row.tab in seen:
                frappe.throw(frappe._("Duplicate Tab row for '{0}'.").format(row.tab))
            seen.add(row.tab)


def _validate_no_duplicate_card_rows(items):
    seen = set()
    for row in items:
        if row.scope == "Card":
            key = (row.tab, row.card_key)
            if key in seen:
                frappe.throw(frappe._("Duplicate Card row for '{0}' in tab '{1}'.").format(row.card_key, row.tab))
            seen.add(key)


def _validate_visible_tabs_have_visible_cards(items):
    """A tab that isn't hidden must have at least one card inside it that
    also isn't hidden — otherwise it renders as a blank, broken-looking tab.
    Doesn't apply to hidden tabs, since their cards never render regardless."""
    visible_card_count_by_tab = {}
    for row in items:
        if row.scope == "Card" and not row.is_hidden:
            visible_card_count_by_tab[row.tab] = visible_card_count_by_tab.get(row.tab, 0) + 1

    for row in items:
        if row.scope == "Tab" and not row.is_hidden:
            if visible_card_count_by_tab.get(row.tab, 0) == 0:
                frappe.throw(
                    frappe._(
                        "The '{0}' tab is visible but has no visible cards inside it. "
                        "Either hide the tab itself, or make at least one card in it visible."
                    ).format(row.tab)
                )
