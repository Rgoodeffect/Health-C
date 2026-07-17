"""Module 8 — Admission & Bed Management.

`Inpatient Record` and `Healthcare Service Unit` (wards/rooms/beds, via the
`is_bed`/`inpatient_occupancy` fields on the service unit tree) are ERPNext
core; healthcare_erp adds bed transfer requests and nursing notes on top.
"""

from __future__ import annotations

import frappe
from frappe.utils import now_datetime, today

from healthcare_erp.api.utils import envelope, require_doctype_permission, set_if_field_exists


@frappe.whitelist()
def list_service_units(unit_type: str | None = None, only_beds: bool = False):
	"""Ward/room/bed hierarchy for the bed board."""
	filters = {}
	if unit_type:
		filters["service_unit_type"] = unit_type
	meta = frappe.get_meta("Healthcare Service Unit")
	if only_beds and meta.get_field("is_bed"):
		filters["is_bed"] = 1

	fields = ["name", "healthcare_service_unit_name", "service_unit_type", "parent_healthcare_service_unit"]
	for optional in ("is_bed", "occupancy_status", "allow_appointments", "inpatient_occupancy"):
		if meta.get_field(optional):
			fields.append(optional)

	return envelope(frappe.get_all("Healthcare Service Unit", filters=filters, fields=fields, limit_page_length=500))


@frappe.whitelist()
def bed_occupancy_summary():
	meta = frappe.get_meta("Healthcare Service Unit")
	if not meta.get_field("is_bed"):
		return envelope([])

	beds = frappe.get_all(
		"Healthcare Service Unit", filters={"is_bed": 1},
		fields=["name", "parent_healthcare_service_unit", "occupancy_status"],
		limit_page_length=1000,
	)
	summary: dict[str, dict] = {}
	for bed in beds:
		ward = bed["parent_healthcare_service_unit"] or "Unassigned"
		bucket = summary.setdefault(ward, {"ward": ward, "total": 0, "occupied": 0})
		bucket["total"] += 1
		if (bed.get("occupancy_status") or "").lower() == "occupied":
			bucket["occupied"] += 1
	return envelope(list(summary.values()))


@frappe.whitelist()
def list_admissions(status: str | None = None):
	require_doctype_permission("Inpatient Record", "read")
	filters = {"status": status} if status else {}
	meta = frappe.get_meta("Inpatient Record")
	fields = ["name", "patient", "patient_name", "status"]
	for optional in ("scheduled_date", "admitted_datetime", "expected_discharge", "practitioner", "service_unit"):
		if meta.get_field(optional):
			fields.append(optional)
	return envelope(frappe.get_all("Inpatient Record", filters=filters, fields=fields, order_by="creation desc", limit_page_length=200))


@frappe.whitelist(methods=["POST"])
def create_admission_request(patient: str, practitioner: str | None = None, admission_reason: str | None = None, service_unit: str | None = None):
	require_doctype_permission("Inpatient Record", "create")
	doc = frappe.new_doc("Inpatient Record")
	set_if_field_exists(doc, {
		"patient": patient,
		"practitioner": practitioner,
		"admission_reason" if frappe.get_meta("Inpatient Record").get_field("admission_reason") else "reason": admission_reason,
		"service_unit": service_unit,
		"scheduled_date": today(),
		"status": "Admission Scheduled",
	})
	doc.insert()
	return envelope(doc.as_dict(), {"message": "Admission requested"})


@frappe.whitelist(methods=["POST"])
def occupy_bed(inpatient_record: str, service_unit: str):
	doc = frappe.get_doc("Inpatient Record", inpatient_record)
	doc.check_permission("write")
	set_if_field_exists(doc, {"service_unit": service_unit, "status": "Admitted", "admitted_datetime": now_datetime()})
	doc.save()

	if frappe.get_meta("Healthcare Service Unit").get_field("occupancy_status"):
		frappe.db.set_value("Healthcare Service Unit", service_unit, "occupancy_status", "Occupied")

	return envelope(doc.as_dict(), {"message": "Bed assigned"})


@frappe.whitelist(methods=["POST"])
def request_transfer(inpatient_record: str, to_service_unit: str, reason: str | None = None):
	require_doctype_permission("Bed Transfer Request", "create")
	record = frappe.get_doc("Inpatient Record", inpatient_record)
	transfer = frappe.get_doc({
		"doctype": "Bed Transfer Request",
		"patient": record.patient,
		"inpatient_record": inpatient_record,
		"from_service_unit": record.get("service_unit"),
		"to_service_unit": to_service_unit,
		"reason": reason,
	})
	transfer.insert()
	return envelope(transfer.as_dict(), {"message": "Transfer requested"})


@frappe.whitelist(methods=["POST"])
def complete_transfer(name: str):
	transfer = frappe.get_doc("Bed Transfer Request", name)
	transfer.check_permission("write")

	record = frappe.get_doc("Inpatient Record", transfer.inpatient_record)
	set_if_field_exists(record, {"service_unit": transfer.to_service_unit})
	record.save()

	meta = frappe.get_meta("Healthcare Service Unit")
	if meta.get_field("occupancy_status"):
		if transfer.from_service_unit:
			frappe.db.set_value("Healthcare Service Unit", transfer.from_service_unit, "occupancy_status", "Vacant")
		frappe.db.set_value("Healthcare Service Unit", transfer.to_service_unit, "occupancy_status", "Occupied")

	transfer.status = "Completed"
	transfer.completed_on = now_datetime()
	transfer.save()
	return envelope(transfer.as_dict(), {"message": "Transfer completed"})


@frappe.whitelist(methods=["POST"])
def discharge_patient(inpatient_record: str, discharge_notes: str | None = None):
	doc = frappe.get_doc("Inpatient Record", inpatient_record)
	doc.check_permission("write")
	set_if_field_exists(doc, {
		"status": "Discharged",
		"discharge_date" if frappe.get_meta("Inpatient Record").get_field("discharge_date") else "discharge_datetime": now_datetime(),
		"discharge_instructions" if frappe.get_meta("Inpatient Record").get_field("discharge_instructions") else "discharge_note": discharge_notes,
	})
	doc.save()

	service_unit = doc.get("service_unit")
	if service_unit and frappe.get_meta("Healthcare Service Unit").get_field("occupancy_status"):
		frappe.db.set_value("Healthcare Service Unit", service_unit, "occupancy_status", "Vacant")

	return envelope(doc.as_dict(), {"message": "Patient discharged"})


# --- Nursing notes -----------------------------------------------------------

@frappe.whitelist()
def list_nursing_notes(patient: str):
	require_doctype_permission("Nursing Note", "read")
	return envelope(frappe.get_all(
		"Nursing Note", filters={"patient": patient},
		fields=["name", "shift", "note", "recorded_by", "recorded_on"],
		order_by="recorded_on desc", limit_page_length=100,
	))


@frappe.whitelist(methods=["POST"])
def add_nursing_note(patient: str, note: str, inpatient_record: str | None = None, shift: str | None = None):
	require_doctype_permission("Nursing Note", "create")
	doc = frappe.get_doc({
		"doctype": "Nursing Note", "patient": patient, "inpatient_record": inpatient_record,
		"shift": shift, "note": note,
	})
	doc.insert()
	return envelope(doc.as_dict())
