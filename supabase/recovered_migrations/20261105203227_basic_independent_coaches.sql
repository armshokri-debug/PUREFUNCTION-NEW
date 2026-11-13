-- ARCHIVED APPLIED MIGRATION. Reference only; do not replay against production.
-- NEEDS ARMIN'S EXPLICIT OK. Run in Supabase SQL Editor only AFTER a full backup.
-- Requires applied T8b + p5 migrations. Do not merge/deploy Basic app before this succeeds.
-- This migration deliberately refuses clients whose creator cannot be inferred uniquely.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
LOCK TABLE public.clients, public.coach_client_assignments IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (
    SELECT c.id FROM public.clients c LEFT JOIN public.coach_client_assignments a ON a.client_id=c.id
    GROUP BY c.id HAVING count(a.coach_id) <> 1
  ) THEN RAISE EXCEPTION 'BASIC OWNER PREFLIGHT: each existing client needs exactly one assignment. Resolve ambiguous/ownerless clients manually, then retry.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.coach_client_assignments a
    LEFT JOIN public.profiles p ON p.id=a.coach_id
    LEFT JOIN auth.users u ON u.id=p.id
    LEFT JOIN private.coach_allowlist l ON l.email=lower(u.email)
    WHERE p.role IS DISTINCT FROM 'coach' OR u.email_confirmed_at IS NULL OR l.email IS NULL
  ) THEN RAISE EXCEPTION 'BASIC OWNER PREFLIGHT: every owner must be a verified, allowlisted coach. Resolve access before migration.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.settings s
    JOIN auth.users u ON lower(u.email)=lower(s.value)
    JOIN public.profiles p ON p.id=u.id AND p.role='coach'
    JOIN private.coach_allowlist l ON l.email=lower(u.email)
    WHERE s.key='coach_email' AND u.email_confirmed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'BASIC OWNER PREFLIGHT: head coach must be configured, verified and allowlisted'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.clients c WHERE c.email <> ''
    GROUP BY lower(c.email) HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'BASIC OWNER PREFLIGHT: duplicate invited client emails require manual review'; END IF;
END $$;
ALTER TABLE public.clients ADD COLUMN coach_id uuid;
UPDATE public.clients c SET coach_id=a.coach_id FROM public.coach_client_assignments a WHERE a.client_id=c.id;
ALTER TABLE public.clients ALTER COLUMN coach_id SET NOT NULL;
ALTER TABLE public.clients ADD CONSTRAINT clients_basic_coach_fk FOREIGN KEY(coach_id) REFERENCES public.profiles(id);
CREATE INDEX clients_basic_coach_idx ON public.clients(coach_id);
CREATE UNIQUE INDEX clients_basic_unique_email ON public.clients (lower(email)) WHERE email <> '';
-- Prevent assigning an existing client to a second coach through a future buggy API.
CREATE UNIQUE INDEX basic_one_coach_per_client ON public.coach_client_assignments(client_id);

CREATE OR REPLACE FUNCTION private.basic_is_coach() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    JOIN private.coach_allowlist a ON a.email=lower(u.email)
    WHERE p.id=auth.uid() AND p.role='coach' AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION private.basic_is_coach() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.basic_is_coach() TO authenticated;
-- Existing policies for exercises and legacy helpers use private.is_coach.
CREATE OR REPLACE FUNCTION private.is_coach() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT private.basic_is_coach(); $$;
CREATE OR REPLACE FUNCTION private.can_manage_client(p_client_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT private.basic_is_coach() AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id=p_client_id AND c.coach_id=auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION private.can_manage_client(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_manage_client(text) TO authenticated;

-- The new row is owned by the authenticated verified coach making the INSERT.
CREATE FUNCTION private.basic_set_client_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT private.basic_is_coach() THEN RAISE EXCEPTION 'Verified coach required' USING ERRCODE='42501'; END IF;
  IF new.coach_id IS NOT NULL AND new.coach_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot create a client for another coach' USING ERRCODE='42501';
  END IF;
  new.coach_id := auth.uid();
  RETURN new;
END;$$;
CREATE TRIGGER basic_owner_on_insert BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION private.basic_set_client_owner();
CREATE FUNCTION private.basic_owner_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF new.coach_id IS DISTINCT FROM old.coach_id THEN
    RAISE EXCEPTION 'Client owner is immutable' USING ERRCODE='42501';
  END IF;
  RETURN new;
END;$$;
CREATE TRIGGER basic_owner_on_update BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION private.basic_owner_immutable();
-- After INSERT the legacy assignment table stays in sync with authoritative coach_id.
CREATE OR REPLACE FUNCTION private.assign_new_client() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF new.coach_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Client owner mismatch' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.coach_client_assignments(coach_id,client_id)
    VALUES(new.coach_id,new.id);
  RETURN new;
END;$$;
-- INSERT ... RETURNING also checks SELECT RLS. Do not re-query the new client via
-- the STABLE can_manage_client helper here: its snapshot may not see that INSERT.
-- Check the new row's coach_id directly; all other client access stays owner-scoped.
DROP POLICY IF EXISTS "clients scoped read" ON public.clients;
CREATE POLICY "clients scoped read" ON public.clients FOR SELECT TO authenticated
USING ((private.basic_is_coach() AND coach_id=auth.uid()) OR id=private.my_client_id());
-- Existing UPDATE/DELETE, workout, notes, message, storage and food policies
-- use private.can_manage_client; replacing it above scopes them to this owner.
DROP POLICY IF EXISTS "clients coach insert" ON public.clients;
CREATE POLICY "clients coach insert" ON public.clients FOR INSERT TO authenticated
WITH CHECK(private.basic_is_coach() AND coach_id=auth.uid());
-- No global assignment overview, including for head coach.
DROP POLICY IF EXISTS "head assignment overview" ON public.coach_client_assignments;

-- Existing p5 assign/unassign is intentionally disabled; head coach can ONLY allowlist.
CREATE OR REPLACE FUNCTION public.pf_manage_trainer(p_action text,p_email text,p_client_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE addr text:=lower(trim(p_email));
BEGIN
  IF NOT public.pf_head_coach() THEN RAISE EXCEPTION 'Head coach only' USING ERRCODE='42501'; END IF;
  IF p_action IS DISTINCT FROM 'invite' THEN
    RAISE EXCEPTION 'Client assignments are automatic and cannot be transferred' USING ERRCODE='42501';
  END IF;
  IF addr !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(addr)>254 THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.coach_allowlist(email) VALUES(addr) ON CONFLICT DO NOTHING;
  RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.pf_manage_trainer(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pf_manage_trainer(text,text,text) TO authenticated;
-- Data migration and readback gate before COMMIT.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clients c LEFT JOIN public.coach_client_assignments a
      ON a.client_id=c.id AND a.coach_id=c.coach_id
    WHERE a.client_id IS NULL
  ) THEN RAISE EXCEPTION 'BASIC OWNER READBACK FAILED'; END IF;
END $$;
COMMIT;

