-- =====================================================================
-- POWER MOON CONSTRUCTION  by KUSIK
-- Complete Supabase migration: tables, indexes, functions, triggers,
-- RLS policies, storage policies and seed data.
-- Run this ONCE in the Supabase SQL editor of a fresh project.
-- =====================================================================

create extension if not exists "pgcrypto";

-- Allow helper functions to reference tables created later in this script.
set check_function_bodies = off;

-- ---------------------------------------------------------------- ENUM-ish
do $$ begin
  create type app_role as enum ('owner','manager','accountant','site_staff');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  role app_role not null default 'site_staff',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- First registered user becomes the owner, everyone else site_staff.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  select count(*) into cnt from public.profiles;
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.email,
    new.raw_user_meta_data->>'phone',
    case when cnt = 0 then 'owner'::app_role else 'site_staff'::app_role end
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- HELPERS
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role::text from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'owner', false)
$$;

create or replace function public.is_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner()
      or exists (select 1 from public.project_members m
                 where m.project_id = pid and m.user_id = auth.uid())
$$;

create or replace function public.can_write(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner()
      or exists (select 1 from public.project_members m
                 where m.project_id = pid and m.user_id = auth.uid()
                   and (m.can_add or m.can_edit))
$$;

-- Sequential document numbers: PMC-2026-001, EXP-2026-00452 ...
create table if not exists public.counters (
  key text primary key,
  value bigint not null default 0
);

create or replace function public.next_number(p_prefix text, p_pad int default 5)
returns text language plpgsql security definer set search_path = public as $$
declare k text; v bigint; y text := to_char(now(),'YYYY');
begin
  k := p_prefix || '-' || y;
  insert into public.counters(key, value) values (k, 1)
  on conflict (key) do update set value = counters.value + 1
  returning counters.value into v;
  return k || '-' || lpad(v::text, p_pad, '0');
end $$;

-- ---------------------------------------------------------------- CLIENTS
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text, phone text, email text, address text, gst text, notes text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- PROJECTS
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  contract_amount numeric(16,2) not null default 0,
  start_date date, expected_completion date, actual_completion date,
  location text, manager_id uuid references public.profiles(id),
  description text,
  status text not null default 'planning'
    check (status in ('planning','active','on_hold','completed','archived')),
  progress int not null default 0 check (progress between 0 and 100),
  opening_cash numeric(16,2) not null default 0,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  deleted_at timestamptz, deleted_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.projects_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.next_number('PMC', 3);
  end if;
  return new;
end $$;
drop trigger if exists trg_projects_code on public.projects;
create trigger trg_projects_code before insert on public.projects
for each row execute function public.projects_before_insert();

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role app_role not null default 'site_staff',
  can_view boolean not null default true,
  can_add boolean not null default true,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  financial_access boolean not null default false,
  report_access boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ------------------------------------------------------- WORK CATEGORIES
create table if not exists public.work_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.project_budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  work_category_id uuid references public.work_categories(id) on delete cascade,
  expense_category text,
  budget_amount numeric(16,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- WORKERS
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text, phone text,
  worker_type text not null default 'Helper',
  daily_wage numeric(12,2) not null default 0,
  work_category_id uuid references public.work_categories(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  joining_date date, status text not null default 'active',
  notes text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_attendance (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  status text not null default 'present' check (status in ('present','absent','half_day','overtime')),
  days numeric(4,2) not null default 1,
  wage numeric(12,2) not null default 0,
  overtime_hours numeric(5,2) not null default 0,
  overtime_amount numeric(12,2) not null default 0,
  payable numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (worker_id, date)
);

create table if not exists public.worker_payments (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique,
  worker_id uuid not null references public.workers(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric(16,2) not null check (amount > 0),
  date date not null default current_date,
  payment_method text not null default 'cash',
  kind text not null default 'payment' check (kind in ('payment','advance','deduction')),
  reference text, notes text,
  idem_key text unique,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- SUPPLIERS
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_person text, phone text, address text, gst text,
  category text, notes text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- MATERIALS
create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  unit text not null default 'nos',
  default_rate numeric(14,2) not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  min_stock numeric(14,3) not null default 0,
  opening_stock numeric(14,3) not null default 0,
  description text,
  status text not null default 'active',
  is_custom boolean not null default true,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.material_purchases (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  material_id uuid not null references public.materials(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_category_id uuid references public.work_categories(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text, rate numeric(14,2) not null default 0,
  material_cost numeric(16,2) not null default 0,
  transport_cost numeric(16,2) not null default 0,
  total numeric(16,2) not null default 0,
  date date not null default current_date,
  bill_number text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  paid_amount numeric(16,2) not null default 0,
  notes text, receipt_url text,
  idem_key text unique,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  movement_type text not null check (movement_type in ('purchase','usage','adjustment','opening')),
  quantity numeric(14,3) not null,
  reason text, date date not null default current_date,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- FINANCE
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null default current_date,
  category text not null default 'other'
    check (category in ('labor','material','transportation','food','travel','hotel','equipment','other')),
  work_category_id uuid references public.work_categories(id) on delete set null,
  description text,
  amount numeric(16,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  paid_to text,
  worker_id uuid references public.workers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  material_id uuid references public.materials(id) on delete set null,
  quantity numeric(14,3), unit text,
  bill_number text, reference_number text, notes text, receipt_url text,
  idem_key text unique,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null default current_date,
  amount numeric(16,2) not null check (amount > 0),
  received_from text,
  payment_method text not null default 'cash',
  purpose text, reference text, notes text, receipt_url text,
  idem_key text unique,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deductions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null default current_date,
  kind text not null default 'other'
    check (kind in ('advance_adjustment','material','labor','damage','penalty','client','other')),
  amount numeric(16,2) not null check (amount > 0),
  description text, worker_id uuid references public.workers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transportation (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  work_category_id uuid references public.work_categories(id) on delete set null,
  vehicle text, driver text, from_location text, to_location text,
  material_id uuid references public.materials(id) on delete set null,
  quantity numeric(14,3), trips int not null default 1,
  rate numeric(14,2) not null default 0,
  fuel_cost numeric(14,2) not null default 0,
  loading_cost numeric(14,2) not null default 0,
  unloading_cost numeric(14,2) not null default 0,
  total numeric(16,2) not null default 0,
  payment_method text not null default 'cash',
  date date not null default current_date, notes text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_transfers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  from_account text not null, to_account text not null,
  amount numeric(16,2) not null check (amount > 0),
  date date not null default current_date,
  reference text, notes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) default auth.uid(),
  user_name text,
  action text not null,
  table_name text not null,
  record_id uuid,
  project_id uuid references public.projects(id) on delete set null,
  old_value jsonb, new_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null, body text, level text default 'info',
  link text, is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- NUMBERING
create or replace function public.set_ref_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref_no is null or new.ref_no = '' then
    new.ref_no := public.next_number(tg_argv[0], 5);
  end if;
  return new;
end $$;

drop trigger if exists trg_exp_ref on public.expenses;
create trigger trg_exp_ref before insert on public.expenses
for each row execute function public.set_ref_no('EXP');
drop trigger if exists trg_inc_ref on public.incomes;
create trigger trg_inc_ref before insert on public.incomes
for each row execute function public.set_ref_no('INC');
drop trigger if exists trg_pay_ref on public.worker_payments;
create trigger trg_pay_ref before insert on public.worker_payments
for each row execute function public.set_ref_no('PAY');
drop trigger if exists trg_mp_ref on public.material_purchases;
create trigger trg_mp_ref before insert on public.material_purchases
for each row execute function public.set_ref_no('PO');

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

do $$ declare t text;
begin
  foreach t in array array['profiles','clients','projects','workers','worker_payments',
    'suppliers','materials','material_purchases','expenses','incomes','deductions','transportation']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
      for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- --------------------------------------------- ATOMIC WORKER PAYMENT (RPC)
-- Creates the payment, mirrors it as a labor expense and writes an audit log
-- inside a single database transaction.
create or replace function public.record_worker_payment(
  p_worker_id uuid, p_project_id uuid, p_amount numeric, p_date date,
  p_method text, p_kind text, p_reference text, p_notes text, p_idem_key text
) returns public.worker_payments
language plpgsql security definer set search_path = public as $$
declare pay public.worker_payments; wname text;
begin
  if not public.can_write(p_project_id) then
    raise exception 'Permission denied';
  end if;
  select name into wname from public.workers where id = p_worker_id;

  insert into public.worker_payments
    (worker_id, project_id, amount, date, payment_method, kind, reference, notes, idem_key)
  values (p_worker_id, p_project_id, p_amount, coalesce(p_date, current_date),
          p_method, coalesce(p_kind,'payment'), p_reference, p_notes, p_idem_key)
  returning * into pay;

  if pay.kind in ('payment','advance') then
    insert into public.expenses
      (project_id, date, category, description, amount, payment_method,
       paid_to, worker_id, reference_number, notes)
    values (p_project_id, pay.date, 'labor',
            coalesce(pay.kind,'payment') || ' to ' || coalesce(wname,'worker'),
            p_amount, p_method, wname, p_worker_id, pay.ref_no, p_notes);
  end if;

  insert into public.audit_logs (action, table_name, record_id, project_id, new_value)
  values ('payment','worker_payments', pay.id, p_project_id, to_jsonb(pay));

  return pay;
end $$;

-- ------------------------------------- MATERIAL PURCHASE (atomic + stock)
create or replace function public.record_material_purchase(
  p_material_id uuid, p_project_id uuid, p_supplier_id uuid, p_work_category_id uuid,
  p_quantity numeric, p_unit text, p_rate numeric, p_transport numeric,
  p_date date, p_bill text, p_payment_status text, p_notes text, p_idem_key text,
  p_receipt_url text default null
) returns public.material_purchases
language plpgsql security definer set search_path = public as $$
declare pur public.material_purchases; mname text; mcost numeric; tot numeric;
begin
  if not public.can_write(p_project_id) then raise exception 'Permission denied'; end if;
  select name into mname from public.materials where id = p_material_id;
  mcost := p_quantity * p_rate;
  tot := mcost + coalesce(p_transport,0);

  insert into public.material_purchases
    (material_id, project_id, supplier_id, work_category_id, quantity, unit, rate,
     material_cost, transport_cost, total, date, bill_number, payment_status, notes, receipt_url, idem_key)
  values (p_material_id, p_project_id, p_supplier_id, p_work_category_id, p_quantity,
          p_unit, p_rate, mcost, coalesce(p_transport,0), tot, coalesce(p_date, current_date),
          p_bill, coalesce(p_payment_status,'unpaid'), p_notes, p_receipt_url, p_idem_key)
  returning * into pur;

  insert into public.material_stock_movements
    (material_id, project_id, movement_type, quantity, reason, date)
  values (p_material_id, p_project_id, 'purchase', p_quantity, 'Purchase ' || pur.ref_no, pur.date);

  insert into public.expenses
    (project_id, date, category, work_category_id, description, amount, payment_method,
     supplier_id, material_id, quantity, unit, bill_number, reference_number, receipt_url)
  values (p_project_id, pur.date, 'material', p_work_category_id,
          coalesce(mname,'Material') || ' purchase', tot, 'cash',
          p_supplier_id, p_material_id, p_quantity, p_unit, p_bill, pur.ref_no, p_receipt_url);

  insert into public.audit_logs (action, table_name, record_id, project_id, new_value)
  values ('created','material_purchases', pur.id, p_project_id, to_jsonb(pur));

  return pur;
end $$;

-- ---------------------------------------------------------------- INDEXES
create index if not exists idx_exp_project on public.expenses(project_id);
create index if not exists idx_exp_date on public.expenses(date);
create index if not exists idx_exp_cat on public.expenses(category);
create index if not exists idx_inc_project on public.incomes(project_id);
create index if not exists idx_att_date on public.worker_attendance(date);
create index if not exists idx_att_project on public.worker_attendance(project_id);
create index if not exists idx_pay_worker on public.worker_payments(worker_id);
create index if not exists idx_mp_project on public.material_purchases(project_id);
create index if not exists idx_sm_material on public.material_stock_movements(material_id);
create index if not exists idx_members_user on public.project_members(user_id);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------- RLS
do $$ declare t text;
begin
  foreach t in array array['profiles','clients','projects','project_members','work_categories',
    'project_budgets','workers','worker_attendance','worker_payments','suppliers',
    'material_categories','materials','material_purchases','material_stock_movements',
    'expenses','incomes','deductions','transportation','ledger_transfers','audit_logs',
    'notifications','counters']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- PROFILES
drop policy if exists p_profiles_select on public.profiles;
create policy p_profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists p_profiles_update_self on public.profiles;
create policy p_profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role::text = public.my_role());
drop policy if exists p_profiles_owner_all on public.profiles;
create policy p_profiles_owner_all on public.profiles for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- PROJECTS
drop policy if exists p_projects_select on public.projects;
create policy p_projects_select on public.projects for select to authenticated
  using (public.is_member(id));
drop policy if exists p_projects_insert on public.projects;
create policy p_projects_insert on public.projects for insert to authenticated
  with check (public.my_role() in ('owner','manager'));
drop policy if exists p_projects_update on public.projects;
create policy p_projects_update on public.projects for update to authenticated
  using (public.is_owner() or (public.my_role() = 'manager' and public.is_member(id)));
drop policy if exists p_projects_delete on public.projects;
create policy p_projects_delete on public.projects for delete to authenticated
  using (public.is_owner());

-- PROJECT MEMBERS
drop policy if exists p_pm_select on public.project_members;
create policy p_pm_select on public.project_members for select to authenticated
  using (user_id = auth.uid() or public.is_member(project_id));
drop policy if exists p_pm_write on public.project_members;
create policy p_pm_write on public.project_members for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Shared master data (readable by all, writable by owner/manager/accountant)
do $$ declare t text;
begin
  foreach t in array array['clients','work_categories','suppliers','materials','material_categories']
  loop
    execute format('drop policy if exists p_%1$s_select on public.%1$s', t);
    execute format('create policy p_%1$s_select on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists p_%1$s_insert on public.%1$s', t);
    execute format('create policy p_%1$s_insert on public.%1$s for insert to authenticated
      with check (public.my_role() is not null)', t);
    execute format('drop policy if exists p_%1$s_update on public.%1$s', t);
    execute format('create policy p_%1$s_update on public.%1$s for update to authenticated
      using (public.my_role() in (''owner'',''manager'',''accountant''))', t);
    execute format('drop policy if exists p_%1$s_delete on public.%1$s', t);
    execute format('create policy p_%1$s_delete on public.%1$s for delete to authenticated
      using (public.is_owner())', t);
  end loop;
end $$;

-- Workers: readable by all authenticated staff, written by owner/manager/site_staff
drop policy if exists p_workers_select on public.workers;
create policy p_workers_select on public.workers for select to authenticated using (true);
drop policy if exists p_workers_insert on public.workers;
create policy p_workers_insert on public.workers for insert to authenticated
  with check (public.my_role() in ('owner','manager','site_staff'));
drop policy if exists p_workers_update on public.workers;
create policy p_workers_update on public.workers for update to authenticated
  using (public.my_role() in ('owner','manager','site_staff'));
drop policy if exists p_workers_delete on public.workers;
create policy p_workers_delete on public.workers for delete to authenticated
  using (public.is_owner());

-- Project-scoped transactional tables
do $$ declare t text;
begin
  foreach t in array array['project_budgets','worker_attendance','worker_payments',
    'material_purchases','material_stock_movements','expenses','incomes','deductions',
    'transportation','ledger_transfers']
  loop
    execute format('drop policy if exists p_%1$s_select on public.%1$s', t);
    execute format('create policy p_%1$s_select on public.%1$s for select to authenticated
      using (project_id is null or public.is_member(project_id))', t);
    execute format('drop policy if exists p_%1$s_insert on public.%1$s', t);
    execute format('create policy p_%1$s_insert on public.%1$s for insert to authenticated
      with check (project_id is null or public.can_write(project_id))', t);
    execute format('drop policy if exists p_%1$s_update on public.%1$s', t);
    execute format('create policy p_%1$s_update on public.%1$s for update to authenticated
      using (project_id is null or public.can_write(project_id))', t);
    execute format('drop policy if exists p_%1$s_delete on public.%1$s', t);
    execute format('create policy p_%1$s_delete on public.%1$s for delete to authenticated
      using (public.is_owner())', t);
  end loop;
end $$;

-- AUDIT LOGS: everyone can append, owners/managers/accountants can read
drop policy if exists p_audit_insert on public.audit_logs;
create policy p_audit_insert on public.audit_logs for insert to authenticated with check (true);
drop policy if exists p_audit_select on public.audit_logs;
create policy p_audit_select on public.audit_logs for select to authenticated
  using (public.my_role() in ('owner','manager','accountant'));

-- NOTIFICATIONS
drop policy if exists p_notif_all on public.notifications;
create policy p_notif_all on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists p_counters_select on public.counters;
create policy p_counters_select on public.counters for select to authenticated using (true);

-- ---------------------------------------------------------------- STORAGE
insert into storage.buckets (id, name, public)
values ('documents','documents', false)
on conflict (id) do nothing;

drop policy if exists s_docs_read on storage.objects;
create policy s_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documents');
drop policy if exists s_docs_insert on storage.objects;
create policy s_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');
drop policy if exists s_docs_update on storage.objects;
create policy s_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());
drop policy if exists s_docs_delete on storage.objects;
create policy s_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (owner = auth.uid() or public.is_owner()));

-- ---------------------------------------------------------------- SEED
insert into public.work_categories (name, is_default) values
  ('Brick Work', true), ('Road Work', true), ('Plumber Work', true),
  ('Electric Work', true), ('Door & Window Work', true), ('Plaster Work', true),
  ('Color / Paint Work', true), ('Tile Work', true)
on conflict (name) do nothing;

insert into public.material_categories (name) values
  ('Cement & Concrete'), ('Aggregates'), ('Masonry'), ('Steel'), ('Finishing'),
  ('Electrical'), ('Plumbing'), ('Woodwork'), ('Hardware'), ('Other')
on conflict (name) do nothing;

insert into public.materials (name, category, unit, is_custom) values
  ('Cement','Cement & Concrete','bag',false),
  ('Sand','Aggregates','cft',false),
  ('Bricks','Masonry','nos',false),
  ('Stone','Aggregates','cft',false),
  ('Steel','Steel','kg',false),
  ('Tiles','Finishing','sqft',false),
  ('Paint','Finishing','litre',false),
  ('Electrical Materials','Electrical','nos',false),
  ('Plumbing Materials','Plumbing','nos',false),
  ('Wood','Woodwork','cft',false),
  ('Glass','Finishing','sqft',false),
  ('Doors','Woodwork','nos',false),
  ('Windows','Woodwork','nos',false),
  ('Hardware','Hardware','nos',false),
  ('Pipes','Plumbing','nos',false),
  ('Wires','Electrical','mtr',false)
on conflict (name) do nothing;

-- ------------------------------------------------- BACKFILL EXISTING USERS
-- Ensures profiles exist for auth users created before this migration ran.
-- The earliest user becomes the Owner.
with ranked as (
  select u.id, u.email, u.raw_user_meta_data as meta,
         row_number() over (order by u.created_at) as rn
  from auth.users u
)
insert into public.profiles (id, full_name, email, phone, role)
select r.id, coalesce(r.meta->>'full_name',''), r.email, r.meta->>'phone',
       (case when r.rn = 1 then 'owner' else 'site_staff' end)::app_role
from ranked r
where not exists (select 1 from public.profiles p where p.id = r.id);

-- =====================================================================
-- PHASE 2: attachments, invoices, quotations
-- =====================================================================

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'documents',
  path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  entity_table text,
  entity_id uuid,
  project_id uuid references public.projects(id) on delete cascade,
  description text,
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  date date not null default current_date,
  due_date date,
  subtotal numeric(16,2) not null default 0,
  tax_percent numeric(6,2) not null default 0,
  tax_amount numeric(16,2) not null default 0,
  discount numeric(16,2) not null default 0,
  total numeric(16,2) not null default 0,
  paid_amount numeric(16,2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft','sent','partially_paid','paid','overdue','cancelled')),
  notes text, terms text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  unit text,
  quantity numeric(14,3) not null default 1,
  rate numeric(14,2) not null default 0,
  amount numeric(16,2) not null default 0,
  sort_order int not null default 0
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_no text unique,
  project_id uuid references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  date date not null default current_date,
  valid_until date,
  subtotal numeric(16,2) not null default 0,
  tax_percent numeric(6,2) not null default 0,
  tax_amount numeric(16,2) not null default 0,
  discount numeric(16,2) not null default 0,
  total numeric(16,2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft','sent','accepted','rejected','expired')),
  notes text, terms text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  category text not null default 'work',
  description text not null,
  unit text,
  quantity numeric(14,3) not null default 1,
  rate numeric(14,2) not null default 0,
  amount numeric(16,2) not null default 0,
  sort_order int not null default 0
);

create or replace function public.set_invoice_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.invoice_no is null or new.invoice_no = '' then
    new.invoice_no := public.next_number('INV', 5);
  end if;
  return new;
end $$;

create or replace function public.set_quotation_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.quotation_no is null or new.quotation_no = '' then
    new.quotation_no := public.next_number('QTN', 5);
  end if;
  return new;
end $$;

drop trigger if exists trg_inv_no on public.invoices;
create trigger trg_inv_no before insert on public.invoices
for each row execute function public.set_invoice_no();
drop trigger if exists trg_quo_no on public.quotations;
create trigger trg_quo_no before insert on public.quotations
for each row execute function public.set_quotation_no();

drop trigger if exists trg_touch_invoices on public.invoices;
create trigger trg_touch_invoices before update on public.invoices
for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_quotations on public.quotations;
create trigger trg_touch_quotations before update on public.quotations
for each row execute function public.touch_updated_at();

create index if not exists idx_att_entity on public.attachments(entity_table, entity_id);
create index if not exists idx_inv_project on public.invoices(project_id);
create index if not exists idx_inv_items on public.invoice_items(invoice_id);
create index if not exists idx_quo_items on public.quotation_items(quotation_id);

alter table public.attachments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;

do $$ declare t text;
begin
  foreach t in array array['attachments','invoices','quotations']
  loop
    execute format('drop policy if exists p_%1$s_select on public.%1$s', t);
    execute format('create policy p_%1$s_select on public.%1$s for select to authenticated
      using (project_id is null or public.is_member(project_id))', t);
    execute format('drop policy if exists p_%1$s_insert on public.%1$s', t);
    execute format('create policy p_%1$s_insert on public.%1$s for insert to authenticated
      with check (project_id is null or public.can_write(project_id))', t);
    execute format('drop policy if exists p_%1$s_update on public.%1$s', t);
    execute format('create policy p_%1$s_update on public.%1$s for update to authenticated
      using (project_id is null or public.can_write(project_id))', t);
    execute format('drop policy if exists p_%1$s_delete on public.%1$s', t);
    execute format('create policy p_%1$s_delete on public.%1$s for delete to authenticated
      using (public.is_owner())', t);
  end loop;
end $$;

drop policy if exists p_invoice_items_all on public.invoice_items;
create policy p_invoice_items_all on public.invoice_items for all to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_member(i.project_id)))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.can_write(i.project_id)));

drop policy if exists p_quotation_items_all on public.quotation_items;
create policy p_quotation_items_all on public.quotation_items for all to authenticated
  using (exists (select 1 from public.quotations q where q.id = quotation_id and (q.project_id is null or public.is_member(q.project_id))))
  with check (exists (select 1 from public.quotations q where q.id = quotation_id and (q.project_id is null or public.can_write(q.project_id))));

-- ---------------------------------------------------------------- GRANTS
-- Supabase normally pre-grants these; declared explicitly so the file is
-- portable to any project and safe to re-run.
do $$ begin
  execute 'grant usage on schema public to authenticated, anon';
  execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
  execute 'grant usage, select on all sequences in schema public to authenticated';
  execute 'alter default privileges in schema public grant select, insert, update, delete on tables to authenticated';
exception when undefined_object then null; end $$;
