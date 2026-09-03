# POWER MOON CONSTRUCTION — by KUSIK

**Construction Management & Expense Tracking**

A production-ready, multi-user construction business management and financial tracking platform. Records every rupee entering and leaving every construction project — projects, clients, workers, attendance, worker payments, materials (default *and* custom), material stock, businesses/suppliers, transportation, income, expenses, deductions, budgets, cash/UPI/bank ledgers, reports, audit logs and permissions.

---

## 1. Project overview

- Company-wide and per-project real-time financial dashboards (nothing hardcoded — every total is computed from database records).
- Role-based multi-user access (Owner, Manager, Accountant, Site Staff) enforced by **Supabase Row Level Security**, not only in the UI.
- Soft delete / archive everywhere financial history exists, with full audit trail.
- Atomic financial operations via PostgreSQL functions (`record_worker_payment`, `record_material_purchase`).
- Branded PDF / Excel / CSV report exports.
- Mobile bottom navigation, Quick Add bottom sheet, offline indicator, skeleton loaders and friendly error handling.

## 2. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Create React App + CRACO), React Router 7 |
| Data layer | Supabase PostgreSQL via `@supabase/supabase-js` |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (`documents` bucket, private) |
| Styling | Tailwind CSS + shadcn/ui (dark premium ERP theme) |
| Charts | Recharts |
| Server state | TanStack React Query |
| Reports | jsPDF + jspdf-autotable (PDF), SheetJS/xlsx (Excel), native CSV |

## 3. Installation

```bash
cd frontend
yarn install
```

## 4. Environment variables

Copy `frontend/.env.example` → `frontend/.env`:

```
REACT_APP_SUPABASE_URL=https://<your-project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your anon / publishable key>
```

Only the **public** URL and anon key are used in the frontend. **Never** put `SUPABASE_SERVICE_ROLE_KEY` in the frontend or in this repo.

## 5. Supabase project creation

1. Create a project at https://supabase.com.
2. Copy **Project URL** and **anon public key** from *Project Settings → API* into `frontend/.env`.
3. In *Authentication → Providers*, keep **Email** enabled. For instant testing, disable "Confirm email" in *Authentication → Sign In / Providers → Email*.
4. In *Authentication → URL Configuration*, add your app origin as a Redirect URL (needed for the password-reset link `<origin>/reset`).

## 6. Database migration instructions

Open the Supabase **SQL Editor**, paste the whole contents of:

```
supabase/migration.sql          # core schema (run first)
supabase/migration_phase3.sql   # purchase orders, daily site reports, site issues
```

and run it once. It is idempotent-friendly (`create table if not exists`, `drop policy if exists`) so it can be re-run safely after edits.

It creates: all tables, foreign keys, indexes, constraints, `updated_at` triggers, auto-numbering (`PMC-2026-001`, `EXP-2026-00001`, `INC-`, `PAY-`, `PO-`), atomic financial functions, RLS policies, Storage bucket + policies, and seed data.

## 7. RLS setup

RLS is enabled on every table by the migration. Helper functions used by the policies:

- `my_role()` — current user's role from `profiles`
- `is_owner()` — true for the Owner
- `is_member(project_id)` — Owner, or a row in `project_members`
- `can_write(project_id)` — Owner, or a member with `can_add`/`can_edit`

Project-scoped tables (`expenses`, `incomes`, `deductions`, `worker_attendance`, `worker_payments`, `material_purchases`, `transportation`, `ledger_transfers`, `project_budgets`, `material_stock_movements`) allow `select` only for project members and `insert/update` only where `can_write()` is true. Hard `delete` is Owner-only everywhere. Users can never elevate their own role (the self-update policy pins `role`).

## 8. Storage setup

The migration creates a **private** `documents` bucket with authenticated-only read/write policies and owner-or-Owner delete. Supported uploads: JPG, PNG, WEBP, PDF. Files are served through signed URLs, never public URLs.

## 9. Seed data

Inserted automatically by the migration:

- 8 default work categories (Brick, Road, Plumber, Electric, Door & Window, Plaster, Colour/Paint, Tile Work)
- 10 material categories
- 16 default materials (Cement, Sand, Bricks, Stone, Steel, Tiles, Paint, Electrical, Plumbing, Wood, Glass, Doors, Windows, Hardware, Pipes, Wires)

Expense categories, payment methods and worker types are fixed system enumerations shown in Settings → Master Data.

**No demo/sample financial data is seeded** — the ledger starts empty and truthful.

## 10. Running locally

```bash
cd frontend
yarn start          # http://localhost:3000
```

The first account you create through **Signup** automatically becomes the **Owner** (handled by the `handle_new_user` trigger). Every later signup starts as **Site Staff** and is promoted by the Owner in *Settings → Users*.

## 11. Production build

```bash
cd frontend
yarn build          # outputs frontend/build
```

## 12. Deployment

Deploy the static `build/` output to any static host (Vercel, Netlify, Cloudflare Pages, S3+CloudFront). Set `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` in the host's environment and add the deployed origin to Supabase → Authentication → URL Configuration.

## 13. User roles

| Role | Capability summary |
|---|---|
| **Owner / Admin** | Everything: projects, transactions, workers, materials, suppliers, users, permissions, settings, restore archived records, permanent delete, audit logs |
| **Manager** | View projects, add/edit expenses & income, manage workers/materials/transportation, project progress, reports. Cannot manage users or permanently delete |
| **Accountant** | Financial view, income, expenses, worker/supplier payments, ledgers, transfers, deductions, report exports |
| **Site Staff** | Workers, attendance, site expenses, material purchases, transportation for assigned projects. No user management, no permanent delete, no financial settings |

## 14. Permission model

Two layers, both enforced in the database:

1. **Global role** (`profiles.role`) — gates which modules a user can read/write.
2. **Project membership** (`project_members`) — per-project `can_view / can_add / can_edit / can_delete / financial_access / report_access`. The Owner implicitly has access to every project.

The UI mirrors these rules (`useAuth().can(module, 'r'|'w')`) purely for UX; the database is the source of truth.

## 14b. Receipts, invoices, quotations and offline mode

- **Receipts / bills**: Expenses, Income and Material Purchases have a *Receipt* field that uploads JPG/PNG/WEBP/PDF (max 10 MB) to the private `documents` bucket, records a row in `attachments`, and offers View / Download via short-lived signed URLs.
- **Invoices** (`/invoices`) and **Quotations** (`/quotations`): line items with unit, quantity and rate; automatic subtotal, discount, tax and grand total; statuses; auto numbers `INV-YYYY-00001` / `QTN-YYYY-00001`; branded PDF export; archive/restore; audit logged.
- **Offline mode**: when the device is offline (or the request fails with a network error) a new record is stored in a local queue, the user is told "Your changes are pending synchronization", and a **Pending sync (n)** badge appears in the header. The queue auto-retries when connectivity returns and every 30 s, uses idempotency keys so nothing is ever double-posted, and shows **Failed sync (n)** with a tap-to-retry action if the server rejected an entry. Financial data is never silently dropped.

## 15. Troubleshooting

| Symptom | Fix |
|---|---|
| `ERROR: 42P01 relation "public.project_members" does not exist` while running the migration | You are running an old copy of the file. The current `supabase/migration.sql` sets `check_function_bodies = off` at the top; copy the whole current file and run it again. |
| Dashboard shows "Unable to load your data" | The migration has not been run yet. Run `supabase/migration.sql`. |
| Login works but every list is empty for a non-Owner | The user has no `project_members` rows. Owner → Settings → Users → *Assign project*. |
| "Permission denied" toast | RLS blocked the action for this role/project. Check the user's role and project permissions. |
| "Duplicate transaction prevented." | A unique idempotency key or reference collided — the record was **not** double-saved. |
| Signup succeeds but login fails | Email confirmation is enabled in Supabase. Confirm the email or disable confirmation for testing. |
| Password reset link errors | Add your app origin to Supabase → Authentication → URL Configuration → Redirect URLs. |
| Numbers look stale after saving | All mutations invalidate React Query caches; if you edited data directly in Supabase, reload the page. |

---

© POWER MOON CONSTRUCTION · **by KUSIK** — Construction Management & Expense Tracking
