# Test Plan — PHASE 2 Summary & Learnings
**Date** : 2026-07-29  
**Status** : ✅ Setup données terminé | 🚀 Phase 3 prête

---

## 🎯 Ce qu'on a découvert

### Architecture React → Supabase
L'app n'a **pas d'API backend**. React parle directement à Supabase via le SDK :
- `BookingsPage.tsx` : fonction `handleSave()` fait TOUT le travail côté client
- Lors d'un save booking, elle déclenche :
  1. Insert/update `bookings` (dates, status, amount_paid)
  2. Snapshot `booking_room_prices` (capture le prix au moment du booking)
  3. Auto-create `payments` si `amount_paid > 0` (delta seulement)
  4. Auto-create `taxi_trips` si `taxi_arrival/departure=true` **ET `isNew=true`**

**Risque** : Créer un booking en SQL pur bypasserait ces déclencheurs. ✅ **Solution hybrid** : SQL pour le référentiel (clients, rooms), **API/UI pour ce qui a logique métier**.

### Hybrid Approach validé
```
SQL seed (clients, rooms, rates)
         ↓
UI Wizard (6 steps)
         ↓
handleSave() déclenche snapshots/payments/taxi
         ↓
Tests vérifient les résultats en DB
```

**3 bookings créés & vérifiés** :
- Alice (#006) : snapshot `booking_room_prices` ✓
- Bob (#007) : payment auto (300€) ✓  
- Carla (#008) : taxi_trips auto (2 lignes) ✓

### Bug trouvé & corrigé
**Cleanup script** avait une faille : `bookings.import_id LIKE 'TEST_%'` ratait les bookings UI (qui ont `import_id=NULL`). Corrigé en filtrant via `client_id` (couvre SQL + UI). ✅ Fichier mis à jour.

### Correction d'environnement
- Vrai TEST Supabase = `uefezhyqcggpzomowpww` (pas `dgvfhkwqfwsddzwcmbjz`)
- RLS Phase 2 : anon sans token ne lit rien (lecture demande `x-share-token`)
- Écriture = authenticated users seulement (credentials admin requises pour l'API)

---

## 📋 Plan condensé — 70 tests / 12 catégories

### Priorité 🔴 Haute (logique financière)
1. **Payments** (~6) : déltas, vérification, remises, dépôts
2. **Taxi** (~8) : trips standalone, marge EUR/MZN, assignation driver → fallback price
3. **Lessons** (~8) : private/group/supervision, tarifs, overrides, multi-participants

### Priorité 🟡 Moyenne (booking logic)
4. **Bookings & pricing** (~8) : full-house vs chambre, fallback tarif, conflits dates, multi-room
5. **Activities** (~6) : we_pay_provider vs provider_pays_us, marge
6. **Equipment rentals** (~4) : morning/afternoon/full_day, slot assignment

### Priorité 🟢 Déjà auditée / Isolée
7. **Shared links & RLS** (~8) : tokens par type, anon restrictions (auditée 2026-07-06)
8. **External accommodations** (~5) : Palmeiras, snapshot cost/sell
9. **Center access** (~3) : own_gear → facturation center access
10. **Dining events** (~4) : count vs menu, price_override
11. **Form submissions** (~4) : soumission → review → booking, anti-doublon
12. **Accounting agrégats** (~6) : dashboard revenue, cash flow, "to verify"

---

## 🔧 Stratégie d'exécution

### Approche validée
- **SQL seed** pour les configurations stables (clients, accommodations, instructors, providers, rates)
- **UI Wizard** pour tout ce qui a logique (bookings avec snapshots/payments/taxi)
- **DB verification** via fetch() avec JWT `authenticated` (RLS permet lecture complète)

### Cleanup strategy
```sql
-- Capturer les IDs TEST_
_test_client_ids : clients WHERE import_id LIKE 'TEST_%'
_test_booking_ids : bookings WHERE client_id IN (...) OR import_id LIKE 'TEST_%'
_test_participant_ids : booking_participants WHERE booking_id IN (...)
-- Delete SET NULL tables FIRST (taxi_trips, equipment_rentals, activity_bookings)
-- Then CASCADE tables (payments, booking_room_prices, booking_rooms, booking_participants)
-- Then bookings, clients, accommodations
```

**Idempotent** : rejouable à volonté (DELETE sur set vide = no-op).

---

## 📊 Données créées (Phase 2)

| Entity | Identifiant | Notes |
|--------|-------------|-------|
| Clients (3) | TEST_Alice/Bob/Carla | import_id = TEST_c1/c2/c3 |
| Bookings (3) | #006, #007, #008 | import_id = NULL (créés UI) |
| Payment (1) | Bob#007 | 300€ auto-créé |
| Taxi trips (2) | Carla#008 | aller/retour |
| Room prices | Alice#006 | snapshot pris |

---

## 🚀 Phase 3 — Ready to go

**Focus** : Payments → Taxi → Lessons (priorité haute, logique financière)

Chaque test :
1. Créer booking via UI ou seed+API
2. Vérifier en DB que la logique métier s'est déclenchée (snapshots/payments/taxi/etc.)
3. Cleanup via script corrigé

**Token budget** : ~65k restants (sur 200k). ~200 tests/tokens = 13k/test. Assez pour ~5 tests complets (booking + vérif + cleanup) avant dépasse.

---

## 📚 Fichiers de référence

- `.claude/docs/data-model.md` : schéma complet
- `client/src/pages/BookingsPage.tsx:1117-1330` : logique `handleSave()` → snapshots/payments/taxi
- `scratchpad/cleanup_test_data.sql` : ✅ corrigé (client_id filter)
- `.claude/docs/BACKLOG.md` : source de vérité single

