-- 2026-11-15 — Page client partagée : la section « Repas » disparaissait (timeout anon)
--
-- Symptôme (#065, 15/11) : sur le téléphone du client (anon + token `client`), plus de
-- section Repas → braai de 12 € absent, solde faux. Chez un admin connecté, tout va bien
-- (sa policy est `USING true`). La page avale l'erreur (`diningRes.data ?? []`).
--
-- Cause : `anon_read_dining_events` (2026-07-06) joignait `booking_participants` DANS la
-- policy. Lu par anon, ce join déclenche la policy anon de `booking_participants`, qui
-- appelle share_type()/share_booking_id() → share_ctx() (SECURITY DEFINER, non inlinable)
-- pour chaque ligne, à chaque élément de `attendees`. Mesuré PROD le 15/11 : 11 repas,
-- 148 inscrits, 84 voyageurs → 86 seq scans × 38 ms = 3,29 s > statement_timeout anon
-- (3 s) → 57014. La table grossit chaque soir : ça ne pouvait qu'empirer.
--
-- Correctif : la liste des voyageurs du lien est calculée UNE fois (helper SECURITY
-- DEFINER, appelé via `(SELECT …)` → InitPlan), sans repasser par les policies de
-- `booking_participants`. Même périmètre qu'avant : un repas est visible ssi un voyageur
-- de LA résa du token y est inscrit (participant + is_attending). Rien d'autre ne change.
-- Le helper ne rend que des ids que ce porteur lit déjà dans `booking_participants`.

CREATE OR REPLACE FUNCTION public.share_participant_ids()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(bp.id::text), '{}')
  FROM booking_participants bp
  WHERE bp.booking_id = share_booking_id();
$$;

-- Mêmes droits que share_booking_id() / share_ctx() : pas PUBLIC.
REVOKE ALL ON FUNCTION public.share_participant_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.share_participant_ids() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "anon_read_dining_events" ON dining_events;
CREATE POLICY "anon_read_dining_events" ON dining_events FOR SELECT TO anon USING (
  (SELECT share_type()) = 'client'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(attendees) AS a
    WHERE a->>'person_type' = 'participant'
      AND (a->>'is_attending')::boolean
      -- Le cast est obligatoire : sans lui, `= ANY ((SELECT …))` est lu comme une
      -- sous-requête (text = text[] → 42883). Avec, c'est un tableau évalué une fois.
      AND a->>'person_id' = ANY ((SELECT share_participant_ids())::text[])
  )
);

-- Vérif (curl anon, avec le token `client` d'une résa inscrite à un repas) :
--   dining_events?select=*  → 200 avec SES repas (et seulement eux), en < 1 s
--   sans token              → 200 []
--   token d'une autre résa  → ne voit pas les repas des autres
