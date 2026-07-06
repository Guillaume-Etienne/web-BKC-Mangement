-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2 — RLS token-aware (2026-07-06)
-- Design : .claude/docs/phase2-rls-token-aware.md (décisions D1a, D2a, D3 toutes, D4 oui)
--
-- Avant : toutes les policies anon SELECT étaient USING (true) → n'importe qui avec
-- la clé anon listait toutes les lignes. Après : anon ne lit une ligne que s'il
-- présente un header `x-share-token` correspondant à un shared_link actif dont le
-- type donne droit à cette ligne. Les GRANT colonnes (Lots A/B) restent et se
-- composent (colonnes AND lignes).
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : le front DOIT déjà envoyer le header (commit supabase.ts
-- + déploiement Vercel) AVANT d'appliquer ce fichier, sinon les pages partagées
-- déployées ne reçoivent plus aucune donnée.
--
-- ROLLBACK (recrée l'état d'avant, policies larges) :
--   Pour chaque table T de la liste en bas : DROP POLICY "anon_read_T" ON T;
--   CREATE POLICY "anon_read_T" ON T FOR SELECT TO anon USING (true);
--   (le front continue de marcher, header ou pas)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Helpers ─────────────────────────────────────────────────────────────────

-- Le shared_link actif correspondant au header x-share-token, ou NULL.
-- SECURITY DEFINER : shared_links n'a pas (et ne doit pas avoir) de policy anon.
CREATE OR REPLACE FUNCTION share_ctx() RETURNS shared_links
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.* FROM shared_links s
  WHERE s.token = current_setting('request.headers', true)::json->>'x-share-token'
    AND s.is_active
    AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
  LIMIT 1;
$$;

-- Le type du token présenté, ou NULL. (Test scalaire sûr — ne PAS tester
-- share_ctx() IS NOT NULL : composite avec expires_at NULL → toujours faux.)
CREATE OR REPLACE FUNCTION share_type() RETURNS shared_link_type
LANGUAGE sql STABLE AS $$ SELECT (share_ctx()).type $$;

-- Un paramètre du token (params JSONB), ou NULL.
CREATE OR REPLACE FUNCTION share_param(p_key TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$ SELECT (share_ctx()).params->>p_key $$;

-- L'id du booking ciblé par un token 'client' (params.booking_number), sinon NULL.
-- SECURITY DEFINER : lit bookings hors policy (sinon poule-et-œuf avec sa policy).
CREATE OR REPLACE FUNCTION share_booking_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id FROM bookings b
  WHERE (share_ctx()).type = 'client'
    AND b.booking_number = ((share_ctx()).params->>'booking_number')::int;
$$;

-- Le client du booking ciblé par un token 'client', sinon NULL.
CREATE OR REPLACE FUNCTION share_client_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.client_id FROM bookings b WHERE b.id = share_booking_id();
$$;

REVOKE EXECUTE ON FUNCTION share_ctx(), share_type(), share_param(TEXT),
                           share_booking_id(), share_client_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION share_ctx(), share_type(), share_param(TEXT),
                           share_booking_id(), share_client_id() TO anon, authenticated;

-- ── 2. Cœur booking (token client → uniquement le booking du token) ───────────

DROP POLICY IF EXISTS "anon_read_bookings" ON bookings;
CREATE POLICY "anon_read_bookings" ON bookings FOR SELECT TO anon USING (
  share_type() IN ('taxi', 'driver', 'taxi_manager', 'restaurant')  -- embeds noms
  OR (share_type() = 'client' AND id = share_booking_id())
);

DROP POLICY IF EXISTS "anon_read_clients" ON clients;
CREATE POLICY "anon_read_clients" ON clients FOR SELECT TO anon USING (
  share_type() IN ('forecast', 'taxi', 'driver', 'taxi_manager', 'restaurant')  -- noms
  OR (share_type() = 'client' AND id = share_client_id())
);

DROP POLICY IF EXISTS "anon_read_booking_participants" ON booking_participants;
CREATE POLICY "anon_read_booking_participants" ON booking_participants
  FOR SELECT TO anon USING (
    share_type() = 'client' AND booking_id = share_booking_id()
  );

DROP POLICY IF EXISTS "anon_read_booking_rooms" ON booking_rooms;
CREATE POLICY "anon_read_booking_rooms" ON booking_rooms FOR SELECT TO anon USING (
  share_type() = 'client' AND booking_id = share_booking_id()
);

DROP POLICY IF EXISTS "anon_read_booking_room_prices" ON booking_room_prices;
CREATE POLICY "anon_read_booking_room_prices" ON booking_room_prices
  FOR SELECT TO anon USING (
    share_type() = 'client' AND booking_id = share_booking_id()
  );

DROP POLICY IF EXISTS "anon_read_payments" ON payments;
CREATE POLICY "anon_read_payments" ON payments FOR SELECT TO anon USING (
  share_type() = 'client' AND booking_id = share_booking_id()
);

DROP POLICY IF EXISTS "anon_read_ext_accom_bookings" ON external_accommodation_bookings;
CREATE POLICY "anon_read_ext_accom_bookings" ON external_accommodation_bookings
  FOR SELECT TO anon USING (
    share_type() = 'client' AND booking_id = share_booking_id()
  );

-- ── 3. Cours & matériel (client → son booking ; forecast → tout, décision D3) ─

DROP POLICY IF EXISTS "anon_read_lessons" ON lessons;
CREATE POLICY "anon_read_lessons" ON lessons FOR SELECT TO anon USING (
  share_type() = 'forecast'
  OR (share_type() = 'client' AND booking_id = share_booking_id())
);

DROP POLICY IF EXISTS "anon_read_equipment_rentals" ON equipment_rentals;
CREATE POLICY "anon_read_equipment_rentals" ON equipment_rentals
  FOR SELECT TO anon USING (
    share_type() = 'forecast'
    OR (share_type() = 'client' AND booking_id = share_booking_id())
  );

-- D2a : uniquement les overrides des leçons du booking du token.
-- (La sous-requête passe par la policy anon de lessons → déjà scopée au booking.)
DROP POLICY IF EXISTS "anon_read_lesson_rate_overrides" ON lesson_rate_overrides;
CREATE POLICY "anon_read_lesson_rate_overrides" ON lesson_rate_overrides
  FOR SELECT TO anon USING (
    share_type() = 'client'
    AND lesson_id IN (SELECT l.id FROM lessons l WHERE l.booking_id = share_booking_id())
  );

-- D1a : uniquement les repas où participe (au moins) un participant du booking.
DROP POLICY IF EXISTS "anon_read_dining_events" ON dining_events;
CREATE POLICY "anon_read_dining_events" ON dining_events FOR SELECT TO anon USING (
  share_type() = 'client'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(attendees) AS a
    JOIN booking_participants bp ON bp.id::text = a->>'person_id'
    WHERE bp.booking_id = share_booking_id()
      AND a->>'person_type' = 'participant'
      AND (a->>'is_attending')::boolean
  )
);

-- ── 4. Taxi ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_read_taxi_trips" ON taxi_trips;
CREATE POLICY "anon_read_taxi_trips" ON taxi_trips FOR SELECT TO anon USING (
  share_type() = 'taxi'
  -- D4 : le manager ne voit plus les trajets sans commission, même via l'API
  OR (share_type() = 'taxi_manager' AND margin_manager_mzn > 0)
  OR (share_type() = 'driver' AND taxi_driver_id = share_param('driver_id')::uuid)
  OR (share_type() = 'client' AND booking_id = share_booking_id())
);

DROP POLICY IF EXISTS "anon_read_taxi_drivers" ON taxi_drivers;
CREATE POLICY "anon_read_taxi_drivers" ON taxi_drivers FOR SELECT TO anon USING (
  share_type() IN ('taxi', 'taxi_manager')
  OR (share_type() = 'driver' AND id = share_param('driver_id')::uuid)
);

DROP POLICY IF EXISTS "anon_read_taxi_manager_payments" ON taxi_manager_payments;
CREATE POLICY "anon_read_taxi_manager_payments" ON taxi_manager_payments
  FOR SELECT TO anon USING (share_type() = 'taxi_manager');

-- ── 5. Activités ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_read_activity_providers" ON activity_providers;
CREATE POLICY "anon_read_activity_providers" ON activity_providers
  FOR SELECT TO anon USING (
    share_type() = 'activity_provider' AND id = share_param('provider_id')::uuid
  );

DROP POLICY IF EXISTS "anon_read_activity_bookings" ON activity_bookings;
CREATE POLICY "anon_read_activity_bookings" ON activity_bookings
  FOR SELECT TO anon USING (
    (share_type() = 'activity_provider' AND provider_id = share_param('provider_id')::uuid)
    OR (share_type() = 'client' AND booking_id = share_booking_id())
  );

DROP POLICY IF EXISTS "anon_read_activity_payments" ON activity_payments;
CREATE POLICY "anon_read_activity_payments" ON activity_payments
  FOR SELECT TO anon USING (
    share_type() = 'activity_provider' AND provider_id = share_param('provider_id')::uuid
  );

-- ── 6. Référentiel (lisible avec n'importe quel token valide) ─────────────────

DROP POLICY IF EXISTS "anon_read_rooms" ON rooms;
CREATE POLICY "anon_read_rooms" ON rooms
  FOR SELECT TO anon USING (share_type() IS NOT NULL);

DROP POLICY IF EXISTS "anon_read_accommodations" ON accommodations;
CREATE POLICY "anon_read_accommodations" ON accommodations
  FOR SELECT TO anon USING (share_type() IS NOT NULL);

DROP POLICY IF EXISTS "anon_read_instructors" ON instructors;
CREATE POLICY "anon_read_instructors" ON instructors
  FOR SELECT TO anon USING (share_type() IS NOT NULL);

DROP POLICY IF EXISTS "anon_read_equipment" ON equipment;
CREATE POLICY "anon_read_equipment" ON equipment
  FOR SELECT TO anon USING (share_type() IS NOT NULL);

DROP POLICY IF EXISTS "anon_read_ext_accommodations" ON external_accommodations;
CREATE POLICY "anon_read_ext_accommodations" ON external_accommodations
  FOR SELECT TO anon USING (share_type() IS NOT NULL);

COMMIT;
