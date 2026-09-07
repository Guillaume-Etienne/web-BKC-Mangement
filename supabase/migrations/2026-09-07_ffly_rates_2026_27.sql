-- 2026-09-07 — Grille Fun & Fly saison 2026-2027.
--
-- Source : "2026-27 grille de prix détaillée Mozambique F&FLY.xlsx", la fiche de
-- synthèse renvoyée à l'agence. Décisions de gui le 2026-09-07 :
--
--   • Les prix de la fiche sont la BASE DE FACTURE, marge F&Fly incluse — même
--     modèle que la facture Brunet 2025 (2450 € facturés → 490 de commission →
--     1960 payés). Donc ils vont tels quels dans agency_rate_items.price, et
--     computeSeasonTotals en récupère 80 %.
--   • Transfert : deux véhicules, deux prix (la ligne unique à 168 € était déjà
--     démentie par la pratique — les 2 courses facturées cette saison sont à 160).
--   • Gardiennage : 7 €/jour en direct (price_items.center_access, inchangé),
--     8 €/jour via agence.
--
-- ⚠️ Aucun effet rétroactif : agency_billing_lines.price est figé à la création.
-- Les lignes déjà facturées (450, 200, 160×2) gardent leur montant.
--
-- Idempotent, et l'agence est retrouvée par son NOM pour tourner sur TEST comme
-- sur PROD (les UUID diffèrent).

DO $$
DECLARE ffly UUID;
BEGIN
  SELECT id INTO ffly FROM agencies WHERE name = 'Fun & Fly';
  IF ffly IS NULL THEN
    RAISE EXCEPTION 'Agence "Fun & Fly" introuvable — rien appliqué.';
  END IF;

  -- ── Cours kite : nouvelle grille ────────────────────────────────────────
  -- Privé 4h 200 → 240, 10h 472,50 → 600 · Semi 4h 160 → 190, 10h 346,50 → 400
  UPDATE agency_rate_items SET price = 240 WHERE agency_id = ffly AND label = 'Pack cours Privé 4h';
  UPDATE agency_rate_items SET price = 600 WHERE agency_id = ffly AND label = 'Pack cours Privé 10h';
  UPDATE agency_rate_items SET price = 190 WHERE agency_id = ffly AND label = 'Pack cours Groupe 4h';
  UPDATE agency_rate_items SET price = 400 WHERE agency_id = ffly AND label = 'Pack cours Semi Privé 10h';

  -- Les 2h manquaient au catalogue alors que la fiche les vend.
  -- « Semi-privé » chez F&Fly = « Group » chez nous (2 élèves max par moniteur).
  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'lesson', 'Pack cours Privé 2h', 2, 140, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items WHERE agency_id = ffly AND label = 'Pack cours Privé 2h');

  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'lesson', 'Pack cours Semi Privé 2h', 2, 100, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items WHERE agency_id = ffly AND label = 'Pack cours Semi Privé 2h');

  -- ── Transferts : une ligne par véhicule ─────────────────────────────────
  -- On désactive, on ne supprime pas : la ligne à 168 est référencée par des
  -- agency_billing_lines déjà émises.
  UPDATE agency_rate_items SET is_active = FALSE
  WHERE agency_id = ffly AND label = 'Transfert Maputo ↔ Bilene';

  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'transfer', 'Transfert Maputo ↔ Bilene — voiture (3 pax, 3 boardbags)', NULL, 160, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items WHERE agency_id = ffly AND label = 'Transfert Maputo ↔ Bilene — voiture (3 pax, 3 boardbags)');

  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'transfer', 'Transfert Maputo ↔ Bilene — pick-up (4 pax, 4 boardbags)', NULL, 200, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items WHERE agency_id = ffly AND label = 'Transfert Maputo ↔ Bilene — pick-up (4 pax, 4 boardbags)');

  -- ── Gardiennage : 8 € via agence (7 € reste le tarif direct) ────────────
  UPDATE agency_rate_items SET price = 8
  WHERE agency_id = ffly AND label = 'Gardiennage matériel personnel — par personne et par jour';
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- RESTE À POSER — en attente du fichier mis à jour par gui (2026-09-07) :
--   • Wing privé 2h / 4h / 10h  → aujourd'hui 4h=200 et 10h=472,50 en base,
--     alignés sur le kite, alors que la fiche vendait le wing MOINS cher (120 à
--     2h contre 140). Ne rien déduire.
--   • KiteFoil (aucune ligne au catalogue aujourd'hui).
--   • Location d'équipement à la journée et forfaits 6-7 jours (aucune ligne
--     category='rental' hors gardiennage).
--   • Hébergement : lignes category='accommodation' pour les séjours pris chez
--     nous (la fiche annonce 90/65/130 la nuit, 85/60/120 à partir de 7 nuits).
-- ════════════════════════════════════════════════════════════════════════════

-- VÉRIFICATION (après application) :
--   SELECT label, price, is_active FROM agency_rate_items
--   WHERE agency_id = (SELECT id FROM agencies WHERE name = 'Fun & Fly')
--   ORDER BY category, label;
