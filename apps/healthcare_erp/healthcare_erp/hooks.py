from . import __version__ as app_version

app_name = "healthcare_erp"
app_title = "Health-C Healthcare ERP"
app_publisher = "Health-C"
app_description = "Custom Healthcare Management System extending ERPNext Healthcare for a private medical center"
app_email = "engineering@health-c.local"
app_license = "Proprietary"
app_icon = "octicon octicon-pulse"
app_color = "#0F6CBD"

required_apps = ["frappe", "erpnext"]

# ---------------------------------------------------------------------------
# The Frappe Desk is intentionally not the product UI. All clinical/business
# users are driven to the Next.js SPA; Desk is reserved for Administrator/
# System Manager low-level configuration only. See www/app.py override below.
# ---------------------------------------------------------------------------

after_install = "healthcare_erp.setup.install.after_install"
after_migrate = "healthcare_erp.setup.install.after_migrate"

fixtures = [
	{"dt": "Role", "filters": [["name", "in", [
		"CEO", "Medical Director", "Finance Director", "Receptionist",
		"Doctor", "Nurse", "Laboratory Technician", "Radiologist",
		"Pharmacist", "Cashier", "Insurance Officer",
	]]]},
	{"dt": "Custom Field", "filters": [["module", "=", "Healthcare ERP"]]},
	{"dt": "Property Setter", "filters": [["module", "=", "Healthcare ERP"]]},
	{"dt": "Workflow", "filters": [["module", "=", "Healthcare ERP"]]},
	{"dt": "Workflow State"},
	{"dt": "Workflow Action Master"},
	{"dt": "Print Format", "filters": [["module", "=", "Healthcare ERP"]]},
]

doc_events = {
	"Patient": {
		"before_insert": "healthcare_erp.healthcare_erp.doc_events.patient.before_insert",
		"after_insert": "healthcare_erp.healthcare_erp.doc_events.patient.after_insert",
	},
	"Patient Appointment": {
		"after_insert": "healthcare_erp.healthcare_erp.doc_events.appointment.after_insert",
		"on_update": "healthcare_erp.healthcare_erp.doc_events.appointment.on_update",
		"on_cancel": "healthcare_erp.healthcare_erp.doc_events.appointment.on_cancel",
	},
	"Patient Encounter": {
		"on_submit": "healthcare_erp.healthcare_erp.doc_events.encounter.on_submit",
	},
	"Lab Test": {
		"on_update": "healthcare_erp.healthcare_erp.doc_events.lab_test.on_update",
	},
	"Inpatient Record": {
		"on_update": "healthcare_erp.healthcare_erp.doc_events.inpatient_record.on_update",
	},
	"Sales Invoice": {
		"on_submit": "healthcare_erp.healthcare_erp.doc_events.billing.on_submit",
	},
}

scheduler_events = {
	"cron": {
		"*/5 * * * *": [
			"healthcare_erp.healthcare_erp.tasks.sync_critical_alerts",
		],
	},
	"hourly": [
		"healthcare_erp.healthcare_erp.tasks.check_appointment_reminders",
		"healthcare_erp.healthcare_erp.tasks.check_drug_expiry",
	],
	"daily": [
		"healthcare_erp.healthcare_erp.tasks.build_executive_kpi_snapshot",
		"healthcare_erp.healthcare_erp.tasks.close_stale_queue_tokens",
	],
}

# The Desk (/app) is reachable only to Administrator/System Manager; every other
# role is routed to the SPA. Nginx (see docker/nginx/nginx.conf) serves the SPA at
# "/" and only proxies "/app", "/api", "/assets" to Frappe, so clinical/business
# users never land on Desk even if they follow an old bookmark. As a defense in
# depth, non-privileged roles are also given a role_home_page that bounces them
# back to the SPA if they do reach a logged-in Desk URL.
role_home_page = {
	"Doctor": "/healthcare_erp/redirect",
	"Nurse": "/healthcare_erp/redirect",
	"Receptionist": "/healthcare_erp/redirect",
	"Laboratory Technician": "/healthcare_erp/redirect",
	"Radiologist": "/healthcare_erp/redirect",
	"Pharmacist": "/healthcare_erp/redirect",
	"Cashier": "/healthcare_erp/redirect",
	"Insurance Officer": "/healthcare_erp/redirect",
	"CEO": "/healthcare_erp/redirect",
	"Medical Director": "/healthcare_erp/redirect",
	"Finance Director": "/healthcare_erp/redirect",
	"Patient": "/healthcare_erp/redirect",
}
