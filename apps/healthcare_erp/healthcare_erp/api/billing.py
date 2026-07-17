"""Module 11 — Billing & Cashier.

`Sales Invoice` and `Payment Entry` are ERPNext core (Accounts module);
healthcare_erp adds Daily Cash Closing and a couple of POS-shaped
convenience endpoints (deposits, refunds, revenue summary) on top.
"""

from __future__ import annotations

import frappe
from frappe.utils import today

from healthcare_erp.api.utils import envelope, require_doctype_permission, set_if_field_exists

PAYMENT_MODES = ("Cash", "Card", "Bank Transfer", "Mobile Payment")


@frappe.whitelist()
def list_invoices(patient: str | None = None):
	require_doctype_permission("Sales Invoice", "read")
	meta = frappe.get_meta("Sales Invoice")
	filters = {}
	if patient:
		filters["patient" if meta.get_field("patient") else "customer"] = patient
	return envelope(frappe.get_all(
		"Sales Invoice", filters=filters,
		fields=["name", "posting_date", "grand_total", "outstanding_amount", "status", "customer"],
		order_by="posting_date desc", limit_page_length=200,
	))


@frappe.whitelist(methods=["POST"])
def create_invoice(patient: str, items, mode_of_payment: str | None = None, pay_immediately: bool = False):
	"""`items`: list of {item_code, qty, rate} (or JSON-encoded)."""
	import json
	if isinstance(items, str):
		items = json.loads(items)

	require_doctype_permission("Sales Invoice", "create")
	customer = _customer_for_patient(patient)

	invoice = frappe.new_doc("Sales Invoice")
	set_if_field_exists(invoice, {"patient": patient, "customer": customer})
	for item in items:
		invoice.append("items", {"item_code": item["item_code"], "qty": item["qty"], "rate": item.get("rate")})

	if pay_immediately and mode_of_payment:
		set_if_field_exists(invoice, {"is_pos": 1})
		invoice.append("payments", {"mode_of_payment": mode_of_payment, "amount": invoice.get("grand_total") or 0})

	invoice.insert()
	if pay_immediately:
		invoice.submit()

	return envelope(invoice.as_dict(), {"message": "Invoice created"})


@frappe.whitelist(methods=["POST"])
def record_payment(invoice: str, mode_of_payment: str, amount: float, reference_no: str | None = None):
	if mode_of_payment not in PAYMENT_MODES:
		frappe.throw(frappe._("Unsupported payment mode: {0}").format(mode_of_payment))

	inv = frappe.get_doc("Sales Invoice", invoice)
	inv.check_permission("read")

	payment = frappe.new_doc("Payment Entry")
	payment.update({
		"payment_type": "Receive",
		"party_type": "Customer",
		"party": inv.customer,
		"paid_amount": amount,
		"received_amount": amount,
		"mode_of_payment": mode_of_payment,
		"reference_no": reference_no,
		"reference_date": today(),
	})
	payment.append("references", {"reference_doctype": "Sales Invoice", "reference_name": invoice, "allocated_amount": amount})
	payment.insert()
	payment.submit()

	return envelope(payment.as_dict(), {"message": "Payment recorded"})


@frappe.whitelist(methods=["POST"])
def record_deposit(patient: str, amount: float, mode_of_payment: str):
	"""Unallocated advance payment — a deposit held against the patient's
	account until applied to a future invoice."""
	customer = _customer_for_patient(patient)
	payment = frappe.new_doc("Payment Entry")
	payment.update({
		"payment_type": "Receive", "party_type": "Customer", "party": customer,
		"paid_amount": amount, "received_amount": amount, "mode_of_payment": mode_of_payment,
	})
	payment.insert()
	payment.submit()
	return envelope(payment.as_dict(), {"message": "Deposit recorded"})


@frappe.whitelist(methods=["POST"])
def record_refund(payment_entry: str, amount: float, reason: str):
	original = frappe.get_doc("Payment Entry", payment_entry)
	original.check_permission("read")

	refund = frappe.new_doc("Payment Entry")
	refund.update({
		"payment_type": "Pay", "party_type": original.party_type, "party": original.party,
		"paid_amount": amount, "received_amount": amount, "mode_of_payment": original.mode_of_payment,
	})
	refund.insert()
	refund.submit()
	refund.add_comment("Comment", frappe._("Refund reason: {0}").format(reason))
	return envelope(refund.as_dict(), {"message": "Refund processed"})


@frappe.whitelist()
def revenue_summary(from_date: str | None = None, to_date: str | None = None):
	require_doctype_permission("Sales Invoice", "read")
	filters = {"docstatus": 1}
	if from_date and to_date:
		filters["posting_date"] = ["between", [from_date, to_date]]

	rows = frappe.get_all("Sales Invoice", filters=filters, fields=["posting_date", "grand_total"])
	by_day: dict[str, float] = {}
	for row in rows:
		key = str(row.posting_date)
		by_day[key] = by_day.get(key, 0) + (row.grand_total or 0)

	return envelope({
		"total": sum(by_day.values()),
		"by_day": [{"date": d, "amount": amt} for d, amt in sorted(by_day.items())],
	})


def _customer_for_patient(patient: str) -> str:
	customer = frappe.db.get_value("Patient", patient, "customer") if frappe.get_meta("Patient").get_field("customer") else None
	if customer:
		return customer
	# Healthcare Settings can auto-link a Customer per Patient; fall back to
	# the patient's own name as the Customer identity if none is linked yet.
	if not frappe.db.exists("Customer", patient):
		frappe.get_doc({"doctype": "Customer", "customer_name": frappe.db.get_value("Patient", patient, "patient_name") or patient}).insert(ignore_permissions=True)
	return patient


# --- Daily cash closing -------------------------------------------------------

@frappe.whitelist()
def get_todays_closing():
	require_doctype_permission("Daily Cash Closing", "read")
	name = frappe.db.get_value("Daily Cash Closing", {"cashier": frappe.session.user, "closing_date": today()}, "name")
	if not name:
		return envelope(None)
	return envelope(frappe.get_doc("Daily Cash Closing", name).as_dict())


@frappe.whitelist(methods=["POST"])
def submit_cash_closing(opening_balance: float = 0, actual_cash_balance: float = 0, notes: str | None = None):
	require_doctype_permission("Daily Cash Closing", "write")
	name = frappe.db.get_value("Daily Cash Closing", {"cashier": frappe.session.user, "closing_date": today()}, "name")
	doc = frappe.get_doc("Daily Cash Closing", name) if name else frappe.new_doc("Daily Cash Closing")
	doc.opening_balance = opening_balance
	doc.actual_cash_balance = actual_cash_balance
	doc.notes = notes
	doc.status = "Closed"
	doc.save() if name else doc.insert()
	return envelope(doc.as_dict(), {"message": "Cash drawer closed"})


@frappe.whitelist()
def list_cash_closings():
	require_doctype_permission("Daily Cash Closing", "read")
	return envelope(frappe.get_all(
		"Daily Cash Closing",
		fields=["name", "cashier", "closing_date", "total_collected", "opening_balance", "actual_cash_balance", "variance", "status"],
		order_by="closing_date desc", limit_page_length=100,
	))
