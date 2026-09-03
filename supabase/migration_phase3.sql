-- =====================================================================
-- POWER MOON CONSTRUCTION by KUSIK — PHASE 3
-- Purchase orders / material requests workflow, daily site reports,
-- site issues and site report photos.
-- Run this ONCE in the Supabase SQL editor AFTER migration.sql.
-- =====================================================================

set check_function_bodies = off;

-- ------------------------------------------------- PURCHASE ORDER WORKFLOW
-- Workflow: requested -> approved -> ordered -> received -> billed -> paid
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_no text unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  material_id uuid not null references public.materials(id) on delete restrict,
  work_category_id uuid references public.work_categories(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text,
  rate numeric(14,2) not null default 0,
  transport_cost numeric(16,2) not null default 0,
  total numeric(16,2) not null default 0,
  requested_by uuid references public.profiles(id) default auth.uid(),
  approved_by uuid references public.profiles(id),
  order_date date not null default current_date,
  delivery_date date,
  received_date date,
  received_quantity numeric(14,3),
  bill_number text,
  bill_date date,
  paid_amount numeric(16,2) not null default 0,
  status text not null default 'requested'
    check (status in ('requested','approved','ordered','received','billed','paid','cancelled')),
  purchase_id uuid references public.material_purchases(id) on delete set null,
  notes text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_po_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.po_no is null or new.po_no = '' then
    new.po_no := public.next_number('PORD', 5);
  end if;
  new.total := (new.quantity * new.rate) + coalesce(new.transport_cost, 0);
  return new;
end $$;

drop trigger if exists trg_po_no on public.purchase_orders;
create trigger trg_po_no before insert on public.purchase_orders
for each row execute function public.set_po_no();

create or replace function public.po_recalc() returns trigger
language plpgsql as $$
begin
  new.total := (new.quantity * new.rate) + coalesce(new.transport_cost, 0);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_po_update on public.purchase_orders;
create trigger trg_po_update before update on public.purchase_orders
for each row execute function public.po_recalc();

-- Receiving a PO creates the real purchase (stock movement + project expense)
create or replace function public.receive_purchase_order(
  p_po_id uuid, p_received_quantity numeric default null, p_received_date date default null
) returns public.purchase_orders
language plpgsql security definer set search_path = public as $$
declare po public.purchase_orders; pur public.material_purchases; qty numeric;
begin
  select * into po from public.purchase_orders where id = p_po_id;
  if po.id is null then raise exception 'Purchase order not found'; end if;
  if not public.can_write(po.project_id) then raise exception 'Permission denied'; end if;
  if po.purchase_id is not null then raise exception 'This purchase order is already received'; end if;

  qty := coalesce(p_received_quantity, po.quantity);

  select * into pur from public.record_material_purchase(
    po.material_id, po.project_id, po.supplier_id, po.work_category_id,
    qty, po.unit, po.rate, po.transport_cost,
    coalesce(p_received_date, current_date), po.bill_number, 'unpaid',
    'Received against ' || po.po_no, 'po-' || po.id::text, null);

  update public.purchase_orders
     set status = 'received', received_quantity = qty,
         received_date = coalesce(p_received_date, current_date),
         purchase_id = pur.id
   where id = p_po_id
  returning * into po;

  insert into public.audit_logs (action, table_name, record_id, project_id, new_value)
  values ('updated','purchase_orders', po.id, po.project_id, to_jsonb(po));

  return po;
end $$;

-- ------------------------------------------------------ DAILY SITE REPORTS
create table if not exists public.daily_site_reports (
  id uuid primary key default gen_random_uuid(),
  report_no text unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null default current_date,
  weather text,
  workers_present int not null default 0,
  work_completed text,
  materials_received text,
  materials_consumed text,
  equipment_used text,
  transportation_note text,
  expenses_note text,
  issues text,
  delays text,
  photo_url text,
  notes text,
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, date)
);

create or replace function public.set_dsr_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.report_no is null or new.report_no = '' then
    new.report_no := public.next_number('DSR', 5);
  end if;
  return new;
end $$;
drop trigger if exists trg_dsr_no on public.daily_site_reports;
create trigger trg_dsr_no before insert on public.daily_site_reports
for each row execute function public.set_dsr_no();

create table if not exists public.site_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  location text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  assigned_to uuid references public.profiles(id),
  description text,
  photo_url text,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  archived_at timestamptz, archived_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_touch_dsr on public.daily_site_reports;
create trigger trg_touch_dsr before update on public.daily_site_reports
for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_issues on public.site_issues;
create trigger trg_touch_issues before update on public.site_issues
for each row execute function public.touch_updated_at();

create index if not exists idx_po_project on public.purchase_orders(project_id);
create index if not exists idx_po_status on public.purchase_orders(status);
create index if not exists idx_dsr_project on public.daily_site_reports(project_id);
create index if not exists idx_issues_project on public.site_issues(project_id);

alter table public.purchase_orders enable row level security;
alter table public.daily_site_reports enable row level security;
alter table public.site_issues enable row level security;

do $$ declare t text;
begin
  foreach t in array array['purchase_orders','daily_site_reports','site_issues']
  loop
    execute format('drop policy if exists p_%1$s_select on public.%1$s', t);
    execute format('create policy p_%1$s_select on public.%1$s for select to authenticated
      using (public.is_member(project_id))', t);
    execute format('drop policy if exists p_%1$s_insert on public.%1$s', t);
    execute format('create policy p_%1$s_insert on public.%1$s for insert to authenticated
      with check (public.can_write(project_id))', t);
    execute format('drop policy if exists p_%1$s_update on public.%1$s', t);
    execute format('create policy p_%1$s_update on public.%1$s for update to authenticated
      using (public.can_write(project_id))', t);
    execute format('drop policy if exists p_%1$s_delete on public.%1$s', t);
    execute format('create policy p_%1$s_delete on public.%1$s for delete to authenticated
      using (public.is_owner())', t);
  end loop;
end $$;

do $$ begin
  execute 'grant usage on schema public to authenticated, anon';
  execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
  execute 'grant usage, select on all sequences in schema public to authenticated';
exception when undefined_object then null; end $$;
