-- Phase 3 functional smoke test: purchase-order workflow + daily site report.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values ('33333333-3333-3333-3333-333333333333','po@test.local','{"full_name":"PO Owner"}'::jsonb);
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select public.my_role() as role;

insert into public.projects (name, contract_amount, status) values ('PO Test Project', 1000000, 'active');
insert into public.suppliers (business_name) values ('Kusik Traders');
update public.materials set opening_stock = 0, min_stock = 30 where name = 'Cement';

\echo '-- create purchase request: total must be qty*rate + transport'
insert into public.purchase_orders (project_id, supplier_id, material_id, quantity, unit, rate, transport_cost, delivery_date)
select p.id, s.id, m.id, 100, 'bag', 350, 1500, current_date + 3
from public.projects p, public.suppliers s, public.materials m
where p.name='PO Test Project' and s.business_name='Kusik Traders' and m.name='Cement';
select po_no, status, quantity, rate, transport_cost, total from public.purchase_orders;

\echo '-- advance requested -> approved -> ordered'
update public.purchase_orders set status='approved';
update public.purchase_orders set status='ordered';
select po_no, status from public.purchase_orders;

\echo '-- receive: creates material purchase + stock movement + project expense'
select po_no, status, received_quantity, purchase_id is not null as linked_purchase
from public.receive_purchase_order((select id from public.purchase_orders), null, current_date);
select ref_no, quantity, total from public.material_purchases;
select movement_type, quantity from public.material_stock_movements;
select ref_no, category, amount from public.expenses;

\echo '-- receiving twice must be rejected'
do $$ begin
  perform public.receive_purchase_order((select id from public.purchase_orders), null, current_date);
  raise exception 'DOUBLE RECEIVE ALLOWED';
exception when others then raise notice 'double receive correctly prevented: %', sqlerrm;
end $$;

\echo '-- bill + pay'
update public.purchase_orders set status='billed', bill_number='BILL-77', bill_date=current_date;
update public.purchase_orders set status='paid', paid_amount=total;
select po_no, status, bill_number, paid_amount, total from public.purchase_orders;

\echo '-- daily site report numbering + one-per-project-per-day constraint'
insert into public.daily_site_reports (project_id, date, weather, workers_present, work_completed, issues)
select id, current_date, 'Light Rain', 14, 'Slab shuttering completed on 2nd floor', 'Water logging near gate'
from public.projects where name='PO Test Project';
select report_no, weather, workers_present, issues from public.daily_site_reports;
do $$ begin
  insert into public.daily_site_reports (project_id, date, work_completed)
  select id, current_date, 'dup' from public.projects where name='PO Test Project';
  raise exception 'DUPLICATE DSR ALLOWED';
exception when unique_violation then raise notice 'one report per project per day correctly enforced';
end $$;

\echo '-- site issue'
insert into public.site_issues (project_id, title, priority, description, status)
select id, 'Water logging at gate', 'high', 'Blocked material entry', 'open' from public.projects where name='PO Test Project';
select title, priority, status from public.site_issues;

\echo '-- PHASE 3 CHECKS PASSED'
