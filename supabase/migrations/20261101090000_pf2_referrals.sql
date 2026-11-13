-- Referrals: a client shares a personal link; the person fills a short form;
-- the coach sees the lead, adds them as a client, and marks them paying,
-- which earns the referrer credit. Credit spent is recorded by the coach.
-- Additive only: no existing table or policy is changed.

insert into private.settings (key, value) values ('referral_credit', '0')
on conflict (key) do nothing;

create table public.referral_codes (
  client_id text primary key references public.clients(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id text not null references public.clients(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  location text not null default '' check (char_length(location) <= 120),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'invited' check (status in ('invited', 'signed_up', 'paying', 'declined')),
  referred_client_id text references public.clients(id) on delete set null,
  credit numeric(10,2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index referrals_referrer_idx on public.referrals (referrer_client_id);
create index referrals_email_idx on public.referrals (lower(email));
create unique index referrals_one_per_email on public.referrals (referrer_client_id, lower(email));

create table public.credit_redemptions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index credit_redemptions_client_idx on public.credit_redemptions (client_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.credit_redemptions enable row level security;

create policy "referral codes read" on public.referral_codes for select to authenticated
  using ((select private.is_coach()) or client_id = (select private.my_client_id()));

create policy "referrals read" on public.referrals for select to authenticated
  using ((select private.is_coach()) or referrer_client_id = (select private.my_client_id()));
create policy "referrals update" on public.referrals for update to authenticated
  using ((select private.is_coach())) with check ((select private.is_coach()));
create policy "referrals delete" on public.referrals for delete to authenticated
  using ((select private.is_coach()));

create policy "redemptions read" on public.credit_redemptions for select to authenticated
  using ((select private.is_coach()) or client_id = (select private.my_client_id()));
create policy "redemptions insert" on public.credit_redemptions for insert to authenticated
  with check ((select private.is_coach()));
create policy "redemptions delete" on public.credit_redemptions for delete to authenticated
  using ((select private.is_coach()));

-- The signed-in client's code (created on first use).
create function public.my_referral_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  cid text := private.my_client_id();
  c text;
begin
  if cid is null then
    return null;
  end if;
  select code into c from public.referral_codes where client_id = cid;
  if c is null then
    loop
      c := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      begin
        insert into public.referral_codes (client_id, code) values (cid, c);
        exit;
      exception when unique_violation then
        -- try another code
      end;
    end loop;
  end if;
  return c;
end;
$$;

-- Public (no sign-in): who invited me? Returns only a first name.
create function public.referral_inviter(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select split_part(coalesce(c.data->>'name', ''), ' ', 1)
  from public.referral_codes r join public.clients c on c.id = r.client_id
  where r.code = lower(trim(p_code));
$$;

-- Public (no sign-in): the invited person sends their details.
create function public.submit_referral(p_code text, p_name text, p_email text, p_location text, p_note text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  cid text;
  e text := lower(trim(p_email));
begin
  select client_id into cid from public.referral_codes where code = lower(trim(p_code));
  if cid is null then
    raise exception 'Invalid invite link';
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email';
  end if;
  if (select count(*) from public.referrals where referrer_client_id = cid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many invites today, please try again tomorrow';
  end if;
  insert into public.referrals (referrer_client_id, name, email, location, note)
  values (cid, left(trim(p_name), 120), e, left(trim(coalesce(p_location, '')), 120), left(trim(coalesce(p_note, '')), 1000))
  on conflict (referrer_client_id, lower(email)) do nothing;
  return true;
end;
$$;

-- Coach: mark a referral paying (sets credit from settings) or change status.
create function public.set_referral_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  amount numeric;
begin
  if not private.is_coach() then
    raise exception 'Only the coach can do this';
  end if;
  if p_status not in ('invited', 'signed_up', 'paying', 'declined') then
    raise exception 'Unknown status';
  end if;
  select coalesce(nullif(value, '')::numeric, 0) into amount from private.settings where key = 'referral_credit';
  update public.referrals
  set status = p_status,
      credit = case when p_status = 'paying' then case when credit > 0 then credit else coalesce(amount, 0) end else 0 end,
      updated_at = now()
  where id = p_id;
end;
$$;

-- Referral credit amount (everyone signed in can read it, to explain the program).
create function public.referral_credit_amount() returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(value, '')::numeric, 0) from private.settings where key = 'referral_credit';
$$;

-- When the coach adds a client whose email matches a referral, mark it signed up.
create function private.on_client_referral_match() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email <> '' then
    update public.referrals
    set status = 'signed_up', referred_client_id = new.id, updated_at = now()
    where lower(email) = lower(new.email) and status = 'invited';
  end if;
  return new;
end;
$$;
create trigger clients_referral_match after insert or update of email on public.clients
  for each row execute function private.on_client_referral_match();

revoke execute on function public.my_referral_code(), public.referral_inviter(text),
  public.submit_referral(text, text, text, text, text), public.set_referral_status(uuid, text),
  public.referral_credit_amount(), private.on_client_referral_match()
  from public, anon, authenticated;
grant execute on function public.my_referral_code(), public.set_referral_status(uuid, text),
  public.referral_credit_amount() to authenticated;
grant execute on function public.referral_inviter(text),
  public.submit_referral(text, text, text, text, text) to anon, authenticated;

alter publication supabase_realtime add table public.referrals;
