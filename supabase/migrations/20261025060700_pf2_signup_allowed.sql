-- Used only by the sign-up Edge Function (service role): may this email create an account?
create function public.signup_role(p_email text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from private.settings s where s.key = 'coach_email' and lower(s.value) = lower(trim(p_email))) then 'coach'
    when exists (select 1 from public.clients c where c.email <> '' and lower(c.email) = lower(trim(p_email))) then 'client'
    else null
  end;
$$;
revoke execute on function public.signup_role(text) from public, anon, authenticated;
grant execute on function public.signup_role(text) to service_role;
