-- Daily workout reminder emails.
-- A random secret lives in Vault; pg_cron sends it to the daily-reminders
-- Edge Function, which checks it via cron_secret_ok() (service role only).
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'cron_secret');
  end if;
end $$;

create or replace function public.cron_secret_ok(s text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret = s);
$$;
revoke all on function public.cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.cron_secret_ok(text) to service_role;

-- 11:00 UTC = 7am New York (6am in winter).
select cron.unschedule('daily-reminders') where exists (select 1 from cron.job where jobname = 'daily-reminders');
select cron.schedule(
  'daily-reminders',
  '0 11 * * *',
  $job$
  select net.http_post(
    url := 'https://rugwzvztweiffprkxfdc.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
