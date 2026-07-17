"""Shared helpers for every healthcare_erp.api.* endpoint.

Conventions (see docs/ARCHITECTURE.md#api-layer-conventions):
  - every endpoint returns `envelope(data, meta)` on success
  - errors bubble up as Frappe's standard exception JSON (400/403/404/500)
  - list endpoints accept filters/page/page_size/order_by uniformly via
    `parsed_list_args()`
  - every endpoint re-checks permissions server-side with
    `frappe.has_permission` — the SPA's role-based UI gating is cosmetic only
"""

from __future__ import annotations

import json

import frappe


def envelope(data, meta: dict | None = None):
	return {"data": data, "meta": meta or {}}


def parsed_list_args(default_order_by: str = "modified desc", max_page_size: int = 100):
	filters = frappe.form_dict.get("filters")
	if filters:
		filters = json.loads(filters) if isinstance(filters, str) else filters
	else:
		filters = {}

	page = int(frappe.form_dict.get("page") or 1)
	page_size = min(int(frappe.form_dict.get("page_size") or 20), max_page_size)
	order_by = frappe.form_dict.get("order_by") or default_order_by

	return {
		"filters": filters,
		"limit_start": (page - 1) * page_size,
		"limit_page_length": page_size,
		"order_by": order_by,
		"page": page,
		"page_size": page_size,
	}


def set_if_field_exists(doc, values: dict):
	"""Set only the fields that actually exist on `doc`'s doctype.

	Core ERPNext doctypes (Patient Encounter, Vital Signs, ...) evolve across
	versions and forks; endpoints that populate them defensively via this
	helper keep working even if a particular field was renamed/removed
	upstream, instead of hard-failing on `doc.update(...)`.
	"""
	meta = frappe.get_meta(doc.doctype)
	for fieldname, value in values.items():
		if meta.get_field(fieldname) or fieldname in ("patient", "practitioner"):
			doc.set(fieldname, value)
	return doc


def require_doctype_permission(doctype: str, ptype: str = "read", doc=None):
	if not frappe.has_permission(doctype, ptype=ptype, doc=doc):
		frappe.throw(
			frappe._("You do not have permission to {0} {1}").format(ptype, doctype),
			frappe.PermissionError,
		)


def paginated_list(doctype: str, fields: list[str], extra_filters: dict | None = None, **kwargs):
	args = parsed_list_args(**kwargs)
	filters = {**args["filters"], **(extra_filters or {})}

	require_doctype_permission(doctype, "read")

	rows = frappe.get_list(
		doctype,
		fields=fields,
		filters=filters,
		order_by=args["order_by"],
		limit_start=args["limit_start"],
		limit_page_length=args["page_size"],
	)
	total = frappe.db.count(doctype, filters=filters)

	return envelope(rows, {
		"page": args["page"],
		"page_size": args["page_size"],
		"total": total,
		"total_pages": max(1, -(-total // args["page_size"])),
	})
