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
  -- Le catalogue disait 'Groupe 4h' mais 'Semi Privé 10h' : un seul vocabulaire,
  -- celui de la fiche envoyée à l'agence. Les lignes de facture référencent l'id,
  -- pas le libellé — renommer est sans effet sur l'existant.
  UPDATE agency_rate_items SET label = 'Pack cours Semi Privé 4h'
  WHERE agency_id = ffly AND label = 'Pack cours Groupe 4h';
  UPDATE agency_rate_items SET price = 190 WHERE agency_id = ffly AND label = 'Pack cours Semi Privé 4h';
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

  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'rental', 'Gardiennage matériel personnel — forfait 6 à 7 jours, par personne', NULL, 50, TRUE
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items WHERE agency_id = ffly AND label = 'Gardiennage matériel personnel — forfait 6 à 7 jours, par personne');

  -- ── Cours kiteFoil ──────────────────────────────────────────────────────
  -- Mêmes prix que le kite dans la fiche. Lignes distinctes quand même : une
  -- facture doit dire ce qui a été vendu. (Le modèle de leçon de l'app ne
  -- connaît pas la discipline — private/group/supervision et rien d'autre.)
  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'lesson', v.label, v.hours, v.price, TRUE
  FROM (VALUES
    ('Pack cours KiteFoil Privé 2h',      2, 140),
    ('Pack cours KiteFoil Privé 4h',      4, 240),
    ('Pack cours KiteFoil Semi Privé 2h', 2, 100),
    ('Pack cours KiteFoil Semi Privé 4h', 4, 190)
  ) AS v(label, hours, price)
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items r WHERE r.agency_id = ffly AND r.label = v.label);

  -- ── Cours wing : seules les 2h sont chiffrées dans la fiche ─────────────
  -- Moins cher que le kite, assumé : matériel débutant uniquement (l. 121).
  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'lesson', v.label, v.hours, v.price, TRUE
  FROM (VALUES
    ('Pack cours Wing privé 2h',      2, 120),
    ('Pack cours Wing Semi Privé 2h', 2,  96)
  ) AS v(label, hours, price)
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items r WHERE r.agency_id = ffly AND r.label = v.label);

  -- ── Location d'équipement ───────────────────────────────────────────────
  -- La fiche vend à la JOURNÉE, l'app facture à la demi-journée : voir le
  -- chantier « rentalPrice() ignore le slot » dans BACKLOG.md.
  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'rental', v.label, NULL, v.price, TRUE
  FROM (VALUES
    ('Location kitesurf (kite + barre + planche) — la journée',  95),
    ('Location kitesurf (kite + barre + planche) — 6 à 7 jours', 500),
    ('Location aile et barre — la journée',                       70),
    ('Location aile et barre — 6 à 7 jours',                     320),
    ('Location foilboard — la journée',                           70),
    ('Location foilboard — 6 à 7 jours',                         350),
    ('Location wingfoil — la journée',                            60),
    ('Location wingfoil — 6 à 7 jours',                          300)
  ) AS v(label, price)
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items r WHERE r.agency_id = ffly AND r.label = v.label);

  -- ── Hébergement ─────────────────────────────────────────────────────────
  -- Seulement pour les séjours pris CHEZ NOUS. Quand F&Fly réserve en direct
  -- auprès de Palmeiras, la chambre reste à 0 sur la résa — c'est le cas des
  -- deux résas F&Fly actuelles. Prix par chambre et par nuit (fiche l. 49).
  -- agency_rate_items n'a qu'une colonne prix : le palier de nuits est dans le
  -- libellé, comme les heures des forfaits cours.
  INSERT INTO agency_rate_items (agency_id, category, label, unit_hours, price, is_active)
  SELECT ffly, 'accommodation', v.label, NULL, v.price, TRUE
  FROM (VALUES
    ('Maison partagée, chambre vue mer (double) — la nuit, 1 à 6 nuits',   90),
    ('Maison partagée, chambre vue mer (double) — la nuit, 7 à 21 nuits',  85),
    ('Maison partagée, chambre classique (double) — la nuit, 1 à 6 nuits', 65),
    ('Maison partagée, chambre classique (double) — la nuit, 7 à 21 nuits',60),
    ('Maison complète (4 pers.) — la nuit, 1 à 6 nuits',                  130),
    ('Maison complète (4 pers.) — la nuit, 7 à 21 nuits',                 120)
  ) AS v(label, price)
  WHERE NOT EXISTS (SELECT 1 FROM agency_rate_items r WHERE r.agency_id = ffly AND r.label = v.label);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- RESTE À POSER — en attente d'une réponse de gui :
--   • Wing privé 4h / 10h : le catalogue dit 200 / 472,50, alignés sur l'ANCIEN
--     tarif kite. Le kite passe à 240 / 600, mais la fiche laisse ces deux cases
--     vides et vend le wing MOINS cher à 2h (120 contre 140) — matériel débutant
--     seulement. Ne rien déduire : c'est le piège « Pack cours 10x 2h ».
--   • KiteFoil 10h : case vide dans la fiche.
--   • Location et gardiennage de 2 à 5 jours, et de 8 à 21 jours : cases vides.
-- ════════════════════════════════════════════════════════════════════════════

-- VÉRIFICATION (après application) :
--   SELECT label, price, is_active FROM agency_rate_items
--   WHERE agency_id = (SELECT id FROM agencies WHERE name = 'Fun & Fly')
--   ORDER BY category, label;
