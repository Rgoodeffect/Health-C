import frappe


def get_context(context):
	"""Bounce any authenticated non-privileged user from Desk to the SPA.

	Reached only if someone hits a Desk URL directly instead of going through
	Nginx's SPA-at-"/" routing (see docs/DEPLOYMENT.md).
	"""
	frontend_url = frappe.conf.get("healthcare_erp_frontend_url") or "/"
	frappe.local.flags.redirect_location = frontend_url
	raise frappe.Redirect
