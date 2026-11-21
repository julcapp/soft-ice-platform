-- Deployment uses a privileged migration principal, never the application login.
-- A NOLOGIN owner prevents runtime DML grants from becoming trigger/DDL ownership.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'soft_ice_audit_owner') THEN
    CREATE ROLE soft_ice_audit_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'soft_ice_audit_owner'
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'soft_ice_audit_owner must be an isolated unprivileged NOLOGIN owner';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "reject_administrator_audit_mutation"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$ BEGIN
  IF OLD."eventType" LIKE 'administrator.%' THEN
    RAISE EXCEPTION 'administrator security audit is append-only' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  RETURN OLD;
END $$;

-- TRUNCATE does not fire row DELETE triggers. The shared audit table cannot be
-- truncated even when currently empty; there is no session-flag maintenance path.
CREATE FUNCTION "reject_administrator_audit_truncate"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$ BEGIN
  RAISE EXCEPTION 'administrator security audit is append-only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER "AuditEvent_no_truncate" BEFORE TRUNCATE ON "AuditEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_administrator_audit_truncate"();
ALTER TABLE "AuditEvent" ENABLE ALWAYS TRIGGER "AuditEvent_administrator_append_only";
ALTER TABLE "AuditEvent" ENABLE ALWAYS TRIGGER "AuditEvent_no_truncate";
REVOKE ALL ON FUNCTION "reject_administrator_audit_mutation"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "reject_administrator_audit_truncate"() FROM PUBLIC;
REVOKE ALL ON TABLE "AuditEvent" FROM PUBLIC;
ALTER FUNCTION "reject_administrator_audit_mutation"() OWNER TO soft_ice_audit_owner;
ALTER FUNCTION "reject_administrator_audit_truncate"() OWNER TO soft_ice_audit_owner;
ALTER TABLE "AuditEvent" OWNER TO soft_ice_audit_owner;
