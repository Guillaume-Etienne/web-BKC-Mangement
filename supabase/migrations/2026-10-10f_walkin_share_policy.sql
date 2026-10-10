-- 2026-10-10 (f) — Lien public d'un walk-in : SES venues seulement, avec heures, prix et paiements.
-- Nécessite 2026-10-10e (valeur d'enum `walkin`) déjà passée.
--
-- Token `walkin` + params.client_id = un client. Il donne accès à :
--   • sa fiche (clients : id, first_name, last_name — GRANT colonne inchangé),
--   • SES venues day-visitor uniquement (bookings.kind = 'day_visitor') — jamais un séjour
--     que ce même client aurait fait comme voyageur,
--   • les cours / locations / paiements de ces venues.
-- Colonnes : inchangées — anon lit le miroir `share_price*`, jamais `instructor_rate`.
--
-- Le périmètre passe par UNE fonction SECURITY DEFINER (comme share_room_keys) : une
-- sous-requête dans la policy devrait relire `bookings` avec les privilèges d'anon.

CREATE OR REPLACE FUNCTION share_walkin_booking_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id FROM bookings b
   WHERE (share_ctx()).type = 'walkin'
     AND b.kind = 'day_visitor'
     AND b.client_id = ((share_ctx()).params->>'client_id')::uuid;
$$;
REVOKE EXECUTE ON FUNCTION share_walkin_booking_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION share_walkin_booking_ids() TO anon, authenticated;

-- `kind` est déjà lisible par anon (2026-09-25_walk_ins.sql) ; la policy bookings l'utilise.
DROP POLICY IF EXISTS "anon_read_bookings" ON bookings;
CREATE POLICY "anon_read_bookings" ON bookings FOR SELECT TO anon USING (
  share_type() IN ('taxi', 'driver', 'taxi_manager', 'restaurant')
  OR (share_type() = 'client' AND id = share_booking_id())
  OR (share_type() = 'walkin' AND id IN (SELECT share_walkin_booking_ids()))
);

DROP POLICY IF EXISTS "anon_read_clients" ON clients;
CREATE POLICY "anon_read_clients" ON clients FOR SELECT TO anon USING (
  share_type() IN ('forecast', 'taxi', 'driver', 'taxi_manager', 'restaurant')
  OR (share_type() = 'client' AND id = share_client_id())
  OR (share_type() = 'walkin' AND id = share_param('client_id')::uuid)
);

DROP POLICY IF EXISTS "anon_read_lessons" ON lessons;
CREATE POLICY "anon_read_lessons" ON lessons FOR SELECT TO anon USING (
  share_type() = 'forecast'
  OR (share_type() = 'client' AND booking_id = share_booking_id())
  OR (share_type() = 'instructor' AND instructor_id = share_param('instructor_id')::uuid)
  OR (share_type() = 'walkin' AND booking_id IN (SELECT share_walkin_booking_ids()))
);

DROP POLICY IF EXISTS "anon_read_equipment_rentals" ON equipment_rentals;
CREATE POLICY "anon_read_equipment_rentals" ON equipment_rentals FOR SELECT TO anon USING (
  share_type() = 'forecast'
  OR (share_type() = 'client' AND booking_id = share_booking_id())
  OR (share_type() = 'walkin' AND booking_id IN (SELECT share_walkin_booking_ids()))
);

DROP POLICY IF EXISTS "anon_read_payments" ON payments;
CREATE POLICY "anon_read_payments" ON payments FOR SELECT TO anon USING (
  (share_type() = 'client' AND booking_id = share_booking_id())
  OR (share_type() = 'walkin' AND booking_id IN (SELECT share_walkin_booking_ids()))
);

-- ── Vérification (curl anon, header x-share-token) ───────────────────────────
--  token walkin du client A :
--    bookings?select=id,kind                → uniquement ses venues (kind = day_visitor)
--    lessons?select=instructor_rate         → 42501 (colonne fermée)
--    payments / lessons / equipment_rentals → seulement celles de ses venues
--  token walkin du client A, bookings?client_id=eq.<client B> → []
--  sans token : tout → []
