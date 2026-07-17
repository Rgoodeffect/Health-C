"""Module 6 — Laboratory Information System (LIS).

`Lab Test` / `Lab Test Template` / `Sample Collection` are ERPNext core;
healthcare_erp adds barcode labels, QC runs, an analyzer-integration inbox,
and critical-result alerting on top.
"""

from __future__ import annotations

import io
import json

import frappe
from frappe.utils import now_datetime

from healthcare_erp.api.utils import envelope, require_doctype_permission, set_if_field_exists

ORDER_FIELDS = [
	"name", "patient", "patient_name", "template", "practitioner", "status",
	"result_date", "result_value", "has_critical_result",
]


@frappe.whitelist()
def list_orders(status: str | None = None, patient: str | None = None):
	require_doctype_permission("Lab Test", "read")
	filters = {}
	if status:
		filters["status"] = status
	if patient:
		filters["patient"] = patient
	return envelope(frappe.get_all(
		"Lab Test", filters=filters, fields=ORDER_FIELDS,
		order_by="creation desc", limit_page_length=200,
	))


@frappe.whitelist(methods=["POST"])
def create_order(patient: str, template: str, practitioner: str | None = None):
	require_doctype_permission("Lab Test", "create")
	doc = frappe.new_doc("Lab Test")
	set_if_field_exists(doc, {"patient": patient, "template": template, "practitioner": practitioner})
	doc.insert()
	return envelope(doc.as_dict(), {"message": "Lab order created"})


@frappe.whitelist(methods=["POST"])
def collect_sample(lab_test: str):
	require_doctype_permission("Sample Collection", "create")
	test = frappe.get_doc("Lab Test", lab_test)
	test.check_permission("write")

	sample = frappe.new_doc("Sample Collection")
	set_if_field_exists(sample, {
		"patient": test.patient,
		"collected_by": frappe.session.user,
		"collected_time": now_datetime(),
	})
	sample.insert()

	barcode_value = f"SMP-{lab_test[-6:].upper()}-{frappe.generate_hash(length=4).upper()}"
	label = frappe.get_doc({
		"doctype": "Sample Barcode Label",
		"barcode": barcode_value,
		"lab_test": lab_test,
		"sample_collection": sample.name,
	})
	label.insert()
	_generate_barcode_image(label, barcode_value)

	set_if_field_exists(test, {"status": "Sample Collected"})
	test.save()

	return envelope({"sample": sample.as_dict(), "label": label.as_dict()}, {"message": "Sample collected"})


def _generate_barcode_image(label_doc, value: str):
	"""Render + attach the Code128 barcode image after the label document
	exists (mirrors the Patient QR generation pattern in doc_events/patient.py)."""
	try:
		import barcode
		from barcode.writer import ImageWriter
	except ImportError:
		frappe.log_error("python-barcode not installed", "Sample barcode generation skipped")
		return

	code128 = barcode.get("code128", value, writer=ImageWriter())
	buffer = io.BytesIO()
	code128.write(buffer, options={"write_text": True})
	buffer.seek(0)

	from frappe.utils.file_manager import save_file
	file_doc = save_file(
		fname=f"{value}.png", content=buffer.read(),
		dt="Sample Barcode Label", dn=label_doc.name, is_private=0,
	)
	frappe.db.set_value("Sample Barcode Label", label_doc.name, "barcode_image", file_doc.file_url)


@frappe.whitelist(methods=["POST"])
def enter_result(lab_test: str, result_value: str, normal_range: str | None = None, has_critical_result: int = 0, critical_result_notes: str | None = None):
	doc = frappe.get_doc("Lab Test", lab_test)
	doc.check_permission("write")
	set_if_field_exists(doc, {
		"result_value": result_value,
		"normal_range": normal_range,
		"has_critical_result": has_critical_result,
		"critical_result_notes": critical_result_notes,
		"status": "Approved" if not has_critical_result else "To Review",
		"result_date": frappe.utils.today(),
	})
	doc.save()

	if int(has_critical_result or 0):
		frappe.get_doc({
			"doctype": "Clinical Alert",
			"patient": doc.patient,
			"severity": "Critical",
			"message": frappe._("Critical lab result for {0}: {1}").format(doc.template, critical_result_notes or result_value),
			"source_doctype": "Lab Test",
			"source_name": doc.name,
		}).insert(ignore_permissions=True)
		frappe.publish_realtime("critical_lab_result", {"lab_test": doc.name, "patient": doc.patient})

	return envelope(doc.as_dict(), {"message": "Result recorded"})


@frappe.whitelist(methods=["POST"])
def verify_result(lab_test: str):
	doc = frappe.get_doc("Lab Test", lab_test)
	doc.check_permission("write")
	set_if_field_exists(doc, {
		"status": "Approved",
		"verified_by": frappe.session.user,
		"verified_on": now_datetime(),
	})
	doc.save()
	return envelope(doc.as_dict(), {"message": "Result verified"})


@frappe.whitelist()
def list_critical_results():
	require_doctype_permission("Lab Test", "read")
	if not frappe.get_meta("Lab Test").get_field("has_critical_result"):
		return envelope([])
	return envelope(frappe.get_all(
		"Lab Test",
		filters={"has_critical_result": 1, "status": ["!=", "Approved"]},
		fields=ORDER_FIELDS,
		order_by="modified desc",
		limit_page_length=100,
	))


# --- QC ------------------------------------------------------------------

@frappe.whitelist()
def list_qc_runs(test_template: str | None = None):
	require_doctype_permission("Lab QC Run", "read")
	filters = {"test_template": test_template} if test_template else {}
	return envelope(frappe.get_all(
		"Lab QC Run", filters=filters,
		fields=["name", "analyzer", "test_template", "control_level", "expected_value",
				"measured_value", "within_range", "run_by", "run_on"],
		order_by="run_on desc", limit_page_length=100,
	))


@frappe.whitelist(methods=["POST"])
def record_qc_run(**payload):
	require_doctype_permission("Lab QC Run", "create")
	doc = frappe.new_doc("Lab QC Run")
	doc.update({
		"analyzer": payload.get("analyzer"),
		"test_template": payload.get("test_template"),
		"control_level": payload.get("control_level"),
		"expected_value": payload.get("expected_value"),
		"measured_value": payload.get("measured_value"),
		"notes": payload.get("notes"),
	})
	doc.insert()
	return envelope(doc.as_dict())


# --- Analyzer integration inbox -------------------------------------------

@frappe.whitelist(methods=["POST"], allow_guest=False)
def ingest_analyzer_result(sample_barcode: str, test_code: str, result_value: str, raw_payload: dict | str | None = None):
	"""Endpoint an analyzer interface (or its middleware) posts results to.
	Kept append-only + reviewed by a technician rather than auto-writing to
	Lab Test, so a malformed analyzer payload can never silently corrupt a
	patient record."""
	entry = frappe.get_doc({
		"doctype": "Analyzer Result Inbox",
		"sample_barcode": sample_barcode,
		"test_code": test_code,
		"result_value": result_value,
		"raw_payload": json.dumps(raw_payload) if isinstance(raw_payload, dict) else raw_payload,
	})
	entry.insert(ignore_permissions=True)
	return envelope(entry.as_dict(), {"message": "Result queued for technician review"})


@frappe.whitelist()
def list_analyzer_inbox(status: str = "Pending"):
	require_doctype_permission("Analyzer Result Inbox", "read")
	return envelope(frappe.get_all(
		"Analyzer Result Inbox", filters={"status": status},
		fields=["name", "sample_barcode", "test_code", "result_value", "received_on", "status"],
		order_by="received_on desc", limit_page_length=100,
	))


@frappe.whitelist(methods=["POST"])
def match_inbox_to_order(inbox_name: str, lab_test: str):
	inbox = frappe.get_doc("Analyzer Result Inbox", inbox_name)
	inbox.check_permission("write")
	label = frappe.db.get_value("Sample Barcode Label", {"barcode": inbox.sample_barcode}, "lab_test")
	if label and label != lab_test:
		frappe.throw(frappe._("This barcode belongs to a different lab test"))

	enter_result(lab_test=lab_test, result_value=inbox.result_value)
	inbox.status = "Matched"
	inbox.lab_test = lab_test
	inbox.save()
	return envelope(inbox.as_dict())
