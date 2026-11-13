-- Pure Function 2: core tables. JSONB documents so the app types map 1:1.
-- Applied to Supabase project "pure-function-2" (rugwzvztweiffprkxfdc).
create schema if not exists private;

create table private.settings (
  key text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('coach', 'client')),
  display_name text not null default '',
  client_id text,
  created_at timestamptz not null default now()
);

create table public.clients (
  id text primary key,
  email text not null default '',
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index clients_email_idx on public.clients (lower(email));

create table public.workouts (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  date date not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (client_id, date)
);
create index workouts_client_date_idx on public.workouts (client_id, date);

create table public.exercises (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index profiles_client_id_idx on public.profiles (client_id);

-- Helpers (security definer: avoids RLS recursion; not exposed by the API).
create function private.is_coach() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

create function private.my_client_id() returns text
language sql stable security definer set search_path = '' as $$
  select client_id from public.profiles where id = auth.uid() and role = 'client';
$$;

create function private.has_profile() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

grant usage on schema private to authenticated;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;

-- profiles: you see yourself; the coach sees everyone. Profiles are only created by triggers.
create policy "profiles read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_coach()));

-- clients: coach full access; a client reads and updates only their own row.
create policy "clients read" on public.clients for select to authenticated
  using ((select private.is_coach()) or id = (select private.my_client_id()));
create policy "clients insert" on public.clients for insert to authenticated
  with check ((select private.is_coach()));
create policy "clients update" on public.clients for update to authenticated
  using ((select private.is_coach()) or id = (select private.my_client_id()))
  with check ((select private.is_coach()) or id = (select private.my_client_id()));
create policy "clients delete" on public.clients for delete to authenticated
  using ((select private.is_coach()));

-- workouts: coach full access; a client only their own (they log results).
create policy "workouts read" on public.workouts for select to authenticated
  using ((select private.is_coach()) or client_id = (select private.my_client_id()));
create policy "workouts insert" on public.workouts for insert to authenticated
  with check ((select private.is_coach()) or client_id = (select private.my_client_id()));
create policy "workouts update" on public.workouts for update to authenticated
  using ((select private.is_coach()) or client_id = (select private.my_client_id()))
  with check ((select private.is_coach()) or client_id = (select private.my_client_id()));
create policy "workouts delete" on public.workouts for delete to authenticated
  using ((select private.is_coach()));

-- exercises (coach's own + edited ones): everyone with a profile reads, coach writes.
create policy "exercises read" on public.exercises for select to authenticated
  using ((select private.has_profile()));
create policy "exercises insert" on public.exercises for insert to authenticated
  with check ((select private.is_coach()));
create policy "exercises update" on public.exercises for update to authenticated
  using ((select private.is_coach())) with check ((select private.is_coach()));
create policy "exercises delete" on public.exercises for delete to authenticated
  using ((select private.is_coach()));

-- A client may not move their row to another email (only the coach sets emails).
create function private.guard_client_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_coach() and new.email is distinct from old.email then
    raise exception 'Only the coach can change a client''s email';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger clients_guard before update on public.clients
  for each row execute function private.guard_client_email();

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger workouts_touch before update on public.workouts
  for each row execute function private.touch_updated_at();
create trigger exercises_touch before update on public.exercises
  for each row execute function private.touch_updated_at();

-- Who gets which role:
--  * coach: only the email in private.settings.coach_email
--  * client: someone whose email the coach added to a client (either order:
--    client signs up first, or the coach adds the email later)
--  * anyone else: no profile, sees nothing
create function private.link_user(uid uuid, user_email text, user_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  coach_email text;
  cid text;
  cname text;
begin
  if exists (select 1 from public.profiles where id = uid) then
    return;
  end if;
  select value into coach_email from private.settings where key = 'coach_email';
  if coach_email is not null and lower(user_email) = lower(coach_email) then
    insert into public.profiles (id, role, display_name)
    values (uid, 'coach', coalesce(nullif(user_name, ''), split_part(user_email, '@', 1)));
    return;
  end if;
  select c.id, c.data->>'name' into cid, cname
  from public.clients c
  where lower(c.email) = lower(user_email)
  limit 1;
  if cid is not null then
    insert into public.profiles (id, role, display_name, client_id)
    values (uid, 'client', coalesce(cname, split_part(user_email, '@', 1)), cid);
  end if;
end;
$$;

create function private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.link_user(new.id, new.email, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.on_auth_user_created();

create function private.on_client_email_set() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  u record;
begin
  if new.email <> '' then
    for u in select id, email from auth.users where lower(email) = lower(new.email) loop
      perform private.link_user(u.id, u.email, null);
    end loop;
  end if;
  return new;
end;
$$;
create trigger clients_link_after_write after insert or update of email on public.clients
  for each row execute function private.on_client_email_set();

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_coach(), private.my_client_id(), private.has_profile() to authenticated;

-- The coach account (change this to move the coach role to another email).
insert into private.settings (key, value) values ('coach_email', 'arm.shokri@gmail.com');

-- Live updates on other devices.
alter publication supabase_realtime add table public.workouts;
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.exercises;
