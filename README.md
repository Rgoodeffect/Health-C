# Health-C

A production-grade Hospital / Medical Center Management System built on **ERPNext 16 /
Frappe Framework 16**, with a fully custom **Next.js 16** frontend (Tailwind CSS, ShadCN-style
UI, Zustand, TanStack Query) as the only user-facing surface — English/Arabic with full RTL
support, light/dark themes, and a modern SaaS design system (not the default ERPNext Desk UI).

- **Architecture & design decisions:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Build status by module:** [`docs/PROGRESS.md`](docs/PROGRESS.md)
- **Backend app:** [`apps/healthcare_erp`](apps/healthcare_erp) — a Frappe custom app that
  extends ERPNext's Healthcare domain
- **Frontend:** [`frontend`](frontend) — Next.js 16 App Router SPA

## Quick start (development)

Backend (requires an existing Frappe bench with the `erpnext` app installed):

```bash
bench get-app healthcare_erp /path/to/Health-C/apps/healthcare_erp
bench --site your-site.local install-app healthcare_erp
bench --site your-site.local set-config healthcare_erp_frontend_url "http://localhost:3000"
bench start
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local   # point FRAPPE_BACKEND_URL at your bench, default http://localhost:8000
npm run dev
```

Then open `http://localhost:3000` — English/Arabic are available at `/en` and `/ar`.

See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
(added as those modules land) for full setup and production Docker deployment instructions.
