# Build Progress

Legend: ✅ done · 🚧 in progress · ⬜ queued

| # | Module | Backend (DocTypes/API/Perms) | Frontend | Seed Data |
|---|---|---|---|---|
| 0 | Platform foundation (app skeleton, roles, auth, design system, shell, i18n) | ✅ | ✅ | ⬜ |
| 1 | Patient Registration | ✅ | ✅ | ⬜ |
| 2 | Appointments | ✅ | ✅ | ⬜ |
| 3 | Reception | ⬜ | ⬜ | ⬜ |
| 4 | Consultation & EMR | ⬜ | ⬜ | ⬜ |
| 5 | Prescription Management | ⬜ | ⬜ | ⬜ |
| 6 | Laboratory (LIS) | ⬜ | ⬜ | ⬜ |
| 7 | Radiology (RIS) | ⬜ | ⬜ | ⬜ |
| 8 | Admission & Bed Management | ⬜ | ⬜ | ⬜ |
| 9 | Surgery & Operating Theatre | ⬜ | ⬜ | ⬜ |
| 10 | Pharmacy | ⬜ | ⬜ | ⬜ |
| 11 | Billing & Cashier | ⬜ | ⬜ | ⬜ |
| 12 | Insurance Management | ⬜ | ⬜ | ⬜ |
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

**Not yet built:** demo/seed data fixtures, and modules 3–14's own doctypes/screens (the
Patient 360 tabs already render live data from core ERPNext doctypes as those modules land —
no frontend rework needed later, just backend doctypes + richer detail screens).
