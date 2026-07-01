# Seed de démo — base TEST

Jeu de données réaliste pour tester **toute** l'appli (planning, bookings, taxis,
activités, compta, pages partagées). Couvre **mi-septembre → mi-octobre 2026**.

> ⚠️ **UNIQUEMENT sur la base TEST.** Ne jamais lancer en PROD.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `seed_test_data.sql` | Wipe le contenu **+ shared_links** (garde config/prix), remet `booking_number` à 1, insère les 5 groupes + tout le reste. **Idempotent** : ré-exécutable à volonté. |
| `teardown_test_data.sql` | Enlève « d'un coup » tout le contenu de démo (même wipe, sans réinsertion). Pour repartir : relancer `seed_test_data.sql`. |

## Comment lancer

1. Ouvrir **Supabase → projet TEST → SQL Editor**.
2. Coller le contenu de `seed_test_data.sql`, **Run**.
3. Tester dans l'appli (bien être en mode TEST : `localStorage.setItem('supabase_env','test')`, navbar ambre).
4. Pour nettoyer : coller `teardown_test_data.sql`, **Run**. (ou relancer le seed, qui wipe d'abord).

## Ce que le seed préserve (config / prix)

`accommodations`, `rooms`, `room_rates`, `price_items`, `equipment`, `instructors`,
`taxi_drivers`, `taxi_pricing_defaults`, `external_accommodations`,
`activity_providers`, `seasons`, `palmeiras_*`.

**Config adaptative** : le seed réutilise tes vraies maisons / chauffeurs / moniteurs /
prestataires / logement externe (par ordre de nom/création). S'il en manque en TEST,
il crée un fallback de démo suffixé `(demo)` — il ne casse jamais.

## Les 5 groupes (bookings #1..#5)

| # | Client | Dates | Logement | Activités testées |
|---|--------|-------|----------|-------------------|
| 1 | **Martin** (famille, 2 enfants) | 14→21 sept | Maison entière (2 ch.) | Cours kite privé + cours **wing** + **location** + **accès centre** (own-gear) + taxis A/R + dining + acompte (**solde dû**) |
| 2 | **Schmidt** (couple) | 20→27 sept | **Logement externe** Palmeiras | Cours + location + **safari** (we_pay) + **activité** (provider_pays) + **taxi privé** 🔒 (margin_manager=0) + payé |
| 3 | **Bernard** (amis, 4) | 28 sept→5 oct | 2 chambres | **Cours groupe** (×3 participants) + location + taxis A/R + day activity + paiement partiel (**solde dû**, 1 non vérifié) |
| 4 | **Dubois** (solo) | 3→10 oct | **Bungalow** Palmeiras | **Supervision** + locations + taxi + payé + **remise** (is_discount) |
| 5 | **Wilson** (couple) | 11→16 oct | 1 chambre | Cours kite couple, **PROVISIONAL**, **aucun paiement** (Outstanding / forecast) |

**Global** : trajet taxi **standalone** (sans booking), 3 dépenses, dette+paiement moniteur,
2 **avances au manager Geraldo** (saldo positif), 2 dining events, 1 day activity.

## Pages partagées prêtes à cliquer (recréées par le seed)

Le seed recrée 5 `shared_links` (tokens fixes). URL = `…/?share=<token>` :

| Token | Type | Contenu |
|-------|------|---------|
| `forecast_seeddemo` | forecast | Prévisionnel saison |
| `taxi_seeddemo01` | taxi | Public Taxi Schedule (places libres, PT/EN) |
| `taximgr_seeddem` | taxi_manager | Manager GERALDO (finances + historique) |
| `driver_seeddemo` | driver | 1er chauffeur (ses trajets + son MZN) |
| `client_seeddemo` | client | Compte client Martin (**booking #1**) |

> Tu peux aussi en créer d'autres via **Options → Shared Links** (c'est le but du smoke-test).

## Repères pour retester / modifier

- **Prix chambres** : le seed lit `room_rates` si présent (`room_id` = UUID chambre),
  sinon retombe sur des valeurs par défaut (50 €/ch., 40 € bungalow).
- **Taxi privé** = `margin_manager_mzn = 0` (badge 🔒). Le groupe 2 en a un.
- **Manager Geraldo** : saldo = Σ `margin_manager_mzn` (trajets managés, >0) − Σ `amount_mzn`
  (`taxi_manager_payments`). Ici : gagné 6×1000 = 6000 − versé 3000 = **3000 MZN dus**.
- **Marqueur** : toutes les lignes de démo portent `[SEED]` (notes) et `import_id LIKE 'SEED-%'`
  (clients/bookings) → repérables si besoin d'un ménage ciblé.

## Runbook — ajouter un groupe / un champ au seed

1. Dans `seed_test_data.sql`, bloc `DO $$ … $$`, dupliquer un groupe existant
   (déclarer les vars `v_bN`, `v_bN_pX` en tête du `DECLARE`).
2. Toujours renseigner les compteurs dérivés du booking
   (`num_lessons`, `num_equipment_rentals`, `num_wing_lessons`, `num_center_access`)
   **cohérents** avec les flags des participants (sinon l'UI diverge).
3. Garder `import_id 'SEED-*'` + `notes '[SEED]'`.
4. Rejouer le seed (il wipe d'abord) — pas besoin de teardown entre deux.
