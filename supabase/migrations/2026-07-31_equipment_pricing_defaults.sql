-- Equipment revenue tab (Equipment page → CA): a lesson never bills gear
-- separately, so the "value" a kite/board brings to a lesson is estimated
-- from the lesson's real margin (client price − instructor pay). These three
-- knobs tune that estimate and were previously hardcoded constants in
-- EquipmentPage.tsx — now editable from the app, single row like
-- taxi_pricing_defaults.

CREATE TABLE equipment_pricing_defaults (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_share   NUMERIC(4,3) NOT NULL DEFAULT 0.35,  -- of the lesson's margin, attributed to gear overall
  other_gear_share  NUMERIC(4,3) NOT NULL DEFAULT 0.30,  -- of that, reserved for untracked accessories (bar, helmet, harness, vest, radio)
  kite_board_ratio  NUMERIC(4,2) NOT NULL DEFAULT 2.0,   -- kite weight vs board in what's left
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE equipment_pricing_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON equipment_pricing_defaults FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- No anon policy on purpose: admin_all is exhaustive here (unlike price_items,
-- nothing about this internal estimate is ever shown on a public share page),
-- so REVOKE-then-GRANT-columns would be a no-op ceremony, not real hardening.

-- Seed the single row with the values gui already validated in the mockup.
INSERT INTO equipment_pricing_defaults (equipment_share, other_gear_share, kite_board_ratio)
VALUES (0.35, 0.30, 2.0);

-- ── Vérification (à lancer après avoir passé la migration) ─────────────────
-- curl anon — doit renvoyer 401/403 (aucune policy anon) :
--   curl -s "$SUPABASE_URL/rest/v1/equipment_pricing_defaults?select=*" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
-- Dans l'app (connecté) : Equipment → CA doit afficher les curseurs avec 35 / 30 / 2.0.
