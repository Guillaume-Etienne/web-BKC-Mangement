---
name: project_test_seed
description: Scripts de seed/teardown de démo pour la base TEST (supabase/seed/)
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f5399f4-4b21-4223-99ba-8584a5084480
---

Jeu de données de démo réaliste pour la base **TEST**, pour tester toute l'appli lors des smoke-tests. Créé 2026-07-01. Voir aussi [[project_taxi_shares]] (pages partagées à tester) et [[bug_taxi_trip_price]].

## Fichiers (versionnés)
`supabase/seed/` :
- `seed_test_data.sql` — wipe contenu **+ shared_links** (garde config/prix), `booking_number` remis à **1**, insère 5 groupes (mi-sept→mi-oct 2026) + finances/taxis/activités/dining/expenses + 5 shared_links prêts à cliquer. **Idempotent** (wipe en tête → ré-exécutable).
- `teardown_test_data.sql` — même wipe, sans réinsertion (« tout enlever d'un coup »).
- `README.md` — procédure + tableau des 5 groupes + runbook « ajouter un groupe ».

## Décisions prises (gui, 2026-07-01)
1. Wipe = tout le contenu **+ shared_links** ; **garde** config/prix (accommodations, rooms, room_rates, price_items, equipment, instructors, taxi_drivers, taxi_pricing_defaults, external_accommodations, activity_providers, seasons, palmeiras_*).
2. `booking_number` **repart à #1** → bookings #1..#5 déterministes.
3. Config **adaptative** : réutilise l'existant (par nom/ordre), crée un fallback suffixé `(demo)` seulement si manquant → ne casse jamais même sur base TEST vide.
4. Mix : Martin (famille, maison entière, kite+wing+loc+own-gear) · Schmidt (couple, logement externe Palmeiras, safari+activité, **taxi privé** margin=0) · Bernard (amis, 2 ch., cours groupe, taxis A/R) · Dubois (solo, bungalow Palmeiras, supervision+remise) · Wilson (**provisional**, 0 paiement).

## À exécuter
Supabase → projet **TEST** → SQL Editor → coller `seed_test_data.sql` → Run. **Jamais en PROD.**

## Points techniques à retenir
- Marqueur de démo : `notes` contient `[SEED]`, `import_id LIKE 'SEED-%'` sur clients/bookings.
- `num_lessons`/`num_equipment_rentals`/`num_wing_lessons`/`num_center_access` posés **cohérents** avec les flags participants (l'appli les dérive côté TS via `deriveActivityCounts` — pas de trigger DB).
- Prix chambres : lit `room_rates` (`room_id`=UUID chambre) si présent, sinon défaut 50/40.
- Manager Geraldo : saldo = Σ`margin_manager_mzn`(>0) − Σ`amount_mzn` = 6000 − 3000 = **3000 MZN dus**.
- ⚠️ Le seed **ne touche pas** `taxi_pricing_defaults` : si la ligne test a `default_price_eur=8000` (cf. [[bug_taxi_trip_price]]), un NOUVEAU trip créé via l'UI héritera de 8000 — les trips du seed ont des prix explicites, eux, donc OK.
