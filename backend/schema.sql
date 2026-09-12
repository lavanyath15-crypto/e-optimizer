-- E-Optimizer auth schema.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It is idempotent, so re-running it after an edit is safe.
--
-- Supabase already stores the credential itself (email + bcrypt password hash)
-- in its managed auth.users table. This file adds the profile row that holds
-- the operator's name and plant assignment, keyed to that auth user.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  plant_id text not null default 'ETH-042',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added separately so an existing deployment picks it up without a drop.
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- This is what protects the data. The anon key shipped to the browser is public
-- by design and grants nothing on its own.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- WITH CHECK is stated explicitly rather than left to default to USING. It is
-- the clause that validates the row *after* the update, so it is what stops a
-- row being reassigned to another user's id.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert or delete policy: rows are created by the trigger below, which runs
-- as security definer, and removed by the cascade from auth.users. Anything not
-- granted by a policy is denied, so this is deliberate rather than missing.

-- ---------------------------------------------------------------------------
-- Identity columns are not the operator's to edit
--
-- The update policy above lets an operator edit their own row, which is correct
-- for full_name. It also let them rewrite plant_id and email. plant_id is meant
-- to scope a plant's data, so a self-service change to it is a privilege
-- escalation waiting for the day real data is stored. email is owned by
-- auth.users and a second editable copy just drifts.
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- auth.uid() is null for the service role and for server-side maintenance, so
  -- administrative updates are still free to change these.
  if auth.uid() is not null then
    new.plant_id := old.plant_id;
    new.email := old.email;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Create the profile row automatically on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  -- Without this, a profile row that somehow already exists turns signup into a
  -- hard failure: the exception propagates out of the trigger and rolls back the
  -- auth.users insert, so the account is never created.
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill, for accounts created before this schema was applied
-- ---------------------------------------------------------------------------

insert into public.profiles (id, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.email
from auth.users u
on conflict (id) do nothing;
