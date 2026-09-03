# PRD — POWER MOON CONSTRUCTION (by KUSIK)

## Original problem statement
Build a complete, production-ready multi-user construction management and financial tracking application named **POWER MOON CONSTRUCTION — by KUSIK**, subtitle *Construction Management & Expense Tracking*. Real database operations, Supabase auth/storage/RLS, role-based authorization, financial calculations, reports (PDF/Excel/CSV), responsive all-device layouts, validation, error handling, audit logs, soft delete/archive. 78 numbered requirement sections; no mockups or fake data.

## User choices (verbatim)
- Backend/DB: "I have a Supabase project and will provide URL + anon key"
- Auth: "JWT email/password" (Supabase Auth email/password)
- Scope for first build: "Core: Auth+roles, Projects, Work Categories, Expenses, Income, Workers+Attendance+Payments, Materials+Custom+Stock, Suppliers, Transportation, Ledgers, Dashboard, Reports (PDF/Excel/CSV), Audit logs, Archive"
- Design: "Dark premium ERP look"
- Seed data: "No, empty"
- Migration: "generate the SQL file and I'll run it"

## Architecture
- **Frontend**: React 19 (CRA + CRACO), React Router 7, Tailwind + shadcn/ui, Recharts, TanStack Query, sonner toasts.
- **Data/Auth/Storage**: Supabase (PostgreSQL + Auth + private `documents` bucket). Frontend talks to Supabase directly with the anon key; all authorization is enforced by RLS.
- **Financial engine**: PostgreSQL functions `record_worker_payment()` and `record_material_purchase()` perform payment/purchase + mirrored project expense + stock movement + audit log atomically.
- **Numbering**: `next_number()` + `counters` table → `PMC-YYYY-001`, `EXP-YYYY-00001`, `INC-`, `PAY-`, `PO-`.
- **Key files**: `supabase/migration.sql`, `frontend/src/lib/{supabase,finance,exports,fmt,clean,audit}.js`, `frontend/src/components/{Crud.jsx,Shell.jsx}`, `frontend/src/context/AuthContext.jsx`, `frontend/src/pages/*`.

## Core requirements (static)
Record every rupee in/out per project; per-project and company-wide real-time financials; roles Owner/Manager/Accountant/Site Staff plus per-project permissions; archive instead of destructive delete; audit history; branded reports; mobile/iPad/desktop layouts.

## Implemented (2026-06)
- Supabase migration: 25+ tables, UUID PKs, FKs, indexes, check constraints, `updated_at` triggers, auto-numbering, RLS on every table, storage bucket + policies, atomic financial RPCs, seed work/material categories + 16 default materials, profile auto-creation trigger + backfill for pre-existing auth users.
- Auth: login, signup (Full Name/Email/Phone/Password/Confirm), show/hide password, forgot password, reset password, session persistence, disabled-account handling, loading states, friendly errors, "Database setup required" state.
- Role matrix in `AuthContext` (UI gating) mirrored by RLS (DB enforcement); Owner-only permanent delete; Owner-only user role/active toggles and project access assignment.
- Modules: Dashboard (company overview, charts, smart alerts, recent transactions, project cards with health score), Projects (CRUD + archive/restore + auto code), Project Detail (Overview/Work/Financial/Resources/Reports tabs, budgets with 75/90/100% warnings, cost forecasting, health score, work-category drilldown), Expenses, Income, Deductions, Workers (earned/paid/outstanding), Attendance (one-tap P/½/A/OT, overtime, bulk save, copy previous day, auto payable), Worker Payments (atomic RPC), Materials (default + custom, low-stock badges), Purchases & Stock (atomic RPC, stock usage/adjustment, stock table), Businesses/Suppliers (dues), Transportation (trips × rate + extras), Ledgers (cash/UPI/bank + internal transfers that don't hit P&L), Reports (17 report types, 8 period presets, PDF/Excel/CSV), Audit Log (old → new diff viewer), Settings (users, project access, master data, business info).
- UX: dark ERP theme (Sora + IBM Plex Sans/Mono), skeleton loaders, empty states with branding, confirmation dialogs, inline validation, mobile bottom nav, Quick Add bottom sheet, offline indicator, error boundary, `data-testid` coverage.

## Implemented — phase 2 (2026-06)
- **Receipt uploads**: `lib/storage.js` + `FileField` component; `type: "file"` field in the generic form engine; wired into Expenses, Income and Material Purchases (`receipt_url`); private `documents` bucket, `attachments` table row per upload, signed-URL view/download, 10 MB and JPG/PNG/WEBP/PDF validation. `record_material_purchase()` now accepts `p_receipt_url` so the receipt survives the atomic create.
- **Invoices & Quotations**: `invoices`/`invoice_items`/`quotations`/`quotation_items` tables with RLS, auto numbering `INV-YYYY-00001` / `QTN-YYYY-00001`; shared `DocumentModule` with dynamic line items, subtotal/discount/tax/grand total, statuses, paid amount + balance for invoices, validity + terms for quotations, branded PDF export, archive/restore, audit logging.
- **Offline site entry**: `lib/offline.js` localStorage queue with idempotency keys, auto-sync on `online` and every 30 s, duplicate-safe replay, failed-item retry; `SyncStatus` badge in the header ("Pending sync (n)" / "Failed sync (n) — retry"); CrudPage falls back to the queue when offline or on network errors and toasts "Your changes are pending synchronization."

## Implemented — phase 3 (2026-06)
- **View / transaction detail drawer** on every list: tap a row (or the eye button `view-<id>`) to open full details with Edit, **Duplicate** (creates a fresh record with its own ref), **Print** (branded PDF), receipt View/Download and Archive. Rich detail layouts for expenses, income, materials (full stock position), workers (earned/paid/advance/outstanding/last payment), businesses (purchases/paid/due) and purchase orders.
- **Purchase orders**: `purchase_orders` table with the workflow requested → approved → ordered → received → billed → paid, auto number `PORD-YYYY-00001`, auto total (qty × rate + transport), and an atomic `receive_purchase_order()` RPC that posts the material purchase + stock movement + project expense + audit log; double-receive rejected.
- **Daily site reports**: `daily_site_reports` (+ `site_issues`) with weather, workers present, work completed, materials received/consumed, equipment, transportation, expenses, issues, delays, site photo upload, auto number `DSR-YYYY-00001`, one report per project per day, and a branded per-report PDF.
- **Inline custom entries**: any material / work-category / material-category picker now has a `+` button to type a brand-new value, which is saved to Supabase, auto-selected and instantly available in every other picker and in Settings → Master Data. Duplicate names are reported and the existing entry is selected.
- Bug fixes from testing iterations 2 & 3: profile-fetch retry so a valid user never sees "Database setup required"; missing-table pages now show an actionable "Database update needed" panel instead of endless skeletons; duplicate inline-create no longer fails silently; Recharts sizing warnings removed and negative ledger cards are flagged in red with an explanation.
- Phase-3 SQL lives in `supabase/migration_phase3.sql` (verified locally: clean + idempotent + full workflow smoke test in `supabase/_local_smoke_phase3.sql`).

## Known gaps / blocked
- Migration bug fixed (2026-06): `set check_function_bodies = off` (helper functions referenced `project_members` before it existed), `next_number()` ON CONFLICT qualification, and split `set_invoice_no()`/`set_quotation_no()` triggers. Verified by testing agent on local Postgres 15: clean first run, idempotent second run, functional smoke test (numbering, atomic RPCs, stock math, duplicate protection, archive-preserves-history) and RLS enforcement all pass. Explicit GRANTs for `authenticated`/`anon` appended for portability. Dry-run harness: `supabase/_local_stubs.sql`, `supabase/_local_smoke.sql`.
- **BLOCKER**: `supabase/migration.sql` has not been executed on the user's Supabase project yet (verified: `PGRST205 table not found`). The container cannot reach the DB (IPv6-only direct host, pooler reports "tenant not found"), so it must be run once from the Supabase SQL Editor. Until then, no data flows and end-to-end testing is not possible.
- "Confirm email" is left ON in Supabase, so new signups need email confirmation. A pre-confirmed Owner account was created via the Admin API: `powermoontech@gmail.com`.

## Prioritized backlog
- **P0**: Run migration, then full end-to-end verification of every module with the testing agent.
- **P1**: Transaction detail drawer (duplicate/print/receipt); purchase-order workflow states; clients module UI; photo progress gallery.
- **P2**: Approval workflows and thresholds; daily site reports; tasks (Kanban) and site issues; equipment & vehicles with expiry alerts; BOQ and work-progress quantities; global search; notifications centre; light mode.

## Next tasks
1. Execute `supabase/migration.sql` in the Supabase SQL Editor.
2. Verify Owner login → create project → expense/income → attendance → payment → purchase → reports.
3. Implement receipt upload + transaction detail drawer.
4. Invoices, quotations and purchase orders with branded PDFs.
