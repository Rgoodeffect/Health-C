"""Module 7 — Radiology Information System (RIS).

Radiology Order/Report/Modality/PACS Study Reference are new doctypes (no
core ERPNext equivalent) — see docs/ARCHITECTURE.md's module map.
"""

from __future__ import annotations

import frappe

from healthcare_erp.api.utils import envelope, require_doctype_permission

ORDER_FIELDS = [
	"name", "patient", "patient_name", "practitioner", "modality", "body_part",
	"priority", "order_date", "scheduled_datetime", "status", "critical_finding",
]


@frappe.whitelist()
def list_orders(status: str | None = None, patient: str | None = None):
	require_doctype_permission("Radiology Order", "read")
	filters = {}
	if status:
		filters["status"] = status
	if patient:
		filters["patient"] = patient
	return envelope(frappe.get_all(
		"Radiology Order", filters=filters, fields=ORDER_FIELDS,
		order_by="creation desc", limit_page_length=200,
	))


@frappe.whitelist(methods=["POST"])
def create_order(patient: str, modality: str, body_part: str | None = None, practitioner: str | None = None,
				  priority: str = "Routine", clinical_indication: str | None = None):
	require_doctype_permission("Radiology Order", "create")
	doc = frappe.new_doc("Radiology Order")
	doc.update({
		"patient": patient,
		"modality": modality,
		"body_part": body_part,
		"practitioner": practitioner,
		"priority": priority,
		"clinical_indication": clinical_indication,
	})
	doc.insert()
	return envelope(doc.as_dict(), {"message": "Imaging order created"})


@frappe.whitelist(methods=["POST"])
def schedule_order(name: str, scheduled_datetime: str):
	doc = frappe.get_doc("Radiology Order", name)
	doc.check_permission("write")
	doc.scheduled_datetime = scheduled_datetime
	doc.status = "Scheduled"
	doc.save()
	return envelope(doc.as_dict(), {"message": "Imaging order scheduled"})


@frappe.whitelist(methods=["POST"])
def update_order_status(name: str, status: str):
	doc = frappe.get_doc("Radiology Order", name)
	doc.check_permission("write")
	doc.status = status
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist(methods=["POST"])
def create_report(radiology_order: str, findings: str, impression: str,
				   critical_finding: int = 0, critical_finding_notes: str | None = None, status: str = "Final"):
	require_doctype_permission("Radiology Report", "create")
	order = frappe.get_doc("Radiology Order", radiology_order)
	order.check_permission("write")

	report = frappe.get_doc({
		"doctype": "Radiology Report",
		"radiology_order": radiology_order,
		"findings": findings,
		"impression": impression,
		"critical_finding": critical_finding,
		"critical_finding_notes": critical_finding_notes,
		"status": status,
	})
	report.insert()

	order.status = "Completed"
	order.critical_finding = critical_finding
	order.save()

	if int(critical_finding or 0):
		frappe.get_doc({
			"doctype": "Clinical Alert",
			"patient": order.patient,
			"severity": "Critical",
			"message": frappe._("Critical radiology finding ({0}): {1}").format(order.modality, critical_finding_notes or impression),
			"source_doctype": "Radiology Report",
			"source_name": report.name,
		}).insert(ignore_permissions=True)
		frappe.publish_realtime("critical_radiology_finding", {"order": order.name, "patient": order.patient})

	return envelope(report.as_dict(), {"message": "Report finalized"})


@frappe.whitelist()
def list_reports(patient: str | None = None, radiology_order: str | None = None):
	require_doctype_permission("Radiology Report", "read")
	filters = {}
	if patient:
		filters["patient"] = patient
	if radiology_order:
		filters["radiology_order"] = radiology_order
	return envelope(frappe.get_all(
		"Radiology Report", filters=filters,
		fields=["name", "radiology_order", "patient", "radiologist", "reported_on",
				"status", "findings", "impression", "critical_finding"],
		order_by="reported_on desc", limit_page_length=100,
	))


@frappe.whitelist()
def list_modalities():
	return envelope(frappe.get_all(
		"Modality", filters={"is_active": 1},
		fields=["modality_code", "modality_name", "service_unit"],
		order_by="modality_name asc", limit_page_length=100,
	))


@frappe.whitelist(methods=["POST"])
def create_modality(modality_code: str, modality_name: str, service_unit: str | None = None):
	require_doctype_permission("Modality", "create")
	doc = frappe.get_doc({
		"doctype": "Modality", "modality_code": modality_code,
		"modality_name": modality_name, "service_unit": service_unit,
	})
	doc.insert()
	return envelope(doc.as_dict())


# --- PACS-ready study reference --------------------------------------------

@frappe.whitelist(methods=["POST"])
def attach_pacs_reference(radiology_order: str, study_instance_uid: str, accession_number: str, pacs_viewer_url: str | None = None):
	"""Record the DICOM identifiers for a study performed on this order.

	A real PACS integration would call this from its worklist/HL7 feed once
	imaging is performed; until that's wired up, radiographers can enter it
	manually so the viewer deep-link is still available in the UI."""
	require_doctype_permission("PACS Study Reference", "create")
	doc = frappe.get_doc({
		"doctype": "PACS Study Reference",
		"accession_number": accession_number,
		"radiology_order": radiology_order,
		"study_instance_uid": study_instance_uid,
		"pacs_viewer_url": pacs_viewer_url,
	})
	doc.insert()
	return envelope(doc.as_dict())


@frappe.whitelist()
def get_pacs_reference(radiology_order: str):
	ref = frappe.db.get_value(
		"PACS Study Reference", {"radiology_order": radiology_order},
		["name", "accession_number", "study_instance_uid", "pacs_viewer_url"], as_dict=True,
	)
	return envelope(ref)
