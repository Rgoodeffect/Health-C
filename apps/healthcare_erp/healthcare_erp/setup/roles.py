"""Central role -> doctype permission matrix for Health-C.

This is the single source of truth for RBAC. `sync_doctype_permissions()`
(called from patches and from the `bench sync-permissions` custom command)
walks this dict and creates/updates Custom DocPerm rows via
`frappe.permissions.add_permission` / `update_permission_property`, so the
matrix stays declarative and diffable in code review instead of living only
in the Desk Role Permission Manager.

Modules add to this dict as they are built (see docs/PROGRESS.md); this file
is therefore append-only across the project's commits.

Record-level scoping for the ``Patient`` role (a patient may only ever see
their *own* records) is not done here — it is enforced via a Frappe
``User Permission`` of type ``Patient`` created automatically for every
portal user in `healthcare_erp.healthcare_erp.doc_events.patient.after_insert`,
which Frappe's permission engine applies on top of whatever role permissions
say below.
"""

from __future__ import annotations

import frappe

# --- permission shorthand ---------------------------------------------------

READ = {"read": 1}
READ_CREATE = {"read": 1, "write": 1, "create": 1}
CRUD = {"read": 1, "write": 1, "create": 1, "delete": 1}
CLINICAL = {  # create/edit/submit clinical documents, no delete (audit trail)
	"read": 1, "write": 1, "create": 1, "submit": 1, "cancel": 1,
	"amend": 1, "print": 1, "email": 1, "report": 1, "export": 1,
}
FULL = {  # administrative full control over a doctype
	"read": 1, "write": 1, "create": 1, "delete": 1, "submit": 1,
	"cancel": 1, "amend": 1, "print": 1, "email": 1, "report": 1,
	"export": 1, "share": 1, "import": 1,
}

# --- role -> { doctype: perm-dict } -----------------------------------------

ROLE_PERMISSION_MATRIX: dict[str, dict[str, dict]] = {
	"CEO": {
		"Patient": READ,
		"Patient Appointment": READ,
		"Sales Invoice": READ,
		"Executive KPI Snapshot": READ,
		"Healthcare Practitioner": READ,
		"Inpatient Record": READ,
	},
	"Medical Director": {
		"Patient": READ,
		"Patient Encounter": READ,
		"Patient Appointment": READ,
		"Healthcare Practitioner": READ_CREATE,
		"Lab Test": READ,
		"Clinical Procedure": READ,
		"Inpatient Record": READ,
		"Executive KPI Snapshot": READ,
	},
	"Finance Director": {
		"Sales Invoice": READ,
		"Payment Entry": READ,
		"Daily Cash Closing": READ,
		"Insurance Claim": READ,
		"Executive KPI Snapshot": READ,
	},
	"Receptionist": {
		"Patient": READ_CREATE,
		"Patient Appointment": CRUD,
		"Appointment Waiting List": CRUD,
		"Reception Queue Token": CRUD,
		"Sales Invoice": READ,
		"Payment Entry": READ_CREATE,
	},
	"Doctor": {
		"Patient": READ,
		"Patient Encounter": CLINICAL,
		"Patient Appointment": {**READ_CREATE, "write": 1},
		"Vital Signs": READ_CREATE,
		"Lab Test": READ_CREATE,
		"Clinical Procedure": READ_CREATE,
		"Drug Prescription": READ_CREATE,
		"Clinical Alert": {**READ, "write": 1},
		"ICD10 Code": READ,
		"Inpatient Record": READ_CREATE,
		"Drug Interaction Rule": READ,
		"Prescription Refill": READ_CREATE,
	},
	"Nurse": {
		"Patient": READ,
		"Vital Signs": READ_CREATE,
		"Nursing Note": READ_CREATE,
		"Inpatient Record": READ_CREATE,
		"Bed Transfer Request": READ_CREATE,
		"Clinical Alert": {**READ, "write": 1},
	},
	"Laboratory Technician": {
		"Lab Test": {**CLINICAL, "delete": 0},
		"Sample Collection": CRUD,
		"Sample Barcode Label": CRUD,
		"Lab QC Run": CRUD,
		"Analyzer Result Inbox": CRUD,
		"Lab Test Template": READ,
	},
	"Radiologist": {
		"Radiology Order": CLINICAL,
		"Radiology Report": CLINICAL,
		"PACS Study Reference": READ_CREATE,
		"Modality": READ,
	},
	"Pharmacist": {
		"Drug Prescription": READ,
		"Item": READ,
		"Batch": READ_CREATE,
		"Dispensing Log": CRUD,
		"Controlled Drug Register": CRUD,
		"Stock Entry": READ_CREATE,
		"Drug Interaction Rule": READ,
		"Prescription Refill": CRUD,
	},
	"Cashier": {
		"Sales Invoice": {**CLINICAL, "delete": 0},
		"Payment Entry": {**CLINICAL, "delete": 0},
		"Daily Cash Closing": CRUD,
	},
	"Insurance Officer": {
		"Healthcare Insurance Company": READ_CREATE,
		"Healthcare Insurance Coverage Plan": READ_CREATE,
		"Insurance Pre Authorization": CRUD,
		"Insurance Claim": CRUD,
		"Insurance Claim Rejection": CRUD,
		"Insurance Settlement": READ_CREATE,
	},
}


def sync_doctype_permissions():
	"""Idempotently apply ROLE_PERMISSION_MATRIX via Frappe's permission API."""
	from frappe.permissions import add_permission, update_permission_property

	for role, doctype_perms in ROLE_PERMISSION_MATRIX.items():
		if not frappe.db.exists("Role", role):
			continue
		for doctype, perms in doctype_perms.items():
			if not frappe.db.exists("DocType", doctype):
				continue
			add_permission(doctype, role, 0)
			for prop, value in perms.items():
				update_permission_property(doctype, role, 0, prop, value)
