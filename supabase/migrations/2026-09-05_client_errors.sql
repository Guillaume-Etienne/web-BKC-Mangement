/* ============================================================================
   Migration : client_errors — ce qui casse chez le visiteur arrive jusqu'à gui
   Date : 2026-09-05
   À exécuter en TEST **puis en PROD** dans la foulée (Supabase SQL editor).

   Pourquoi : le 2026-09-04 un client n'a pas pu valider le formulaire depuis un
   Android. On ne l'a su que parce qu'il a téléphoné, et on n'a eu de l'erreur
   que ce qu'il a réussi à lire à l'écran — traduit en français par son
   navigateur, ce qui a failli nous envoyer chercher au mauvais endroit. Les
   pages partagées n'ont ni compte, ni console, ni support : sans cette table,
   une panne chez un visiteur ne laisse aucune trace nulle part.

   Le code tourne SANS cette migration : reportClientError avale l'échec de son
   propre insert. Tant qu'elle n'est pas passée, on est simplement aveugle comme
   avant — rien ne casse.

   Idempotente : repassable sans dommage (DROP POLICY IF EXISTS avant chaque
   CREATE POLICY — sans ça un second passage échouerait en 42710).

   ⚠️ La prose de ce fichier est en commentaire de BLOC, pas en `--` : un
   collage qui recoupe une longue ligne transformerait la moitié orpheline en
   SQL. C'est arrivé le 2026-09-05 sur le fichier jumeau.
   ============================================================================ */

CREATE TABLE IF NOT EXISTS client_errors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  /* La famille, telle que la classe client/src/utils/recoverableError.ts :
     'dom-mutated' | 'chunk' | 'network' | 'storage' | 'unknown' */
  kind        TEXT NOT NULL,
  /* D'où on l'a attrapée : 'boundary' | 'form-submit' | 'unhandled' */
  source      TEXT NOT NULL,
  message     TEXT NOT NULL,
  /* ⚠️ Le chemin et le TYPE de lien partagé, JAMAIS le token : il vaut mot de
     passe, et cette table est alimentée par des anonymes. */
  page        TEXT,
  user_agent  TEXT,
  app_lang    TEXT,
  /* true quand RecoveryBoundary a remonté l'arbre tout seul et que le visiteur
     n'a rien vu. Une ligne recovered n'est pas un incident, c'est une preuve
     que le filet a servi. */
  recovered   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_client_errors_occurred_at
  ON client_errors(occurred_at DESC);

/* ── RLS ─────────────────────────────────────────────────────────────────── */

ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON client_errors;
CREATE POLICY "admin_all" ON client_errors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

/* Un visiteur anonyme peut UNIQUEMENT déposer. Pas de SELECT : la table dirait
   sinon à n'importe qui ce qui casse chez les autres, et avec quel navigateur.
   Les longueurs sont bornées ici et pas seulement côté client — le client est
   la seule chose qu'un attaquant contrôle entièrement. */
DROP POLICY IF EXISTS "anon_insert_client_errors" ON client_errors;
CREATE POLICY "anon_insert_client_errors" ON client_errors
  FOR INSERT TO anon
  WITH CHECK (
    kind IN ('dom-mutated', 'chunk', 'network', 'storage', 'unknown')
    AND source IN ('boundary', 'form-submit', 'unhandled')
    AND length(message) BETWEEN 1 AND 500
    AND length(COALESCE(page, '')) <= 200
    AND length(COALESCE(user_agent, '')) <= 400
    AND length(COALESCE(app_lang, '')) <= 8
  );

GRANT INSERT ON client_errors TO anon;

/* ── Entretien ───────────────────────────────────────────────────────────────
   Table jetable : rien ici n'a de valeur passé quelques semaines, et l'insert
   anonyme est ouvert (comme form_submissions l'est déjà). Le bouton « Clear »
   de Options → Database la vide. À relancer à la main si besoin — ligne laissée
   en commentaire volontairement, à copier soi-même :

       DELETE FROM client_errors WHERE occurred_at < now() - interval '90 days';

   ── VÉRIFICATION (après, sur chaque base) ──────────────────────────────────
   anon peut déposer mais rien lire :

       curl "$SUPABASE_URL/rest/v1/client_errors?select=id&limit=1" \
            -H "apikey: $ANON_KEY"

   attendu : 42501 permission denied (la table existe, anon n'y lit rien).
   AVANT la migration c'était PGRST205 — c'est le contrôle négatif.
   ──────────────────────────────────────────────────────────────────────────── */
