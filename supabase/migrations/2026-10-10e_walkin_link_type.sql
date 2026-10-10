-- 2026-10-10 (e) — Nouveau type de lien partagé : `walkin` (page « mes venues » d'UN client).
--
-- ⚠️ À lancer SEUL, dans sa propre exécution, AVANT 2026-10-10f (une valeur d'enum ajoutée ne
-- peut pas être utilisée dans la même transaction : 55P04). Mêmes consignes que 10a.
ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS 'walkin';
