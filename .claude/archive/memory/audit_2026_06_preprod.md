---
name: audit_2026_06_preprod
description: "Audit pré-prod (2026-06-28) — câblage compta/résas/taxis/activités OK, 2 tables orphelines droppées, migration consolidée à appliquer, seed saison à confirmer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 933253e1-21af-4a2a-bb0e-122337ce8afc
---

**Audit complet avant go-prod** demandé par gui (des résas commencent à tomber, juin 2026). Lié à [[project_form_traveler_kite_info]].

## Câblage — tout relié ✓
- Compta (`AccountingDashboard` + `computeBookingTotal`) agrège les 7 postes : accom (chambres+externe), cours, locations, taxis (booking + standalone), dining, activités net (2 flux), center access. Coûts instructeurs, marge taxi EUR (taux global unique), dépenses, Palmeiras : OK.
- Intake : formulaire public capture les flags par voyageur → `SubmissionsPage` persiste + dérive. Boucle complète.
- 44 tables, toutes lues/écrites sauf les orphelines ci-dessous. RLS admin partout + anon ciblé pages publiques.

## Nettoyage fait (2026-06-28)
- **DROP `participant_consumptions`** (+ type `ParticipantConsumption`, enum `consumption_type`) — orpheline, jamais alimentée.
- **DROP `travel_guide_sections`** (+ interface dupliquée dans `database.ts`) — le guide vit en **localStorage** via `data/travelGuide.ts`, jamais en DB.
- schema.sql + data-model.md + INDEX.md mis à jour. Build OK.

## Migration consolidée à appliquer (TEST → PROD)
`supabase/migrations/2026-06-28_pre_prod_consolidated.sql` — regroupe : (1) colonnes per-traveler + `num_wing_lessons`, (2) les 2 DROP, (3) seed saison `2026-2027 : 2026-09-15 → 2027-03-15` (guard `WHERE NOT EXISTS`). Remplace l'ancien `2026-06-27_per_traveler_activity.sql` (supprimé).
Saison d'exploitation = mi-sept → mi-mars (variable, dates non critiques). **Attention année** : les résas de juin 2026 sont pour la saison 2026-2027 (la 2025-2026 est passée).

## Seasons — explication
Une "saison" = fenêtre de dates nommée, **filtre de période** dans les écrans compta (CashFlow, Expenses, Houses, Palmeiras), mode "Season" en plus de "All time"/"Custom". Table vide aujourd'hui → bouton Season inopérant (pas de crash, tout en `?.`). Il faut ≥1 ligne pour filtrer la compta par saison. Aucune UI de gestion des saisons (création manuelle / seed SQL).

## Pré-flight orphelins de lignes (read-only)
`supabase/migrations/diagnostics_orphans_preflight.sql` — requêtes à lancer sur TEST+PROD avant go : participant_ids UUID[] sans FK (lessons/activity_bookings) pouvant être périmés, bookings sans hébergement, booking_rooms sans prix, etc.

## Redondances mineures laissées (non bloquantes)
- `bookings.emergency_contact_*` toujours null (les contacts vivent sur `clients`).
- `taxi_drivers.margin_percent` vestigial (modèle `default_*` l'a remplacé).
- Realtime publication PAS dans schema.sql (appliquée manuellement en prod, mars 2026) — un rebuild from-scratch ne l'aurait pas.

## Statut bascule prod (2026-06-28)
1. ✅ Dates saison confirmées (mi-sept→mi-mars, 2026-2027 seedé).
2. ✅ Migration consolidée appliquée TEST **et PROD** + pré-flight OK (saison renvoyée par requête 8).
3. ✅ `git push` fait (origin/master = `67ba184`) → Vercel déploie le front (colonnes en face).
4. ⏳ **RESTE : vérifier/redéployer `notify-submission` sur PROD** (non bloquant, n'affecte que la richesse de l'email admin). Le code repo est à jour. Redeploy via dashboard Supabase (Edge Functions → coller le code → Deploy) ou CLI `supabase functions deploy notify-submission --no-verify-jwt --project-ref oslsbansxaajcpwhivmx`. (idem TEST `uefezhyqcggpzomowpww` si emails test pauvres.)
5. ⏳ Créer le lien public `booking_form` **en PROD** (Management → Shared Links) pour que les clients aient l'URL `?share=...`.
