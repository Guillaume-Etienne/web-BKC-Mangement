# Pages partagées & système de liens (`shared_links`)

> **Doc de référence** pour tout ce qui touche aux pages publiques (accès par `?share=<token>`, sans login) et au taxi. Lis ça avant de toucher à une page partagée. Sécurité des données : voir **`security-rls.md`**.

## Les types de liens partagés

`SharedLinkType` (dans `types/database.ts`) **ET** l'enum Postgres `shared_link_type` doivent rester synchronisés (cf. runbook plus bas).

| type | Page (`App.tsx` dispatch) | `params` | Label UI (`LINK_TYPE_LABELS`) |
|------|---------------------------|----------|-------------------------------|
| `forecast` | `ForecastSharePage` | — | Forecast |
| `taxi` | `TaxiSharePage` | — | **Public Taxi Schedule** |
| `client` | `ClientSharePage` | `booking_number` | Client Account |
| `driver` | `DriverSharePage` | `driver_id` | **Taxi Driver Schedule** |
| `taxi_manager` | `TaxiManagerSharePage` | — (un seul manager, Geraldo) | **Taxi Manager GERALDO schedule** |
| `activity_provider` | `ActivityProviderSharePage` | `provider_id` | Activity Provider |
| `booking_form` | `BookingFormPage` | — | Public Booking Form |

## Où se créent les liens

- **Point central = Options → onglet Shared Links** (`ManagementPage`, tab `links`). On y crée TOUS les types (sauf `activity_provider` qui a son propre flux). Voir [[feedback_shared_links_central]]. Form : choix du type, + sélecteur conditionnel (booking par **nom ou numéro** pour `client`, **driver dropdown** pour `driver`). Liste **groupée par type** en sections repliables, bouton expand/collapse all, nom du client affiché sur les liens `client`.
- **Raccourcis contextuels** (coexistent) : bouton « share link » sur la carte chauffeur (`DriverStatementPanel`) et sur le provider d'activité (`ActivitiesPage`).

## Les 3 pages partagées TAXI

Toutes en **PT par défaut + toggle EN** (chauffeurs/manager mozambicains), via le dico commun.

| Page | Fichier | Public | Contenu | Montre l'argent ? |
|------|---------|--------|---------|-------------------|
| Public Taxi Schedule | `pages/TaxiSharePage.tsx` | staff / affichage | tous les trajets par jour, **places libres** (`seats − nb_persons`, « — » si pas de chauffeur), trajets non assignés en rouge | ❌ aucune |
| Taxi Driver Schedule | `pages/DriverSharePage.tsx` | 1 chauffeur | ses trajets + son MZN, bloc « O meu dinheiro » (gagné/à venir/total) | seulement `price_driver_mzn` |
| Taxi Manager GERALDO | `pages/TaxiManagerSharePage.tsx` | Geraldo | tous trajets **managés** + résumé par chauffeur + ses finances (comissão − adiantamentos = saldo) + historique paiements | `margin_manager_mzn` |

**Infra i18n/UI partagée :**
- `data/taxiShareI18n.ts` — dico PT/EN (`tr.key[lang]`) + helpers `tripTypeLabel`, `statusLabel`, `fmt`, `mzn`, `formatTripDate` ; types `TaxiLang`, `DateMode`, `ViewMode`.
- `pages/taxiShareUI.tsx` — `usePref` (préférence localStorage : langue, vue, date) + `Segmented` (toggle blanc sur header bleu).

## Conventions taxi à connaître

- **Taxi privé** : `margin_manager_mzn === 0` ⟹ trajet hors-manager (Geraldo ne touche rien, ne le voit pas). Décidé **par trajet**, pas de flag. Badge « 🔒 Private » dans les vues admin List/Kanban. Détail sur le champ `TaxiTrip.margin_manager_mzn` (`types/database.ts`) et [[security_anon_rls_exposure]] non concerné.
- **`taxi_drivers.seats`** : capacité du véhicule (défaut 3), éditable dans le form chauffeur (onglet Drivers). Sert aux « places libres » de la Public Taxi Schedule.
- **Tarifs nouveau trajet** : hérités de `taxi_pricing_defaults` (singleton ; les requêtes trient `updated_at desc` pour éviter les doublons → bug prix 8000€, cf. [[bug_taxi_trip_price]]).
- **Modèle financier** : client paie `price_eur` (EUR), chauffeur `price_driver_mzn`, manager `margin_manager_mzn` (MZN). Taux global `taxi_pricing_defaults.eur_mzn_rate`. Marge centre = `computeTaxiMarginEur`.

## 🔧 RUNBOOK — Ajouter un nouveau type de page partagée

Tous ces points sont nécessaires (on a déjà oublié l'enum une fois → erreur `invalid input value for enum shared_link_type`) :

1. **`types/database.ts`** : ajouter la valeur à `SharedLinkType`.
2. **Migration SQL** : `ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS '<nouveau>';` (à lancer SEULE, hors txn) + refléter dans `schema.sql`. **Appliquer TEST puis PROD.**
3. **La page** : `pages/XxxSharePage.tsx` (props depuis `sharedLink.params` si besoin).
4. **`App.tsx`** : importer + ajouter `if (sharedLink.type === '<nouveau>') return <XxxSharePage … />` dans le bloc share (avant le check session).
5. **`ManagementPage.tsx`** : ajouter au `LINK_TYPE_LABELS` (icône + label). Si la page a besoin d'un `param`, ajouter le champ conditionnel dans le form + le passer dans `handleCreateLink` (`params.xxx`). Retirer le type du `.filter(...)` d'exclusion si présent.
6. **RLS** : si la page lit des tables en anon → policy(ies) `anon` + **suivre la checklist de `security-rls.md`** (jamais `USING(true)` sur du sensible sans réflexion ; privilèges colonne si besoin).
7. **Cette doc** : mettre à jour le tableau des types.

## 🔧 RUNBOOK — Ajouter un champ à une page partagée

1. Colonne en base (migration + `schema.sql`) si nouveau champ.
2. Type TS (+ `mock.ts` si l'entité y figure, sinon build TS strict casse).
3. Form admin de l'entité (pour saisir la valeur).
4. La page partagée + le dico `taxiShareI18n.ts` (clé PT/EN) si texte visible.
5. ⚠️ Si la table est restreinte par colonne pour anon (`clients`, `booking_participants`) → ajouter la colonne au `GRANT SELECT (...)` ET au `.select()` de la page. Voir `security-rls.md`.
