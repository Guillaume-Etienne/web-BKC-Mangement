-- 2026-10-16 (c) — Outlook, étape 3 : « intention globale » — la charge de TOUTE l'équipe, agrégée.
-- Nécessite 2026-10-16 (table) et 2026-10-10a (token `instructor`). Strictement additif.
--
-- Un moniteur doit voir la charge de l'équipe (heures kite/wing par jour, qui en porte combien,
-- combien restent sans moniteur) SANS voir les élèves des autres. `lesson_intents` ne peut pas
-- être ouverte à ce token : un GRANT colonne est par rôle, et ses lignes portent booking_id /
-- participant_id. À la place, une fonction SECURITY DEFINER qui ne rend que des TOTAUX :
-- (jour, kite|wing, moniteur ou NULL, heures). Aucun identifiant de résa ou de participant,
-- aucun prix, aucune note, aucune location. Même schéma que share_walkin_booking_ids().
--
-- Heures réparties à parts égales sur la fenêtre de chaque ligne (fenêtre vide = dates de la
-- résa), comme l'écran admin. La plage demandée est plafonnée à 366 jours.

CREATE OR REPLACE FUNCTION instructor_load(p_from date, p_to date)
RETURNS TABLE (day date, kind text, instructor_id uuid, hours numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d::date, i.kind, i.instructor_id,
         sum(i.planned_hours / ((w.we - w.ws) + 1))
    FROM lesson_intents i
    JOIN bookings b ON b.id = i.booking_id
    CROSS JOIN LATERAL (SELECT COALESCE(i.window_start, b.check_in)  AS ws,
                               COALESCE(i.window_end,   b.check_out) AS we) w
    CROSS JOIN LATERAL generate_series(GREATEST(w.ws, p_from)::timestamp,
                                       LEAST(w.we, p_to)::timestamp,
                                       interval '1 day') d
   WHERE (share_ctx()).type = 'instructor'
     AND p_to >= p_from AND p_to - p_from <= 366
     AND i.kind IN ('kite', 'wing')
     AND i.planned_hours > 0
     AND b.status <> 'cancelled'
     AND b.kind = 'stay'
     AND w.we >= w.ws
   GROUP BY 1, 2, 3;
$$;
REVOKE EXECUTE ON FUNCTION instructor_load(date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION instructor_load(date, date) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — TEST **et** PROD, curl anon (POST, corps JSON) :
--   curl -X POST "$URL/rest/v1/rpc/instructor_load" -H "apikey: $ANON" \
--        -H "content-type: application/json" -H "x-share-token: <token instructor>" \
--        -d '{"p_from":"2026-10-16","p_to":"2026-11-30"}'
--     → lignes {day, kind, instructor_id, hours} : SEULEMENT des totaux, aucun id de résa/participant
--   même appel avec un token d'un autre type (client, forecast…) ou SANS token → []
--   p_to - p_from > 366 → []
-- ════════════════════════════════════════════════════════════════════════════
