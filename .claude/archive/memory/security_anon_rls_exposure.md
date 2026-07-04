---
name: security_anon_rls_exposure
description: Dette sécu connue — les policies anon USING(true) exposent les données en lecture publique
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f5399f4-4b21-4223-99ba-8584a5084480
---

**Dette de sécurité CONNUE (auditée 2026-06-30)** : les pages partagées fonctionnent via des policies `FOR SELECT TO anon USING (true)` sur ~22 tables. La clé `anon` étant publique (bundle JS), **toutes ces tables sont lisibles publiquement** par quiconque l'extrait — **le token de partage ne protège PAS les données** (il route juste l'UI dans `App.tsx`).

Exposé en 🔴 sensible : `clients` (emails/tél), `booking_participants` (**passeports**), `payments`, `taxi_manager_payments`. Détail complet + tableau + checklist + pistes de durcissement dans **`.claude/docs/security-rls.md`** (indexé dans INDEX.md).

**Calibrage** : lecture seule (pas d'écriture anon sauf insert form_submissions en pending), proba faible mais impact RGPD réel (passeports).

**✅ Mitigation faite (2026-06-30, commit `c4bab93`)** : `clients` et `booking_participants` restreintes **par colonne** pour anon (id/first_name/last_name only) → passeports, emails, tél, dates de naissance, contacts d'urgence, notes **ne sont plus exposés**. Migration `2026-06-30_shared_pages_security.sql` (à appliquer TEST→PROD par gui). `.select()` des pages narrowés en conséquence.

**RESTE (chantier futur, non fait)** : anon peut toujours lire ces colonnes identité pour **TOUTES les lignes** (pas seulement le booking du token), et `bookings`/`payments`/`taxi_*` restent en `USING(true)` complet. Vrai fix = Edge Functions service-role validant le token, ou RLS token-aware, ou vues filtrées.

**How to apply** : avant toute nouvelle policy anon ou page partagée → lire `security-rls.md` et suivre sa checklist, puis mettre à jour son tableau. Lié à [[feedback_shared_links_central]] et [[project_taxi_shares]].
