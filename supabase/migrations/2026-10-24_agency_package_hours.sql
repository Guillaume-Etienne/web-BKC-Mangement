-- 2026-10-24 — Forfaits cours agence : une seule réserve d'heures, rattachée toute seule.
--
-- Vécu deux fois : #26 (rattaché à la main le 23/10) et #022 (6,5 h jamais rattachées → la page
-- du client affichait ~377 € de cours que Fun & Fly paie). Les cours se saisissent au Daily, la
-- veille ; rien ne les reliait au forfait tant que personne ne cliquait sur ⚡ Fill packages.
--
-- Décisions gui (2026-10-24) :
--   • les forfaits cours d'une résa forment UNE réserve commune (quels que soient le voyageur
--     et la discipline) ; au-delà, le client paie ;
--   • rattachement automatique pour les VRAIES leçons (table `lessons`, saisies au Daily) —
--     jamais les prévisions du Forecast (`lesson_intents`, non facturées).
--
-- 1. Trigger BEFORE INSERT sur `lessons` : une leçon d'une résa agence, sans ligne, prend la
--    première ligne forfait (ordre des id, comme le bouton ⚡) où elle TIENT entièrement. Si
--    elle ne tient nulle part, elle reste au client (pas de découpage) — l'écran compta le
--    signale. Jamais d'UPDATE : un détachement à la main n'est pas défait.
--    SECURITY INVOKER : en anon (walk-in) la lecture des lignes agence rend 0 ligne → rien.
--    ⚠️ Le bloc EXCEPTION n'est pas décoratif : un rattachement raté ne doit JAMAIS bloquer la
--    saisie d'un cours (déjà vécu avec notify_enquiry).
--
-- 2. `share_agency_package()` : pour un token client, le nom de l'agence et le total d'heures
--    des forfaits — AUCUN prix. SECURITY DEFINER parce que `agencies` et `agency_billing_lines`
--    restent admin-only (le nom des partenaires ne doit pas fuiter vers le Forecast partagé) ;
--    le périmètre tient en un WHERE : la résa du token, via share_booking_id().
--
-- Idempotent. À passer en TEST puis en PROD.

CREATE OR REPLACE FUNCTION attach_lesson_to_agency_package()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.agency_billing_line_id IS NULL AND NEW.booking_id IS NOT NULL THEN
    BEGIN
      SELECT l.id INTO NEW.agency_billing_line_id
        FROM agency_billing_lines l
        JOIN bookings b ON b.id = l.booking_id AND b.agency_id = l.agency_id
       WHERE l.booking_id = NEW.booking_id
         AND l.unit_hours IS NOT NULL
         AND l.unit_hours - COALESCE((SELECT sum(x.duration_hours) FROM lessons x
                                       WHERE x.agency_billing_line_id = l.id), 0)
             >= NEW.duration_hours
       ORDER BY l.id
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NEW.agency_billing_line_id := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attach_lesson_to_agency_package ON lessons;
CREATE TRIGGER trg_attach_lesson_to_agency_package
  BEFORE INSERT ON lessons
  FOR EACH ROW EXECUTE FUNCTION attach_lesson_to_agency_package();

REVOKE EXECUTE ON FUNCTION attach_lesson_to_agency_package() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION share_agency_package()
RETURNS TABLE (agency_name text, hours_included numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.name::text,
         COALESCE(sum(l.unit_hours), 0)::numeric
    FROM bookings b
    JOIN agencies a ON a.id = b.agency_id
    LEFT JOIN agency_billing_lines l
           ON l.booking_id = b.id AND l.agency_id = a.id AND l.unit_hours IS NOT NULL
   WHERE share_type() = 'client'
     AND b.id = share_booking_id()
   GROUP BY a.name;
$$;
REVOKE EXECUTE ON FUNCTION share_agency_package() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION share_agency_package() TO anon, authenticated;

-- ── Vérification ────────────────────────────────────────────────────────────
--  SQL : SELECT tgname FROM pg_trigger WHERE tgname = 'trg_attach_lesson_to_agency_package';  → 1 ligne
--  curl anon, header x-share-token = token client de #022 :
--    POST rest/v1/rpc/share_agency_package           → [{"agency_name":"Fun & Fly","hours_included":14}]
--  même appel avec le token client d'une résa directe → []
--  même appel sans token                              → []
--  Daily : un cours ajouté à #022 ou #26 arrive déjà sur le forfait (Compta → jauge).
