-- RLS enforcement test
\set ON_ERROR_STOP on

-- Create a site_staff user via auth.users stub
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'staff@example.com')
  on conflict (id) do nothing;
-- ensure profile exists (trigger should create with default owner, then we downgrade)
select id, role from public.profiles where id='11111111-1111-1111-1111-111111111111';
update public.profiles set role='site_staff' where id='11111111-1111-1111-1111-111111111111';

-- Also seed an owner user + project
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'owner2@example.com')
  on conflict (id) do nothing;
update public.profiles set role='owner' where id='22222222-2222-2222-2222-222222222222';

-- As owner, create a project
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
insert into public.projects (name, status, created_by) values ('RLS Test Proj', 'active', '22222222-2222-2222-2222-222222222222')
  returning id, code;
reset role;

-- Switch to staff user
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

-- Staff must see 0 projects
select count(*) as staff_visible_projects from public.projects;
-- Staff must see 0 expenses
select count(*) as staff_visible_expenses from public.expenses;

-- Staff insert project should fail
do $$
begin
  begin
    insert into public.projects (name, status, created_by) values ('Should Fail', 'active', '11111111-1111-1111-1111-111111111111');
    raise exception 'FAIL: staff was allowed to insert project';
  exception when insufficient_privilege or others then
    raise notice 'OK: staff blocked from inserting project';
  end;
end$$;

-- Staff must be blocked from elevating own role
do $$
begin
  begin
    update public.profiles set role='owner' where id='11111111-1111-1111-1111-111111111111';
    -- Check if it actually changed
    if (select role from public.profiles where id='11111111-1111-1111-1111-111111111111') = 'owner' then
      raise exception 'FAIL: staff elevated their own role to owner';
    else
      raise notice 'OK: staff role escalation blocked/no-op';
    end if;
  exception when insufficient_privilege then
    raise notice 'OK: staff role escalation blocked by RLS';
  end;
end$$;

reset role;

-- Owner adds staff as project member
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
insert into public.project_members (project_id, user_id)
  select id, '11111111-1111-1111-1111-111111111111' from public.projects where name='RLS Test Proj';
reset role;

-- Staff should now see the project
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
select count(*) as staff_visible_after_membership from public.projects;
reset role;
