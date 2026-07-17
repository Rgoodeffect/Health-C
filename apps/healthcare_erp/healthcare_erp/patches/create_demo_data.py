"""Demo/seed data for a private medical center of ~20 practitioners.

Deliberately NOT registered in patches.txt — this never runs automatically
on install/migrate. Run it explicitly when you want a populated demo
environment:

    bench --site <site> execute healthcare_erp.patches.create_demo_data.execute

Idempotent: safe to run more than once (checks for existing records by
name/identifying field before creating).
"""

from __future__ import annotations

import random

import frappe
from frappe.utils import add_days, today

FIRST_NAMES = ["Amina", "Youssef", "Layla", "Omar", "Fatima", "Khalid", "Noor", "Zaid",
			   "Salma", "Hassan", "Mariam", "Tariq", "Huda", "Sami", "Rania", "Adel",
			   "Dana", "Faisal", "Lina", "Nabil"]
LAST_NAMES = ["Al-Sayed", "Haddad", "Mansour", "Farouk", "Nasser", "Qureshi", "Saleh",
			  "Barakat", "Aziz", "Karim"]
DEPARTMENTS = ["General Medicine", "Cardiology", "Pediatrics", "Orthopedics", "Dermatology"]
MODALITIES = [("XR", "X-Ray"), ("CT", "CT Scan"), ("MRI", "MRI"), ("US", "Ultrasound")]


def execute():
	frappe.flags.in_patch = True
	try:
		practitioners = _create_practitioners()
		modalities = _create_modalities()
		patients = _create_patients()
		_create_appointments(patients, practitioners)
		_create_encounters(patients, practitioners)
		_create_lab_orders(patients)
		_create_radiology_orders(patients, modalities)
		frappe.db.commit()
		print(f"Demo data ready: {len(patients)} patients, {len(practitioners)} practitioners.")
	finally:
		frappe.flags.in_patch = False


def _create_practitioners() -> list[str]:
	if not frappe.db.exists("DocType", "Healthcare Practitioner"):
		return []
	names = []
	for i in range(20):
		full_name = f"Dr. {random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
		existing = frappe.db.exists("Healthcare Practitioner", {"practitioner_name": full_name})
		if existing:
			names.append(existing)
			continue
		try:
			doc = frappe.get_doc({
				"doctype": "Healthcare Practitioner",
				"first_name": full_name.split(" ", 1)[1].split(" ")[0],
				"practitioner_name": full_name,
				"department": random.choice(DEPARTMENTS) if frappe.get_meta("Healthcare Practitioner").get_field("department") else None,
			})
			doc.insert(ignore_permissions=True)
			names.append(doc.name)
		except Exception:
			frappe.log_error(title="Demo data: practitioner creation skipped")
	return names


def _create_modalities() -> list[str]:
	if not frappe.db.exists("DocType", "Modality"):
		return []
	codes = []
	for code, name in MODALITIES:
		if not frappe.db.exists("Modality", code):
			frappe.get_doc({"doctype": "Modality", "modality_code": code, "modality_name": name}).insert(ignore_permissions=True)
		codes.append(code)
	return codes


def _create_patients() -> list[str]:
	names = []
	for i in range(25):
		first = random.choice(FIRST_NAMES)
		last = random.choice(LAST_NAMES)
		mobile = f"+9665{random.randint(10000000, 99999999)}"
		if frappe.db.exists("Patient", {"mobile": mobile}):
			continue
		try:
			doc = frappe.get_doc({
				"doctype": "Patient",
				"first_name": first,
				"last_name": last,
				"sex": random.choice(["Male", "Female"]),
				"dob": add_days(today(), -random.randint(6000, 25000)),
				"mobile": mobile,
				"blood_group": random.choice(["A Positive", "B Positive", "O Positive", "AB Positive"]),
			})
			doc.insert(ignore_permissions=True)
			names.append(doc.name)
		except Exception:
			frappe.log_error(title="Demo data: patient creation skipped")
	return names


def _create_appointments(patients: list[str], practitioners: list[str]):
	if not patients or not practitioners or not frappe.db.exists("DocType", "Patient Appointment"):
		return
	for patient in patients[:15]:
		try:
			frappe.get_doc({
				"doctype": "Patient Appointment",
				"patient": patient,
				"practitioner": random.choice(practitioners),
				"appointment_date": add_days(today(), random.randint(-10, 10)),
				"appointment_time": f"{random.randint(8, 17):02d}:00:00",
				"duration": 15,
			}).insert(ignore_permissions=True)
		except Exception:
			frappe.log_error(title="Demo data: appointment creation skipped")


def _create_encounters(patients: list[str], practitioners: list[str]):
	if not patients or not practitioners or not frappe.db.exists("DocType", "Patient Encounter"):
		return
	complaints = ["Fever and headache", "Persistent cough", "Lower back pain", "Routine checkup", "Follow-up for hypertension"]
	for patient in patients[:10]:
		try:
			doc = frappe.get_doc({
				"doctype": "Patient Encounter",
				"patient": patient,
				"practitioner": random.choice(practitioners),
				"encounter_date": add_days(today(), -random.randint(0, 30)),
			})
			if doc.meta.get_field("chief_complaint"):
				doc.chief_complaint = random.choice(complaints)
			doc.insert(ignore_permissions=True)
		except Exception:
			frappe.log_error(title="Demo data: encounter creation skipped")


def _create_lab_orders(patients: list[str]):
	if not patients or not frappe.db.exists("DocType", "Lab Test"):
		return
	templates = ["Complete Blood Count", "Lipid Panel", "HbA1c", "Liver Function Test"]
	for patient in patients[:10]:
		try:
			frappe.get_doc({
				"doctype": "Lab Test",
				"patient": patient,
				"template": random.choice(templates) if frappe.get_meta("Lab Test").get_field("template") else None,
			}).insert(ignore_permissions=True)
		except Exception:
			frappe.log_error(title="Demo data: lab order creation skipped")


def _create_radiology_orders(patients: list[str], modalities: list[str]):
	if not patients or not modalities or not frappe.db.exists("DocType", "Radiology Order"):
		return
	body_parts = ["Chest", "Abdomen", "Knee", "Skull"]
	for patient in patients[:8]:
		try:
			frappe.get_doc({
				"doctype": "Radiology Order",
				"patient": patient,
				"modality": random.choice(modalities),
				"body_part": random.choice(body_parts),
			}).insert(ignore_permissions=True)
		except Exception:
			frappe.log_error(title="Demo data: radiology order creation skipped")
