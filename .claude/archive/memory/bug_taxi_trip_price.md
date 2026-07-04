---
name: bug_taxi_trip_price
description: "BUG à investiguer — création d'un nouveau trip taxi donne un prix aberrant (8000€)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f5399f4-4b21-4223-99ba-8584a5084480
---

**BUG signalé (2026-06-30, à investiguer PLUS TARD)** : créer un nouveau trajet taxi produit un **prix aberrant (~8000€)**.

**Piste à vérifier** : à la création, le trip hérite de `pricingDefaults.default_price_eur` (`TaxiKanbanView.addNewTrip` / `TaxiListView.addNewTrip`). 8000 ressemble à un montant **MZN** (cf. `default_driver_mzn` ~6000-8000), donc probable **confusion MZN↔EUR** : soit la valeur `taxi_pricing_defaults.default_price_eur` en base est fausse (saisie en MZN), soit un mauvais mapping de colonne. Vérifier `taxi_pricing_defaults` en base (TEST + PROD) + le formulaire de Pricing dans ManagementPage.

**Statut (2026-06-30, commit `4364316`)** : investigué. Le formulaire de pricing mappe correctement (pas de bug de saisie). Cause probable = **plusieurs lignes dans `taxi_pricing_defaults`** : `TaxiPage` ET `ManagementPage` prenaient `[0]` **sans ORDER** → les 2 écrans pouvaient piocher des lignes différentes (Options affiche 120€ pendant que les nouveaux trajets héritent d'une vieille ligne à 8000€). **Fix code** : les 2 requêtes font `order updated_at desc` → même ligne (la plus récente) partout. **Reste à faire par gui** : lancer `supabase/migrations/diagnostics_taxi_pricing.sql` pour voir/corriger la valeur stockée (mettre default_price_eur=120) et supprimer les lignes en double.
