# Health-C — Architecture

## What this is

A production-grade Hospital / Medical Center Management System built on **ERPNext 16 /
Frappe Framework 16** as the backend system-of-record, with a fully custom **Next.js 16**
frontend as the only user-facing surface. No user ever sees the default Frappe Desk UI.

## Why extend ERPNext Healthcare instead of building from scratch

ERPNext 16 ships a mature **Healthcare** domain (module `healthcare`) with production doctypes
already covering a large share of the spec: `Patient`, `Healthcare Practitioner`,
`Patient Appointment`, `Patient Encounter`, `Lab Test`, `Lab Test Template`, `Sample Collection`,
`Inpatient Record`, `Healthcare Service Unit` (wards/rooms/beds), `Clinical Procedure`,
`Patient Medical Record`, `Vital Signs`, and Insurance-adjacent doctypes (`Healthcare Insurance
Company`, `Healthcare Insurance Coverage Plan`), plus native Accounts/Stock modules for
billing and pharmacy inventory.

Rebuilding these from zero would be slower, less correct (loses years of hardening,
`bench` migrations, print formats, and Frappe's permission engine), and harder to maintain
across ERPNext version upgrades. The correct architecture as an ERPNext implementer is:

1. **Reuse** core Healthcare/Accounts/Stock doctypes wherever the spec matches them.
2. **Extend** them with Custom Fields, Property Setters, and Client Scripts only where the
   spec asks for something ERPNext doesn't have (MRN format, QR code, national ID/passport
   capture, controlled-drug flags, etc.) — via a custom app, never by editing core.
3. **Add new DocTypes** in the custom app for concepts ERPNext has no equivalent for
   (Surgical Team Assignment, Pre-op Checklist, Anesthesia Record, Recovery Room Log,
   Implant Tracking, Insurance Pre-Authorization, Insurance Claim Resubmission, Waiting List,
   Queue Token, Executive Dashboard KPI snapshots).
4. **Expose everything through a versioned REST/RPC API layer** (`whitelisted` methods under
   `healthcare_erp/api/*`) built for the frontend's exact shapes — never make the SPA talk to
   raw Frappe REST list views.
5. **Build 100% of the UI in Next.js.** Frappe/ERPNext is reduced to: database, permission
   engine, workflow engine, background jobs (queue, scheduler), file storage, email/SMS,
   and reporting primitives. The Desk is only used by admins for low-level system
   configuration (Users, Roles, DocType Builder for one-off tweaks) — never by clinical or
   business end users.

## Repository layout

```
Health-C/
├── apps/
│   └── healthcare_erp/            # Frappe custom app (installed into a bench)
│       ├── healthcare_erp/
│       │   ├── hooks.py
│       │   ├── modules.txt
│       │   ├── healthcare_erp/    # module: new doctypes for gaps in ERPNext Healthcare
│       │   │   └── doctype/
│       │   ├── api/               # whitelisted REST endpoints consumed by Next.js
│       │   ├── fixtures/          # roles, custom fields, workflows, print formats
│       │   ├── patches/           # data migrations
│       │   └── www/               # (unused — no Desk-facing pages)
│       ├── requirements.txt
│       └── setup.py
├── frontend/                      # Next.js 16 SPA — the entire user experience
│   └── src/...
├── docker/                        # docker-compose stack: frappe, mariadb, redis, nginx, frontend
├── docs/                          # this file, INSTALLATION.md, DEPLOYMENT.md, PERMISSIONS_MATRIX.md
└── README.md
```

## Backend module → DocType map

| Module | Reused ERPNext DocTypes | New custom-app DocTypes |
|---|---|---|
| 1. Patient Registration | `Patient`, `Patient Relation`, `Patient Medical Record` | `Patient QR Code` (generated), Custom Fields on `Patient` (MRN format, National ID, Passport No, Insurance summary) |
| 2. Appointments | `Patient Appointment`, `Practitioner Schedule` | `Appointment Waiting List` |
| 3. Reception | `Patient Appointment` | `Reception Queue Token`, `Waiting Room Display Config` |
| 4. Consultation & EMR | `Patient Encounter`, `Vital Signs`, `Patient History Settings` | `Clinical Alert`, `Allergy Flag` (wraps `Patient` allergies child), ICD-10 term list loader |
| 5. Prescription | `Prescription` (child of Encounter), `Drug Prescription` | `Drug Interaction Rule`, `Prescription Refill` |
| 6. Laboratory (LIS) | `Lab Test`, `Lab Test Template`, `Sample Collection`, `Lab Test Group Template` | `Sample Barcode Label`, `Lab QC Run`, `Analyzer Result Inbox` |
| 7. Radiology (RIS) | `Clinical Procedure`, `Clinical Procedure Template` | `Radiology Order`, `Radiology Report`, `Modality`, `PACS Study Reference` |
| 8. Admission & Bed Mgmt | `Inpatient Record`, `Healthcare Service Unit` | `Bed Transfer Request`, `Nursing Note` |
| 9. Surgery & OT | `Clinical Procedure` | `Surgery Request`, `OT Schedule`, `Surgical Team Assignment`, `Pre-Op Checklist`, `Anesthesia Record`, `Surgery Note`, `Recovery Room Log`, `Implant Tracking` |
| 10. Pharmacy | `Item` (drug), `Batch`, `Stock Entry`, `Delivery Note` | `Controlled Drug Register`, `Dispensing Log` |
| 11. Billing & Cashier | `Sales Invoice`, `Payment Entry`, `POS Profile` | `Daily Cash Closing` |
| 12. Insurance | `Healthcare Insurance Company`, `Healthcare Insurance Coverage Plan` | `Insurance Pre Authorization`, `Insurance Claim`, `Insurance Claim Rejection`, `Insurance Settlement` |
| 13. Executive Dashboards | Frappe Insights / Number Cards / Dashboard Chart | `Executive KPI Snapshot` (materialized nightly via scheduler) |
| 14. Patient Portal | — | served entirely by the Next.js frontend against the API layer, `Patient` role scoped by `User` ↔ `Patient` link |

## API layer conventions

- Base path: `/api/method/healthcare_erp.api.<module>.<action>`
- Auth: Frappe API Key/Secret for service-to-service, **cookie + CSRF session** for the
  Next.js SPA in production (same-site behind Nginx), JWT-friendly token endpoint provided
  for the Patient Portal mobile use case.
- Every endpoint has: input validation, `frappe.has_permission` checks (never trust the
  frontend role), and a stable JSON envelope: `{"data": ..., "meta": {...}}` on success,
  Frappe's standard exception envelope on error.
- List endpoints support `filters`, `page`, `page_size`, `order_by` uniformly.

## Frontend architecture

- **Next.js 16 App Router**, `src/app/[locale]/...` for i18n routing (`en`, `ar`).
- **next-intl** for translation + instant switching without logout (locale cookie, no
  reload of auth state).
- **Tailwind CSS v4** + **ShadCN UI** primitives, themed via CSS variables for the brand
  palette (`--color-primary: #0F6CBD` etc.) and `16px` radius tokens; `dir="rtl"` flip via
  `<html dir>` driven by locale, with logical CSS properties (`ms-*`, `me-*`) throughout so
  RTL is never an afterthought.
- **Zustand** for local/UI state (sidebar collapse, command palette, active patient context).
- **TanStack Query** for all server state, with a typed Frappe API client
  (`src/lib/api/frappe-client.ts`) and per-module hooks (`src/lib/api/patients.ts`, etc.).
- **RBAC on the frontend** mirrors backend roles for UI gating only (menu visibility, route
  guards) — every real authorization decision is re-checked server-side.

## Design system

- Colors: primary `#0F6CBD`, success `#22C55E`, warning `#F59E0B`, danger `#EF4444`.
- Radius: `16px` (`--radius: 1rem`) on cards, inputs, buttons.
- Fonts: `Inter` (Latin), `Cairo` (Arabic) — swapped via `next/font` based on locale.
- Shell: collapsible sidebar, top bar with global search, `⌘K` command palette, KPI cards,
  responsive data tables, light/dark themes via `next-themes` + CSS variables.

## Delivery plan (module by module)

This system is being generated incrementally, in the order listed in the module map above,
with each module delivered as: DocTypes/fixtures + API endpoints + permissions + Next.js
screens + seed/demo data, committed independently. See `docs/PROGRESS.md` for live status.
