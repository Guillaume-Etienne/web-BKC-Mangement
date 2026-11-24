/* 2026-11-24 — Grille logement Fun & Fly (maison partagée), donnée par gui.

   Prix par CHAMBRE et par nuit (colonne « double » de la grille F&F, les autres
   vides), marge F&F incluse — même modèle que le reste de la grille : base de
   facture, la commission de 20 % se déduit du brut.

                         1 à 6 nuits   7 à 21 nuits
     Chambre vue mer        90 €          85 €
     Chambre classique      65 €          60 €

   Chez nous : H3/F = vue mer, H3/B = classique (gui, 24/11).
   Une ligne de facture = prix unitaire × nombre de nuits (champ « qty » du
   formulaire d'ajout), comme le gardiennage par jour.

   Idempotent ; agence retrouvée par son NOM (UUID différents TEST / PROD). */

DO $$
DECLARE ffly UUID;
BEGIN
  SELECT id INTO ffly FROM agencies WHERE name = 'Fun & Fly';
  IF ffly IS NULL THEN
    RAISE EXCEPTION 'Agence Fun & Fly introuvable — rien appliqué.';
  END IF;

  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'accommodation', v.label, NULL, v.price, TRUE
  FROM (VALUES
    ('Maison partagée — chambre vue mer, par nuit (séjour 1 à 6 nuits)',    90),
    ('Maison partagée — chambre vue mer, par nuit (séjour 7 à 21 nuits)',   85),
    ('Maison partagée — chambre classique, par nuit (séjour 1 à 6 nuits)',  65),
    ('Maison partagée — chambre classique, par nuit (séjour 7 à 21 nuits)', 60)
  ) AS v(label, price)
  WHERE NOT EXISTS (
    SELECT 1 FROM agency_rate_items r WHERE r.agency_id = ffly AND r.label = v.label
  );
END $$;

-- Vérif : 4 lignes 'accommodation' pour Fun & Fly
-- SELECT label, price FROM agency_rate_items WHERE category = 'accommodation' ORDER BY label;
