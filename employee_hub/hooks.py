app_name = "employee_hub"
app_title = "Employee Hub"
app_publisher = "Sebin P Sabu"
app_description = "Personalized Employee Self-Service Hub for ERPNext"
app_email = "sebin.freelance@gmail.com"  
app_license = "MIT"

# Assets --------------------------------------------------------------------
app_include_js = ["/assets/employee_hub/js/employee_hub_boot.js", "/assets/employee_hub/js/hub_layout_preview.js"]
app_include_css = "/assets/employee_hub/css/employee_hub.css"


doctype_js = {
    "Role Profile": "public/js/role_profile.js"
}


permission_query_conditions = {
    "My Document": "employee_hub.employee_hub.utils.my_document_permissions.get_permission_query_conditions"
}
has_permission = {
    "My Document": "employee_hub.employee_hub.utils.my_document_permissions.has_permission"
}

# Redirect employees straight to Employee Hub after login -------------------
# Requires the built-in "Employee" role (auto-assigned by ERPNext when a
# User is linked to an Employee record).

# role_home_page = {
#     "Employee": "employee-hub"
# }
after_install = "employee_hub.employee_hub.setup.install.print_credits"

after_migrate = [
    "employee_hub.employee_hub.setup.install.print_credits",
    "employee_hub.employee_hub.setup.install.seed_global_default_layout",
    "employee_hub.employee_hub.setup.install.setup_hr_manager_permissions",
]

on_login = "employee_hub.employee_hub.boot.on_login"

# Safety net: also stamp boot info in case some other part of the UI wants
# to know whether the current user has a linked Employee record.
boot_session = "employee_hub.employee_hub.boot.boot_session"

# Doc events ------------------------------------------------------------------
doc_events = {
    "HR Request": {
        "before_insert": "employee_hub.employee_hub.doctype.hr_request.hr_request.set_default_employee"
    }
}

# Fixtures (export role/custom settings with `bench export-fixtures`) -------
fixtures = []