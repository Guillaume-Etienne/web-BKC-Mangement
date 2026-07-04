---
name: project_form_traveler_kite_info
description: Per-traveler kite activity model — flags on booking_participants, num_* derived; notation G·N·LK·R·LW·C; build OK, committed local, PROD migration + push pending
metadata: 
  node_type: memory
  type: project
  originSessionId: 309efdb6-341d-476f-8837-aec221425e33
---

**✅ FAIT (2026-06-27)** — le modèle "qui fait quoi" est passé de compteurs anonymes sur le booking à des **flags par voyageur**. Voir [[project_booking_form]].

**Ce qui était cassé** (diagnostic) : le formulaire public collectait `wants_kite_lessons / wants_kite_rental / wants_wing_lessons / brings_own_gear / needs_storage` par voyageur (`FormTraveler`), mais à l'approbation **seul `kite_level` était recopié** sur le participant — tout le reste jeté. Le booking repartait avec `num_* = 0`, ressaisie manuelle au compteur. Et le **wing n'existait nulle part** côté booking. Notation incohérente : voyageurs = `G` dans la liste mais `P` dans le planning.

**Décisions gui** :
- Modèle **par voyageur** (flags sur `booking_participants`, source de vérité) ; les `num_*` deviennent un **cache dénormalisé** recalculé via `deriveActivityCounts()` à chaque write des participants.
- **Center access** (la `C`, tarif €/jour) = voyageurs avec **`brings_own_gear = true`** (own-gear riders). Pas les non-kiters, pas les cours/location.
- Notation unifiée **partout** : `{n}G · {n}N · {n}LK · {n}R · {n}LW · {n}C` (G guests, N nights majuscule, **LK** kite lessons, R rental, **LW** wing lessons, C center access). ⚠️ schéma révisé 2026-06-28 : LK/LW (Lessons-Kite / Lessons-Wing) au lieu de KL/WL. Légende "Stay codes" de BookingsPage mise à jour en conséquence. Shorthand nuits `Xn`→`XN` aussi dans le résumé wizard et les lignes compta `BookingFinances` (y compris `/n`→`/N`). Texte en toutes lettres « nights » laissé tel quel.

**Implémentation** :
- `booking_participants` +6 bool : `does_kite, brings_own_gear, needs_storage, wants_kite_lessons, wants_kite_rental, wants_wing_lessons`. `bookings` +`num_wing_lessons`.
- Helper `client/src/utils/bookingActivity.ts` : `deriveActivityCounts()`, `activityCountColumns()`, `travelerActivityLabel()`.
- `SubmissionsPage` : persiste les flags + `activityCountColumns(travelers)` sur le booking.
- `BookingsPage` : `ParticipantData` porte les flags (`EMPTY_ACTIVITY`), étape 5 "KiteCenter" = cases à cocher **par voyageur** (plus de `<Counter>` anonymes), save recalcule `num_*`. Taxi `nbPersons` = nb participants réels.
- Notation : `PlanningRow` (P→G, LK, R, LW, C), liste `BookingsPage` (G·N·LK·R·LW·C) + légende "Stay codes", `PlanningView` modal (+Wing/Center access en clair), `ManagementPage` card (+wing). `BookingFinances` : nuits compactes `Xn`→`XN`.
- `npm run build` OK. **Commité en local** (pas de push — éviter déploiement Vercel avant migration PROD).

**⚠️ RESTE À FAIRE** :
- **Migration PROD** : `supabase/migrations/2026-06-27_per_traveler_activity.sql` — appliquer sur TEST puis PROD (idempotent). Tant que pas appliquée, les colonnes manquent → erreurs insert.
- Anciens bookings : gardent leur `num_*` (cache) jusqu'à la prochaine édition ; pas de backfill des flags possible (on ne sait pas qui fait quoi). À la réédition, `num_*` se recalcule depuis flags (souvent 0 au début) → prévenir gui.
- Le formulaire public (`BookingFormPage` `TravelerCard`) collecte bien ces flags (commit `026e103`) — vérifier que l'UX y est complète (wing inclus).
- Lien FAQ par langue dans l'email accusé client (`notify-submission/index.ts`) — URLs à fournir par gui.
