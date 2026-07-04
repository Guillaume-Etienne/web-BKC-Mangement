---
name: Code and documentation audit (2026-03)
description: Comprehensive audit verifying code-docs alignment, identified 4 data integrity issues, fixed all documentation gaps
type: project
---

## Summary

Completed March 2026: Full audit of codebase and .claude/docs/ to verify code-documentation alignment and identify integrity issues. **All documentation fixes applied and built successfully.** Code compiles cleanly.

## Key Findings

### 🔴 CRITICAL — Data Integrity Issues

**Issue 1: Activity bookings not in booking total** (computeBookingTotal, accounting/utils.ts:88-96)
- Activity bookings linked to booking not included in financial total
- Only accommodation + lessons + rentals + taxi + dining summed
- **Impact**: Booking totals wrong if activities booked; missing revenue in AccountingPage
- **Fix needed**: Add filtered `computeActivityNetRevenue(bookingId, data)` and include in calculation

**Issue 3: Payment.is_discount flag never used**
- Field exists in Payment table but never read in accounting calculations
- **Impact**: Discount tracking/reporting broken
- **Decision**: Implement in `computeBookingTotal()` or remove from schema

**Issue 4: Lessons without booking_id create asymmetry**
- Lessons can exist without booking_id (day activities, scheduled trips)
- DO appear in instructor payroll (`computeInstructorEarned` has no booking_id filter)
- DO NOT appear on client invoices (filtered out in `computeLessonsRevenue`)
- **Status**: Likely intentional but undocumented — add code comments to clarify

### 🟠 IMPORTANT — Documentation Gaps (All Fixed)

**PlanningView (pages.md)**
- Missing 3 hooks: `useBookingDrag`, `useTable<HouseRental>`, `useTable<PriceItem>`
- Missing state keys: `draftMoves`, `showValidateModal`, `lessonView`, `weekStart`
- Missing draft mode documentation (validation modal before bulk apply)
- ✅ Fixed: Added all 3 hooks + 4 state keys + draft mode explanation

**BookingsPage (pages.md)**
- Wizard steps documented as 0-5, actually 1-6
- Missing hooks: `useBookingRoomPrices`, `useTable<HouseRental>`
- ✅ Fixed: Corrected steps to 1-6, added missing hooks

**TaxiPage (pages.md)**
- Tabs documented as 'planning'|'drivers', actually 'planning'|'finance'|'drivers'
- Missing `useTable<TaxiManagerPayment>` hook
- ✅ Fixed: Added 'finance' tab, added hook

**NowView (components.md)**
- Props documented as `{instructors, bookingParticipants}`
- Actually receives full list: `{bookings, bookingParticipants, bookingRooms, rooms, accommodations, instructors}`
- ✅ Fixed: Expanded Props to full 6 parameters

**PlanningRow (components.md)**
- Missing optional `unavailableDays?: Set<number>` prop
- ✅ Fixed: Added prop documentation

**TaxiListView (components.md)**
- `pricingDefaults` documented as nullable, actually required
- ✅ Fixed: Corrected to required

**New TaxiFinanceTab component**
- Tab for manager payment history not documented
- ✅ Fixed: Added full component documentation with AddPaymentForm

### 🟡 MODERATE — Orphaned Tables

**ParticipantConsumption**
- Table exists but never populated in codebase (0 inserts anywhere)
- ClientSharePage tried to read it → always empty Services section
- ✅ Fixed: ClientSharePage refactored to query source tables directly (lessons, equipment_rentals, taxi_trips, dining_events, external_accommodations)

**TravelGuideSection**
- Documented in code (client/src/types/database.ts) but missing from data-model.md
- 8 fields, i18n support (fr/en/es)
- ✅ Fixed: Added to data-model.md with full field documentation

### Dining Events — Indirect FK

No FK constraint between `dining_events.attendees[].person_id` and `booking_participants.id`. Works in practice but fragile if participant deleted. Marked as low priority—works but should note in RLS policies.

## Files Modified

### Code Changes
1. **client/src/pages/ClientSharePage.tsx** — Completely refactored:
   - Removed unused `ParticipantConsumption` queries
   - Added direct queries to: `lessons` + `instructors` + `lesson_rate_overrides`, `equipment_rentals`, `taxi_trips`, `dining_events` + `booking_participants`, `external_accommodation_bookings` + `external_accommodations`
   - Reuse calculation functions from `utils.ts` (same as AccountingPage)
   - Added section detail display (dining shows "braai · 2p @ 13€ → 26€")

2. **supabase/schema.sql** — Added 10 RLS policies for anon access:
   - booking_participants, dining_events, lesson_rate_overrides
   - external_accommodation_bookings, external_accommodations
   - booking_rooms, booking_room_prices, rooms, accommodations, payments

3. **client/src/types/database.ts** — Added TravelGuideSection interface:
   - 8 fields: id, key, title_fr/en/es, body_fr/en/es, sort_order, updated_at

### Documentation Changes
1. `.claude/docs/data-model.md` — Added 2 table sections: ParticipantConsumption, TravelGuideSection
2. `.claude/docs/pages.md` — Fixed PlanningView (3 hooks + 4 state + draft mode), BookingsPage (steps 1-6), TaxiPage (tabs + hook)
3. `.claude/docs/components.md` — Fixed NowView (Props 6 params), PlanningRow (unavailableDays), TaxiListView (pricingDefaults required), added TaxiFinanceTab
4. `.claude/docs/INDEX.md` — Added pointers to ParticipantConsumption, TravelGuideSection, audit issues, clarified PlanningView/TaxiPage/TaxiFinanceTab
5. `project_accounting_issues.md` — Enhanced with Issues 3-4 (Payment.is_discount unused, Lessons without booking_id asymmetry)

## Build Status

✅ `npm run build` — All TypeScript compiles cleanly, 0 errors
- vite v7.3.1, 120 modules, ~913KB bundle

## Next Steps (For Production)

1. Execute 10 RLS policy SQL statements in Supabase production console (already in schema.sql, lines TBD)
2. Test ClientSharePage with booking containing: lessons, rentals, taxis, dining events
3. Verify amounts match AccountingPage > Bookings > same booking
4. Consider: Implement Payment.is_discount logic in computeBookingTotal() and UI (Issue 3 decision)

## Verification Points

- ✅ All doc changes verified against actual code
- ✅ Build passes with strict TS (noUnusedLocals, noUnusedParameters)
- ✅ No breaking changes to component/page interfaces
- ✅ Calculation functions reused consistently (lessons, equipment, taxi, dining)
