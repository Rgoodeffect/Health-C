"""Module 5 — Prescription Management.

`Drug Prescription` (a child table of core `Patient Encounter`) already
carries the actual prescribed-drug rows; this module adds drug search,
allergy/interaction checking ahead of prescribing, refill tracking, and
the data endpoint behind the printable prescription view.
"""

from __future__ import annotations

import frappe
from frappe.utils import add_days, today

from healthcare_erp.api.utils import envelope, require_doctype_permission


@frappe.whitelist()
def drug_search(query: str = "", limit: int = 20):
	filters = {"disabled": 0}
	if frappe.get_meta("Item").get_field("is_stock_item"):
		filters["is_stock_item"] = 1
	rows = frappe.get_all(
		"Item",
		filters=filters,
		or_filters={"item_name": ["like", f"%{query}%"], "item_code": ["like", f"%{query}%"]} if query else None,
		fields=["name as item_code", "item_name", "item_group", "stock_uom"],
		limit_page_length=limit,
	)
	return envelope(rows)


@frappe.whitelist()
def check_allergy_conflict(patient: str, drug: str):
	"""Heuristic substring match between the patient's recorded allergens and
	the drug name/code — flags a possible conflict for pharmacist/doctor
	review rather than silently blocking (real allergen<->drug ontology
	mapping is out of scope for a local demo dataset)."""
	if not frappe.db.exists("DocType", "Patient Allergy"):
		return envelope({"conflict": False, "matches": []})

	allergies = frappe.get_all(
		"Patient Allergy", filters={"parent": patient, "parenttype": "Patient"},
		fields=["allergen", "reaction", "severity"],
	)
	drug_name = (frappe.db.get_value("Item", drug, "item_name") or drug).lower()

	matches = [a for a in allergies if a.allergen.lower() in drug_name or drug_name in a.allergen.lower()]
	return envelope({"conflict": bool(matches), "matches": matches})


@frappe.whitelist()
def check_drug_interactions(drugs):
	"""`drugs`: list (or JSON-encoded list) of Item codes already on / about
	to be added to the patient's regimen."""
	import json
	if isinstance(drugs, str):
		drugs = json.loads(drugs)
	if not drugs or len(drugs) < 2:
		return envelope([])

	rules = frappe.get_all(
		"Drug Interaction Rule",
		filters={"drug_a": ["in", drugs]},
		or_filters=None,
		fields=["name", "drug_a", "drug_b", "severity", "description"],
	) + frappe.get_all(
		"Drug Interaction Rule",
		filters={"drug_b": ["in", drugs]},
		fields=["name", "drug_a", "drug_b", "severity", "description"],
	)

	drug_set = set(drugs)
	conflicts = [r for r in rules if r.drug_a in drug_set and r.drug_b in drug_set]
	return envelope(conflicts)


@frappe.whitelist(methods=["POST"])
def prescribe(encounter: str, drug: str, dosage: str, frequency: str, duration: str | None = None,
			  refills_allowed: int = 0, comment: str | None = None):
	require_doctype_permission("Patient Encounter", "write")
	enc = frappe.get_doc("Patient Encounter", encounter)
	enc.check_permission("write")

	drug_name = frappe.db.get_value("Item", drug, "item_name") or drug
	enc.append("drug_prescription", {
		"drug_code": drug,
		"drug_name": drug_name,
		"dosage": dosage,
		"period": duration,
		"comment": comment,
	})
	enc.save()

	refill = frappe.get_doc({
		"doctype": "Prescription Refill",
		"patient": enc.patient,
		"drug": drug,
		"original_encounter": encounter,
		"dosage": dosage,
		"frequency": frequency,
		"refills_allowed": refills_allowed,
	})
	refill.insert()

	return envelope({"encounter": enc.as_dict(), "refill": refill.as_dict()}, {"message": "Prescription added"})


@frappe.whitelist()
def list_prescriptions(patient: str):
	require_doctype_permission("Prescription Refill", "read")
	return envelope(frappe.get_all(
		"Prescription Refill",
		filters={"patient": patient},
		fields=["name", "drug", "drug_name", "dosage", "frequency", "refills_allowed",
				"refills_used", "last_refill_date", "next_refill_due", "status", "original_encounter"],
		order_by="creation desc",
		limit_page_length=100,
	))


@frappe.whitelist(methods=["POST"])
def request_refill(name: str):
	doc = frappe.get_doc("Prescription Refill", name)
	doc.check_permission("write")
	if doc.status != "Active":
		frappe.throw(frappe._("This prescription is no longer active"))
	if doc.refills_used >= doc.refills_allowed:
		frappe.throw(frappe._("No refills remaining — a new consultation is required"))

	doc.refills_used += 1
	doc.last_refill_date = today()
	doc.next_refill_due = add_days(today(), 30)
	if doc.refills_used >= doc.refills_allowed:
		doc.status = "Completed"
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist()
def printable_prescription(encounter: str):
	"""Structured payload the frontend renders into a print-friendly view."""
	enc = frappe.get_doc("Patient Encounter", encounter)
	enc.check_permission("read")
	patient = frappe.get_doc("Patient", enc.patient)
	practitioner_name = frappe.db.get_value("Healthcare Practitioner", enc.practitioner, "practitioner_name") if enc.practitioner else None

	return envelope({
		"encounter": enc.name,
		"encounter_date": str(enc.encounter_date),
		"patient_name": patient.patient_name,
		"patient_mrn": patient.name,
		"patient_age_sex": f"{patient.sex or ''}".strip(),
		"practitioner_name": practitioner_name or enc.practitioner,
		"diagnosis": enc.get("primary_diagnosis_code"),
		"drugs": [
			{
				"drug_name": row.drug_name,
				"dosage": row.dosage,
				"period": row.period,
				"comment": row.comment,
			}
			for row in enc.get("drug_prescription") or []
		],
	})
