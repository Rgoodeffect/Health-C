"""Module 10 — Pharmacy.

Drug master (`Item`), batch/expiry (`Batch`), and stock movements
(`Stock Entry`) are ERPNext core (Stock module); healthcare_erp adds
dispensing, controlled-drug register, and expiry alerting on top.
"""

from __future__ import annotations

import frappe
from frappe.utils import add_days, today

from healthcare_erp.api.utils import envelope, require_doctype_permission


@frappe.whitelist()
def list_drugs(query: str = "", limit: int = 20):
	filters = {"disabled": 0}
	rows = frappe.get_all(
		"Item",
		filters=filters,
		or_filters={"item_name": ["like", f"%{query}%"], "item_code": ["like", f"%{query}%"]} if query else None,
		fields=["name as item_code", "item_name", "item_group", "stock_uom", "is_controlled_substance", "controlled_schedule"],
		limit_page_length=limit,
	)
	return envelope(rows)


@frappe.whitelist()
def list_batches(item_code: str):
	require_doctype_permission("Batch", "read")
	meta = frappe.get_meta("Batch")
	fields = ["name", "expiry_date"]
	for optional in ("batch_qty", "manufacturing_date"):
		if meta.get_field(optional):
			fields.append(optional)
	return envelope(frappe.get_all(
		"Batch", filters={"item": item_code, "disabled": 0}, fields=fields,
		order_by="expiry_date asc", limit_page_length=100,
	))


@frappe.whitelist()
def expiring_batches(days: int = 30):
	require_doctype_permission("Batch", "read")
	return envelope(frappe.get_all(
		"Batch",
		filters={"expiry_date": ["between", [today(), add_days(today(), days)]], "disabled": 0},
		fields=["name", "item", "expiry_date"],
		order_by="expiry_date asc", limit_page_length=200,
	))


@frappe.whitelist(methods=["POST"])
def dispense(patient: str, drug: str, quantity: float, batch: str | None = None,
			 prescription_refill: str | None = None, witnessed_by: str | None = None):
	require_doctype_permission("Dispensing Log", "create")

	is_controlled = frappe.db.get_value("Item", drug, "is_controlled_substance")
	if is_controlled and not witnessed_by:
		frappe.throw(frappe._("Dispensing a controlled substance requires a witness"))

	log = frappe.get_doc({
		"doctype": "Dispensing Log", "patient": patient, "drug": drug, "batch": batch,
		"quantity": quantity, "prescription_refill": prescription_refill, "is_controlled": is_controlled or 0,
	})
	log.insert()

	if is_controlled:
		schedule = frappe.db.get_value("Item", drug, "controlled_schedule")
		last_balance = frappe.db.get_value(
			"Controlled Drug Register", {"drug": drug}, "balance_after", order_by="dispensed_on desc",
		) or 0
		register = frappe.get_doc({
			"doctype": "Controlled Drug Register", "dispensing_log": log.name, "schedule": schedule,
			"witnessed_by": witnessed_by, "balance_before": last_balance, "balance_after": last_balance - quantity,
		})
		register.insert()

	return envelope(log.as_dict(), {"message": "Drug dispensed"})


@frappe.whitelist()
def list_dispensing_log(patient: str | None = None):
	require_doctype_permission("Dispensing Log", "read")
	filters = {"patient": patient} if patient else {}
	return envelope(frappe.get_all(
		"Dispensing Log", filters=filters,
		fields=["name", "patient", "drug", "batch", "quantity", "is_controlled", "dispensed_by", "dispensed_on"],
		order_by="dispensed_on desc", limit_page_length=200,
	))


@frappe.whitelist()
def controlled_drug_register(drug: str | None = None):
	require_doctype_permission("Controlled Drug Register", "read")
	filters = {"drug": drug} if drug else {}
	return envelope(frappe.get_all(
		"Controlled Drug Register", filters=filters,
		fields=["name", "dispensing_log", "drug", "schedule", "quantity_dispensed", "balance_before", "balance_after", "witnessed_by", "dispensed_on"],
		order_by="dispensed_on desc", limit_page_length=200,
	))


@frappe.whitelist(methods=["POST"])
def stock_transfer(item_code: str, qty: float, from_warehouse: str, to_warehouse: str):
	require_doctype_permission("Stock Entry", "create")
	entry = frappe.new_doc("Stock Entry")
	entry.stock_entry_type = "Material Transfer"
	entry.append("items", {
		"item_code": item_code, "qty": qty,
		"s_warehouse": from_warehouse, "t_warehouse": to_warehouse,
	})
	entry.insert()
	entry.submit()
	return envelope(entry.as_dict(), {"message": "Stock transferred"})


@frappe.whitelist()
def stock_levels(item_code: str | None = None):
	"""Current on-hand quantity per warehouse (core `Bin` doctype)."""
	if not frappe.db.exists("DocType", "Bin"):
		return envelope([])
	filters = {"item_code": item_code} if item_code else {}
	return envelope(frappe.get_all(
		"Bin", filters=filters, fields=["item_code", "warehouse", "actual_qty"],
		order_by="item_code asc", limit_page_length=200,
	))
