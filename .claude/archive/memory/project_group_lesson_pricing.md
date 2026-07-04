---
name: Group lesson pricing model
description: Group lessons are priced per person (client side) but instructor gets fixed hourly rate regardless of student count
type: project
---

## Group lesson pricing — dual rate model

- **Client side**: `rate_group` is the price **per person per hour**. A group lesson with 3 students at 30€/h = 3 × 30 × duration = 90€/h total revenue.
- **Instructor side**: instructor gets their fixed `rate_group` × duration, regardless of how many students. Same lesson = 30€ × duration cost.

**Why:** The center's margin on group lessons scales with group size. Private = 1:1 (no margin uplift). Group = instructor cost stays flat, revenue scales with headcount.

**How to apply:**
- `computeLessonsRevenue` (client billing) should multiply by participant count for group lessons → **currently does NOT do this** (known bug, fix planned)
- `computeInstructorEarned` (payroll) should stay as-is — rate × duration, no multiplication
- Per-guest breakdown attributes `rate × duration` to each participant (correct per-person price)

**Current state (2026-03-30):** ✅ FIXED.
- `computeLessonsRevenue` now multiplies by `participant_ids.length` for group lessons
- `computeInstructorEarned` unchanged (rate × duration, no multiplication)
- BookingFinances + ClientSharePage lesson line display updated
- Per-guest breakdown attributes rate × duration to each participant (correct per-person view)
