import frappe
from frappe.model.document import Document


class DailyCashClosing(Document):
	def before_save(self):
		self.total_collected = sum([
			self.cash_collected or 0,
			self.card_collected or 0,
			self.bank_transfer_collected or 0,
			self.mobile_payment_collected or 0,
		])
		expected_cash = (self.opening_balance or 0) + (self.cash_collected or 0)
		if self.actual_cash_balance is not None:
			self.variance = (self.actual_cash_balance or 0) - expected_cash
