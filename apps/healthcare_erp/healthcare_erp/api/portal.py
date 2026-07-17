"""Module 14 — Patient Portal.

Every endpoint here resolves the *calling* user's own Patient record and
never accepts a `patient` argument from the client — the portal is a
strictly self-service surface. Record-level access still also flows
through the `Patient`-role User Permission (doc_events/patient.py), so
this is defense in depth, not the only gate.
"""

from __future__ import annotations

import frappe

from healthcare_erp.api.utils import envelope


def _current_patient() -> str:
	patient = frappe.db.get_value("Patient", {"user_id": frappe.session.user}, "name")
	if not patient:
		frappe.throw(frappe._("No patient record is linked to your account"), frappe.PermissionError)
	return patient


@frappe.whitelist()
def my_profile():
	patient = frappe.get_doc("Patient", _current_patient())
	return envelope(patient.as_dict())


@frappe.whitelist()
def my_appointments():
	patient = _current_patient()
	return envelope(frappe.get_all(
		"Patient Appointment", filters={"patient": patient},
		fields=["name", "practitioner", "department", "appointment_date", "appointment_time", "status", "appointment_type"],
		order_by="appointment_date desc", limit_page_length=100,
	))


@frappe.whitelist(methods=["POST"])
def book_appointment(practitioner: str, appointment_date: str, appointment_time: str, appointment_type: str | None = None):
	patient = _current_patient()
	appt = frappe.new_doc("Patient Appointment")
	appt.update({
		"patient": patient, "practitioner": practitioner, "appointment_date": appointment_date,
		"appointment_time": appointment_time, "appointment_type": appointment_type,
	})
	appt.insert()
	return envelope(appt.as_dict(), {"message": "Appointment booked"})


@frappe.whitelist(methods=["POST"])
def cancel_my_appointment(name: str):
	patient = _current_patient()
	doc = frappe.get_doc("Patient Appointment", name)
	if doc.patient != patient:
		frappe.throw(frappe._("Not your appointment"), frappe.PermissionError)
	doc.status = "Cancelled"
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist()
def my_medical_records():
	patient = _current_patient()
	if not frappe.db.exists("DocType", "Patient Encounter"):
		return envelope([])
	meta = frappe.get_meta("Patient Encounter")
	fields = ["name", "encounter_date", "practitioner", "docstatus"]
	if meta.get_field("chief_complaint"):
		fields += ["chief_complaint", "treatment_plan", "follow_up_date"]
	return envelope(frappe.get_all(
		"Patient Encounter", filters={"patient": patient, "docstatus": 1}, fields=fields,
		order_by="encounter_date desc", limit_page_length=100,
	))


@frappe.whitelist()
def my_prescriptions():
	patient = _current_patient()
	if not frappe.db.exists("DocType", "Prescription Refill"):
		return envelope([])
	return envelope(frappe.get_all(
		"Prescription Refill", filters={"patient": patient},
		fields=["name", "drug_name", "dosage", "frequency", "refills_allowed", "refills_used", "status"],
		order_by="creation desc", limit_page_length=100,
	))


@frappe.whitelist()
def my_lab_results():
	patient = _current_patient()
	if not frappe.db.exists("DocType", "Lab Test"):
		return envelope([])
	return envelope(frappe.get_all(
		"Lab Test", filters={"patient": patient, "status": "Approved"},
		fields=["name", "template", "result_value", "normal_range", "result_date"],
		order_by="result_date desc", limit_page_length=100,
	))


@frappe.whitelist()
def my_radiology_reports():
	patient = _current_patient()
	if not frappe.db.exists("DocType", "Radiology Report"):
		return envelope([])
	return envelope(frappe.get_all(
		"Radiology Report", filters={"patient": patient, "status": "Final"},
		fields=["name", "radiology_order", "findings", "impression", "reported_on"],
		order_by="reported_on desc", limit_page_length=100,
	))


@frappe.whitelist()
def my_invoices():
	patient = _current_patient()
	if not frappe.db.exists("DocType", "Sales Invoice"):
		return envelope([])
	meta = frappe.get_meta("Sales Invoice")
	filters = {"patient": patient} if meta.get_field("patient") else {"customer": patient}
	return envelope(frappe.get_all(
		"Sales Invoice", filters=filters,
		fields=["name", "posting_date", "grand_total", "outstanding_amount", "status"],
		order_by="posting_date desc", limit_page_length=100,
	))


@frappe.whitelist()
def my_documents():
	patient = _current_patient()
	return envelope(frappe.get_all(
		"File", filters={"attached_to_doctype": "Patient", "attached_to_name": patient},
		fields=["name", "file_name", "file_url", "file_size", "creation"],
		order_by="creation desc", limit_page_length=100,
	))
