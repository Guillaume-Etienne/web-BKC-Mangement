-- Planning: let an accommodation show only the spots actually in use.
--
-- Why: San Martinho is a large third-party hotel. Its "spots" are a convenience
-- of our own data entry, not real rooms — it was given six on 2026-08-21 so that
-- several guests can stay there at once (it had exactly one, capacity 2, which
-- blocked a booking). But every spot is a planning ROW, so six spots meant six
-- San Martinho rows month after month, most of them empty.
--
-- gui's call: show only the occupied spots plus ONE free row to drop a booking
-- onto, and apply it to San Martinho alone — houses and bungalows keep their
-- fixed rows, because their room count is real and does not move.
--
-- ── Why a flag and not a name test ───────────────────────────────────────────
-- "San Martinho only" must NOT be written as a name match in the source. That is
-- the mistake this project has already paid for three times (full house at 100 €,
-- lessons by name, rentals by name — see data-model.md), and it is exactly why
-- `agencies.short_code` exists as a column. A rename would silently change the
-- planning's behaviour. So the behaviour lives on the row itself, and gui can
-- turn it on for another hotel from Options → Accommodations without a deploy.

ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS hide_empty_rooms BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN accommodations.hide_empty_rooms IS
  'Planning shows only the spots in use over the displayed window, plus one free row. For third-party places whose spot count is arbitrary (San Martinho). Houses and bungalows leave this false: their rooms are real.';

-- One-shot backfill, and the result is STORED — not a name lookup that runs on
-- every render. PROD holds "San Martinho"; TEST holds "Palmeiras Room (demo)"
-- instead, so this matches nothing there, which is correct: a demo row does not
-- need the behaviour. Any other place is switched on from the Options screen.
UPDATE accommodations SET hide_empty_rooms = true WHERE name ILIKE '%martinho%';

-- ── Vérifications ────────────────────────────────────────────────────────────
--
-- 1) La colonne existe et vaut false partout sauf San Martinho (PROD) :
--      SELECT name, type, hide_empty_rooms FROM accommodations ORDER BY name;
--    → PROD : San Martinho = true, tout le reste false.
--    → TEST : tout false (aucun nom ne correspond) — attendu.
--
-- 2) anon : la colonne suit le sort de la table. `accommodations` est lisible
--    par tout token valide (référentiel), donc rien de neuf à ouvrir ni à fermer
--    — contrôle par curl anon, doit répondre 200 :
--      curl -s "$URL/rest/v1/accommodations?select=name,hide_empty_rooms" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "x-share-token: $TOKEN"
--    (sans token valide, `[]` est normal depuis la Phase 2 — ça ne prouve rien.)
--
-- 3) À l'écran : Planning → le groupe « Other » ne montre plus que les
--    emplacements San Martinho occupés, plus une ligne libre en dessous.
