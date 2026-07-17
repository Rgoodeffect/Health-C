from __future__ import annotations

import frappe


def on_submit(doc, method=None):
	"""Roll a submitted Sales Invoice's cash collections into today's Daily
	Cash Closing draft for the cashier who created it, so end-of-day
	reconciliation doesn't require re-tallying every invoice by hand."""
	mode = (doc.get("mode_of_payment") or "").lower()
	if "cash" not in mode and doc.get("is_pos"):
		return
	if not doc.get("is_pos"):
		return

	today = frappe.utils.today()
	cashier = doc.owner
	closing_name = frappe.db.get_value("Daily Cash Closing", {"cashier": cashier, "closing_date": today}, "name")

	if not closing_name:
		closing = frappe.get_doc({"doctype": "Daily Cash Closing", "cashier": cashier, "closing_date": today})
		closing.insert(ignore_permissions=True)
		closing_name = closing.name

	field = {
		"cash": "cash_collected",
		"card": "card_collected",
		"bank transfer": "bank_transfer_collected",
		"mobile payment": "mobile_payment_collected",
	}.get(mode)

	if field:
		current = frappe.db.get_value("Daily Cash Closing", closing_name, field) or 0
		frappe.db.set_value("Daily Cash Closing", closing_name, field, current + (doc.paid_amount or doc.grand_total or 0))
