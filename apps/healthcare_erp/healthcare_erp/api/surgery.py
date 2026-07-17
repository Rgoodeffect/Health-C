"""Module 9 — Surgery & Operating Theatre.

Every doctype here is new (no core ERPNext equivalent for a full OT
workflow): Surgery Request (with a Surgical Team Member child table),
OT Schedule, Pre Op Checklist, Anesthesia Record, Surgery Note, Recovery
Room Log, Implant Tracking.
"""

from __future__ import annotations

import frappe

from healthcare_erp.api.utils import envelope, require_doctype_permission

REQUEST_FIELDS = ["name", "patient", "patient_name", "procedure", "requested_by", "requested_date", "priority", "status"]


@frappe.whitelist()
def list_requests(status: str | None = None):
	require_doctype_permission("Surgery Request", "read")
	filters = {"status": status} if status else {}
	return envelope(frappe.get_all("Surgery Request", filters=filters, fields=REQUEST_FIELDS, order_by="creation desc", limit_page_length=200))


@frappe.whitelist(methods=["POST"])
def create_request(patient: str, procedure: str, requested_by: str | None = None, priority: str = "Elective", notes: str | None = None):
	require_doctype_permission("Surgery Request", "create")
	doc = frappe.get_doc({
		"doctype": "Surgery Request", "patient": patient, "procedure": procedure,
		"requested_by": requested_by, "priority": priority, "notes": notes,
	})
	doc.insert()
	return envelope(doc.as_dict(), {"message": "Surgery requested"})


@frappe.whitelist(methods=["POST"])
def assign_team(surgery_request: str, team_members: list | str):
	"""`team_members`: list of {practitioner, role} (or JSON-encoded)."""
	import json
	if isinstance(team_members, str):
		team_members = json.loads(team_members)

	doc = frappe.get_doc("Surgery Request", surgery_request)
	doc.check_permission("write")
	doc.set("team_members", [])
	for member in team_members:
		doc.append("team_members", {"practitioner": member.get("practitioner"), "role": member.get("role")})
	doc.save()
	return envelope(doc.as_dict(), {"message": "Surgical team assigned"})


@frappe.whitelist()
def get_request(name: str):
	doc = frappe.get_doc("Surgery Request", name)
	doc.check_permission("read")
	return envelope(doc.as_dict())


# --- OT scheduling -----------------------------------------------------------

@frappe.whitelist()
def list_ot_schedule(operating_room: str | None = None):
	require_doctype_permission("OT Schedule", "read")
	filters = {"operating_room": operating_room} if operating_room else {}
	return envelope(frappe.get_all(
		"OT Schedule", filters=filters,
		fields=["name", "surgery_request", "operating_room", "scheduled_start", "scheduled_end", "status"],
		order_by="scheduled_start asc", limit_page_length=200,
	))


@frappe.whitelist(methods=["POST"])
def schedule_surgery(surgery_request: str, operating_room: str, scheduled_start: str, scheduled_end: str):
	require_doctype_permission("OT Schedule", "create")

	overlap = frappe.get_all(
		"OT Schedule",
		filters={
			"operating_room": operating_room,
			"status": ["!=", "Cancelled"],
			"scheduled_start": ["<", scheduled_end],
			"scheduled_end": [">", scheduled_start],
		},
		limit_page_length=1,
	)
	if overlap:
		frappe.throw(frappe._("This operating room is already booked for the selected time"))

	doc = frappe.get_doc({
		"doctype": "OT Schedule", "surgery_request": surgery_request, "operating_room": operating_room,
		"scheduled_start": scheduled_start, "scheduled_end": scheduled_end,
	})
	doc.insert()

	frappe.db.set_value("Surgery Request", surgery_request, "status", "Scheduled")
	return envelope(doc.as_dict(), {"message": "Surgery scheduled"})


# --- Pre-op checklist --------------------------------------------------------

@frappe.whitelist(methods=["POST"])
def save_pre_op_checklist(surgery_request: str, **items):
	require_doctype_permission("Pre Op Checklist", "create")
	checklist_fields = {
		"consent_obtained", "site_marked", "npo_confirmed",
		"allergies_reviewed", "labs_reviewed", "equipment_ready", "notes",
	}
	existing = frappe.db.get_value("Pre Op Checklist", {"surgery_request": surgery_request}, "name")
	doc = frappe.get_doc("Pre Op Checklist", existing) if existing else frappe.new_doc("Pre Op Checklist")
	doc.surgery_request = surgery_request
	for field, value in items.items():
		if field in checklist_fields:
			doc.set(field, value)

	all_checked = all(doc.get(f) for f in checklist_fields if f != "notes")
	if all_checked:
		doc.completed_by = frappe.session.user
		doc.completed_on = frappe.utils.now_datetime()

	if existing:
		doc.save()
	else:
		doc.insert()
	return envelope(doc.as_dict())


@frappe.whitelist()
def get_pre_op_checklist(surgery_request: str):
	name = frappe.db.get_value("Pre Op Checklist", {"surgery_request": surgery_request}, "name")
	return envelope(frappe.get_doc("Pre Op Checklist", name).as_dict() if name else None)


# --- Anesthesia + surgery note + recovery -----------------------------------

@frappe.whitelist(methods=["POST"])
def save_anesthesia_record(surgery_request: str, anesthesia_type: str, anesthesiologist: str | None = None,
							start_time: str | None = None, end_time: str | None = None, asa_class: str | None = None, notes: str | None = None):
	require_doctype_permission("Anesthesia Record", "create")
	existing = frappe.db.get_value("Anesthesia Record", {"surgery_request": surgery_request}, "name")
	doc = frappe.get_doc("Anesthesia Record", existing) if existing else frappe.new_doc("Anesthesia Record")
	doc.update({
		"surgery_request": surgery_request, "anesthesia_type": anesthesia_type,
		"anesthesiologist": anesthesiologist, "start_time": start_time, "end_time": end_time,
		"asa_class": asa_class, "notes": notes,
	})
	doc.save() if existing else doc.insert()
	return envelope(doc.as_dict())


@frappe.whitelist(methods=["POST"])
def save_surgery_note(surgery_request: str, procedure_performed: str, findings: str | None = None,
					   complications: str | None = None, surgeon: str | None = None,
					   start_time: str | None = None, end_time: str | None = None, estimated_blood_loss: int | None = None):
	require_doctype_permission("Surgery Note", "create")
	existing = frappe.db.get_value("Surgery Note", {"surgery_request": surgery_request}, "name")
	doc = frappe.get_doc("Surgery Note", existing) if existing else frappe.new_doc("Surgery Note")
	doc.update({
		"surgery_request": surgery_request, "procedure_performed": procedure_performed, "findings": findings,
		"complications": complications, "surgeon": surgeon, "start_time": start_time,
		"end_time": end_time, "estimated_blood_loss": estimated_blood_loss,
	})
	doc.save() if existing else doc.insert()

	frappe.db.set_value("Surgery Request", surgery_request, "status", "Completed")
	frappe.db.set_value("OT Schedule", {"surgery_request": surgery_request}, "status", "Completed")
	return envelope(doc.as_dict(), {"message": "Surgery note saved"})


@frappe.whitelist(methods=["POST"])
def admit_to_recovery(surgery_request: str):
	require_doctype_permission("Recovery Room Log", "create")
	patient = frappe.db.get_value("Surgery Request", surgery_request, "patient")
	doc = frappe.get_doc({"doctype": "Recovery Room Log", "surgery_request": surgery_request, "patient": patient})
	doc.insert()
	return envelope(doc.as_dict())


@frappe.whitelist(methods=["POST"])
def discharge_from_recovery(name: str, vitals_stable: int = 1, pain_score: int | None = None, notes: str | None = None):
	doc = frappe.get_doc("Recovery Room Log", name)
	doc.check_permission("write")
	doc.discharge_time = frappe.utils.now_datetime()
	doc.vitals_stable = vitals_stable
	doc.pain_score = pain_score
	doc.notes = notes
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist()
def list_recovery_room():
	require_doctype_permission("Recovery Room Log", "read")
	return envelope(frappe.get_all(
		"Recovery Room Log", filters={"discharge_time": ["is", "not set"]},
		fields=["name", "surgery_request", "patient", "admitted_time", "vitals_stable"],
		order_by="admitted_time asc", limit_page_length=100,
	))


# --- Implant tracking --------------------------------------------------------

@frappe.whitelist(methods=["POST"])
def add_implant(surgery_request: str, implant_name: str, manufacturer: str | None = None,
				 lot_number: str | None = None, serial_number: str | None = None, expiry_date: str | None = None):
	require_doctype_permission("Implant Tracking", "create")
	doc = frappe.get_doc({
		"doctype": "Implant Tracking", "surgery_request": surgery_request, "implant_name": implant_name,
		"manufacturer": manufacturer, "lot_number": lot_number, "serial_number": serial_number, "expiry_date": expiry_date,
	})
	doc.insert()
	return envelope(doc.as_dict())


@frappe.whitelist()
def list_implants(surgery_request: str | None = None, patient: str | None = None):
	require_doctype_permission("Implant Tracking", "read")
	filters = {}
	if surgery_request:
		filters["surgery_request"] = surgery_request
	if patient:
		filters["patient"] = patient
	return envelope(frappe.get_all(
		"Implant Tracking", filters=filters,
		fields=["name", "surgery_request", "patient", "implant_name", "manufacturer", "lot_number", "serial_number", "expiry_date"],
		order_by="creation desc", limit_page_length=200,
	))
