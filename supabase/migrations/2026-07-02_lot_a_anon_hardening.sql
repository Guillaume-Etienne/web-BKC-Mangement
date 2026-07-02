-- ============================================================
-- Lot A — anon hardening (apply on TEST **and** PROD, same day)
-- Idempotent: safe to re-run. See .claude/docs/security-rls.md.
--
-- 1. get_db_stats(): EXECUTE is granted to PUBLIC by default in Postgres,
--    so anon could call it via /rest/v1/rpc/get_db_stats. Admin-only now
--    (only caller: DatabaseTab.tsx, authenticated).
--
-- 2. shared_links token enumeration: the anon SELECT policy let anyone list
--    ALL active tokens (GET /rest/v1/shared_links?select=token) and thus open
--    every shared page. Replaced by resolve_share_token(p_token): you must
--    already KNOW a token to resolve it. App change: App.tsx uses
--    supabase.rpc('resolve_share_token', ...) instead of reading the table.
--    Admin pages (authenticated) keep reading/writing shared_links directly.
-- ============================================================

-- 1. get_db_stats admin-only
REVOKE EXECUTE ON FUNCTION get_db_stats() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_db_stats() TO authenticated;

-- 2a. Token resolver: returns the link only for an exact, active, unexpired token.
--     SECURITY DEFINER (owner bypasses RLS) so anon needs no SELECT on the table.
CREATE OR REPLACE FUNCTION resolve_share_token(p_token TEXT)
RETURNS SETOF shared_links
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM shared_links
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at >= CURRENT_DATE);
$$;

REVOKE EXECUTE ON FUNCTION resolve_share_token(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION resolve_share_token(TEXT) TO anon, authenticated;

-- 2b. Close direct anon reads on shared_links (policy + column grants)
DROP POLICY IF EXISTS "anon_read_shared_links" ON shared_links;
REVOKE SELECT ON shared_links FROM anon;

-- ── Post-checks (run manually, expect false / false) ──
-- SELECT has_function_privilege('anon', 'get_db_stats()', 'EXECUTE');
-- SELECT has_table_privilege('anon', 'shared_links', 'SELECT');
