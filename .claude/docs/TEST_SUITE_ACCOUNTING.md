# Suite de tests comptables (vitest)

**Créée le** 2026-07-29 · `client/src/components/accounting/utils.test.ts` (83 tests, ~0,7 s)

```bash
cd client
npm test          # run unique
npm run test:watch
```

`npm run build` type-checke aussi les tests (ils sont dans `src/`), donc une fixture qui
ne correspond plus au schéma casse le build — c'est voulu.

## Ce qui est couvert

| Domaine | Tests | Points clés vérifiés |
|---|---|---|
| Nuitées | 5 | same-day = 0, dates inversées = 0, passage de mois |
| Tarif chambre | 7 | snapshot > tarif de base > 0 ; split full-house ; bungalow jamais splitté |
| Revenu hébergement | 6 | full house au prix maison (pas la somme des chambres), externe sur ses propres dates |
| Externe coût/marge | 6 | coût au **snapshot**, marge sell − cost, cumul de plusieurs séjours |
| Leçons | 7 | private/group/supervision, override, groupe × participants |
| Tarif leçon | 4 | override prioritaire sur le tarif instructeur |
| Locations | 3 | somme des prix saisis (tarification manuelle assumée) |
| Taxi | 7 | marge MZN→EUR, taxi privé (manager = 0), garde-fou taux = 0 |
| Activités | 4 | `we_pay_provider` facturé / `provider_pays_us` non facturé |
| Center access | 4 | personnes × nuits × tarif/jour |
| Repas | 8 | override individuel, event gratuit, repas instructeurs |
| Paiements | 6 | remises exclues du encaissé, paiement non vérifié compté |
| Paie instructeur | 7 | leçons hors booking comptées, solde earned − dettes − repas − versé |
| Total booking | 3 | agrégat des 7 sources |
| Acompte / format | 6 | 30 % plancher 120 €, arrondi euros |

Les tests sont écrits en **comportement métier** (« bills a full house at the house rate,
not the sum of room rates »), pas en paraphrase du code : ils décrivent la règle de gestion.

## 🔴 Bug trouvé et corrigé

**Coût des hébergements externes lu sur le référentiel au lieu du snapshot.**
`computeExternalAccommodationCost()` (écrit plus tôt dans la session) lisait
`external_accommodations.cost_per_night` — le tarif maître — alors que le revenu, lui,
utilise `external_accommodation_bookings.sell_price_per_night`, un **snapshot** pris à la
réservation. Conséquence : changer le tarif Palmeiras dans les options réécrivait
rétroactivement le coût de tous les séjours passés, et la marge affichée devenait fausse.

Corrigé : le coût lit `e.cost_per_night` (snapshot), symétrique du prix de vente.
Vérifié par mutation — en réintroduisant le bug, 2 tests tombent
(`expected 3996 to be 320`). `BookingFinances` affiche aussi le snapshot désormais.

## ⚠️ Comportements encodés à confirmer par gui

Ces points sont **testés tels qu'ils sont aujourd'hui**. Ce ne sont pas forcément des bugs,
mais ils méritent une décision explicite — si l'un doit changer, le test correspondant
dit exactement quoi modifier.

1. **Leçon de groupe : asymétrie client / instructeur.** Le client est facturé
   `tarif × heures × nb participants`, l'instructeur touche `tarif × heures` (une fois).
   Cohérent avec une marge centre sur les groupes — à confirmer.
2. **Event repas gratuit → override ignoré.** Si `price_per_person === 0`, l'event est
   sauté en entier : un convive avec un `price_override` à 20 € n'est jamais facturé.
   Probablement une vraie coquille.
3. **Paiement « à vérifier » compté comme encaissé.** Il réduit déjà l'outstanding avant
   vérification.
4. **Booking à 0 nuit** : le revenu hébergement retourne 0 (y compris l'externe, à cause du
   garde-fou en tête de fonction) alors que le coût externe, lui, est toujours calculé
   → marge négative sur un cas limite.
5. **`computeBookingTotal` ne filtre pas les annulés** — c'est à l'appelant de le faire.
6. **Repli sur `client_id`** quand un booking n'a pas de participants : ne matche que les
   convives enregistrés avec `person_type = 'participant'`.

## Ce que cette suite ne couvre pas

Fonctions pures uniquement. Restent à tester côté DB/UI :
`handleSave()` (auto-création snapshots / paiements / `taxi_trips`), RLS et liens partagés,
agrégats du dashboard (CashFlow, net result), formulaire public.
