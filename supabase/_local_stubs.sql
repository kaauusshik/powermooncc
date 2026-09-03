-- Minimal Supabase-like stubs so migration.sql can be dry-run locally.
create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid
);

create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;

do $$ begin
  create role authenticated;
exception when duplicate_object then null; end $$;
