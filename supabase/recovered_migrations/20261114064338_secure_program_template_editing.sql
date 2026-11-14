-- APPLIED with explicit owner approval on 2026-11-14.
-- Supabase migration version: 20261114064338; project: rugwzvztweiffprkxfdc.
-- ARCHIVE ONLY: do not replay against production.
-- The original proposal, including its pre-approval warning, is retained verbatim below.

-- PROPOSAL ONLY — NOT APPLIED — OWNER APPROVAL REQUIRED FOR PRODUCTION.
-- Pure Function: Secure editing for public.program_templates.
-- Target baseline: bd57a8ca7c6d24bbd306ce71d915f0544b486c86
--
-- Verified live schema (supabase/schema-reference-2026-11-13.json):
--   public.program_templates (
--     id text primary key,
--     owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
--     data jsonb not null,
--     created_at timestamptz not null default now()
--   )
-- Existing policies (preserved unchanged):
--   "coach templates read"   FOR SELECT TO authenticated USING ((SELECT private.is_coach()) AND owner_id = auth.uid())
--   "coach templates insert" FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_coach()) AND owner_id = auth.uid())
--   "coach templates delete" FOR DELETE TO authenticated USING ((SELECT private.is_coach()) AND owner_id = auth.uid())
--
-- Design note on privilege & concurrency:
--   public.program_templates has no version column and direct table/PostgREST UPDATEs cannot carry
--   an optimistic-concurrency precondition (p_expected_data). Therefore all direct UPDATE privileges
--   on public.program_templates are revoked from PUBLIC, anon, and authenticated, and RLS denies
--   direct UPDATEs. Authenticated verified coaches edit templates exclusively through the narrowly
--   scoped SECURITY DEFINER RPC public.pf_update_program_template(p_id, p_data, p_expected_data).
--
-- Note: Updating a template only updates public.program_templates.data.
-- Assigned client workouts in public.workouts are independent clones and are never modified.

BEGIN;

-- 1. Revoke all direct UPDATE privileges on public.program_templates so neither anon nor
--    authenticated callers can overwrite newer template revisions without p_expected_data.
--    Existing SELECT, INSERT, and DELETE grants and policies remain unchanged.
REVOKE UPDATE ON public.program_templates FROM PUBLIC, anon, authenticated;

-- 2. Null-safe, fail-closed payload validator (SECURITY INVOKER, empty search_path).
--    Uses IS DISTINCT FROM / COALESCE so SQL NULL from missing JSON keys never evaluates
--    to UNKNOWN and falls through. Preserves valid zero values (offset=0, sets=0,
--    loadKg=0, restSec=0, durationMin=0, loggedSets[].kg=0/null, reps=0/null).
CREATE OR REPLACE FUNCTION private.is_valid_program_template_data(
  p_row_id text,
  p_data jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_scope text;
  v_max_days numeric;
  v_day jsonb;
  v_offset numeric;
  v_workout jsonb;
  v_status text;
  v_duration numeric;
  v_session_rpe numeric;
  v_block jsonb;
  v_sets numeric;
  v_load numeric;
  v_rest numeric;
  v_reps_num numeric;
  v_rpe numeric;
  v_set jsonb;
  v_set_num numeric;
  v_kg numeric;
  v_reps numeric;
BEGIN
  IF p_row_id IS NULL OR length(btrim(p_row_id)) = 0 THEN
    RETURN false;
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  -- Required template id (non-empty string matching row id)
  IF NOT (p_data ? 'id') OR jsonb_typeof(p_data->'id') IS DISTINCT FROM 'string' THEN
    RETURN false;
  END IF;
  IF (p_data->>'id') IS DISTINCT FROM p_row_id THEN
    RETURN false;
  END IF;

  -- Required template name (non-empty string)
  IF NOT (p_data ? 'name') OR jsonb_typeof(p_data->'name') IS DISTINCT FROM 'string' THEN
    RETURN false;
  END IF;
  IF COALESCE(length(btrim(p_data->>'name')), 0) = 0 THEN
    RETURN false;
  END IF;

  -- Required scope ('week' or 'program')
  IF NOT (p_data ? 'scope') OR jsonb_typeof(p_data->'scope') IS DISTINCT FROM 'string' THEN
    RETURN false;
  END IF;
  v_scope := p_data->>'scope';
  IF COALESCE(v_scope IN ('week', 'program'), false) IS DISTINCT FROM true THEN
    RETURN false;
  END IF;
  v_max_days := CASE WHEN v_scope = 'week' THEN 7 ELSE 84 END;

  -- Required createdAt timestamp string
  IF NOT (p_data ? 'createdAt') OR jsonb_typeof(p_data->'createdAt') IS DISTINCT FROM 'string' THEN
    RETURN false;
  END IF;
  IF COALESCE(length(btrim(p_data->>'createdAt')), 0) = 0 THEN
    RETURN false;
  END IF;

  -- Required days array
  IF NOT (p_data ? 'days') OR jsonb_typeof(p_data->'days') IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;

  FOR v_day IN SELECT value FROM jsonb_array_elements(p_data->'days')
  LOOP
    IF v_day IS NULL OR jsonb_typeof(v_day) IS DISTINCT FROM 'object' THEN
      RETURN false;
    END IF;

    -- Required day offset: integer in [0, v_max_days), preserving 0
    IF NOT (v_day ? 'offset') OR jsonb_typeof(v_day->'offset') IS DISTINCT FROM 'number' THEN
      RETURN false;
    END IF;
    v_offset := (v_day->>'offset')::numeric;
    IF v_offset IS NULL OR v_offset <> trunc(v_offset) OR v_offset < 0 OR v_offset >= v_max_days THEN
      RETURN false;
    END IF;

    -- Required workout object
    IF NOT (v_day ? 'workout') THEN
      RETURN false;
    END IF;
    v_workout := v_day->'workout';
    IF v_workout IS NULL OR jsonb_typeof(v_workout) IS DISTINCT FROM 'object' THEN
      RETURN false;
    END IF;

    IF NOT (v_workout ? 'id') OR jsonb_typeof(v_workout->'id') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;
    IF COALESCE(length(btrim(v_workout->>'id')), 0) = 0 THEN
      RETURN false;
    END IF;

    IF NOT (v_workout ? 'date') OR jsonb_typeof(v_workout->'date') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;
    IF COALESCE(length(btrim(v_workout->>'date')), 0) = 0 THEN
      RETURN false;
    END IF;

    IF NOT (v_workout ? 'title') OR jsonb_typeof(v_workout->'title') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;

    IF v_workout ? 'focus' AND jsonb_typeof(v_workout->'focus') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;

    IF v_workout ? 'coachNotes' AND jsonb_typeof(v_workout->'coachNotes') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;

    IF v_workout ? 'durationMin' THEN
      IF jsonb_typeof(v_workout->'durationMin') IS DISTINCT FROM 'number' THEN
        RETURN false;
      END IF;
      v_duration := (v_workout->>'durationMin')::numeric;
      IF v_duration IS NULL OR v_duration < 0 THEN
        RETURN false;
      END IF;
    END IF;

    IF v_workout ? 'completedAt' AND jsonb_typeof(v_workout->'completedAt') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;

    IF v_workout ? 'sessionRpe' THEN
      IF jsonb_typeof(v_workout->'sessionRpe') IS DISTINCT FROM 'number' THEN
        RETURN false;
      END IF;
      v_session_rpe := (v_workout->>'sessionRpe')::numeric;
      IF v_session_rpe IS NULL OR v_session_rpe < 0 THEN
        RETURN false;
      END IF;
    END IF;

    IF v_workout ? 'clientFeedback' AND jsonb_typeof(v_workout->'clientFeedback') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;

    IF NOT (v_workout ? 'status') OR jsonb_typeof(v_workout->'status') IS DISTINCT FROM 'string' THEN
      RETURN false;
    END IF;
    v_status := v_workout->>'status';
    IF COALESCE(v_status IN ('planned', 'completed', 'missed'), false) IS DISTINCT FROM true THEN
      RETURN false;
    END IF;

    IF NOT (v_workout ? 'blocks') OR jsonb_typeof(v_workout->'blocks') IS DISTINCT FROM 'array' THEN
      RETURN false;
    END IF;

    FOR v_block IN SELECT value FROM jsonb_array_elements(v_workout->'blocks')
    LOOP
      IF v_block IS NULL OR jsonb_typeof(v_block) IS DISTINCT FROM 'object' THEN
        RETURN false;
      END IF;

      IF NOT (v_block ? 'id') OR jsonb_typeof(v_block->'id') IS DISTINCT FROM 'string' THEN
        RETURN false;
      END IF;
      IF COALESCE(length(btrim(v_block->>'id')), 0) = 0 THEN
        RETURN false;
      END IF;

      IF v_block ? 'exerciseId' THEN
        IF jsonb_typeof(v_block->'exerciseId') IS DISTINCT FROM 'string' THEN
          RETURN false;
        END IF;
        IF COALESCE(length(btrim(v_block->>'exerciseId')), 0) = 0 THEN
          RETURN false;
        END IF;
      END IF;

      IF NOT (v_block ? 'name') OR jsonb_typeof(v_block->'name') IS DISTINCT FROM 'string' THEN
        RETURN false;
      END IF;
      IF COALESCE(length(btrim(v_block->>'name')), 0) = 0 THEN
        RETURN false;
      END IF;

      IF v_block ? 'supersetWithPrevious'
        AND jsonb_typeof(v_block->'supersetWithPrevious') IS DISTINCT FROM 'boolean'
      THEN
        RETURN false;
      END IF;

      IF v_block ? 'sets' THEN
        IF jsonb_typeof(v_block->'sets') IS DISTINCT FROM 'number' THEN
          RETURN false;
        END IF;
        v_sets := (v_block->>'sets')::numeric;
        IF v_sets IS NULL OR v_sets <> trunc(v_sets) OR v_sets < 0 THEN
          RETURN false;
        END IF;
      END IF;

      IF v_block ? 'reps' THEN
        IF COALESCE(jsonb_typeof(v_block->'reps') IN ('string', 'number'), false) IS DISTINCT FROM true THEN
          RETURN false;
        END IF;
        IF jsonb_typeof(v_block->'reps') = 'number' THEN
          v_reps_num := (v_block->>'reps')::numeric;
          IF v_reps_num IS NULL OR v_reps_num < 0 THEN
            RETURN false;
          END IF;
        END IF;
      END IF;

      IF v_block ? 'loadKg' THEN
        IF jsonb_typeof(v_block->'loadKg') IS DISTINCT FROM 'number' THEN
          RETURN false;
        END IF;
        v_load := (v_block->>'loadKg')::numeric;
        IF v_load IS NULL OR v_load < 0 THEN
          RETURN false;
        END IF;
      END IF;

      IF v_block ? 'restSec' THEN
        IF jsonb_typeof(v_block->'restSec') IS DISTINCT FROM 'number' THEN
          RETURN false;
        END IF;
        v_rest := (v_block->>'restSec')::numeric;
        IF v_rest IS NULL OR v_rest < 0 THEN
          RETURN false;
        END IF;
      END IF;

      IF v_block ? 'notes' AND jsonb_typeof(v_block->'notes') IS DISTINCT FROM 'string' THEN
        RETURN false;
      END IF;

      IF v_block ? 'rpe' THEN
        IF jsonb_typeof(v_block->'rpe') IS DISTINCT FROM 'number' THEN
          RETURN false;
        END IF;
        v_rpe := (v_block->>'rpe')::numeric;
        IF v_rpe IS NULL OR v_rpe < 0 THEN
          RETURN false;
        END IF;
      END IF;

      IF v_block ? 'pain' AND jsonb_typeof(v_block->'pain') IS DISTINCT FROM 'boolean' THEN
        RETURN false;
      END IF;

      IF v_block ? 'clientNote' AND jsonb_typeof(v_block->'clientNote') IS DISTINCT FROM 'string' THEN
        RETURN false;
      END IF;

      IF NOT (v_block ? 'loggedSets') OR jsonb_typeof(v_block->'loggedSets') IS DISTINCT FROM 'array' THEN
        RETURN false;
      END IF;

      FOR v_set IN SELECT value FROM jsonb_array_elements(v_block->'loggedSets')
      LOOP
        IF v_set IS NULL OR jsonb_typeof(v_set) IS DISTINCT FROM 'object' THEN
          RETURN false;
        END IF;

        IF NOT (v_set ? 'setNumber') OR jsonb_typeof(v_set->'setNumber') IS DISTINCT FROM 'number' THEN
          RETURN false;
        END IF;
        v_set_num := (v_set->>'setNumber')::numeric;
        IF v_set_num IS NULL OR v_set_num <> trunc(v_set_num) OR v_set_num < 0 THEN
          RETURN false;
        END IF;

        IF NOT (v_set ? 'completed') OR jsonb_typeof(v_set->'completed') IS DISTINCT FROM 'boolean' THEN
          RETURN false;
        END IF;

        IF NOT (v_set ? 'kg')
          OR COALESCE(jsonb_typeof(v_set->'kg') IN ('number', 'null'), false) IS DISTINCT FROM true
        THEN
          RETURN false;
        END IF;
        IF jsonb_typeof(v_set->'kg') = 'number' THEN
          v_kg := (v_set->>'kg')::numeric;
          IF v_kg IS NULL OR v_kg < 0 THEN
            RETURN false;
          END IF;
        END IF;

        IF NOT (v_set ? 'reps')
          OR COALESCE(jsonb_typeof(v_set->'reps') IN ('number', 'null'), false) IS DISTINCT FROM true
        THEN
          RETURN false;
        END IF;
        IF jsonb_typeof(v_set->'reps') = 'number' THEN
          v_reps := (v_set->>'reps')::numeric;
          IF v_reps IS NULL OR v_reps < 0 THEN
            RETURN false;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.is_valid_program_template_data(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_valid_program_template_data(text, jsonb) TO authenticated;

-- 3. Explicit deny-all RLS policy on direct UPDATEs (defense in depth alongside REVOKE UPDATE).
DROP POLICY IF EXISTS "coach templates update" ON public.program_templates;
DROP POLICY IF EXISTS "coach templates deny direct update" ON public.program_templates;
CREATE POLICY "coach templates deny direct update"
  ON public.program_templates
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 4. BEFORE UPDATE invariant trigger (SECURITY INVOKER, empty search_path):
--    Defense-in-depth enforcing coach ownership, immutable identity columns, and payload validity.
CREATE OR REPLACE FUNCTION private.guard_program_template_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_coach() OR OLD.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the owning verified coach may update a program template'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Program template id is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Program template owner_id is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Program template created_at is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF NOT private.is_valid_program_template_data(NEW.id, NEW.data) THEN
    RAISE EXCEPTION 'Invalid program template payload'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_program_template_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS program_templates_guard_update ON public.program_templates;
CREATE TRIGGER program_templates_guard_update
  BEFORE UPDATE ON public.program_templates
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_program_template_update();

-- 5. Narrowly privileged SECURITY DEFINER RPC: the sole permitted mutation route for editing.
--    Runs as function owner (postgres) solely to update public.program_templates.data after
--    revoking direct UPDATE grants from authenticated callers. Enforces verified coach identity,
--    strict row ownership (owner_id = auth.uid()), valid payload, row lock (FOR UPDATE), and
--    optimistic concurrency against p_expected_data (SQLSTATE 40001 on stale conflict).
CREATE OR REPLACE FUNCTION public.pf_update_program_template(
  p_id text,
  p_data jsonb,
  p_expected_data jsonb
)
RETURNS public.program_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_existing public.program_templates%ROWTYPE;
  v_updated public.program_templates%ROWTYPE;
BEGIN
  IF v_caller_id IS NULL OR NOT private.is_coach() THEN
    RAISE EXCEPTION 'Verified coach required'
      USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR length(btrim(p_id)) = 0 THEN
    RAISE EXCEPTION 'Template id is required'
      USING ERRCODE = '22023';
  END IF;
  IF p_expected_data IS NULL OR jsonb_typeof(p_expected_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Concurrency precondition (p_expected_data) is required'
      USING ERRCODE = '22023';
  END IF;
  IF NOT private.is_valid_program_template_data(p_id, p_data) THEN
    RAISE EXCEPTION 'Invalid program template payload'
      USING ERRCODE = '22023';
  END IF;

  -- Lock only the row owned by the authenticated coach.
  SELECT *
  INTO v_existing
  FROM public.program_templates
  WHERE id = p_id
    AND owner_id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND OR v_existing.owner_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Program template not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  IF v_existing.data IS DISTINCT FROM p_expected_data THEN
    RAISE EXCEPTION 'Program template was modified elsewhere; reload before saving'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.program_templates
  SET data = p_data
  WHERE id = p_id
    AND owner_id = v_caller_id
    AND created_at = v_existing.created_at
    AND data IS NOT DISTINCT FROM p_expected_data
  RETURNING *
  INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program template was modified elsewhere; reload before saving'
      USING ERRCODE = '40001';
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.pf_update_program_template(text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pf_update_program_template(text, jsonb, jsonb) TO authenticated;

COMMIT;
