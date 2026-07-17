"""Module 1 — Patient Registration & Patient 360 Profile API.

Backs both the Reception "register patient" screen and the Patient 360
profile's tabs (Overview / Appointments / Consultations / Prescriptions /
Lab / Radiology / Admissions / Surgery / Billing / Insurance / Documents).

Tab data intentionally reads straight from the core ERPNext Healthcare
doctypes (Patient Appointment, Patient Encounter, Lab Test, Clinical
Procedure, Inpatient Record, Sales Invoice, ...) rather than duplicating
that data — Module 1 is the aggregation point, later modules only add
richer detail screens that these summaries deep-link into.
"""

from __future__ import annotations

import frappe
from frappe.utils import getdate, today

from healthcare_erp.api.utils import envelope, paginated_list, require_doctype_permission

PATIENT_LIST_FIELDS = [
	"name", "patient_name", "sex", "dob", "mobile", "email", "status",
	"national_id", "primary_insurance_company", "insurance_verified", "image", "qr_code",
]


@frappe.whitelist()
def list_patients():
	return paginated_list("Patient", PATIENT_LIST_FIELDS, default_order_by="creation desc")


@frappe.whitelist()
def get_patient(patient: str):
	require_doctype_permission("Patient", "read")
	doc = frappe.get_doc("Patient", patient)
	doc.check_permission("read")
	data = doc.as_dict()
	data["age"] = _calculate_age(doc.dob) if doc.dob else None
	return envelope(data)


@frappe.whitelist(methods=["POST"])
def create_patient(**payload):
	require_doctype_permission("Patient", "create")

	patient = frappe.new_doc("Patient")
	patient.update({
		"first_name": payload.get("first_name"),
		"last_name": payload.get("last_name"),
		"sex": payload.get("sex"),
		"dob": payload.get("dob"),
		"mobile": payload.get("mobile"),
		"email": payload.get("email"),
		"blood_group": payload.get("blood_group"),
		"national_id": payload.get("national_id"),
		"passport_no": payload.get("passport_no"),
		"primary_insurance_company": payload.get("primary_insurance_company"),
		"primary_policy_number": payload.get("primary_policy_number"),
		"coverage_plan": payload.get("coverage_plan"),
	})

	for contact in payload.get("emergency_contacts", []):
		patient.append("patient_relation", {
			"relation": contact.get("relation"),
			"name_": contact.get("name"),
			"phone_no": contact.get("phone"),
		})

	patient.insert()
	return envelope(patient.as_dict(), {"message": "Patient registered"})


@frappe.whitelist(methods=["PUT", "POST"])
def update_patient(patient: str, **payload):
	doc = frappe.get_doc("Patient", patient)
	doc.check_permission("write")
	allowed_fields = {
		"mobile", "email", "blood_group", "national_id", "passport_no",
		"primary_insurance_company", "primary_policy_number", "coverage_plan",
		"insurance_verified", "status",
	}
	for field, value in payload.items():
		if field in allowed_fields:
			doc.set(field, value)
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist()
def patient_360(patient: str):
	doc = frappe.get_doc("Patient", patient)
	doc.check_permission("read")

	return envelope({
		"overview": _overview(doc),
		"appointments": _appointments(patient),
		"consultations": _consultations(patient),
		"prescriptions": _prescriptions(patient),
		"lab": _lab(patient),
		"radiology": _radiology(patient),
		"admissions": _admissions(patient),
		"surgery": _surgery(patient),
		"billing": _billing(patient),
		"insurance": _insurance(doc),
		"documents": _documents(patient),
	})


def _overview(doc):
	allergies = frappe.get_all(
		"Patient", filters={"name": doc.name}, fields=["allergies"],
	) if frappe.get_meta("Patient").get_field("allergies") else []
	return {
		"patient_name": doc.patient_name,
		"mrn": doc.name,
		"sex": doc.sex,
		"dob": doc.dob,
		"age": _calculate_age(doc.dob) if doc.dob else None,
		"blood_group": doc.blood_group,
		"mobile": doc.mobile,
		"email": doc.email,
		"national_id": doc.national_id,
		"passport_no": doc.passport_no,
		"qr_code": doc.qr_code,
		"image": doc.image,
		"status": doc.status,
		"allergies": allergies,
	}


def _appointments(patient):
	if not frappe.db.exists("DocType", "Patient Appointment"):
		return []
	return frappe.get_all(
		"Patient Appointment",
		filters={"patient": patient},
		fields=["name", "appointment_date", "appointment_time", "practitioner",
				"department", "status", "appointment_type"],
		order_by="appointment_date desc",
		limit_page_length=50,
	)


def _consultations(patient):
	if not frappe.db.exists("DocType", "Patient Encounter"):
		return []
	# `chief_complaint`/`primary_diagnosis_code` are healthcare_erp Custom Fields
	# (Module 4) — core Patient Encounter stores these as child tables (Symptom/
	# Diagnosis), which frappe.get_all cannot select directly, so we don't rely
	# on their exact core schema here.
	fields = ["name", "encounter_date", "practitioner", "docstatus"]
	meta = frappe.get_meta("Patient Encounter")
	if meta.get_field("chief_complaint"):
		fields.append("chief_complaint")
	if meta.get_field("primary_diagnosis_code"):
		fields.append("primary_diagnosis_code as diagnosis")

	return frappe.get_all(
		"Patient Encounter",
		filters={"patient": patient},
		fields=fields,
		order_by="encounter_date desc",
		limit_page_length=50,
	)


def _prescriptions(patient):
	if not frappe.db.exists("DocType", "Patient Encounter"):
		return []
	encounters = frappe.get_all("Patient Encounter", filters={"patient": patient}, pluck="name")
	if not encounters:
		return []
	return frappe.get_all(
		"Drug Prescription",
		filters={"parent": ["in", encounters]},
		fields=["parent", "drug_name", "dosage", "period", "comment"],
		limit_page_length=100,
	)


def _lab(patient):
	if not frappe.db.exists("DocType", "Lab Test"):
		return []
	return frappe.get_all(
		"Lab Test",
		filters={"patient": patient},
		fields=["name", "template", "status", "result_date", "practitioner"],
		order_by="creation desc",
		limit_page_length=50,
	)


def _radiology(patient):
	if not frappe.db.exists("DocType", "Radiology Order"):
		return []
	return frappe.get_all(
		"Radiology Order",
		filters={"patient": patient},
		fields=["name", "modality", "status", "order_date", "critical_finding"],
		order_by="creation desc",
		limit_page_length=50,
	)


def _admissions(patient):
	if not frappe.db.exists("DocType", "Inpatient Record"):
		return []
	return frappe.get_all(
		"Inpatient Record",
		filters={"patient": patient},
		fields=["name", "status", "scheduled_date", "expected_discharge", "admitted_datetime"],
		order_by="creation desc",
		limit_page_length=20,
	)


def _surgery(patient):
	if not frappe.db.exists("DocType", "Surgery Request"):
		return []
	return frappe.get_all(
		"Surgery Request",
		filters={"patient": patient},
		fields=["name", "procedure", "status", "requested_date"],
		order_by="creation desc",
		limit_page_length=20,
	)


def _billing(patient):
	if not frappe.db.exists("DocType", "Sales Invoice"):
		return []
	return frappe.get_all(
		"Sales Invoice",
		filters={"patient": patient} if frappe.get_meta("Sales Invoice").get_field("patient") else {"customer": patient},
		fields=["name", "posting_date", "grand_total", "outstanding_amount", "status"],
		order_by="posting_date desc",
		limit_page_length=50,
	)


def _insurance(doc):
	return {
		"primary_insurance_company": doc.primary_insurance_company,
		"primary_policy_number": doc.primary_policy_number,
		"coverage_plan": doc.coverage_plan,
		"insurance_verified": doc.insurance_verified,
		"claims": frappe.get_all(
			"Insurance Claim",
			filters={"patient": doc.name},
			fields=["name", "status", "claim_amount", "approved_amount", "submitted_on"],
			order_by="creation desc",
			limit_page_length=20,
		) if frappe.db.exists("DocType", "Insurance Claim") else [],
	}


def _documents(patient):
	return frappe.get_all(
		"File",
		filters={"attached_to_doctype": "Patient", "attached_to_name": patient},
		fields=["name", "file_name", "file_url", "file_size", "creation", "is_private"],
		order_by="creation desc",
		limit_page_length=100,
	)


def _calculate_age(dob) -> str:
	dob = getdate(dob)
	now = getdate(today())
	years = now.year - dob.year - ((now.month, now.day) < (dob.month, dob.day))
	return f"{years}y"
