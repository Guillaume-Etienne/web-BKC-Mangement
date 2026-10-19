-- 2026-10-19b — ⚠️ TEST UNIQUEMENT (uefezh…) — ne JAMAIS passer en PROD
--
-- Recopie sur TEST les droits d'anon (visiteur non connecté) tels qu'ils sont en
-- PROD le 2026-10-19 : généré depuis information_schema de PROD, table par table.
--
-- Pourquoi : TEST et PROD ont exactement le même schéma, mêmes policies, mêmes
-- index… sauf ces GRANT. TEST en donnait beaucoup plus (bookings : 37 colonnes
-- lisibles contre 9 en PROD, clients 19 contre 3, + agencies, enquiries,
-- shared_links, document_templates, transfer_reference_prices…). Conséquence :
-- un oubli de GRANT dans une migration passait sans bruit sur TEST et cassait la
-- page partagée en PROD (42501 → page vide). Après ce script, TEST casse pareil.
--
-- Mécanique : REVOKE ALL sur chaque table (retire aussi les droits par colonne),
-- puis les GRANT de PROD à l'identique. Les policies RLS ne sont pas touchées.
-- Ne concerne QUE le rôle anon ; authenticated est déjà identique.
-- Si une migration ajoutée APRÈS le 2026-10-19 a changé des GRANT anon, la
-- passer de nouveau sur TEST après ce script.

BEGIN;

REVOKE ALL ON public.accommodations FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.accommodations TO anon;
REVOKE ALL ON public.activity_bookings FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.activity_bookings TO anon;
REVOKE ALL ON public.activity_payments FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.activity_payments TO anon;
REVOKE ALL ON public.activity_providers FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.activity_providers TO anon;
GRANT SELECT (email, id, name, phone, show_prices, type, website) ON public.activity_providers TO anon;
REVOKE ALL ON public.agencies FROM anon;
REVOKE ALL ON public.agency_billing_lines FROM anon;
REVOKE ALL ON public.agency_invoices FROM anon;
REVOKE ALL ON public.agency_rate_items FROM anon;
REVOKE ALL ON public.associate_transfers FROM anon;
REVOKE ALL ON public.associates FROM anon;
REVOKE ALL ON public.booking_charges FROM anon;
GRANT SELECT (booking_id, category, date, id, label, quantity, unit_price) ON public.booking_charges TO anon;
REVOKE ALL ON public.booking_participants FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.booking_participants TO anon;
GRANT SELECT (booking_id, first_name, id, last_name) ON public.booking_participants TO anon;
REVOKE ALL ON public.booking_room_prices FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.booking_room_prices TO anon;
GRANT SELECT (agency_billing_line_id, booking_id, override_note, paid_to_owner, room_id, share_price_per_night) ON public.booking_room_prices TO anon;
REVOKE ALL ON public.booking_rooms FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.booking_rooms TO anon;
REVOKE ALL ON public.bookings FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.bookings TO anon;
GRANT SELECT (booking_number, center_access_rate, check_in, check_out, client_id, id, kind, num_center_access, status) ON public.bookings TO anon;
REVOKE ALL ON public.client_errors FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.client_errors TO anon;
REVOKE ALL ON public.client_notes FROM anon;
REVOKE ALL ON public.clients FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.clients TO anon;
GRANT SELECT (first_name, id, last_name) ON public.clients TO anon;
REVOKE ALL ON public.day_activities FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.day_activities TO anon;
REVOKE ALL ON public.dining_events FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.dining_events TO anon;
REVOKE ALL ON public.dismissed_actions FROM anon;
REVOKE ALL ON public.document_templates FROM anon;
REVOKE ALL ON public.email_logs FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.email_logs TO anon;
REVOKE ALL ON public.enquiries FROM anon;
GRANT INSERT (email, language, message, name, phone, source_id, source_other) ON public.enquiries TO anon;
REVOKE ALL ON public.enquiry_notes FROM anon;
REVOKE ALL ON public.enquiry_sources FROM anon;
GRANT SELECT (id, is_active, label, sort_order) ON public.enquiry_sources TO anon;
REVOKE ALL ON public.equipment FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.equipment TO anon;
GRANT SELECT (brand, category, condition, id, is_active, name, notes, size, year) ON public.equipment TO anon;
REVOKE ALL ON public.equipment_pricing_defaults FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.equipment_pricing_defaults TO anon;
REVOKE ALL ON public.equipment_rentals FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.equipment_rentals TO anon;
GRANT SELECT (agency_billing_line_id, booking_id, client_note, date, equipment_id, id, list_price, participant_id, rental_type, share_price, slot) ON public.equipment_rentals TO anon;
REVOKE ALL ON public.expense_categories FROM anon;
REVOKE ALL ON public.expenses FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO anon;
REVOKE ALL ON public.external_accommodation_bookings FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.external_accommodation_bookings TO anon;
GRANT SELECT (accommodation_id, booking_id, check_in, check_out, id, total_sell_price) ON public.external_accommodation_bookings TO anon;
REVOKE ALL ON public.form_submissions FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.form_submissions TO anon;
REVOKE ALL ON public.house_rentals FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.house_rentals TO anon;
REVOKE ALL ON public.instructor_debts FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.instructor_debts TO anon;
REVOKE ALL ON public.instructor_payments FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.instructor_payments TO anon;
REVOKE ALL ON public.instructors FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.instructors TO anon;
GRANT SELECT (first_name, id, last_name) ON public.instructors TO anon;
REVOKE ALL ON public.lesson_clients FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.lesson_clients TO anon;
REVOKE ALL ON public.lesson_intents FROM anon;
GRANT SELECT (booking_id, id, instructor_id, kind, participant_id, planned_hours, prepaid_hours, window_end, window_start) ON public.lesson_intents TO anon;
REVOKE ALL ON public.lesson_participant_gear FROM anon;
REVOKE ALL ON public.lesson_rate_overrides FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.lesson_rate_overrides TO anon;
REVOKE ALL ON public.lessons FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.lessons TO anon;
GRANT SELECT (agency_billing_line_id, booking_id, date, discipline, duration_hours, id, instructor_id, notes, participant_ids, share_price_per_hour, start_time, type) ON public.lessons TO anon;
REVOKE ALL ON public.palmeiras_entries FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.palmeiras_entries TO anon;
REVOKE ALL ON public.palmeiras_rents FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.palmeiras_rents TO anon;
REVOKE ALL ON public.palmeiras_reversals FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.palmeiras_reversals TO anon;
REVOKE ALL ON public.partner_hotel_payments FROM anon;
GRANT SELECT (amount_mzn, date, direction, hotel_id, id, notes) ON public.partner_hotel_payments TO anon;
REVOKE ALL ON public.partner_hotel_stays FROM anon;
GRANT SELECT (airport_transfer, big_bags, check_in, check_out, children_count, commission_pct, couples_count, display_name, group_id, guests_paid, hotel_confirmed, hotel_id, id, nb_persons, notes, paid_by, rooms, transfer_time) ON public.partner_hotel_stays TO anon;
REVOKE ALL ON public.partner_hotels FROM anon;
GRANT SELECT (commission_pct, id, name) ON public.partner_hotels TO anon;
REVOKE ALL ON public.payments FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.payments TO anon;
REVOKE ALL ON public.planned_lessons FROM anon;
GRANT SELECT (client_id, date, duration_hours, id, instructor_id, notes, participant_ids, start_time, type) ON public.planned_lessons TO anon;
REVOKE ALL ON public.planned_rentals FROM anon;
GRANT SELECT (client_id, date, equipment_id, id, notes, participant_id, rental_type, slot) ON public.planned_rentals TO anon;
REVOKE ALL ON public.price_items FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.price_items TO anon;
REVOKE ALL ON public.price_tiers FROM anon;
REVOKE ALL ON public.room_rates FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.room_rates TO anon;
GRANT SELECT (price_per_night, room_id) ON public.room_rates TO anon;
REVOKE ALL ON public.rooms FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.rooms TO anon;
REVOKE ALL ON public.seasons FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.seasons TO anon;
REVOKE ALL ON public.shared_links FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.shared_links TO anon;
REVOKE ALL ON public.taxi_drivers FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.taxi_drivers TO anon;
GRANT SELECT (id, name, phone, seats, vehicle) ON public.taxi_drivers TO anon;
REVOKE ALL ON public.taxi_manager_payments FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.taxi_manager_payments TO anon;
REVOKE ALL ON public.taxi_pricing_defaults FROM anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.taxi_pricing_defaults TO anon;
REVOKE ALL ON public.taxi_trips FROM anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.taxi_trips TO anon;
GRANT SELECT (agency_billing_line_id, booking_id, date, id, margin_manager_mzn, nb_boardbags, nb_luggage, nb_persons, notes, price_driver_mzn, share_price_eur, start_time, status, taxi_driver_id, type) ON public.taxi_trips TO anon;
REVOKE ALL ON public.transfer_reference_prices FROM anon;

COMMIT;

-- ── Vérification (Claude la refait par empreinte md5 TEST vs PROD) ─────────────
--   SELECT count(*) FROM information_schema.column_privileges
--   WHERE table_schema = 'public' AND grantee = 'anon' AND table_name = 'bookings' AND privilege_type = 'SELECT';
--   → 9 (était 37).
-- Puis les pages partagées sur TEST (localhost:5173/?share=…) : client, chauffeur,
-- gestionnaire taxi, restaurant, prévisions, formulaires → doivent s'afficher.
