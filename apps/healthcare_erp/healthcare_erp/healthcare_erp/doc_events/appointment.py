from __future__ import annotations

import frappe


def after_insert(doc, method=None):
	_fulfill_waiting_list_entry(doc)


def on_update(doc, method=None):
	pass


def on_cancel(doc, method=None):
	frappe.db.set_value(
		"Appointment Waiting List",
		{"scheduled_appointment": doc.name},
		{"status": "Waiting", "scheduled_appointment": None},
	)


def _fulfill_waiting_list_entry(doc):
	"""If this patient had an open waiting-list request matching the
	practitioner/department just booked, mark it Scheduled so reception's
	waiting list view clears automatically."""
	filters = {"patient": doc.patient, "status": "Waiting"}
	if doc.get("practitioner"):
		filters["practitioner"] = doc.practitioner

	entry = frappe.db.get_value("Appointment Waiting List", filters, "name")
	if entry:
		frappe.db.set_value(
			"Appointment Waiting List", entry,
			{"status": "Scheduled", "scheduled_appointment": doc.name},
		)
