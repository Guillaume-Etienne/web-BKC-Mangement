---
name: accounting-issues-audit-2026-03
description: CLOSED 2026-05-25 — all 4 audit issues resolved or documented in code
metadata: 
  node_type: memory
  type: project
  originSessionId: a9c95d91-f8f8-44cb-aff1-0a14abc3d8d1
---

## STATUS — CHAPTER CLOSED (2026-05-25)

Verified against current code: all 4 issues below are resolved or intentionally documented. No further accounting work planned.
- **Issue 1 (activities in total)** → ✅ FIXED: `computeBookingTotal` includes `computeActivityRevenueForBooking` (utils.ts:110), 🎯 Activities section in BookingFinances.
- **Issue 2 (dining no FK)** → documented in code comment (utils.ts:192-194), manual matching, low priority, works in practice.
- **Issue 3 (is_discount)** → ✅ FIXED: `computeBookingDiscounts`/`computeBookingPaid` (utils.ts:115-126), full `DiscountForm`, purple badges, `due = total − discounts − paid`.
- **Issue 4 (lessons without booking_id)** → ✅ documented in code comment (utils.ts:141-143).

Original audit notes preserved below for reference.

---

## Issue 1: Activity bookings not in booking total

**Location**: `client/src/components/accounting/utils.ts:88-96` (`computeBookingTotal`)

**Problem**: Activity bookings linked to a booking (via `activity_bookings.booking_id`) are NOT included in the booking's financial total. Only accommodation, lessons, rentals, taxi, dining are summed.

**Impact**: Booking totals are WRONG if activities are booked. Admin sees missing revenue in AccountingPage > Bookings.

**Fix needed**: Add filtered `computeActivityNetRevenue(bookingId, data)` function and include in line 95.

**Current calc**:
```
accommodation + lessons + rentals + taxi + dining
(Missing: activities)
```

---

## Issue 2: Dining events — indirect participant matching, no FK

**Location**: `DiningEvent.attendees[].person_id` matched against `BookingParticipant.id` in utils.ts:179

**Problem**: No database referential integrity. Attendees can exist without valid participants. If a participant is deleted, their dining charges remain orphaned.

**Impact**: Data inconsistency risk. Cascading deletes don't clean up dining records.

**Low priority** — works in practice, but fragile.

---

## Issue 3: Payment.is_discount flag never used

**Location**: `client/src/types/database.ts:432` (Payment.is_discount field)

**Problem**: The `is_discount` field exists in the Payment table but is never read in any accounting calculations. The field is not mentioned in balance or total calculations.

**Impact**: If a client paid with a discount, system treats it as full payment toward balance. No discount tracking or reporting.

**Decision needed**: Either remove the field from schema and interface, or implement discount logic in `computeBookingTotal()` and display in UI.

**Current usage**: Field defined but completely unused.

---

## Issue 4: Lessons without booking_id (edge case)

**Location**: `client/src/components/accounting/utils.ts:119-129` (`computeInstructorEarned`)

**Problem**: Lessons can be created without `booking_id` (for day activities, scheduled trips, etc.). These lessons:
- DO appear in instructor payroll calculations (`computeInstructorEarned` doesn't filter by booking_id)
- DO NOT appear on client invoices (filtered out in `computeLessonsRevenue` via booking_id match)

**Impact**: Instructor gets paid for day activity lessons, but revenue is "missing" from booking accounting. Can cause discrepancies if not tracked carefully.

**Current behavior**: This is likely intentional (day activities = center revenue, not booking-specific), but should be clearly documented in code comments.

**Recommendation**: Add comment in `computeInstructorEarned()` explaining that it includes all lessons regardless of booking_id.

---

## Status

✅ `participant_consumptions` table was unused — fixed by refactoring ClientSharePage to query source tables directly (mar 2026).
