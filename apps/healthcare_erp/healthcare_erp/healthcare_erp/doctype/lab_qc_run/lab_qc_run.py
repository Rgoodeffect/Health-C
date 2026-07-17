import frappe
from frappe.model.document import Document


class LabQCRun(Document):
	def before_save(self):
		try:
			expected = float(self.expected_value)
			measured = float(self.measured_value)
			tolerance = expected * 0.1
			self.within_range = 1 if abs(measured - expected) <= tolerance else 0
		except (TypeError, ValueError):
			# Non-numeric analyzer output (e.g. qualitative controls) — leave the
			# reviewer to set within_range manually.
			pass
