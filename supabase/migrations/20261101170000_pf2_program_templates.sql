-- NEEDS ARMIN'S OK. DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Optional T3 migration. App hides template UI in cloud mode until installed.
-- Does not touch workout calculations, authentication, or old messages table.
create table if not exists public.program_templates (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists program_templates_owner_created_idx on public.program_templates (owner_id, created_at desc);
alter table public.program_templates enable row level security;
create policy "coach templates read" on public.program_templates for select to authenticated
  using ((select private.is_coach()) and owner_id = auth.uid());
create policy "coach templates insert" on public.program_templates for insert to authenticated
  with check ((select private.is_coach()) and owner_id = auth.uid());
create policy "coach templates delete" on public.program_templates for delete to authenticated
  using ((select private.is_coach()) and owner_id = auth.uid());
