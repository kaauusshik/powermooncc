-- Local functional smoke test of the POWER MOON CONSTRUCTION database layer.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'owner@test.local',
        '{"full_name":"Kusik Owner","phone":"900"}'::jsonb);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

\echo '-- profile auto-created + role'
select full_name, role from public.profiles;
\echo '-- my_role / is_owner'
select public.my_role() as role, public.is_owner() as owner;

insert into public.projects (name, client_name, contract_amount, start_date, status, progress, opening_cash)
values ('Bhubaneswar Residential Building', 'Mr. Das', 5000000, current_date, 'active', 20, 50000);
\echo '-- auto project code'
select code, name from public.projects;

insert into public.workers (name, worker_type, daily_wage, project_id)
select 'Ramesh Mason', 'Mason', 700, id from public.projects;

\echo '-- attendance + payable'
insert into public.worker_attendance (worker_id, project_id, date, status, days, wage, overtime_hours, overtime_amount, payable)
select w.id, w.project_id, current_date, 'present', 1, 700, 2, 175, 875 from public.workers w;
select status, days, payable from public.worker_attendance;

\echo '-- atomic worker payment (payment + mirrored expense + audit)'
select ref_no, amount, kind from public.record_worker_payment(
  (select id from public.workers), (select id from public.projects),
  5000, current_date, 'cash', 'payment', 'REF1', 'weekly wages', 'idem-pay-1');
select ref_no, category, amount, paid_to from public.expenses;
select action, table_name from public.audit_logs;

\echo '-- duplicate protection (same idem key must fail)'
do $$
begin
  perform public.record_worker_payment((select id from public.workers), (select id from public.projects),
    5000, current_date, 'cash', 'payment', 'REF1', 'dup', 'idem-pay-1');
  raise exception 'DUPLICATE WAS ALLOWED';
exception when unique_violation then raise notice 'duplicate correctly prevented';
end $$;

\echo '-- atomic material purchase (purchase + stock movement + expense)'
select ref_no, quantity, rate, material_cost, transport_cost, total
from public.record_material_purchase(
  (select id from public.materials where name='Cement'), (select id from public.projects),
  null, (select id from public.work_categories where name='Brick Work'),
  200, 'bag', 350, 2000, current_date, 'BILL-1', 'unpaid', 'cement lot', 'idem-pur-1', 'receipts/x.jpg');

\echo '-- stock position for Cement (opening + purchased - used + adjusted)'
insert into public.material_stock_movements (material_id, project_id, movement_type, quantity, reason)
select id, (select id from public.projects), 'usage', 180, 'brick work' from public.materials where name='Cement';
update public.materials set opening_stock = 50, min_stock = 30 where name = 'Cement';
select
  m.opening_stock as opening,
  coalesce(sum(case when sm.movement_type='purchase' then sm.quantity end),0) as purchased,
  coalesce(sum(case when sm.movement_type='usage' then sm.quantity end),0) as used,
  m.opening_stock
    + coalesce(sum(case when sm.movement_type='purchase' then sm.quantity end),0)
    - coalesce(sum(case when sm.movement_type='usage' then sm.quantity end),0) as remaining
from public.materials m left join public.material_stock_movements sm on sm.material_id = m.id
where m.name='Cement' group by m.id, m.opening_stock;

\echo '-- income + ledger math'
insert into public.incomes (project_id, date, amount, received_from, payment_method)
select id, current_date, 1500000, 'Mr. Das', 'upi' from public.projects;
insert into public.ledger_transfers (project_id, from_account, to_account, amount)
select id, 'upi', 'bank', 500000 from public.projects;
select
  (select sum(amount) from public.incomes) as received,
  (select sum(amount) from public.expenses) as expenses,
  (select sum(amount) from public.ledger_transfers) as transfers;

\echo '-- invoice numbering + items'
insert into public.invoices (project_id, client_name, date, subtotal, tax_percent, tax_amount, discount, total)
select id, 'Mr. Das', current_date, 100000, 18, 18000, 0, 118000 from public.projects;
insert into public.invoice_items (invoice_id, description, unit, quantity, rate, amount)
select id, 'Brick work RCC slab', 'sqft', 1000, 100, 100000 from public.invoices;
select invoice_no, total, status from public.invoices;

insert into public.quotations (project_id, client_name, date, subtotal, tax_percent, tax_amount, total)
select id, 'Mr. Das', current_date, 50000, 18, 9000, 59000 from public.projects;
select quotation_no, total from public.quotations;

\echo '-- archive keeps history'
update public.workers set archived_at = now();
select (select count(*) from public.worker_attendance) as attendance_rows,
       (select count(*) from public.worker_payments) as payment_rows;

\echo '-- ALL DATABASE CHECKS PASSED'
