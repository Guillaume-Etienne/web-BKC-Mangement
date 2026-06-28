-- ============================================================
-- PRE-FLIGHT ORPHAN / INTEGRITY CHECKS (read-only)
-- Run on TEST and PROD before going live. All queries should return 0 rows
-- (or only rows you understand). Nothing here modifies data.
-- ============================================================

-- 1. Lessons referencing participant ids that no longer exist
--    (participant_ids is UUID[] with NO foreign key → can go stale)
SELECT l.id AS lesson_id, l.date, pid AS missing_participant_id
FROM lessons l, unnest(l.participant_ids) AS pid
WHERE pid NOT IN (SELECT id FROM booking_participants);

-- 2. Activity bookings referencing missing participant ids (same UUID[] risk)
SELECT a.id AS activity_booking_id, a.date, pid AS missing_participant_id
FROM activity_bookings a, unnest(a.participant_ids) AS pid
WHERE pid NOT IN (SELECT id FROM booking_participants);

-- 3. Lessons pointing at equipment that no longer exists (kite_id / board_id, no FK)
SELECT id, date, kite_id, board_id
FROM lessons
WHERE (kite_id  IS NOT NULL AND kite_id  NOT IN (SELECT id FROM equipment))
   OR (board_id IS NOT NULL AND board_id NOT IN (SELECT id FROM equipment));

-- 4. Bookings with NO accommodation at all (no room AND no external accom)
--    → likely incomplete bookings to finish before season
SELECT b.booking_number, b.check_in, b.check_out, b.status
FROM bookings b
WHERE b.status <> 'cancelled'
  AND NOT EXISTS (SELECT 1 FROM booking_rooms br WHERE br.booking_id = b.id)
  AND NOT EXISTS (SELECT 1 FROM external_accommodation_bookings e WHERE e.booking_id = b.id)
ORDER BY b.check_in;

-- 5. booking_room_prices pointing at a room not actually assigned to the booking
--    (price snapshot orphaned from booking_rooms → won't be billed)
SELECT brp.booking_id, brp.room_id, brp.price_per_night
FROM booking_room_prices brp
WHERE NOT EXISTS (
  SELECT 1 FROM booking_rooms br
  WHERE br.booking_id = brp.booking_id AND br.room_id = brp.room_id
);

-- 6. booking_rooms WITHOUT a price snapshot (will count as 0 revenue in accounting)
SELECT br.booking_id, b.booking_number, br.room_id
FROM booking_rooms br
JOIN bookings b ON b.id = br.booking_id
WHERE b.status <> 'cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM booking_room_prices brp
    WHERE brp.booking_id = br.booking_id AND brp.room_id = br.room_id
  );

-- 7. Cached counters vs derived-from-flags (informational).
--    Mismatches are EXPECTED for bookings created before the per-traveler model
--    (their flags are all false). Use this to spot which ones to re-save.
SELECT b.booking_number,
       b.num_lessons, b.num_equipment_rentals, b.num_wing_lessons, b.num_center_access,
       (SELECT count(*) FROM booking_participants p WHERE p.booking_id = b.id AND p.wants_kite_lessons) AS derived_lessons,
       (SELECT count(*) FROM booking_participants p WHERE p.booking_id = b.id AND p.wants_kite_rental)  AS derived_rentals,
       (SELECT count(*) FROM booking_participants p WHERE p.booking_id = b.id AND p.wants_wing_lessons) AS derived_wing,
       (SELECT count(*) FROM booking_participants p WHERE p.booking_id = b.id AND p.brings_own_gear)    AS derived_center_access
FROM bookings b
WHERE b.status <> 'cancelled'
ORDER BY b.check_in;

-- 8. Seasons sanity — must return >= 1 row for the "Season" accounting filter to work
SELECT * FROM seasons ORDER BY start_date;
