from __future__ import annotations

import io

import frappe
from frappe.utils.file_manager import save_file


def before_insert(doc, method=None):
	# `name` is generated from the `MRN-.YYYY.-.#####` naming series (see
	# fixtures/property_setter.json) so the MRN *is* the Patient's primary key —
	# no separate MRN field to keep in sync.
	pass


def after_insert(doc, method=None):
	_generate_qr_code(doc)
	_link_portal_user(doc)


def _generate_qr_code(doc):
	"""Encode a compact MRN payload so reception/ward staff can scan the
	patient wristband/card to pull up the Patient 360 profile instantly."""
	try:
		import qrcode
	except ImportError:
		frappe.log_error("qrcode package not installed", "Patient QR generation skipped")
		return

	payload = frappe.utils.get_url(f"/patients/{doc.name}")
	img = qrcode.make(payload)
	buffer = io.BytesIO()
	img.save(buffer, format="PNG")
	buffer.seek(0)

	file_doc = save_file(
		fname=f"{doc.name}-qr.png",
		content=buffer.read(),
		dt="Patient",
		dn=doc.name,
		is_private=0,
	)
	frappe.db.set_value("Patient", doc.name, "qr_code", file_doc.file_url)


def _link_portal_user(doc):
	"""If this Patient record already has a linked Website User (self-registered
	via the Patient Portal or invited by reception), scope that user's visibility
	to only this Patient record via a User Permission, per the RBAC design in
	setup/roles.py."""
	if not doc.get("user_id"):
		return

	if frappe.db.exists("User Permission", {
		"user": doc.user_id, "allow": "Patient", "for_value": doc.name,
	}):
		return

	frappe.get_doc({
		"doctype": "User Permission",
		"user": doc.user_id,
		"allow": "Patient",
		"for_value": doc.name,
		"apply_to_all_doctypes": 1,
	}).insert(ignore_permissions=True)

	if "Patient" not in frappe.get_roles(doc.user_id):
		user = frappe.get_doc("User", doc.user_id)
		user.append("roles", {"role": "Patient"})
		user.save(ignore_permissions=True)
