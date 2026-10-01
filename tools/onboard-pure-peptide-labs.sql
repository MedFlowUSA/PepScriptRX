-- Lily's supplied email and scoped admin configuration are now recorded in this migration.
-- Provision Auth first using tools/provision-pure-owner.mjs; no passwords in SQL.
\set ON_ERROR_STOP on
begin;
\ir ../supabase/migrations/20261001223000_pure_lily_admin_65_percent.sql
commit;
