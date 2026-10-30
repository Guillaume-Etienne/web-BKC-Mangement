-- 2026-10-30 — Nouveau type de lien partagé : `palmeiras` (relevé de compte avec le Palmeiras).
--
-- ⚠️ À lancer SEUL, dans sa propre exécution, AVANT 2026-10-30b (une valeur d'enum ajoutée ne
-- peut pas être utilisée dans la même transaction : 55P04). Idempotent. TEST puis PROD.
ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS 'palmeiras';
