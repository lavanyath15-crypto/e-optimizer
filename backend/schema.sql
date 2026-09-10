-- E-Optimizer auth schema.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- Supabase already stores the credential itself (email + bcrypt password hash)
-- in its managed auth.users table. This file adds the profile row that holds
-- the operator's name and plant assignment, keyed to that auth user.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  plant_id text default 'ETH-042',
  created_at timestamptz not null default now()
);

-- Row Level Security: an operator can read and edit only their own profile.
-- This is what protects the data. The anon key shipped to the browser is
-- public by design and grants nothing on its own.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Create the profile row automatically whenever a new account signs up.
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
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
