import frappe

from healthcare_erp.setup.roles import ROLE_PERMISSION_MATRIX, sync_doctype_permissions


def after_install():
	"""One-time setup run by `bench --site <site> install-app healthcare_erp`."""
	create_module_def()
	create_missing_roles()
	sync_doctype_permissions()
	set_default_healthcare_settings()
	frappe.db.commit()


def after_migrate():
	"""Run on every `bench migrate` so role/permission drift is self-healing."""
	create_missing_roles()
	sync_doctype_permissions()


def create_module_def():
	if not frappe.db.exists("Module Def", "Healthcare ERP"):
		frappe.get_doc({
			"doctype": "Module Def",
			"module_name": "Healthcare ERP",
			"app_name": "healthcare_erp",
		}).insert(ignore_permissions=True)


def create_missing_roles():
	for role in ROLE_PERMISSION_MATRIX:
		if not frappe.db.exists("Role", role):
			frappe.get_doc({
				"doctype": "Role",
				"role_name": role,
				"desk_access": 0,
			}).insert(ignore_permissions=True)


def set_default_healthcare_settings():
	"""Sensible defaults for a private medical center of ~20 practitioners."""
	if frappe.db.exists("DocType", "Healthcare Settings"):
		settings = frappe.get_single("Healthcare Settings")
		settings.db_set("collect_registration_fee", 0)
		settings.db_set("link_customer_to_patient", 1)
		settings.db_set("patient_master_name", "Naming Series")
