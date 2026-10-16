-- 2026-10-16 (d) — Protections de suppression : plus aucune suppression ne peut emporter
-- en cascade de l'argent ou un historique. Strictement structurel, aucune donnée modifiée.
--
-- Avant : un seul « Delete this client? » effaçait toutes ses résas ET, par ricochet, leurs
-- paiements, cours, factures agence. Supprimer un hébergement retirait ses chambres de toutes
-- les résas (le message disait « Existing bookings will be kept »). Supprimer un moniteur
-- effaçait ses dettes et ses paiements.
--
-- Après : ON DELETE RESTRICT sur ces liens. La base REFUSE la suppression (erreur 23503) tant
-- qu'il reste quelque chose de lié ; l'app traduit l'erreur (utils/deleteGuard.ts). Ce qui
-- n'est que du détail sans argent reste en cascade (participants, chambres d'une résa, prix
-- figés d'une résa supprimée, emails…) : supprimer une résa vide reste possible.
--
-- rooms → accommodations reste CASCADE : supprimer un hébergement sans aucune résa emporte ses
-- chambres. Mais booking_rooms / booking_room_prices → rooms passent en RESTRICT, donc dès
-- qu'une chambre est occupée, la suppression de l'hébergement entier échoue.
--
-- Rollback : même script avec ON DELETE CASCADE (ou SET NULL pour bookings_agency_id_fkey).

BEGIN;

-- clients : un client avec des résas ou des cours ne se supprime plus
ALTER TABLE bookings       DROP CONSTRAINT bookings_client_id_fkey,
  ADD CONSTRAINT bookings_client_id_fkey       FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE lesson_clients DROP CONSTRAINT lesson_clients_client_id_fkey,
  ADD CONSTRAINT lesson_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

-- bookings : une résa avec paiements, cours ou facturation agence ne se supprime plus
ALTER TABLE payments             DROP CONSTRAINT payments_booking_id_fkey,
  ADD CONSTRAINT payments_booking_id_fkey             FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
ALTER TABLE lessons              DROP CONSTRAINT lessons_booking_id_fkey,
  ADD CONSTRAINT lessons_booking_id_fkey              FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
ALTER TABLE agency_billing_lines DROP CONSTRAINT agency_billing_lines_booking_id_fkey,
  ADD CONSTRAINT agency_billing_lines_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
ALTER TABLE agency_invoices      DROP CONSTRAINT agency_invoices_booking_id_fkey,
  ADD CONSTRAINT agency_invoices_booking_id_fkey      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;

-- accommodations / rooms : une chambre occupée bloque, un séjour externe ou une location aussi
ALTER TABLE booking_rooms                   DROP CONSTRAINT booking_rooms_room_id_fkey,
  ADD CONSTRAINT booking_rooms_room_id_fkey                   FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT;
ALTER TABLE booking_room_prices             DROP CONSTRAINT booking_room_prices_room_id_fkey,
  ADD CONSTRAINT booking_room_prices_room_id_fkey             FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT;
ALTER TABLE external_accommodation_bookings DROP CONSTRAINT external_accommodation_bookings_accommodation_id_fkey,
  ADD CONSTRAINT external_accommodation_bookings_accommodation_id_fkey FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE RESTRICT;
ALTER TABLE house_rentals                   DROP CONSTRAINT house_rentals_accommodation_id_fkey,
  ADD CONSTRAINT house_rentals_accommodation_id_fkey          FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE RESTRICT;

-- instructors : dettes et paiements = la paie, jamais effacée en cascade
ALTER TABLE instructor_debts    DROP CONSTRAINT instructor_debts_instructor_id_fkey,
  ADD CONSTRAINT instructor_debts_instructor_id_fkey    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE RESTRICT;
ALTER TABLE instructor_payments DROP CONSTRAINT instructor_payments_instructor_id_fkey,
  ADD CONSTRAINT instructor_payments_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE RESTRICT;

-- activity providers / partner hotels : leurs réservations et règlements restent
ALTER TABLE activity_bookings      DROP CONSTRAINT activity_bookings_provider_id_fkey,
  ADD CONSTRAINT activity_bookings_provider_id_fkey      FOREIGN KEY (provider_id) REFERENCES activity_providers(id) ON DELETE RESTRICT;
ALTER TABLE activity_payments      DROP CONSTRAINT activity_payments_provider_id_fkey,
  ADD CONSTRAINT activity_payments_provider_id_fkey      FOREIGN KEY (provider_id) REFERENCES activity_providers(id) ON DELETE RESTRICT;
ALTER TABLE partner_hotel_stays    DROP CONSTRAINT partner_hotel_stays_hotel_id_fkey,
  ADD CONSTRAINT partner_hotel_stays_hotel_id_fkey       FOREIGN KEY (hotel_id) REFERENCES partner_hotels(id) ON DELETE RESTRICT;
ALTER TABLE partner_hotel_payments DROP CONSTRAINT partner_hotel_payments_hotel_id_fkey,
  ADD CONSTRAINT partner_hotel_payments_hotel_id_fkey    FOREIGN KEY (hotel_id) REFERENCES partner_hotels(id) ON DELETE RESTRICT;

-- agencies : SET NULL transformait en silence une résa agence en résa client (facturée au client)
ALTER TABLE bookings DROP CONSTRAINT bookings_agency_id_fkey,
  ADD CONSTRAINT bookings_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE RESTRICT;

COMMIT;

-- Vérification (attendu : 17 lignes, toutes 'r') :
-- SELECT conname, confdeltype FROM pg_constraint WHERE conname IN (
--   'bookings_client_id_fkey','lesson_clients_client_id_fkey','payments_booking_id_fkey',
--   'lessons_booking_id_fkey','agency_billing_lines_booking_id_fkey','agency_invoices_booking_id_fkey',
--   'booking_rooms_room_id_fkey','booking_room_prices_room_id_fkey',
--   'external_accommodation_bookings_accommodation_id_fkey','house_rentals_accommodation_id_fkey',
--   'instructor_debts_instructor_id_fkey','instructor_payments_instructor_id_fkey',
--   'activity_bookings_provider_id_fkey','activity_payments_provider_id_fkey',
--   'partner_hotel_stays_hotel_id_fkey','partner_hotel_payments_hotel_id_fkey','bookings_agency_id_fkey');
