-- ============================================================
-- Migration : Public booking intake form + admin review queue
-- Date : 2026-05-31
-- À exécuter D'ABORD en TEST puis en PROD (Supabase SQL editor).
-- ============================================================

-- 1. Nouveaux enums ----------------------------------------------------------
CREATE TYPE form_submission_status AS ENUM ('pending', 'approved', 'rejected');

-- ⚠️ ALTER TYPE ... ADD VALUE doit être exécuté seul (hors transaction qui
-- réutilise la valeur). Lancer cette ligne dans son propre run si besoin.
ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS 'booking_form';

-- 2. Nouvelles colonnes bookings --------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS has_travel_insurance BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS waiver_accepted_at   TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS waiver_version       TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referral_source      TEXT;

-- 3. Table file d'attente ----------------------------------------------------
CREATE TABLE IF NOT EXISTS form_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status             form_submission_status NOT NULL DEFAULT 'pending',
  language           TEXT NOT NULL DEFAULT 'en',
  reference_name     TEXT,
  email              TEXT,
  num_travelers      INTEGER,
  arrival_date       DATE,
  payload            JSONB NOT NULL,
  reviewed_at        TIMESTAMPTZ,
  created_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);

-- 4. RLS ---------------------------------------------------------------------
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON form_submissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Le formulaire public (anon) peut uniquement créer une soumission 'pending'.
CREATE POLICY "anon_insert_form_submissions" ON form_submissions
  FOR INSERT TO anon
  WITH CHECK (status = 'pending');
