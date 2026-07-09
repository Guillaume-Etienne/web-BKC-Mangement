-- ============================================================
-- Document templates in DB + new Welcome Guide document
-- (apply TEST then PROD, verify with anon curl → must NOT read rows)
--
-- 1. Table `document_templates` : persistent storage of the editable
--    guide sections (Travel Guide + new Welcome Guide), previously kept
--    only in browser localStorage (bkc_guide_sections) — lost on cache
--    clear, never shared between browsers/admins.
--    Admin-only : RLS authenticated, no anon policy, explicit REVOKE.
--    The app seeds content on first Save (from localStorage/defaults),
--    so no INSERT here.
-- 2. email_log_type += 'welcome_guide' : the Welcome Guide is sendable
--    by email like the Travel Guide (Edge Function send-email passes
--    the type through, the enum is the only validation).
--
-- Idempotent. ALTER TYPE ... ADD VALUE is safe here because the new
-- value is not used elsewhere in this migration.
-- ============================================================

ALTER TYPE email_log_type ADD VALUE IF NOT EXISTS 'welcome_guide';

CREATE TABLE IF NOT EXISTS document_templates (
  id         TEXT NOT NULL,                -- section id ('tg1'…, 'wg1'…)
  doc_type   TEXT NOT NULL CHECK (doc_type IN ('travel_guide', 'welcome_guide')),
  sort_order INT  NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  title      JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { fr, en, es }
  content    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { fr, en, es }
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (doc_type, id)
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON document_templates;
CREATE POLICY "admin_all" ON document_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Belt and braces: no anon access at all (no policy anyway, but the
-- default grants would still let anon hit the endpoint and get []).
REVOKE ALL ON document_templates FROM anon;
