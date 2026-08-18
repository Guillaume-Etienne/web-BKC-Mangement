-- Short marker shown next to a client's name wherever a booking comes from a
-- partner agency: "(FF) Loic SENE" in the planning bars, the Daily and Forecast
-- cards, the Bookings list and the accounting tables.
--
-- Why a column rather than a lookup in the code: the codes gui wants (FF for
-- Fun & Fly, Adekua, Decat) are per-agency data, and mapping them by NAME in
-- the source is the mistake this project has already paid for three times
-- (full house at 100 €, lessons by name, rentals by name — see data-model.md).
-- Renaming an agency would silently drop its marker, and a fourth agency would
-- get none at all, with nothing to signal it.
--
-- Nullable on purpose: empty means "no marker", never an invented one. Short by
-- design — it sits inside a planning bar that may be three days wide.

ALTER TABLE agencies ADD COLUMN short_code TEXT;

COMMENT ON COLUMN agencies.short_code IS
  'Badge shown beside the client name for bookings from this agency, e.g. "FF". NULL = no badge.';

-- Deliberately NOT granted to anon. `agencies` is admin-only (REVOKE ALL, see
-- 2026-08-16b), and the shared Forecast planning is served anonymously: exposing
-- this column there would print the commercial names of our partners to anyone
-- holding the link. The marker stays inside the authenticated app. Opening it
-- later is a security decision to take on purpose, not a side effect.

-- Seed the three agencies gui already uses. Matching on name is acceptable HERE
-- and nowhere else: it is a one-shot backfill whose result is stored, not a
-- lookup that runs on every render — and any row it misses simply shows no
-- badge until it is filled in from Options → 🤝 Agencies.
UPDATE agencies SET short_code = 'FF'     WHERE short_code IS NULL AND name ILIKE '%fun%fly%';
UPDATE agencies SET short_code = 'Adek' WHERE short_code IS NULL AND name ILIKE '%adekua%';
UPDATE agencies SET short_code = 'Decat'  WHERE short_code IS NULL AND name ILIKE '%decathlon%';

-- ── Vérifications (après avoir passé la migration) ─────────────────────────
--
-- 1) La colonne existe et anon n'y a pas accès — doit répondre 42501 :
--    curl -s "$SUPABASE_URL/rest/v1/agencies?select=short_code" \
--      -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--    Contrôle négatif (doit répondre 42501 aussi, la table entière est fermée) :
--    ...?select=colonne_bidon
--
-- 2) Connecté (SQL editor), les trois codes sont posés :
--    SELECT name, short_code FROM agencies ORDER BY name;
--    → Fun & Fly = FF, Adekua = Adek, Decathlon = Decat.
--    Une agence sans code n'est PAS une erreur : elle n'aura pas de badge.
--
-- 3) Dans l'app : Options → 🤝 Agencies affiche le champ "Short code" rempli,
--    et une résa reliée à Fun & Fly montre "(FF)" devant le nom du client dans
--    le planning, la liste Bookings et la compta.
