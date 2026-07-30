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

## 🔴 Bug trouvé et corrigé (2) — repas gratuit, override ignoré

Un event repas à `price_per_person = 0` était sauté **en entier**, donc un convive portant
un `price_override` explicite n'était jamais facturé. Confirmé comme bug par gui.

Le garde-fou `if (ev.price_per_person === 0)` était **dupliqué à 5 endroits** ; ne corriger
que `utils.ts` aurait désynchronisé les totaux des lignes de détail :

| Fichier | Rôle | Correction |
|---|---|---|
| `utils.ts` ×3 | revenu global, charge booking, charge instructeur | garde-fou supprimé |
| `EventsTab.tsx:8` | total par event | garde-fou supprimé — le fichier listait déjà (l. 20) les events gratuits porteurs d'un override, mais les totalisait à 0 |
| `BookingFinances.tsx` | lignes de détail par participant | ligne poussée si montant ≠ 0 |
| `ClientSharePage.tsx` ×2 | total + détail côté client | idem |

Règle désormais : c'est le **montant effectif** (`price_override ?? price_per_person`) qui
décide, pas le prix de l'event. Un override explicite à 0 € reste donc gratuit.

## Agrégats extraits et testés (2026-07-29)

Les chiffres de tête du dashboard et du CashFlow étaient calculés **inline dans les
composants**, donc intestables — c'est comme ça que l'arrondi taxi avait dérivé du détail.
Ils vivent désormais dans deux fonctions pures :

- `computeSeasonTotals(data)` → répartition du revenu, encaissements, chaque ligne de coût,
  net Palmeiras, résultat. Les conventions faciles à rater sont documentées dessus
  (annulés hors revenu, taxi en marge jamais resoustrait, coût moniteur sur toute leçon donnée).
- `cashFlowUtils.ts` → `buildCashFlowRows` / `filterRowsByPeriod` / `sumCashFlowRows` /
  `runningBalances`. Base **encaissements** et non facturation.

**Vérifié iso-comportement sur la base TEST** : après refactor, chaque montant du dashboard
est identique à l'euro (4 413 € de revenu, +891 € de résultat). Et les deux vues se
réconcilient — CashFlow « All time » encaissé = 3 080 € = le chiffre du dashboard.

### ⚠️ « Billed » ne veut pas dire la même chose dans les deux onglets

Sur TEST : dashboard **4 818 €**, CashFlow **5 008 €**. L'écart de 190 € se décompose
exactement en remises **30 €** + taxis standalone **160 €**.

- Dashboard = ce que doivent les clients sur leurs résas, **net de remises**, résas seules.
- CashFlow = revenu généré dans le mois, **brut de remises**, + les trajets sans résa.

Les deux sont défendables, mais portent le même mot. Le point discutable est le brut : une
remise de 30 € accordée laisse quand même 30 € en « revenue generated ». À trancher par gui.

## Vérifications bout-en-bout sur la base TEST (2026-07-30)

Les garde-fous et l'auto-création de `handleSave` ne sont pas couverts par les tests
unitaires (ils vivent dans un composant React et écrivent en base). Testés à la main via
Claude in Chrome, sur la vraie base TEST. Astuce utile : `window.alert` est **intercepté**
(`window.alert = m => window.__alerts.push(m)`) — sinon une boîte de dialogue gèle
l'extension et on perd la main sur le navigateur.

| Scénario | Attendu | Résultat |
|---|---|---|
| Éditer une résa **sans rien changer** | passe | ✅ aucune alerte, modale fermée |
| Déplacer la #009 sur les dates de la #007, **même chambre** | bloqué | ✅ message affiché, modale maintenue, **rien écrit en base** |
| Annuler la #009 (**1 leçon**) | bloqué | ✅ message au singulier, **statut inchangé en base** |
| Annuler la #008 (**0 leçon, 2 taxis**) | passe | ✅ annulée — l'exclusion taxi fonctionne |
| Ré-enregistrer la #008 (taxis déjà créés) | pas de doublon | ✅ toujours **2** trajets, pas 4 (garde `isNew`) |
| Ré-enregistrer avec `amount_paid = 0` | pas de paiement | ✅ 0 paiement créé |

Le premier scénario est le plus important : un faux positif sur le conflit de dates aurait
empêché **toute** modification de réservation — pire que le bug corrigé. La base TEST a été
remise dans son état d'origine après les tests (#008 rebasculée en `provisional`).

## ⚠️ Comportements encodés à confirmer par gui

Ces points sont **testés tels qu'ils sont aujourd'hui**. Ce ne sont pas forcément des bugs,
mais ils méritent une décision explicite — si l'un doit changer, le test correspondant
dit exactement quoi modifier.

1. **Leçon de groupe : asymétrie client / instructeur.** Le client est facturé
   `tarif × heures × nb participants`, l'instructeur touche `tarif × heures` (une fois).
   Cohérent avec une marge centre sur les groupes — à confirmer.
2. **Paiement « à vérifier » compté comme encaissé.** Il réduit déjà l'outstanding avant
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
