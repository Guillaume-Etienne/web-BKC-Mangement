# Test Plan — PHASE 3 Findings & Gaps
**Date** : 2026-07-29  
**Status** : ✅ Tests validés | ⚠️ Gaps découverts | 🔴 1 bug confirmé

---

## ✅ Tests complétés & validés

### Payments — Delta auto-créé ✓
- Booking #009 avec `amount_paid=150€` → payment auto-créé
- Édition : augmenter à 200€ → **delta=50€** seulement (pas 200€)
- **Validé** : logique `prevPaid - newAmount` fonctionne en create ET edit
- Code ref : `BookingsPage.tsx:1279-1292`

### Taxi — Standalone trips & marge ✓
- Trip standalone (pas de booking) créé en DB
- `booking_id = NULL` ✓
- Marge calculée : 120€ - (6000 MZN + 1000 MZN)/73 = **24.11€** ✓
- **Validé** : taxi standalone bien découpié pour revenue calc
- Code ref : `taxi_trips` table, `computeStandaloneTaxiRevenue`

### Lessons — Rate override prioritaire ✓
- Leçon privée : default rate 40€/h
- Override 60€/h appliqué
- Accounting affiche 60€/h ✓
- **Validé** : `getLessonRate()` prioritise override sur default
- Code ref : `BookingsPage.tsx`, `accounting/utils.ts:139-149`

### Bookings & Pricing — Full-house fallback ✓
- Full-house toggle → split prix en 2 chambres
- Fallback exact à 100€/nuit si pas de config custom ✓
- Snapshot `booking_room_prices` bien pris
- **Validé** : fix c80a0cd fonctionne correctement
- Code ref : `roomPricing.ts`, `BookingsPage.tsx:352-368`

---

## 🔴 Bugs confirmés

### Date Conflict — App accepte le chevauchement (AUDIT FINDING)
- **Symptôme** : H2/F Dec 1-5 + H2/F Dec 3-7 = tous les deux acceptés silencieusement
- **Root cause** : `isRoomConflicted()` = juste affichage (badge rouge), aucune validation
- **DB** : no `EXCLUDE` constraint, no trigger
- **Impact** : bookings invalides acceptés en prod
- **Fix requis** : ajouter vérification côté UI (canProceed) ET DB (trigger ou unique constraint)
- Code ref : `BookingsPage.tsx:377-397`, `supabase/schema.sql:124-128`

---

## ⚠️ Gaps découverts (Features incomplètes)

### 1. Equipment Rentals — Pas de logique tarif par slot
**Découverte** : Agent 2 a tracé le code au complet
- ❌ **Aucun calcul prix × jours × 0.5** pour morning/afternoon/full_day
- ❌ `equipment_rentals.price` = champ libre, saisi manuellement
- ❌ `booking.num_equipment_rentals` = count(brings_own_gear) sur participants, **pas lié à `equipment_rentals` table**
- **Implication** : test Equipment invalide (spec attendait une formule qui n'existe pas)
- **Réalité** : tarification 100% manuelle, admin saisit le prix
- Code ref : `EquipmentPage.tsx:125-139, 456-463`, `bookingActivity.ts:deriveActivityCounts`, `ClientSharePage.tsx:242`

**Décision pour tests** : invalider ce test, faire plutôt un test "affichage prix manuel" si pertinent

---

### 2. External Accommodations — Feature lecture-only, gap de costing
**Découverte** : Agent 4 a vérifié le schéma et l'accounting
- ❌ **Pas de chemin UI** pour créer `external_accommodation_bookings`
- ❌ **Cost n'est jamais utilisé** : aucune fonction `computeExternalAccommodationCost()`
- ⚠️ "Palmeiras" = valeur réelle (propriété du centre), pas test
- **Réalité** : 
  - Table `external_accommodations` existe (name, provider, cost_per_night, sell_price_per_night)
  - Revenue calc OK : `sell_price_per_night × nights` affichée en Accounting
  - Cost calc MISSING : cost_per_night n'est lu nulle part
  - Marge = Revenue - Cost donc incalculable
- **Implication** : feature incomplète (lecture-only), gap de logique métier
- Code ref : `schema.sql:443-464`, `accounting/utils.ts:41-48` (Revenue only), `PalmeirasTab.tsx` (separate tab)

**Décision pour tests** : marquer comme "pas prêt à tester" jusqu'à implémentation du cost accounting

---

### 3. Activities — Schéma réel ≠ spec du test
**Découverte** : Agent 3 a vérifié le schéma vs. la spec
- **Spec du test attendait** : `we_pay_provider` booléen sur provider, auto-create `activity_payments`
- **Schéma réel** :
  - `payment_flow` enum per booking : `'we_pay_provider' | 'provider_pays_us'`
  - Deux prix : `price_client` et `price_provider`
  - `activity_payments` = ledger manuel séparé, jamais auto-généré
- **Logique réelle validée** :
  - `we_pay_provider` → revenue += price_client, cost += price_provider
  - `provider_pays_us` → revenue += price_provider (client paie provider directement)
- Code ref : `ActivitiesPage.tsx:260+` (manual "+ Add payment"), `AccountingDashboard.tsx:55-57, 86`, `accounting/utils.ts:78-89`

**Décision pour tests** : refaire avec schéma réel (payment_flow per booking, manual payments), pas auto-create

---

## 📋 Plan PHASE 4+

Basé sur les findings, priorités réordonnées :

### Prêt à tester (logique métier stable)
1. **Payments** → plus de tests (discounts, deposits, verification status)
2. **Taxi** → plus de tests (driver assignment → fallback prices, rate changes)
3. **Lessons** → plus de tests (group, supervision, multi-participant)
4. **Bookings** → FIX date conflict bug EN PRIORITÉ, puis multi-room, cancellation cascade
5. **Center Access** → quick validation (logique solide)

### À clarifier avec gui avant test
- **Equipment** : est-ce une feature manquante (tarification par slot) ou design intentionnel (100% manuel) ?
- **External Accommodations** : implémenter cost accounting ou laisser comme lecture-only ?
- **Activities** : confirmer que payment_flow per booking + manual payments est l'intent

### Documenté mais pas d'accès pour exécuter
- **Form Submissions** → SQL seed préparé, besoin de gui pour INSERT
- **Dining Events** → SQL seed préparé, besoin de gui
- **Shared Links/RLS** → quick smoke test (déjà auditée en 2026-07-06)
- **Accounting aggregates** → validé via code-read, pas de test d'intégration encore

---

## 🎯 Action immédiate suggérée

1. **Valider les 3 gaps avec gui** (Equipment/External Acc./Activities)
2. **Fixer le date conflict bug** (PHASE 2 de bugfix)
3. **Continuer PHASE 4** avec les catégories prêtes (Payments/Taxi/Lessons/Bookings)

**Tokens utilisés** : ~195k / 200k (98%) — presque au limite. Phase 4+ pourra être rapide si on focus sur les catégories solides.

---

## Fichiers générés cette session

- `.claude/docs/TEST_PLAN_PHASE_2_SUMMARY.md` — architecture + hybrid approach
- `scratchpad/cleanup_test_data.sql` — ✅ corrigé (client_id filter)
- `scratchpad/seeding_test_data.sql` — base SQL (pas exécuté)
- `.claude/docs/TEST_PLAN_PHASE_3_FINDINGS.md` — ce fichier

