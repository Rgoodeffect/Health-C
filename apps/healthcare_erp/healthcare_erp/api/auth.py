"""Session/auth endpoints for the Next.js SPA.

The SPA authenticates with the standard Frappe cookie session (login via
`/api/method/login`) and reads its own identity + role + permitted routes
from `whoami` below, rather than re-implementing role logic in JS. This
keeps a single source of truth: Frappe's Role/User Permission engine.
"""

from __future__ import annotations

import frappe

from healthcare_erp.api.utils import envelope

PORTAL_ROLE = "Patient"


@frappe.whitelist()
def whoami():
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(frappe._("Not logged in"), frappe.AuthenticationError)

	roles = frappe.get_roles(user)
	user_doc = frappe.get_doc("User", user)

	patient = None
	if PORTAL_ROLE in roles:
		patient = frappe.db.get_value(
			"Patient", {"user_id": user}, ["name", "patient_name", "mrn" if _has_mrn_field() else "name"],
			as_dict=True,
		)

	return envelope({
		"user": user,
		"full_name": user_doc.full_name,
		"user_image": user_doc.user_image,
		"language": user_doc.language or "en",
		"roles": roles,
		"is_portal_user": PORTAL_ROLE in roles and not _is_staff(roles),
		"patient": patient,
	})


@frappe.whitelist()
def set_language(language: str):
	if language not in ("en", "ar"):
		frappe.throw(frappe._("Unsupported language"))
	frappe.db.set_value("User", frappe.session.user, "language", language)
	frappe.local.cookie_manager.set_cookie("preferred_language", language, max_age=31536000)
	frappe.db.commit()
	return envelope({"language": language})


def _is_staff(roles: list[str]) -> bool:
	staff_roles = {
		"CEO", "Medical Director", "Finance Director", "Receptionist", "Doctor",
		"Nurse", "Laboratory Technician", "Radiologist", "Pharmacist", "Cashier",
		"Insurance Officer", "System Manager", "Administrator",
	}
	return bool(staff_roles.intersection(roles))


def _has_mrn_field() -> bool:
	return bool(frappe.get_meta("Patient").get_field("mrn"))
