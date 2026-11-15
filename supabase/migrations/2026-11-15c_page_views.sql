/* ============================================================================
   Migration : page_views — quelles pages servent vraiment, gui vs Teresa
   Date : 2026-11-15
   À exécuter en TEST **puis en PROD** dans la foulée (Supabase SQL editor).

   Une ligne par (compte, page, jour) : ~2 comptes x ~60 clés x 365 jours au
   maximum, donc rien du tout. La clé est une page (`taxis`) ou un onglet
   (`taxis#drivers`).

   Le client ne fait AUCUN insert direct : il accumule en mémoire et envoie tout
   en un seul appel à track_page_views() (au passage en arrière-plan, ou toutes
   les 5 min). La table n'a donc pas de policy d'écriture : seule la fonction
   (SECURITY DEFINER) écrit, et seulement pour auth.uid().

   Le code tourne SANS cette migration : l'échec de l'envoi est avalé, on est
   simplement aveugle tant qu'elle n'est pas passée.

   Idempotente. Prose en commentaire de BLOC (cf. client_errors).
   ============================================================================ */

CREATE TABLE IF NOT EXISTS page_views (
  user_id    UUID NOT NULL,
  /* Partie locale de l'email (`gui`, `teresa`…) : auth.users n'est pas lisible
     depuis le client, et le tableau d'Options doit nommer les gens. */
  user_label TEXT NOT NULL,
  page       TEXT NOT NULL,
  /* Jour calendaire au Mozambique, calculé ici : le client peut rester ouvert
     à cheval sur minuit. */
  day        DATE NOT NULL,
  views      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, page, day)
);

CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

/* Lecture : les deux admins voient tout. Aucune policy d'écriture, volontaire. */
DROP POLICY IF EXISTS "admin_read" ON page_views;
CREATE POLICY "admin_read" ON page_views
  FOR SELECT TO authenticated USING (true);

/* Le panneau « Clear » d'Options vide la table : une policy de suppression. */
DROP POLICY IF EXISTS "admin_delete" ON page_views;
CREATE POLICY "admin_delete" ON page_views
  FOR DELETE TO authenticated USING (true);

REVOKE ALL ON page_views FROM anon;
GRANT SELECT, DELETE ON page_views TO authenticated;

/* p_items : [{"page":"taxis#drivers","n":3}, …] — borné des deux côtés. */
CREATE OR REPLACE FUNCTION track_page_views(p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid   UUID := auth.uid();
  label TEXT := COALESCE(NULLIF(split_part(COALESCE(auth.jwt() ->> 'email', ''), '@', 1), ''), 'unknown');
  today DATE := (now() AT TIME ZONE 'Africa/Maputo')::date;
  item  JSONB;
  k     TEXT;
  n     INTEGER;
BEGIN
  IF uid IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RETURN; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LIMIT 100 LOOP
    k := item ->> 'page';
    n := LEAST(GREATEST(COALESCE((item ->> 'n')::integer, 0), 0), 1000);
    IF k IS NULL OR n = 0 OR length(k) > 60 OR k !~ '^[a-z0-9_#-]+$' THEN CONTINUE; END IF;

    INSERT INTO page_views (user_id, user_label, page, day, views)
    VALUES (uid, label, k, today, n)
    ON CONFLICT (user_id, page, day)
    DO UPDATE SET views = page_views.views + EXCLUDED.views,
                  user_label = EXCLUDED.user_label;
  END LOOP;
END;
$$;

/* ⚠️ Une fonction est exécutable par PUBLIC par défaut : on ferme à anon. */
REVOKE ALL ON FUNCTION track_page_views(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION track_page_views(JSONB) TO authenticated;

/* Lecture agrégée pour le panneau Usage : PostgREST plafonne à 1000 lignes, le
   GROUP BY se fait donc ici. p_since NULL = depuis toujours. */
CREATE OR REPLACE FUNCTION get_page_usage(p_since DATE DEFAULT NULL)
RETURNS TABLE (page TEXT, user_label TEXT, views BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT pv.page, pv.user_label, SUM(pv.views)::bigint
  FROM page_views pv
  WHERE p_since IS NULL OR pv.day >= p_since
  GROUP BY pv.page, pv.user_label
$$;

REVOKE ALL ON FUNCTION get_page_usage(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_page_usage(DATE) TO authenticated;

/* Vérifs (anon) : la lecture doit répondre 42501 (ou []), l'appel 42501/401.
     curl -s "$URL/rest/v1/page_views?select=*&limit=1" -H "apikey: $ANON"
     curl -s -X POST "$URL/rest/v1/rpc/track_page_views" -H "apikey: $ANON" \
       -H "Content-Type: application/json" -d '{"p_items":[]}'
*/
