-- ============================================================================
--  TEARDOWN — Vide tout le contenu de démo (base TEST)
-- ----------------------------------------------------------------------------
--  Supprime TOUT le contenu transactionnel + shared_links, en gardant la
--  config et les prix (mêmes tables préservées que seed_test_data.sql).
--  Comme la base TEST ne contient que le seed après un reset, ceci enlève
--  "d'un coup" tout le jeu de démo. Ré-exécute seed_test_data.sql pour repartir.
--
--  ⚠️  À N'EXÉCUTER QUE SUR LA BASE TEST.
-- ============================================================================

BEGIN;

DELETE FROM email_logs;
DELETE FROM lesson_rate_overrides;
DELETE FROM lessons;
DELETE FROM equipment_rentals;
DELETE FROM activity_payments;
DELETE FROM activity_bookings;
DELETE FROM taxi_trips;
DELETE FROM taxi_manager_payments;
DELETE FROM payments;
DELETE FROM booking_room_prices;
DELETE FROM external_accommodation_bookings;
DELETE FROM booking_participants;
DELETE FROM booking_rooms;
DELETE FROM dining_events;
DELETE FROM day_activities;
DELETE FROM instructor_debts;
DELETE FROM instructor_payments;
DELETE FROM house_rentals;
DELETE FROM expenses;
DELETE FROM form_submissions;
DELETE FROM bookings;
DELETE FROM clients;
DELETE FROM shared_links;

ALTER SEQUENCE booking_number_seq RESTART WITH 1;

COMMIT;

-- Config / prix conservés : accommodations, rooms, room_rates, price_items,
-- equipment, instructors, taxi_drivers, taxi_pricing_defaults,
-- external_accommodations, activity_providers, seasons, palmeiras_*.
