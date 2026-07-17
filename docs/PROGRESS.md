# Build Progress

Legend: ✅ done · 🚧 in progress · ⬜ queued

| # | Module | Backend (DocTypes/API/Perms) | Frontend | Seed Data |
|---|---|---|---|---|
| 0 | Platform foundation (app skeleton, roles, auth, design system, shell, i18n) | ✅ | ✅ | ⬜ |
| 1 | Patient Registration | ✅ | ✅ | ⬜ |
| 2 | Appointments | ✅ | ✅ | ⬜ |
| 3 | Reception | ✅ | ✅ | ⬜ |
| 4 | Consultation & EMR | ✅ | ✅ | ✅ |
| 5 | Prescription Management | ✅ | ✅ | ⬜ |
| 6 | Laboratory (LIS) | ✅ | ✅ | ⬜ |
| 7 | Radiology (RIS) | ✅ | ✅ | ⬜ |
| 8 | Admission & Bed Management | ✅ | ✅ | ⬜ |
| 9 | Surgery & Operating Theatre | ✅ | ✅ | ⬜ |
| 10 | Pharmacy | ✅ | ✅ | ⬜ |
| 11 | Billing & Cashier | ✅ | ✅ | ⬜ |
| 12 | Insurance Management | ✅ | ✅ | ⬜ |
| 13 | Executive Dashboards | ⬜ | ⬜ | ⬜ |
| 14 | Patient Portal | ⬜ | ⬜ | ⬜ |
| — | Docker deployment (dev + prod) | ⬜ | | |
| — | Installation / Deployment guides | ⬜ | | |

Each row is committed to `claude/healthcare-management-system-xxor9g` as it completes.

## What's actually in place right now

**Module 0 — Platform foundation**
- Frappe custom app `apps/healthcare_erp` scaffolded (`hooks.py`, `modules.txt`, `setup.py`,
  `requirements.txt`), installable into any Frappe 16/ERPNext 16 bench.
- Role/permission matrix (`healthcare_erp/setup/roles.py`) with idempotent sync on
  install/migrate, covering all 13 non-Administrator roles from the spec.
- Shared API envelope + pagination helpers (`healthcare_erp/api/utils.py`) and session/auth
  endpoint (`healthcare_erp/api/auth.py`) used by every module's API.
- Next.js 16 App Router app (`frontend/`) verified to build (`npm run build`) and serve
  (`npm run dev`) both `/en` and `/ar` routes with correct `dir="rtl"`/`dir="ltr"`, dark/light
  theme via `next-themes`, full ShadCN-style UI kit (button, card, dialog, sheet, command
  palette, tabs, table, select, etc.), collapsible sidebar + topbar + ⌘K command palette,
  Zustand UI store, and a typed TanStack Query client against the Frappe API.

**Module 1 — Patient Registration**
- Custom Fields on `Patient` (National ID, Passport, QR code, insurance summary) +
  Property Setter switching `Patient` naming to the `MRN-.YYYY.-.#####` series, so the MRN
  *is* the Patient ID.
- QR code auto-generated on patient creation (`doc_events/patient.py`), linking a scanned
  wristband/card straight to the Patient 360 profile URL.
- Portal user auto-scoping: creating a Patient linked to a Website User automatically grants
  the `Patient` role and a `User Permission` restricting that user to their own record.
- `healthcare_erp/api/patients.py`: list/create/update + a `patient_360` aggregation endpoint
  that reads across every module's doctypes (appointments, encounters, lab, radiology,
  admissions, surgery, billing, insurance, documents) for the profile's tabs.
- Frontend: patient list with search/pagination/register dialog, and the full Patient 360
  profile page with all 11 tabs, wired end-to-end to the API above.

**Module 2 — Appointments**
- `Appointment Waiting List` doctype (new) alongside core `Patient Appointment`.
- `healthcare_erp/api/appointments.py`: day/week/month range queries, drag-and-drop
  reschedule, cancel, and waiting-list CRUD with auto-fulfillment when a matching
  appointment is booked for a waiting patient.
- Frontend: day/week/month calendar with native HTML5 drag-and-drop rescheduling on the
  week grid, and month-view drill-down into a day.

**Module 3 — Reception**
- `Reception Queue Token` doctype (date-scoped naming series `TKN-YYYY-MM-DD-###`).
- `healthcare_erp/api/reception.py`: check-in, live queue, call-next (priority-ordered),
  status updates, payment verification, and a PII-minimal waiting-room-display endpoint.
- `healthcare_erp/tasks.py` added (scheduler jobs referenced by `hooks.py` since the
  foundation commit had no implementation yet) — each job guards on the doctypes it needs
  so it safely no-ops until that module is installed.
- Frontend: reception desk screen (search-to-check-in, live queue table with actions) and a
  separate kiosk-style `/reception-display` route (no app chrome) for a lobby TV.

**Module 4 — Consultation & EMR**
- `Clinical Alert` + `ICD10 Code` doctypes (new), Custom Fields on core `Patient Encounter`
  for chief complaint/history/examination/treatment plan/follow-up/clinical notes (core only
  models symptoms/diagnosis as child tables), 32 seeded ICD-10 codes.
- `healthcare_erp/api/encounters.py`: create/update/submit encounters, ICD-10 search, vitals
  against core `Vital Signs`, clinical alerts, and a cross-module medical timeline. Added a
  `set_if_field_exists()` helper so writes to core doctypes degrade gracefully if a field
  isn't present on a given ERPNext version. Also fixed a Module-1 bug where the patients API
  queried Patient Encounter's `symptoms`/`diagnosis` as if they were scalar fields.
- Frontend: EMR workspace — patient search, consultation form with ICD-10 autocomplete and
  real voice dictation (Web Speech API, graceful fallback), past consultations with sign-off,
  clinical alerts panel, medical timeline.

**Module 5 — Prescription Management**
- `Patient Allergy` child doctype wired onto `Patient` (and fixed the Module-1 bug where
  allergies were queried as a scalar field), `Drug Interaction Rule`, `Prescription Refill`.
- `healthcare_erp/api/prescriptions.py`: drug search over core `Item`, allergy-conflict and
  drug-interaction checks, prescribing (appends to the encounter's Drug Prescription rows +
  creates a refill tracker), refill requests, and a printable-prescription data endpoint.
- Frontend: prescribing workflow with live allergy/interaction warnings, refill tracking
  table, and a print action rendering a clean prescription via `window.print()`.

**Module 6 — Laboratory Information System**
- `Sample Barcode Label`, `Lab QC Run`, `Analyzer Result Inbox` doctypes; Custom Fields add a
  result summary + critical-result flag to core `Lab Test`.
- `healthcare_erp/api/laboratory.py`: order creation, sample collection with Code128 barcode
  generation, result entry (auto Clinical Alert + realtime push on critical results),
  verification, QC run recording, and an analyzer-integration inbox that queues incoming
  results for technician review instead of writing directly to a patient record.
- Frontend: order/collect/result/verify workflow, barcode label dialog with print, unverified
  critical-results view, QC run log.

**Module 7 — Radiology Information System**
- `Modality`, `Radiology Order`, `Radiology Report`, `PACS Study Reference` doctypes (no core
  ERPNext equivalent for imaging).
- `healthcare_erp/api/radiology.py`: order/schedule/report workflow with automatic Clinical
  Alert + realtime push on critical findings, modality management, and a PACS-ready endpoint
  storing DICOM study/accession identifiers + a viewer deep-link.
- Frontend: order/schedule/report workflow with priority + critical-finding badges, and
  modality management.

**Module 8 — Admission & Bed Management**
- `Bed Transfer Request`, `Nursing Note` doctypes alongside core `Inpatient Record` /
  `Healthcare Service Unit`.
- `healthcare_erp/api/admissions.py`: bed board occupancy summary, admission requests, bed
  assignment, transfer request/completion, discharge, nursing notes — all defensively
  read/written via `set_if_field_exists()`.
- Frontend: bed board with occupancy bars per ward, admission -> assign bed -> transfer ->
  discharge workflow, nursing notes screen.

**Module 9 — Surgery & Operating Theatre**
- Surgery Request (+ Surgical Team Member child table), OT Schedule, Pre Op Checklist,
  Anesthesia Record, Surgery Note, Recovery Room Log, Implant Tracking doctypes.
- `healthcare_erp/api/surgery.py`: request -> team assignment -> OR scheduling (with
  double-booking prevention) -> pre-op checklist -> anesthesia -> surgery note (closes out
  the request) -> recovery room -> implant tracking.
- Frontend: request list with a per-surgery management dialog covering the full workflow,
  plus a recovery room board.

**Module 10 — Pharmacy**
- `Dispensing Log`, `Controlled Drug Register` doctypes alongside core `Item`/`Batch`/
  `Stock Entry`; Custom Fields flag controlled substances + schedule on `Item`.
- `healthcare_erp/api/pharmacy.py`: drug/batch search, expiring-batch alerts, dispensing
  (witness-gated for controlled substances, running balance in the register), stock
  transfers via core Stock Entry, stock level lookups via core Bin.
- Frontend: dispensing workflow with witness gate, expiring-batches view, controlled drug
  register.

**Module 11 — Billing & Cashier**
- `Daily Cash Closing` doctype (auto-computes total collected + cash variance) alongside core
  `Sales Invoice`/`Payment Entry`; implemented `doc_events/billing.py` (referenced since the
  foundation commit but not yet built) to roll POS cash invoices into the cashier's daily
  closing automatically.
- `healthcare_erp/api/billing.py`: invoice creation with immediate POS payment, payment
  recording across Cash/Card/Bank Transfer/Mobile Payment, deposits, refunds, revenue
  summary, cash-closing submission.
- Frontend: invoicing + payment recording, deposits/refunds, daily cash closing with history.

**Module 12 — Insurance Management**
- `Insurance Pre Authorization`, `Insurance Claim`, `Insurance Claim Rejection`,
  `Insurance Settlement` doctypes alongside core `Healthcare Insurance Company`/`Coverage Plan`.
- `healthcare_erp/api/insurance.py`: eligibility verification, pre-authorization
  request/approval, claim creation/submission, rejection + resubmission tracking, settlement
  recording with Full Coverage/Co-Payment/Deductible support.
- Frontend: eligibility check, pre-authorization workflow, claims with submit/reject/settle,
  open-rejections resubmission panel, settlements ledger.

**Not yet built:** demo/seed data for modules 0–3/5–12, and modules 13–14's own doctypes/screens (the
Patient 360 tabs already render live data from core ERPNext doctypes as those modules land —
no frontend rework needed later, just backend doctypes + richer detail screens).
