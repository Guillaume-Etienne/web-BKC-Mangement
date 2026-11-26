-- 2026-11-26 — Le manager taxi attribue un chauffeur à un trajet (page partagée, sans compte)
--
-- Jusqu'ici anon ne pouvait que LIRE. Une seule écriture est ouverte, par une fonction
-- SECURITY DEFINER très étroite — jamais par un droit d'écriture sur taxi_trips :
--
--   manager_assign_driver(p_trip_id, p_driver_id)
--
-- Ce qu'elle fait : remplir `taxi_driver_id` d'un trajet QUI N'EN A PAS ENCORE, et rien d'autre
-- (+ needs_details → confirmed, décision gui 2026-11-26). Ce qu'elle refuse, sans le dire :
--   · un jeton qui n'est pas un lien `taxi_manager` actif et non expiré (absent, faux, autre type)
--   · un trajet qui a déjà un chauffeur (c'est gui qui l'a choisi : le manager ne le remplace pas
--     et ne l'enlève pas — d'où aussi aucun risque de course avec l'admin)
--   · un trajet privé (margin_manager_mzn = 0 : invisible pour le manager)
--   · un trajet « Payé » (status done : le chauffeur est déjà réglé)
--   · un trajet passé (jour calculé à Maputo : la base est en UTC, Bilene en UTC+2)
--   · un chauffeur qui n'existe pas
--   · plus de 30 attributions par lien et par 24 h (si le lien fuite, les dégâts restent bornés)
-- Une seule erreur générique pour tous les refus de trajet : on ne peut pas deviner quels ids
-- sont des trajets privés.
--
-- Le prix du chauffeur ne change PAS à l'attribution (les tarifs diffèrent : 6500, 7000, 8000…
-- et gui en saisit à la main). Le journal garde `reviewed_at` NULL tant que gui n'a pas vérifié le
-- prix : l'admin Taxis affiche un bandeau « attribués par le manager ».
--
-- Journal taxi_trip_driver_log : admin seulement (RLS + REVOKE explicite — une table neuve est
-- ouverte à anon par défaut).
--
-- Lien du manager : il peut maintenant écrire, donc il expire. Fin mars 2027 (fin de saison).
-- ⚠️ À REFAIRE CHAQUE SAISON : Options → Shared Links → lien taxi_manager → nouvelle date.
--
-- Strictement additive. TEST puis PROD AVANT de pousser le code.
-- ROLLBACK : DROP FUNCTION manager_assign_driver(uuid, uuid); DROP TABLE taxi_trip_driver_log;

BEGIN;

CREATE TABLE IF NOT EXISTS taxi_trip_driver_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES taxi_trips(id) ON DELETE CASCADE,
  driver_id      UUID REFERENCES taxi_drivers(id) ON DELETE SET NULL,
  shared_link_id UUID REFERENCES shared_links(id) ON DELETE SET NULL,
  status_before  taxi_trip_status NOT NULL,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ            -- NULL = gui n'a pas encore vérifié le prix du chauffeur
);

CREATE INDEX IF NOT EXISTS idx_taxi_trip_driver_log_trip ON taxi_trip_driver_log(trip_id);
CREATE INDEX IF NOT EXISTS idx_taxi_trip_driver_log_link ON taxi_trip_driver_log(shared_link_id, changed_at);

ALTER TABLE taxi_trip_driver_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON taxi_trip_driver_log;
CREATE POLICY "admin_all" ON taxi_trip_driver_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON taxi_trip_driver_log FROM anon;

CREATE OR REPLACE FUNCTION manager_assign_driver(p_trip_id uuid, p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link   shared_links;
  v_status taxi_trip_status;
BEGIN
  -- share_ctx() rend NULL pour un lien absent / faux / expiré / désactivé : on teste donc
  -- « type DISTINCT FROM », jamais « type <> ».
  v_link := share_ctx();
  IF v_link.type IS DISTINCT FROM 'taxi_manager' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_trip_id IS NULL OR p_driver_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM taxi_drivers WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'trip_not_assignable' USING ERRCODE = 'P0001';
  END IF;

  IF (SELECT count(*) FROM taxi_trip_driver_log
       WHERE shared_link_id = v_link.id AND changed_at > now() - interval '24 hours') >= 30 THEN
    RAISE EXCEPTION 'too_many_changes' USING ERRCODE = 'P0001';
  END IF;

  -- Verrou sur la ligne : deux attributions simultanées ne s'écrasent pas.
  SELECT status INTO v_status
    FROM taxi_trips
   WHERE id = p_trip_id
     AND taxi_driver_id IS NULL
     AND margin_manager_mzn > 0
     AND status <> 'done'
     AND date >= (now() AT TIME ZONE 'Africa/Maputo')::date
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_not_assignable' USING ERRCODE = 'P0001';
  END IF;

  UPDATE taxi_trips
     SET taxi_driver_id = p_driver_id,
         status = CASE WHEN status = 'needs_details' THEN 'confirmed'::taxi_trip_status ELSE status END
   WHERE id = p_trip_id;

  INSERT INTO taxi_trip_driver_log (trip_id, driver_id, shared_link_id, status_before)
  VALUES (p_trip_id, p_driver_id, v_link.id, v_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION manager_assign_driver(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION manager_assign_driver(uuid, uuid) TO anon, authenticated;

-- Lien du manager : fin de saison. Seulement ceux sans date (on ne repousse jamais une date posée).
UPDATE shared_links SET expires_at = DATE '2027-03-31'
 WHERE type = 'taxi_manager' AND expires_at IS NULL;

COMMIT;

-- Vérif (curl anon, header x-share-token) :
--   POST /rest/v1/rpc/manager_assign_driver {"p_trip_id":"…","p_driver_id":"…"}
--     sans token / token `taxi` ou `driver` ou `client` → 42501 « forbidden »
--     token manager, trajet déjà attribué / privé / « Payé » / passé / inconnu → P0001 « trip_not_assignable »
--   GET /rest/v1/taxi_trip_driver_log → 42501 (anon n'a aucun droit)
