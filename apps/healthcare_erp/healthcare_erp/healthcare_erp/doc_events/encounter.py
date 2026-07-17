from __future__ import annotations

import frappe


def on_submit(doc, method=None):
	"""When a doctor signs off a consultation: clear the reception queue
	token that brought the patient in, and raise a Clinical Alert if the
	free-text clinical notes call out something urgent."""
	frappe.db.set_value(
		"Reception Queue Token",
		{"patient": doc.patient, "status": ["in", ["Called", "In Consultation"]]},
		{"status": "Completed"},
	)

	notes = " ".join(filter(None, [doc.get("chief_complaint"), doc.get("clinical_notes")])).lower()
	if any(keyword in notes for keyword in ("urgent", "critical", "emergency")):
		frappe.get_doc({
			"doctype": "Clinical Alert",
			"patient": doc.patient,
			"severity": "Critical",
			"message": frappe._("Consultation on {0} flagged urgent language for follow-up").format(doc.encounter_date),
			"source_doctype": "Patient Encounter",
			"source_name": doc.name,
		}).insert(ignore_permissions=True)
