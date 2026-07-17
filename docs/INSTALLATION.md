# Installation Guide (development / bare-metal bench)

For a containerized setup instead, see [`DEPLOYMENT.md`](DEPLOYMENT.md). This guide is for
running the app directly against an existing Frappe bench — e.g. for local development of
`healthcare_erp` itself.

## Prerequisites

- Ubuntu 24.04 (or similar), Python 3.11+, Node.js 18+, MariaDB 10.6+, Redis 6+
- [`bench`](https://github.com/frappe/bench) CLI installed (`pip install frappe-bench`)
- A working Frappe bench with **ERPNext 16** already installed on a site, and the
  **Healthcare** domain enabled (Home Workspace → Domain Settings → Healthcare)

## 1. Get the app into your bench

```bash
cd ~/frappe-bench
bench get-app healthcare_erp /path/to/Health-C/apps/healthcare_erp
```

## 2. Install it on your site

```bash
bench --site your-site.local install-app healthcare_erp
```

This runs `healthcare_erp.setup.install.after_install`, which:

- creates the `Healthcare ERP` Module Def
- creates any of the 13 custom roles (CEO, Medical Director, Finance Director,
  Receptionist, Doctor, Nurse, Laboratory Technician, Radiologist, Pharmacist, Cashier,
  Insurance Officer) that don't already exist
- syncs the full role/permission matrix (`healthcare_erp/setup/roles.py`)
- sets sensible `Healthcare Settings` defaults (Patient naming via naming series, etc.)

Fixtures (Custom Fields, Property Setters, the seeded ICD-10 code list) are applied
automatically as part of `bench get-app`/`install-app`'s fixture sync — no extra step needed.

## 3. Point the app at your Next.js frontend

The Desk redirect page (`www/healthcare_erp/redirect.py`) and any server-generated links use
this site config value:

```bash
bench --site your-site.local set-config healthcare_erp_frontend_url "http://localhost:3000"
```

## 4. Build the frontend

```bash
cd /path/to/Health-C/frontend
npm install
cp .env.example .env.local   # set FRAPPE_BACKEND_URL to your bench's URL, e.g. http://your-site.local:8000
npm run dev                  # or `npm run build && npm start` for a production-like run
```

Visit `http://localhost:3000` — you'll be redirected to `/en` (or `/ar` if that's your
browser's preferred language / your saved preference).

## 5. Create your first users

Through the Frappe Desk (`/app`, Administrator only) create Users and assign them the
appropriate role(s) from the list above (a User can hold more than one). For a **Patient**
portal user, create/edit the `Patient` record and set its `User` field — the app
automatically grants the `Patient` role and scopes their portal access to just that record
the moment the link is saved (see `healthcare_erp/healthcare_erp/doc_events/patient.py`).

## 6. Scheduler

Make sure the bench scheduler is enabled so the background jobs in
`healthcare_erp/healthcare_erp/tasks.py` (critical-alert sync, appointment reminders, drug
expiry checks, nightly executive KPI snapshot, stale queue-token cleanup) actually run:

```bash
bench --site your-site.local scheduler enable
bench schedule   # or run under supervisor/systemd in production — see DEPLOYMENT.md
```

## Troubleshooting

- **"DocType X does not exist" errors after install** — run `bench --site your-site.local
  migrate` again; new DocType folders sometimes need a second migrate pass on first install
  in older bench versions.
- **Custom fields didn't show up** — run `bench --site your-site.local migrate` to force a
  fixture re-sync.
- **A portal user can see other patients' data** — check that their `Patient.user_id` is set
  and that a corresponding `User Permission` (`Allow: Patient`, `Apply to all DocTypes`) exists
  for them; it's created automatically on `Patient` save but can be re-created manually via
  the Desk if it was deleted.
