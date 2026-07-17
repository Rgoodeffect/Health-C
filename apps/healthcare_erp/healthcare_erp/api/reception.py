"""Module 3 — Reception: check-in, queue/token management, waiting room
dashboard, and payment verification before a consultation starts."""

from __future__ import annotations

import frappe
from frappe.utils import now_datetime, today

from healthcare_erp.api.utils import envelope, require_doctype_permission

QUEUE_FIELDS = [
	"name", "patient", "patient_name", "appointment", "practitioner", "department",
	"status", "priority", "payment_status", "checked_in_at", "called_at", "completed_at",
]

PRIORITY_ORDER = {"Emergency": 0, "Urgent": 1, "Normal": 2}


@frappe.whitelist(methods=["POST"])
def check_in(patient: str, appointment: str | None = None, department: str | None = None, practitioner: str | None = None):
	require_doctype_permission("Reception Queue Token", "create")

	if appointment:
		appt = frappe.get_doc("Patient Appointment", appointment)
		department = department or appt.get("department")
		practitioner = practitioner or appt.get("practitioner")
		appt.db_set("status", "Open")

	token = frappe.new_doc("Reception Queue Token")
	token.update({
		"patient": patient,
		"appointment": appointment,
		"department": department,
		"practitioner": practitioner,
	})
	token.insert()
	return envelope(token.as_dict(), {"message": "Patient checked in"})


@frappe.whitelist()
def queue(department: str | None = None, status: str | None = None):
	require_doctype_permission("Reception Queue Token", "read")
	filters = {"checked_in_at": [">=", today()]}
	if department:
		filters["department"] = department
	if status:
		filters["status"] = status
	else:
		filters["status"] = ["not in", ["Completed", "No Show"]]

	rows = frappe.get_list("Reception Queue Token", fields=QUEUE_FIELDS, filters=filters, limit_page_length=0)
	rows.sort(key=lambda r: (PRIORITY_ORDER.get(r["priority"], 2), r["checked_in_at"]))
	return envelope(rows)


@frappe.whitelist()
def waiting_room_display():
	"""Public-safe payload for a lobby TV: token numbers currently being
	served/next per department, no PII beyond first name."""
	rows = frappe.get_list(
		"Reception Queue Token",
		fields=["name", "department", "status", "patient_name"],
		filters={"checked_in_at": [">=", today()], "status": ["in", ["Waiting", "Called", "In Consultation"]]},
		limit_page_length=0,
	)
	by_department: dict[str, dict] = {}
	for row in rows:
		dept = row["department"] or "General"
		bucket = by_department.setdefault(dept, {"now_serving": [], "waiting_count": 0})
		if row["status"] in ("Called", "In Consultation"):
			bucket["now_serving"].append({"token": row["name"], "patient_first_name": row["patient_name"].split(" ")[0]})
		else:
			bucket["waiting_count"] += 1
	return envelope(by_department)


@frappe.whitelist(methods=["POST"])
def call_next(department: str | None = None, practitioner: str | None = None):
	filters = {"status": "Waiting", "checked_in_at": [">=", today()]}
	if department:
		filters["department"] = department
	if practitioner:
		filters["practitioner"] = practitioner

	candidates = frappe.get_list("Reception Queue Token", fields=QUEUE_FIELDS, filters=filters, limit_page_length=0)
	if not candidates:
		return envelope(None, {"message": "Queue is empty"})

	candidates.sort(key=lambda r: (PRIORITY_ORDER.get(r["priority"], 2), r["checked_in_at"]))
	next_token = candidates[0]

	doc = frappe.get_doc("Reception Queue Token", next_token["name"])
	doc.check_permission("write")
	doc.status = "Called"
	doc.called_at = now_datetime()
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist(methods=["POST"])
def update_status(name: str, status: str):
	doc = frappe.get_doc("Reception Queue Token", name)
	doc.check_permission("write")
	doc.status = status
	if status == "Completed":
		doc.completed_at = now_datetime()
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist(methods=["POST"])
def verify_payment(name: str, payment_status: str = "Verified"):
	doc = frappe.get_doc("Reception Queue Token", name)
	doc.check_permission("write")
	doc.payment_status = payment_status
	doc.save()
	return envelope(doc.as_dict())
