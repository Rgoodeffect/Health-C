"""Module 13 — Executive Dashboards.

Every KPI here is computed live from the doctypes each module already
owns (no duplicated ledgers) and additionally materialized once a day into
`Executive KPI Snapshot` by `healthcare_erp.healthcare_erp.tasks.
build_executive_kpi_snapshot` for trend charts.
"""

from __future__ import annotations

import frappe
from frappe.utils import add_days, get_first_day, today

from healthcare_erp.api.utils import envelope

EXECUTIVE_ROLES = {"CEO", "Medical Director", "Finance Director", "System Manager"}


def _require_executive_access():
	if not EXECUTIVE_ROLES.intersection(frappe.get_roles(frappe.session.user)):
		frappe.throw(frappe._("Executive dashboard access required"), frappe.PermissionError)


def compute_live_kpis() -> dict:
	month_start = get_first_day(today())

	kpis = {
		"total_patients": frappe.db.count("Patient"),
		"new_patients_today": frappe.db.count("Patient", {"creation": [">=", today()]}),
		"appointments_today": (
			frappe.db.count("Patient Appointment", {"appointment_date": today()})
			if frappe.db.exists("DocType", "Patient Appointment") else 0
		),
		"active_admissions": (
			frappe.db.count("Inpatient Record", {"status": "Admitted"})
			if frappe.db.exists("DocType", "Inpatient Record") else 0
		),
		"surgeries_mtd": (
			frappe.db.count("Surgery Request", {"status": "Completed", "modified": [">=", month_start]})
			if frappe.db.exists("DocType", "Surgery Request") else 0
		),
		"lab_tests_today": (
			frappe.db.count("Lab Test", {"creation": [">=", today()]})
			if frappe.db.exists("DocType", "Lab Test") else 0
		),
		"radiology_orders_today": (
			frappe.db.count("Radiology Order", {"creation": [">=", today()]})
			if frappe.db.exists("DocType", "Radiology Order") else 0
		),
		"pharmacy_dispensed_today": (
			frappe.db.count("Dispensing Log", {"dispensed_on": [">=", today()]})
			if frappe.db.exists("DocType", "Dispensing Log") else 0
		),
		"claims_submitted_mtd": (
			frappe.db.count("Insurance Claim", {"submitted_on": [">=", month_start]})
			if frappe.db.exists("DocType", "Insurance Claim") else 0
		),
		"claims_settled_mtd": (
			frappe.db.count("Insurance Settlement", {"settlement_date": [">=", month_start]})
			if frappe.db.exists("DocType", "Insurance Settlement") else 0
		),
	}

	kpis["bed_occupancy_pct"] = _bed_occupancy_pct()
	kpis["revenue_mtd"], kpis["collections_mtd"] = _revenue_and_collections(month_start)
	return kpis


def _bed_occupancy_pct() -> float:
	if not frappe.get_meta("Healthcare Service Unit").get_field("is_bed"):
		return 0
	total = frappe.db.count("Healthcare Service Unit", {"is_bed": 1})
	if not total:
		return 0
	occupied = frappe.db.count("Healthcare Service Unit", {"is_bed": 1, "occupancy_status": "Occupied"})
	return round((occupied / total) * 100, 1)


def _revenue_and_collections(month_start) -> tuple[float, float]:
	if not frappe.db.exists("DocType", "Sales Invoice"):
		return 0, 0
	invoices = frappe.get_all(
		"Sales Invoice", filters={"docstatus": 1, "posting_date": [">=", month_start]},
		fields=["grand_total", "outstanding_amount"],
	)
	revenue = sum(inv.grand_total or 0 for inv in invoices)
	collections = sum((inv.grand_total or 0) - (inv.outstanding_amount or 0) for inv in invoices)
	return revenue, collections


@frappe.whitelist()
def live_kpis():
	_require_executive_access()
	return envelope(compute_live_kpis())


@frappe.whitelist()
def revenue_trend(days: int = 30):
	_require_executive_access()
	if not frappe.db.exists("DocType", "Sales Invoice"):
		return envelope([])

	start = add_days(today(), -int(days))
	rows = frappe.get_all("Sales Invoice", filters={"docstatus": 1, "posting_date": [">=", start]}, fields=["posting_date", "grand_total"])
	by_day: dict[str, float] = {}
	for row in rows:
		key = str(row.posting_date)
		by_day[key] = by_day.get(key, 0) + (row.grand_total or 0)

	return envelope([{"date": d, "amount": amt} for d, amt in sorted(by_day.items())])


@frappe.whitelist()
def patient_growth_trend(days: int = 30):
	_require_executive_access()
	start = add_days(today(), -int(days))
	rows = frappe.get_all("Patient", filters={"creation": [">=", start]}, fields=["creation"])
	by_day: dict[str, int] = {}
	for row in rows:
		key = str(row.creation.date())
		by_day[key] = by_day.get(key, 0) + 1

	return envelope([{"date": d, "count": c} for d, c in sorted(by_day.items())])


@frappe.whitelist()
def snapshot_history(days: int = 90):
	_require_executive_access()
	if not frappe.db.exists("DocType", "Executive KPI Snapshot"):
		return envelope([])
	start = add_days(today(), -int(days))
	return envelope(frappe.get_all(
		"Executive KPI Snapshot", filters={"snapshot_date": [">=", start]},
		fields=["*"], order_by="snapshot_date asc", limit_page_length=200,
	))
