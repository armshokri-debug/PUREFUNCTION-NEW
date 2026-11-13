-- PROPOSAL ONLY — NOT APPLIED — OWNER APPROVAL REQUIRED FOR PRODUCTION.
-- Isolated SQL verification tests for supabase/proposals/program_template_editing.sql.
-- Target baseline: bd57a8ca7c6d24bbd306ce71d915f0544b486c86
--
-- SAFETY:
--   * Execute ONLY in a confirmed disposable local PostgreSQL / Supabase test database
--     where the baseline schema and supabase/proposals/program_template_editing.sql are loaded.
--   * Never run against live Supabase.
--   * Entire suite runs inside a transaction and ends with ROLLBACK.

BEGIN;

DO $$
DECLARE
  v_coach_a uuid := '11111111-1111-4111-8111-111111111111';
  v_coach_b uuid := '22222222-2222-4222-8222-222222222222';
  v_client_u uuid := '33333333-3333-4333-8333-333333333333';

  v_tpl_id text := 'tpl-edit-test-1';
  v_tpl_crud_id text := 'tpl-crud-test-1';
  v_client_id text := 'client-edit-test-1';
  v_workout_id text := 'wo-edit-test-1';

  v_created_at timestamptz := '2026-11-01T10:00:00Z';
  v_data_v1 jsonb := jsonb_build_object(
    'id', 'tpl-edit-test-1',
    'name', 'Initial Week',
    'scope', 'week',
    'createdAt', '2026-11-01T10:00:00.000Z',
    'days', jsonb_build_array(
      jsonb_build_object(
        'offset', 0,
        'workout', jsonb_build_object(
          'id', 'wo-src-1',
          'date', '2026-11-02',
          'title', 'Day 1 Hinge',
          'focus', 'Posterior chain',
          'status', 'planned',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', 'blk-1', 'exerciseId', 'ex-rdl', 'name', 'RDL', 'sets', 3, 'reps', '8', 'loadKg', 60, 'restSec', 90, 'notes', '', 'loggedSets', jsonb_build_array())
          )
        )
      )
    )
  );
  v_data_v2 jsonb := jsonb_build_object(
    'id', 'tpl-edit-test-1',
    'name', 'Updated Week v2',
    'scope', 'week',
    'createdAt', '2026-11-01T10:00:00.000Z',
    'days', jsonb_build_array(
      jsonb_build_object(
        'offset', 0,
        'workout', jsonb_build_object(
          'id', 'wo-src-1',
          'date', '2026-11-02',
          'title', 'Day 1 Hinge Revised',
          'focus', 'Posterior chain',
          'status', 'planned',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', 'blk-1', 'exerciseId', 'ex-rdl', 'name', 'RDL', 'sets', 4, 'reps', '6', 'loadKg', 70, 'restSec', 90, 'notes', '', 'loggedSets', jsonb_build_array())
          )
        )
      )
    )
  );
  v_data_v3 jsonb := jsonb_build_object(
    'id', 'tpl-edit-test-1',
    'name', 'Updated Week v3',
    'scope', 'week',
    'createdAt', '2026-11-01T10:00:00.000Z',
    'days', jsonb_build_array()
  );
  -- Valid payload exercising permitted zero values and nullable loggedSet fields
  v_data_zeros jsonb := jsonb_build_object(
    'id', 'tpl-edit-test-1',
    'name', 'Zero Values Preserved',
    'scope', 'week',
    'createdAt', '2026-11-01T10:00:00.000Z',
    'days', jsonb_build_array(
      jsonb_build_object(
        'offset', 0,
        'workout', jsonb_build_object(
          'id', 'wo-zero-1',
          'date', '2026-11-02',
          'title', '',
          'durationMin', 0,
          'status', 'planned',
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'id', 'blk-zero',
              'exerciseId', 'ex-bw',
              'name', '90-90 Breathing',
              'sets', 0,
              'reps', '0',
              'loadKg', 0,
              'restSec', 0,
              'notes', '',
              'loggedSets', jsonb_build_array(
                jsonb_build_object('setNumber', 1, 'kg', 0, 'reps', 0, 'completed', false),
                jsonb_build_object('setNumber', 2, 'kg', NULL, 'reps', NULL, 'completed', false)
              )
            )
          )
        )
      )
    )
  );

  v_invalid_payloads jsonb[];
  v_bad jsonb;
  v_res public.program_templates%ROWTYPE;
  v_row_count int;
  v_stored_data jsonb;
  v_stored_owner uuid;
  v_stored_created timestamptz;
  v_workout_data_before jsonb;
  v_workout_updated_before timestamptz;
  v_workout_data_after jsonb;
  v_workout_updated_after timestamptz;
  v_caught boolean;
  v_idx int;
BEGIN
  -- Synthetic auth/profile/allowlist fixtures (rolled back at end of script)
  INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_coach_a, 'test.coach.a@example.invalid', now(), '{"display_name":"Coach A"}'::jsonb, now(), now()),
    (v_coach_b, 'test.coach.b@example.invalid', now(), '{"display_name":"Coach B"}'::jsonb, now(), now()),
    (v_client_u, 'test.client.u@example.invalid', now(), '{"display_name":"Client U"}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO private.coach_allowlist (email)
  VALUES ('test.coach.a@example.invalid'), ('test.coach.b@example.invalid')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, role, display_name, client_id)
  VALUES
    (v_coach_a, 'coach', 'Coach A', NULL),
    (v_coach_b, 'coach', 'Coach B', NULL),
    (v_client_u, 'client', 'Client U', v_client_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, client_id = EXCLUDED.client_id;

  -- Seed synthetic client + previously assigned workout cloned from v_data_v1
  INSERT INTO public.clients (id, coach_id, email, data)
  VALUES (v_client_id, v_coach_a, 'test.client.u@example.invalid', jsonb_build_object('id', v_client_id, 'name', 'Client U'));

  INSERT INTO public.workouts (id, client_id, date, data)
  VALUES (
    v_workout_id,
    v_client_id,
    '2026-11-09',
    jsonb_build_object('id', v_workout_id, 'date', '2026-11-09', 'title', 'Day 1 Hinge', 'focus', 'Posterior chain', 'status', 'planned', 'blocks', jsonb_build_array())
  );

  SELECT data, updated_at INTO v_workout_data_before, v_workout_updated_before
  FROM public.workouts WHERE id = v_workout_id;

  -- Seed Coach A's template
  INSERT INTO public.program_templates (id, owner_id, data, created_at)
  VALUES (v_tpl_id, v_coach_a, v_data_v1, v_created_at);

  -- -------------------------------------------------------------------------
  -- TEST 1: Owner coach can read/create/delete and update via pf_update_program_template
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_coach_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  -- Existing SELECT/INSERT/DELETE behavior preserved for owning coach
  INSERT INTO public.program_templates (id, data)
  VALUES (v_tpl_crud_id, jsonb_set(v_data_v1, '{id}', to_jsonb(v_tpl_crud_id)));

  SELECT count(*) INTO v_row_count FROM public.program_templates WHERE id = v_tpl_crud_id;
  ASSERT v_row_count = 1, 'Test 1a failed: owner coach could not read newly inserted template';

  DELETE FROM public.program_templates WHERE id = v_tpl_crud_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  ASSERT v_row_count = 1, 'Test 1b failed: owner coach could not delete own template';

  -- Update v1 -> v2 through RPC
  SELECT * INTO v_res FROM public.pf_update_program_template(v_tpl_id, v_data_v2, v_data_v1);
  ASSERT v_res.id = v_tpl_id, 'Test 1c failed: id changed';
  ASSERT v_res.owner_id = v_coach_a, 'Test 1d failed: owner_id changed';
  ASSERT v_res.created_at = v_created_at, 'Test 1e failed: created_at changed';
  ASSERT v_res.data = v_data_v2, 'Test 1f failed: data not updated to v2';

  -- -------------------------------------------------------------------------
  -- TEST 2: Another coach cannot update (RPC or direct UPDATE) or read/delete
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_coach_b::text, true);

  v_caught := false;
  BEGIN
    PERFORM public.pf_update_program_template(v_tpl_id, v_data_v3, v_data_v2);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 2a failed: other coach RPC update was not denied';

  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET data = v_data_v3 WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 2b failed: other coach direct UPDATE was not denied';

  SELECT count(*) INTO v_row_count FROM public.program_templates WHERE id = v_tpl_id;
  ASSERT v_row_count = 0, 'Test 2c failed: other coach SELECT saw Coach A template';

  DELETE FROM public.program_templates WHERE id = v_tpl_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  ASSERT v_row_count = 0, 'Test 2d failed: other coach DELETE affected rows';

  -- -------------------------------------------------------------------------
  -- TEST 3: Client and anonymous access are denied
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_client_u::text, true);

  v_caught := false;
  BEGIN
    PERFORM public.pf_update_program_template(v_tpl_id, v_data_v3, v_data_v2);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 3a failed: client RPC update was not denied';

  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET data = v_data_v3 WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 3b failed: client direct UPDATE was not denied';

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  SET LOCAL ROLE anon;

  v_caught := false;
  BEGIN
    PERFORM public.pf_update_program_template(v_tpl_id, v_data_v3, v_data_v2);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 3c failed: anon RPC update was not denied';

  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET data = v_data_v3 WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 3d failed: anon direct UPDATE was not denied by privilege';

  -- Verify stored data remained v2 after all unauthorized attempts in Tests 2 and 3
  RESET ROLE;
  SELECT data, owner_id, created_at INTO v_stored_data, v_stored_owner, v_stored_created
  FROM public.program_templates WHERE id = v_tpl_id;
  ASSERT v_stored_data = v_data_v2, 'Test 3e failed: unauthorized calls mutated stored data';
  ASSERT v_stored_owner = v_coach_a AND v_stored_created = v_created_at, 'Test 3f failed: immutable columns changed';

  -- -------------------------------------------------------------------------
  -- TEST 4: Ownership and row identity/created_at cannot be changed
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_coach_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET owner_id = v_coach_b WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 4a failed: owner_id change was allowed';

  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET id = 'tpl-hijacked' WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 4b failed: id change was allowed';

  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET created_at = now() - interval '30 days' WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 4c failed: created_at change was allowed';

  -- -------------------------------------------------------------------------
  -- TEST 5: Direct UPDATE bypass and stale RPC saves are rejected; v2 remains intact
  -- -------------------------------------------------------------------------
  -- 5a: Stale RPC save using superseded v1 precondition
  v_caught := false;
  BEGIN
    PERFORM public.pf_update_program_template(v_tpl_id, v_data_v3, v_data_v1);
  EXCEPTION WHEN SQLSTATE '40001' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 5a failed: stale expected_data was not rejected with 40001';

  -- 5b: NULL concurrency precondition
  v_caught := false;
  BEGIN
    PERFORM public.pf_update_program_template(v_tpl_id, v_data_v3, NULL);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 5b failed: NULL expected_data precondition was not rejected';

  -- 5c: JSON null concurrency precondition
  v_caught := false;
  BEGIN
    PERFORM public.pf_update_program_template(v_tpl_id, v_data_v3, 'null'::jsonb);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 5c failed: JSON null expected_data precondition was not rejected';

  -- 5d: Same authenticated owner tries direct SQL UPDATE to stale v1 after saving v2
  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET data = v_data_v1 WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 5d failed: authenticated owner direct stale UPDATE was not blocked';

  -- 5e: Same authenticated owner tries direct SQL UPDATE even with valid v3 payload
  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET data = v_data_v3 WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 5e failed: authenticated owner direct UPDATE without RPC was not blocked';

  SELECT data INTO v_stored_data FROM public.program_templates WHERE id = v_tpl_id;
  ASSERT v_stored_data = v_data_v2, 'Test 5f failed: direct or stale write mutated stored v2 data';

  -- -------------------------------------------------------------------------
  -- TEST 6: Malformed payloads, missing fields, wrong types, and explicit JSON nulls fail closed
  -- -------------------------------------------------------------------------
  -- Verify directly on pure validator for the exact reproduced bug inputs as well
  ASSERT private.is_valid_program_template_data('x', '{}'::jsonb) = false,
    'Test 6.0a failed: {} passed validator';
  ASSERT private.is_valid_program_template_data('x', '{"id":"x","days":[]}'::jsonb) = false,
    'Test 6.0b failed: {"id":"x","days":[]} passed validator';
  ASSERT private.is_valid_program_template_data('x', '{"id":"x","name":"A","scope":"week","createdAt":"now","days":[{}]}'::jsonb) = false,
    'Test 6.0c failed: {"id":"x","name":"A","scope":"week","createdAt":"now","days":[{}]} passed validator';
  ASSERT private.is_valid_program_template_data(NULL, v_data_v2) = false,
    'Test 6.0d failed: NULL row id passed validator';
  ASSERT private.is_valid_program_template_data(v_tpl_id, NULL) = false,
    'Test 6.0e failed: NULL payload passed validator';

  v_invalid_payloads := ARRAY[
    -- Reproduced bug payloads (missing keys / empty nested objects)
    '{}'::jsonb,
    jsonb_build_object('id', v_tpl_id, 'days', jsonb_build_array()),
    jsonb_build_object('id', v_tpl_id, 'name', 'A', 'scope', 'week', 'createdAt', 'now', 'days', jsonb_build_array('{}'::jsonb)),
    -- Root non-object / id mismatch / blank name / bad scope
    '[]'::jsonb,
    'null'::jsonb,
    jsonb_set(v_data_v2, '{id}', '"wrong-id"'::jsonb),
    jsonb_set(v_data_v2, '{name}', '"   "'::jsonb),
    jsonb_set(v_data_v2, '{scope}', '"month"'::jsonb),
    -- Out-of-range and malformed offsets (with otherwise complete workout object)
    jsonb_set(v_data_v2, '{days}', jsonb_build_array(jsonb_build_object('offset', 7, 'workout', v_data_v2->'days'->0->'workout'))),
    jsonb_set(v_data_v2, '{days}', jsonb_build_array(jsonb_build_object('offset', -1, 'workout', v_data_v2->'days'->0->'workout'))),
    jsonb_set(v_data_v2, '{days}', jsonb_build_array(jsonb_build_object('offset', 1.5, 'workout', v_data_v2->'days'->0->'workout'))),
    jsonb_set(v_data_v2, '{days}', jsonb_build_array(jsonb_build_object('offset', '0', 'workout', v_data_v2->'days'->0->'workout'))),
    -- Malformed workout & block structures & wrong JSON types
    jsonb_set(v_data_v2, '{days}', jsonb_build_array(jsonb_build_object('offset', 0, 'workout', '{}'::jsonb))),
    jsonb_set(v_data_v2, '{days,0,workout,status}', '"unknown"'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks}', '"none"'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks}', jsonb_build_array('{}'::jsonb)),
    jsonb_set(v_data_v2, '{days,0,workout,blocks,0,sets}', '"3"'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks,0,sets}', '-1'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks,0,loadKg}', '-5'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks,0,loggedSets}', jsonb_build_array('{}'::jsonb)),
    -- Explicit JSON nulls at every structural level
    jsonb_set(v_data_v2, '{id}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{name}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{scope}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{createdAt}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days}', jsonb_build_array('null'::jsonb)),
    jsonb_set(v_data_v2, '{days,0,offset}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,title}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,focus}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks,0}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks,0,sets}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks,0,loadKg}', 'null'::jsonb),
    jsonb_set(v_data_v2, '{days,0,workout,blocks,0,loggedSets}', 'null'::jsonb)
  ];

  FOR v_idx IN 1..array_length(v_invalid_payloads, 1)
  LOOP
    v_bad := v_invalid_payloads[v_idx];
    ASSERT private.is_valid_program_template_data(v_tpl_id, v_bad) = false,
      format('Test 6.%s failed: invalid payload passed validator: %s', v_idx, v_bad::text);

    v_caught := false;
    BEGIN
      PERFORM public.pf_update_program_template(v_tpl_id, v_bad, v_data_v2);
    EXCEPTION WHEN SQLSTATE '22023' THEN
      v_caught := true;
    END;
    ASSERT v_caught,
      format('Test 6.%s failed: invalid payload was not rejected by RPC with 22023: %s', v_idx, v_bad::text);
  END LOOP;

  -- Direct UPDATE with invalid payload must also fail with 42501
  v_caught := false;
  BEGIN
    UPDATE public.program_templates SET data = '{"id":"wrong"}'::jsonb WHERE id = v_tpl_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  ASSERT v_caught, 'Test 6.direct failed: direct UPDATE with invalid payload was not blocked';

  SELECT data, owner_id, created_at INTO v_stored_data, v_stored_owner, v_stored_created
  FROM public.program_templates WHERE id = v_tpl_id;
  ASSERT v_stored_data = v_data_v2, 'Test 6.stored failed: row data mutated after rejected payloads';
  ASSERT v_stored_owner = v_coach_a AND v_stored_created = v_created_at, 'Test 6.immutable failed: immutable columns changed';

  -- -------------------------------------------------------------------------
  -- TEST 7: Valid zero values succeed and previously assigned workouts remain unchanged
  -- -------------------------------------------------------------------------
  SELECT * INTO v_res FROM public.pf_update_program_template(v_tpl_id, v_data_zeros, v_data_v2);
  ASSERT v_res.data = v_data_zeros, 'Test 7a failed: valid zero-value template update was rejected';

  SELECT * INTO v_res FROM public.pf_update_program_template(v_tpl_id, v_data_v3, v_data_zeros);
  ASSERT v_res.data = v_data_v3, 'Test 7b failed: valid update from zero-value template to v3 failed';

  RESET ROLE;
  SELECT data, updated_at INTO v_workout_data_after, v_workout_updated_after
  FROM public.workouts WHERE id = v_workout_id;
  ASSERT v_workout_data_after = v_workout_data_before, 'Test 7c failed: assigned workout data changed';
  ASSERT v_workout_updated_after = v_workout_updated_before, 'Test 7d failed: assigned workout updated_at changed';
END
$$;

ROLLBACK;
