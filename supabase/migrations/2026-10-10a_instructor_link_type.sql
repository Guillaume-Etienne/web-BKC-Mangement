-- 2026-10-10 (a) — Un type de lien partagé pour la page « heures » d'un moniteur.
--
-- ⚠️ À PASSER SEUL, ET EN PREMIER. Ce fichier ne contient QUE l'ajout de la valeur
-- d'enum : PostgreSQL refuse d'utiliser une valeur d'enum ajoutée dans la même
-- transaction, et l'éditeur SQL du dashboard exécute un script dans UNE transaction.
-- Fusionné avec le (b) → `55P04 unsafe use of new value "instructor"`.
--
-- Page : client/src/pages/InstructorSharePage.tsx (lien `?share=<token>`,
-- params.instructor_id). Heures seulement — aucun montant.

ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS 'instructor';

-- VÉRIFICATION — TEST **et** PROD, avant de passer le (b) :
--   SELECT unnest(enum_range(NULL::shared_link_type));   → contient 'instructor'
