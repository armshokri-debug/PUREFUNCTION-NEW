-- ARCHIVED APPLIED MIGRATION. Reference only; do not replay against production.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
CREATE SCHEMA pf_basic_backup_20261105 AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA pf_basic_backup_20261105 FROM PUBLIC,anon,authenticated,service_role;
LOCK TABLE public.clients,public.coach_client_assignments IN SHARE MODE;
CREATE TABLE pf_basic_backup_20261105.clients AS TABLE public.clients;
CREATE TABLE pf_basic_backup_20261105.assignments AS TABLE public.coach_client_assignments;
CREATE TABLE pf_basic_backup_20261105.functions AS
SELECT p.oid::regprocedure::text AS name,pg_get_functiondef(p.oid) AS definition,p.proacl::text AS grants,pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='private' AND p.proname IN ('is_coach','can_manage_client','assign_new_client'))
OR (n.nspname='public' AND p.proname='pf_manage_trainer');
CREATE TABLE pf_basic_backup_20261105.policies AS SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('clients','coach_client_assignments');
CREATE TABLE pf_basic_backup_20261105.manifest AS SELECT now() AS captured_at,'0465279862e32857375a17083caec3f5824cd8a2'::text AS release_sha,'Same-database logical rollback snapshot for Basic ownership migration only; not disaster-recovery backup.'::text AS scope;
REVOKE ALL ON ALL TABLES IN SCHEMA pf_basic_backup_20261105 FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE pf_basic_backup_20261105.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_basic_backup_20261105.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_basic_backup_20261105.functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_basic_backup_20261105.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_basic_backup_20261105.manifest ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
IF EXISTS((SELECT * FROM public.clients EXCEPT SELECT * FROM pf_basic_backup_20261105.clients) UNION ALL (SELECT * FROM pf_basic_backup_20261105.clients EXCEPT SELECT * FROM public.clients)) THEN RAISE EXCEPTION 'Client backup mismatch'; END IF;
IF EXISTS((SELECT * FROM public.coach_client_assignments EXCEPT SELECT * FROM pf_basic_backup_20261105.assignments) UNION ALL (SELECT * FROM pf_basic_backup_20261105.assignments EXCEPT SELECT * FROM public.coach_client_assignments)) THEN RAISE EXCEPTION 'Assignment backup mismatch'; END IF;
IF (SELECT count(*) FROM pf_basic_backup_20261105.functions)<>4 THEN RAISE EXCEPTION 'Missing function backup'; END IF;
IF has_schema_privilege('anon','pf_basic_backup_20261105','USAGE') OR has_schema_privilege('authenticated','pf_basic_backup_20261105','USAGE') OR has_schema_privilege('service_role','pf_basic_backup_20261105','USAGE') THEN RAISE EXCEPTION 'Backup permissions too broad'; END IF;
END $$;
COMMIT;
