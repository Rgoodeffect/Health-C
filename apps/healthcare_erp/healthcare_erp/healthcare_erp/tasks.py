"""Scheduled jobs referenced by hooks.py `scheduler_events`.

Each task guards on `frappe.db.exists("DocType", ...)` for doctypes that
belong to modules not yet installed, so the scheduler never breaks as the
app is built out incrementally — see docs/PROGRESS.md.
"""

from __future__ import annotations

import frappe
from frappe.utils import add_days, now_datetime, today


def sync_critical_alerts():
	"""Every 5 minutes: surface newly-flagged critical lab/radiology results
	as a Clinical Alert so ward/EMR staff see them without polling reports.
	Implemented fully once the Laboratory/Radiology modules land; safe no-op
	until then."""
	if frappe.db.exists("DocType", "Lab Test") and frappe.get_meta("Lab Test").get_field("has_critical_result"):
		critical_tests = frappe.get_all(
			"Lab Test",
			filters={"has_critical_result": 1, "modified": [">", add_days(now_datetime(), -1)]},
			fields=["name", "patient"],
		)
		for test in critical_tests:
			_raise_clinical_alert(test.patient, f"Critical lab result: {test.name}")


def check_appointment_reminders():
	"""Hourly: notify patients/practitioners of appointments starting
	tomorrow."""
	if not frappe.db.exists("DocType", "Patient Appointment"):
		return

	tomorrow = add_days(today(), 1)
	appointments = frappe.get_all(
		"Patient Appointment",
		filters={"appointment_date": tomorrow, "status": ["not in", ["Cancelled", "Closed"]], "reminded": 0}
		if frappe.get_meta("Patient Appointment").get_field("reminded")
		else {"appointment_date": tomorrow, "status": ["not in", ["Cancelled", "Closed"]]},
		fields=["name", "patient", "practitioner", "appointment_time"],
	)
	for appt in appointments:
		frappe.publish_realtime(
			"appointment_reminder",
			{"appointment": appt.name, "appointment_time": str(appt.appointment_time)},
			user=frappe.db.get_value("Patient", appt.patient, "user_id"),
		)


def check_drug_expiry():
	"""Hourly: flag batches expiring within 30 days for the Pharmacy
	dashboard (core ERPNext `Batch` doctype, always available once Stock is
	set up)."""
	if not frappe.db.exists("DocType", "Batch"):
		return

	expiring = frappe.get_all(
		"Batch",
		filters={"expiry_date": ["between", [today(), add_days(today(), 30)]], "disabled": 0},
		fields=["name", "item", "expiry_date"],
	)
	for batch in expiring:
		frappe.publish_realtime("drug_expiry_warning", {"batch": batch.name, "item": batch.item, "expiry_date": str(batch.expiry_date)})


def build_executive_kpi_snapshot():
	"""Daily: materialize yesterday's KPIs for the Executive Dashboards
	module. No-op until `Executive KPI Snapshot` (Module 13) is installed."""
	if not frappe.db.exists("DocType", "Executive KPI Snapshot"):
		return
	frappe.get_doc({"doctype": "Executive KPI Snapshot", "snapshot_date": today()}).insert(ignore_permissions=True)


def close_stale_queue_tokens():
	"""Daily: any reception token left Waiting/Called from a previous day is
	a no-show — clear it so the next day's queue starts clean."""
	if not frappe.db.exists("DocType", "Reception Queue Token"):
		return

	stale = frappe.get_all(
		"Reception Queue Token",
		filters={"status": ["in", ["Waiting", "Called"]], "checked_in_at": ["<", today()]},
		pluck="name",
	)
	for name in stale:
		frappe.db.set_value("Reception Queue Token", name, "status", "No Show")


def _raise_clinical_alert(patient: str, message: str):
	if not frappe.db.exists("DocType", "Clinical Alert"):
		return
	frappe.get_doc({
		"doctype": "Clinical Alert",
		"patient": patient,
		"message": message,
		"raised_on": now_datetime(),
	}).insert(ignore_permissions=True)
