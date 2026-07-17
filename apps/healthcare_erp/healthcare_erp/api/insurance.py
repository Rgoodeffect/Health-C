"""Module 12 — Insurance Management.

`Healthcare Insurance Company` / `Healthcare Insurance Coverage Plan` are
ERPNext core; healthcare_erp adds pre-authorization, claims, rejections/
resubmission, and settlement tracking on top.
"""

from __future__ import annotations

import frappe
from frappe.utils import today

from healthcare_erp.api.utils import envelope, require_doctype_permission


@frappe.whitelist()
def list_companies():
	return envelope(frappe.get_all("Healthcare Insurance Company", fields=["name", "insurance_company_name" if frappe.get_meta("Healthcare Insurance Company").get_field("insurance_company_name") else "name"], limit_page_length=200))


@frappe.whitelist()
def list_plans(insurance_company: str | None = None):
	filters = {"insurance_company": insurance_company} if insurance_company else {}
	meta = frappe.get_meta("Healthcare Insurance Coverage Plan")
	fields = ["name"]
	for optional in ("coverage_plan_name", "insurance_company", "is_active"):
		if meta.get_field(optional):
			fields.append(optional)
	return envelope(frappe.get_all("Healthcare Insurance Coverage Plan", filters=filters, fields=fields, limit_page_length=200))


@frappe.whitelist(methods=["POST"])
def verify_eligibility(patient: str, insurance_company: str, coverage_plan: str | None = None):
	"""Without a live payer/clearinghouse connection this validates that the
	patient's on-file insurance matches what's being billed against, and
	flips `Patient.insurance_verified` so reception/billing see it's been
	checked today. A real eligibility switch (270/271 EDI or payer API)
	would replace the match check below with an actual real-time call."""
	patient_doc = frappe.get_doc("Patient", patient)
	matches = patient_doc.get("primary_insurance_company") == insurance_company
	if coverage_plan:
		matches = matches and patient_doc.get("coverage_plan") == coverage_plan

	if matches:
		patient_doc.db_set("insurance_verified", 1)

	return envelope({
		"eligible": bool(matches),
		"insurance_company": insurance_company,
		"coverage_plan": coverage_plan,
		"checked_on": today(),
	})


# --- Pre-authorization --------------------------------------------------------

@frappe.whitelist(methods=["POST"])
def request_pre_authorization(patient: str, insurance_company: str, procedure_or_service: str,
							   coverage_plan: str | None = None, estimated_cost: float | None = None):
	require_doctype_permission("Insurance Pre Authorization", "create")
	doc = frappe.get_doc({
		"doctype": "Insurance Pre Authorization", "patient": patient, "insurance_company": insurance_company,
		"coverage_plan": coverage_plan, "procedure_or_service": procedure_or_service, "estimated_cost": estimated_cost,
	})
	doc.insert()
	return envelope(doc.as_dict(), {"message": "Pre-authorization requested"})


@frappe.whitelist(methods=["POST"])
def update_pre_authorization(name: str, status: str, auth_number: str | None = None, valid_until: str | None = None):
	doc = frappe.get_doc("Insurance Pre Authorization", name)
	doc.check_permission("write")
	doc.status = status
	doc.auth_number = auth_number
	doc.valid_until = valid_until
	doc.save()
	return envelope(doc.as_dict())


@frappe.whitelist()
def list_pre_authorizations(patient: str | None = None, status: str | None = None):
	require_doctype_permission("Insurance Pre Authorization", "read")
	filters = {}
	if patient:
		filters["patient"] = patient
	if status:
		filters["status"] = status
	return envelope(frappe.get_all(
		"Insurance Pre Authorization", filters=filters,
		fields=["name", "patient", "insurance_company", "procedure_or_service", "estimated_cost", "status", "auth_number", "requested_date"],
		order_by="creation desc", limit_page_length=200,
	))


# --- Claims --------------------------------------------------------------

@frappe.whitelist(methods=["POST"])
def create_claim(patient: str, insurance_company: str, claim_amount: float, coverage_type: str = "Full Coverage",
				  coverage_plan: str | None = None, invoice: str | None = None, pre_authorization: str | None = None):
	require_doctype_permission("Insurance Claim", "create")
	doc = frappe.get_doc({
		"doctype": "Insurance Claim", "patient": patient, "insurance_company": insurance_company,
		"coverage_plan": coverage_plan, "invoice": invoice, "pre_authorization": pre_authorization,
		"claim_amount": claim_amount, "coverage_type": coverage_type,
	})
	doc.insert()
	return envelope(doc.as_dict(), {"message": "Claim created"})


@frappe.whitelist(methods=["POST"])
def submit_claim(name: str):
	doc = frappe.get_doc("Insurance Claim", name)
	doc.check_permission("write")
	doc.status = "Submitted"
	doc.submitted_on = today()
	doc.save()
	return envelope(doc.as_dict(), {"message": "Claim submitted"})


@frappe.whitelist()
def list_claims(patient: str | None = None, status: str | None = None):
	require_doctype_permission("Insurance Claim", "read")
	filters = {}
	if patient:
		filters["patient"] = patient
	if status:
		filters["status"] = status
	return envelope(frappe.get_all(
		"Insurance Claim", filters=filters,
		fields=["name", "patient", "insurance_company", "coverage_type", "claim_amount",
				"approved_amount", "status", "submitted_on"],
		order_by="creation desc", limit_page_length=200,
	))


@frappe.whitelist(methods=["POST"])
def reject_claim(claim: str, reason: str):
	doc = frappe.get_doc("Insurance Claim", claim)
	doc.check_permission("write")
	doc.status = "Rejected"
	doc.save()

	rejection = frappe.get_doc({"doctype": "Insurance Claim Rejection", "claim": claim, "reason": reason})
	rejection.insert()
	return envelope(rejection.as_dict(), {"message": "Claim rejected"})


@frappe.whitelist(methods=["POST"])
def resubmit_claim(rejection: str):
	rejection_doc = frappe.get_doc("Insurance Claim Rejection", rejection)
	rejection_doc.check_permission("write")
	rejection_doc.resubmission_count = (rejection_doc.resubmission_count or 0) + 1
	rejection_doc.status = "Resubmitted"
	rejection_doc.save()

	frappe.db.set_value("Insurance Claim", rejection_doc.claim, {"status": "Submitted", "submitted_on": today()})
	return envelope(rejection_doc.as_dict(), {"message": "Claim resubmitted"})


@frappe.whitelist()
def list_rejections(status: str | None = None):
	require_doctype_permission("Insurance Claim Rejection", "read")
	filters = {"status": status} if status else {}
	return envelope(frappe.get_all(
		"Insurance Claim Rejection", filters=filters,
		fields=["name", "claim", "reason", "rejected_on", "resubmission_count", "status"],
		order_by="rejected_on desc", limit_page_length=200,
	))


# --- Settlement ------------------------------------------------------------

@frappe.whitelist(methods=["POST"])
def settle_claim(claim: str, settled_amount: float, payment_reference: str | None = None):
	require_doctype_permission("Insurance Settlement", "create")
	claim_doc = frappe.get_doc("Insurance Claim", claim)
	claim_doc.check_permission("write")
	claim_doc.status = "Settled"
	claim_doc.approved_amount = settled_amount
	claim_doc.save()

	settlement = frappe.get_doc({
		"doctype": "Insurance Settlement", "claim": claim, "settled_amount": settled_amount,
		"payment_reference": payment_reference, "status": "Received",
	})
	settlement.insert()
	return envelope(settlement.as_dict(), {"message": "Claim settled"})


@frappe.whitelist()
def list_settlements():
	require_doctype_permission("Insurance Settlement", "read")
	return envelope(frappe.get_all(
		"Insurance Settlement",
		fields=["name", "claim", "settled_amount", "settlement_date", "payment_reference", "status"],
		order_by="settlement_date desc", limit_page_length=200,
	))
