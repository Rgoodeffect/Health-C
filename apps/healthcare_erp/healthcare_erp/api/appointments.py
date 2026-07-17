"""Module 2 — Appointments.

`Patient Appointment` is ERPNext core; this module adds the calendar-shaped
list views (day/week/month), drag-and-drop reschedule, cancellation, and the
Waiting List workflow the default Desk list view doesn't provide.
"""

from __future__ import annotations

import frappe
from frappe.utils import add_days, get_first_day, get_last_day, getdate

from healthcare_erp.api.utils import envelope, require_doctype_permission

APPOINTMENT_FIELDS = [
	"name", "patient", "patient_name", "practitioner", "practitioner_name",
	"department", "appointment_date", "appointment_time", "duration",
	"appointment_type", "status", "notes",
]


@frappe.whitelist()
def calendar(view: str = "week", date: str | None = None, practitioner: str | None = None):
	"""view: day | week | month"""
	require_doctype_permission("Patient Appointment", "read")
	anchor = getdate(date) if date else getdate()

	if view == "day":
		start, end = anchor, anchor
	elif view == "month":
		start, end = get_first_day(anchor), get_last_day(anchor)
	else:  # week
		start = add_days(anchor, -anchor.weekday())
		end = add_days(start, 6)

	filters = {"appointment_date": ["between", [start, end]]}
	if practitioner:
		filters["practitioner"] = practitioner

	rows = frappe.get_list(
		"Patient Appointment",
		fields=APPOINTMENT_FIELDS,
		filters=filters,
		order_by="appointment_date asc, appointment_time asc",
		limit_page_length=0,
	)
	return envelope(rows, {"view": view, "start": str(start), "end": str(end)})


@frappe.whitelist(methods=["POST"])
def create_appointment(**payload):
	require_doctype_permission("Patient Appointment", "create")
	appt = frappe.new_doc("Patient Appointment")
	appt.update({
		"patient": payload.get("patient"),
		"practitioner": payload.get("practitioner"),
		"department": payload.get("department"),
		"appointment_date": payload.get("appointment_date"),
		"appointment_time": payload.get("appointment_time"),
		"duration": payload.get("duration") or 15,
		"appointment_type": payload.get("appointment_type"),
		"notes": payload.get("notes"),
	})
	appt.insert()
	return envelope(appt.as_dict(), {"message": "Appointment booked"})


@frappe.whitelist(methods=["POST", "PUT"])
def reschedule_appointment(name: str, appointment_date: str, appointment_time: str):
	"""Backs the calendar's drag-and-drop reschedule interaction."""
	doc = frappe.get_doc("Patient Appointment", name)
	doc.check_permission("write")
	doc.appointment_date = appointment_date
	doc.appointment_time = appointment_time
	doc.status = "Open" if doc.status == "Closed" else doc.status
	doc.save()
	return envelope(doc.as_dict(), {"message": "Appointment rescheduled"})


@frappe.whitelist(methods=["POST"])
def cancel_appointment(name: str, reason: str | None = None):
	doc = frappe.get_doc("Patient Appointment", name)
	doc.check_permission("write")
	doc.status = "Cancelled"
	if reason:
		doc.append_comment("Comment", f"Cancelled: {reason}")
	doc.save()
	return envelope(doc.as_dict(), {"message": "Appointment cancelled"})


# --- Waiting list -----------------------------------------------------------

@frappe.whitelist()
def list_waiting_list(status: str = "Waiting"):
	require_doctype_permission("Appointment Waiting List", "read")
	rows = frappe.get_list(
		"Appointment Waiting List",
		fields=["name", "patient", "patient_name", "practitioner", "department",
				"preferred_date", "priority", "status", "added_on", "notes"],
		filters={"status": status} if status else {},
		order_by="priority desc, added_on asc",
		limit_page_length=0,
	)
	return envelope(rows)


@frappe.whitelist(methods=["POST"])
def add_to_waiting_list(**payload):
	require_doctype_permission("Appointment Waiting List", "create")
	entry = frappe.new_doc("Appointment Waiting List")
	entry.update({
		"patient": payload.get("patient"),
		"practitioner": payload.get("practitioner"),
		"department": payload.get("department"),
		"preferred_date": payload.get("preferred_date"),
		"priority": payload.get("priority") or "Routine",
		"notes": payload.get("notes"),
	})
	entry.insert()
	return envelope(entry.as_dict())


@frappe.whitelist(methods=["POST"])
def remove_from_waiting_list(name: str):
	doc = frappe.get_doc("Appointment Waiting List", name)
	doc.check_permission("write")
	doc.status = "Cancelled"
	doc.save()
	return envelope(doc.as_dict())
