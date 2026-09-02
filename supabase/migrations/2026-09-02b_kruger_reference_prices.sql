-- 2026-09-02 (b) — Seed only, no schema change: Kruger Park & Eswatini tour prices,
-- as a new section in transfer_reference_prices (created by 2026-09-02_transfer_reference_prices.sql,
-- which must run first — this file only inserts rows into it).
--
-- Source: gui's "kruger.xlsx". The sheet mixed a real booking ledger ("ToursMaputo" /
-- "ToursMaputo 2025" — client names, booking numbers, payment status) with the actual
-- price catalogue. The ledger is deliberately NOT reproduced here (gui, 2026-09-02,
-- AskUserQuestion): it isn't price info, it's internal accounting that already
-- belongs in the app's own bookings/accounting, and it carries real client names —
-- nothing a client-question reference tool should ever hold.
--
-- Same reasoning skipped the row 2/17 note "10% STO rates on one-day tours, 5% on
-- multiple day tours" — that is an agency commission policy, not a client price
-- (closer to the existing agencies/agency_rate_items chantier than to this table).
--
-- Reused the exact row shape from the Transfers seed (one price + free-text notes,
-- gui's call on 2026-09-02) rather than a new "package card" component: here
-- from_label = package name, to_label = the group-size tier it prices, so one row =
-- one price point instead of a wall of text in notes. Merged-cell columns in the
-- source put some of these tables side by side in a way that was easy to
-- misattribute — reconstructed carefully column by column, but worth a glance from
-- gui once it's visible in the UI.

INSERT INTO transfer_reference_prices
  (section, section_order, collapsible, row_order, from_label, to_label, price, currency, detail, notes)
VALUES
  ('Kruger Park & Eswatini tours', 5, true, 0,  'Kruger Park (solo day trip)', '1 person', 390, 'USD', '1 day, per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 1,  'Maputo Special Reserve (day trip)', NULL, 370, 'USD', '1 day, per person', NULL),

  ('Kruger Park & Eswatini tours', 5, true, 2,  'Kruger Park — 2-day package', '2 persons',   250, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 3,  'Kruger Park — 2-day package', '3 persons',   225, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 4,  'Kruger Park — 2-day package', '4 persons',   195, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 5,  'Kruger Park — 2-day package', '5+ persons',  188, 'USD', 'per person', NULL),

  ('Kruger Park & Eswatini tours', 5, true, 6,  'Kruger Park — 3-day package', '2-3 persons', 725, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 7,  'Kruger Park — 3-day package', '4+ persons',  685, 'USD', 'per person', NULL),

  ('Kruger Park & Eswatini tours', 5, true, 8,  'Blyde River Canyon (special, 1 day)', '2-3 persons', 495, 'USD', 'per person',
    'Labelled "Special River Canyon" in the source'),
  ('Kruger Park & Eswatini tours', 5, true, 9,  'Blyde River Canyon (special, 1 day)', '4+ persons',  455, 'USD', 'per person', NULL),

  ('Kruger Park & Eswatini tours', 5, true, 10, 'Kruger + Blyde River Canyon — 3-day package', '2-3 persons', 725, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 11, 'Kruger + Blyde River Canyon — 3-day package', '4+ persons',  685, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 12, 'Kruger + Blyde River Canyon — 4-day package', '2-3 persons', 945, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 13, 'Kruger + Blyde River Canyon — 4-day package', '4+ persons',  895, 'USD', 'per person', NULL),

  ('Kruger Park & Eswatini tours', 5, true, 14, 'Eswatini/Kruger — 3-day package (2 Kruger + 1 Eswatini)', '2-3 persons', 785, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 15, 'Eswatini/Kruger — 3-day package (2 Kruger + 1 Eswatini)', '4+ persons',  695, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 16, 'Eswatini/Kruger — 3-day package (1 Kruger + 2 Eswatini)', '2-3 persons', 785, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 17, 'Eswatini/Kruger — 3-day package (1 Kruger + 2 Eswatini)', '4+ persons',  695, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 18, 'Eswatini/Kruger — 4-day package (2 Kruger + 2 Eswatini)', '2-3 persons', 985, 'USD', 'per person', NULL),
  ('Kruger Park & Eswatini tours', 5, true, 19, 'Eswatini/Kruger — 4-day package (2 Kruger + 2 Eswatini)', '4+ persons',  895, 'USD', 'per person', NULL),

  ('Kruger Park & Eswatini tours', 5, true, 20, 'What''s included (multi-day packages)', NULL, NULL, NULL, NULL,
    'Park entrance, accommodation, and meals — lunch & dinner day 1, breakfast & lunch on the final day (all 3 meals on the middle day if a 3-day package).'),
  ('Kruger Park & Eswatini tours', 5, true, 21, 'Lodge', NULL, NULL, NULL, NULL,
    'In Marloth Park, a protected area just outside the Kruger gate — closer wildlife viewing than the rest camps inside the park. https://www.crocodilekruger.co.za/'),
  ('Kruger Park & Eswatini tours', 5, true, 22, 'Booking terms', NULL, NULL, NULL, NULL,
    '30% deposit to confirm. +5% surcharge if paid by PayPal. Remaining 70% payable in Metical (Mozambican bank account or the Maputo office), PayPal, or cash on the day. Full payment required if booking within 24h of the tour.');

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION
--
-- Table admin-only (RLS déjà posée par 2026-09-02_transfer_reference_prices.sql) —
-- un curl anon ne prouve rien ici, à vérifier en service_role ou depuis l'app connectée :
--   SELECT count(*) FROM transfer_reference_prices WHERE section = 'Kruger Park & Eswatini tours';
--   → doit renvoyer 23.
-- ════════════════════════════════════════════════════════════════════════════
