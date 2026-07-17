"""Module 4 — Consultation & EMR.

`Patient Encounter` is ERPNext core; healthcare_erp adds the free-text
clinical fields (chief complaint, history, examination, treatment plan,
follow-up, clinical notes) as Custom Fields, plus a local ICD-10 lookup
table, Clinical Alerts, and a cross-module Medical Timeline.
"""

from __future__ import annotations

import frappe
from frappe.utils import getdate, today

from healthcare_erp.api.utils import envelope, require_doctype_permission, set_if_field_exists

ENCOUNTER_FIELDS = [
	"name", "patient", "practitioner", "encounter_date", "docstatus",
	"chief_complaint", "primary_diagnosis_code", "follow_up_date",
]


@frappe.whitelist()
def list_encounters(patient: str):
	require_doctype_permission("Patient Encounter", "read")
	return envelope(frappe.get_all(
		"Patient Encounter",
		filters={"patient": patient},
		fields=ENCOUNTER_FIELDS,
		order_by="encounter_date desc",
		limit_page_length=100,
	))


@frappe.whitelist()
def get_encounter(name: str):
	doc = frappe.get_doc("Patient Encounter", name)
	doc.check_permission("read")
	return envelope(doc.as_dict())


@frappe.whitelist(methods=["POST"])
def create_encounter(**payload):
	require_doctype_permission("Patient Encounter", "create")
	doc = frappe.new_doc("Patient Encounter")
	doc.patient = payload.get("patient")
	doc.practitioner = payload.get("practitioner")
	doc.encounter_date = payload.get("encounter_date") or today()

	set_if_field_exists(doc, {
		"chief_complaint": payload.get("chief_complaint"),
		"history_of_present_illness": payload.get("history"),
		"examination_findings": payload.get("examination"),
		"primary_diagnosis_code": payload.get("diagnosis_code"),
		"treatment_plan": payload.get("treatment_plan"),
		"follow_up_date": payload.get("follow_up_date"),
		"clinical_notes": payload.get("clinical_notes"),
	})
	doc.insert()
	return envelope(doc.as_dict(), {"message": "Consultation saved as draft"})


@frappe.whitelist(methods=["PUT", "POST"])
def update_encounter(name: str, **payload):
	doc = frappe.get_doc("Patient Encounter", name)
	doc.check_permission("write")
	set_if_field_exists(doc, {
		"chief_complaint": payload.get("chief_complaint"),
		"history_of_present_illness": payload.get("history"),
		"examination_findings": payload.get("examination"),
		"primary_diagnosis_code": payload.get("diagnosis_code"),
		"treatment_plan": payload.get("treatment_plan"),
		"follow_up_date": payload.get("follow_up_date"),
		"clinical_notes": payload.get("clinical_notes"),
	})
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist(methods=["POST"])
def submit_encounter(name: str):
	doc = frappe.get_doc("Patient Encounter", name)
	doc.check_permission("submit")
	doc.submit()
	return envelope(doc.as_dict(), {"message": "Consultation signed off"})


@frappe.whitelist()
def icd10_search(query: str = "", limit: int = 20):
	require_doctype_permission("ICD10 Code", "read")
	if not query:
		return envelope(frappe.get_all("ICD10 Code", fields=["code", "title", "category"], limit_page_length=limit))

	rows = frappe.get_all(
		"ICD10 Code",
		or_filters={"code": ["like", f"%{query}%"], "title": ["like", f"%{query}%"]},
		fields=["code", "title", "category"],
		limit_page_length=limit,
	)
	return envelope(rows)


# --- Vitals ------------------------------------------------------------------

VITALS_FIELDS = [
	"name", "signs_date", "temperature", "pulse", "respiratory_rate",
	"bp_systolic", "bp_diastolic", "oxygen_saturation", "height", "weight", "bmi",
]


@frappe.whitelist()
def list_vitals(patient: str):
	if not frappe.db.exists("DocType", "Vital Signs"):
		return envelope([])
	require_doctype_permission("Vital Signs", "read")
	meta = frappe.get_meta("Vital Signs")
	fields = [f for f in VITALS_FIELDS if f == "name" or meta.get_field(f)]
	return envelope(frappe.get_all(
		"Vital Signs", filters={"patient": patient}, fields=fields,
		order_by="creation desc", limit_page_length=50,
	))


@frappe.whitelist(methods=["POST"])
def record_vitals(patient: str, encounter: str | None = None, **payload):
	require_doctype_permission("Vital Signs", "create")
	doc = frappe.new_doc("Vital Signs")
	set_if_field_exists(doc, {
		"patient": patient,
		"encounter": encounter,
		"signs_date": today(),
		"temperature": payload.get("temperature"),
		"pulse": payload.get("pulse"),
		"respiratory_rate": payload.get("respiratory_rate"),
		"bp_systolic": payload.get("bp_systolic"),
		"bp_diastolic": payload.get("bp_diastolic"),
		"oxygen_saturation": payload.get("spo2"),
		"height": payload.get("height"),
		"weight": payload.get("weight"),
	})
	doc.insert()
	return envelope(doc.as_dict())


# --- Clinical alerts -----------------------------------------------------------

@frappe.whitelist()
def list_clinical_alerts(patient: str | None = None, acknowledged: int = 0):
	require_doctype_permission("Clinical Alert", "read")
	filters = {"acknowledged": acknowledged}
	if patient:
		filters["patient"] = patient
	return envelope(frappe.get_all(
		"Clinical Alert",
		filters=filters,
		fields=["name", "patient", "patient_name", "severity", "message", "raised_on", "acknowledged"],
		order_by="raised_on desc",
		limit_page_length=100,
	))


@frappe.whitelist(methods=["POST"])
def acknowledge_alert(name: str):
	doc = frappe.get_doc("Clinical Alert", name)
	doc.check_permission("write")
	doc.acknowledged = 1
	doc.acknowledged_by = frappe.session.user
	doc.acknowledged_on = frappe.utils.now_datetime()
	doc.save()
	return envelope(doc.as_dict())


# --- Medical timeline ----------------------------------------------------------

@frappe.whitelist()
def medical_timeline(patient: str):
	"""Unified, chronologically-sorted feed across every clinical module for
	the Patient 360 "Overview"/EMR timeline widget."""
	require_doctype_permission("Patient", "read")
	events = []

	def add(kind, rows, date_field, label_field):
		for row in rows:
			events.append({
				"kind": kind,
				"date": str(row.get(date_field)),
				"label": row.get(label_field) or kind,
				"reference": row.get("name"),
			})

	if frappe.db.exists("DocType", "Patient Encounter"):
		add("consultation", frappe.get_all(
			"Patient Encounter", filters={"patient": patient},
			fields=["name", "encounter_date", "chief_complaint"], limit_page_length=100,
		), "encounter_date", "chief_complaint")

	if frappe.db.exists("DocType", "Patient Appointment"):
		add("appointment", frappe.get_all(
			"Patient Appointment", filters={"patient": patient},
			fields=["name", "appointment_date", "appointment_type"], limit_page_length=100,
		), "appointment_date", "appointment_type")

	if frappe.db.exists("DocType", "Lab Test"):
		add("lab", frappe.get_all(
			"Lab Test", filters={"patient": patient},
			fields=["name", "result_date", "template"], limit_page_length=100,
		), "result_date", "template")

	if frappe.db.exists("DocType", "Inpatient Record"):
		add("admission", frappe.get_all(
			"Inpatient Record", filters={"patient": patient},
			fields=["name", "scheduled_date", "status"], limit_page_length=100,
		), "scheduled_date", "status")

	events = [e for e in events if e["date"] and e["date"] != "None"]
	events.sort(key=lambda e: e["date"], reverse=True)
	return envelope(events)
