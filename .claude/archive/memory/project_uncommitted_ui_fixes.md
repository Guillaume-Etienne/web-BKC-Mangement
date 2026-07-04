---
name: project_uncommitted_ui_fixes
description: "Batch retouches UI + 2 bugfixes — commité 67ba184 (local, non poussé)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 933253e1-21af-4a2a-bb0e-122337ce8afc
---

**État : ✅ commité `67ba184` (local, non poussé), build OK.** Lié à [[audit_2026_06_preprod]] et [[project_form_traveler_kite_info]].

## Esthétique notation (2026-06-28)
- Codes "Stay" révisés : **LK** (kite lessons) / **LW** (wing lessons) au lieu de KL/WL. Appliqué liste `BookingsPage` + barre `PlanningRow`. Notation finale partout : **G · N · LK · R · LW · C**.
- Légende "Stay codes" de BookingsPage (qui était restée en retard `n`/`L`) mise à jour.
- Étape **Transport** du wizard : bandeau « 👥 Total passengers : X people » en haut (aide au choix du taxi), calculé sur les voyageurs nommés.

## Bugfix paiement (important)
`BookingsPage` save étape 6 : le paiement auto « à vérifier » ne se créait que pour les **nouveaux** bookings (`if (isNew && amount_paid>0)`). Donc ajouter un montant en **éditant** un booking (ex: 100€ sur une résa créée via formulaire avec amount_paid=0) ne créait aucun Payment → invisible en compta. **Fix** : création basée sur le **delta** `data.amount_paid − wizard.editing.amount_paid` (prev=0 si new). Idempotent : re-save sans changer = rien ; bump = différence. Réductions ignorées (à gérer manuellement dans Accounting→Bookings).
> ⚠️ Gotcha à retenir : `bookings.amount_paid` n'est PAS la source de vérité des paiements (c'est la table `payments`). Le champ du wizard ne fait que semer un Payment sur le delta.

## Feature navigation compta
Section **"Outstanding payments"** du dashboard compta (`AccountingDashboard`, table `unpaidBookings`) : lignes désormais **cliquables** → ouvrent la résa dans /Bookings. Câblage `onOpenBooking` : `App.tsx` → `AccountingPage` (nouvelle prop) → `AccountingDashboard` (onClick ligne + curseur + chevron ↗). Même pattern que le planning.

## À faire
- Committer ce batch.
- (Rappel global : migration PROD + redeploy notify-submission TEST/PROD + push, voir [[audit_2026_06_preprod]].)
