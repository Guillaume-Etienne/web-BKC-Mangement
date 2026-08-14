-- 2026-08-14 (a) — Un type de lien partagé pour le formulaire de demande.
--
-- ⚠️ À PASSER SEUL, ET EN PREMIER. Ce fichier ne contient QUE l'ajout de la valeur
-- d'enum, et c'est volontaire : PostgreSQL refuse d'utiliser une valeur d'enum
-- ajoutée dans la même transaction, et l'éditeur SQL du dashboard exécute tout un
-- script dans UNE transaction. Fusionner ce fichier avec le (b) donnerait
-- `55P04 unsafe use of new value "enquiry_form" of enum type shared_link_type`.
-- (Déjà vécu le 2026-07-30 avec les catégories de prix.)
--
-- À QUOI SERT CE TYPE
-- Le formulaire léger est une page publique de l'app, embarquée en iframe sur le
-- site (cf. .claude/docs/ENQUIRIES.md). Comme toute page publique ici, elle est
-- servie par un lien signé `?share=<token>` — c'est ce token qui autorise la
-- lecture de la liste des origines et l'écriture de la demande.

ALTER TYPE shared_link_type ADD VALUE IF NOT EXISTS 'enquiry_form';

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — sur TEST **et** PROD, avant de passer le fichier (b) :
--
--   SELECT unnest(enum_range(NULL::shared_link_type));
--   → doit contenir 'enquiry_form'
--
-- Par curl anon, le contrôle équivalent :
--   curl "$URL/rest/v1/shared_links?type=eq.enquiry_form&select=id" -H "apikey: $ANON"
--   → 200 [] (la valeur passe le parseur)
--   …alors que  ?type=eq.zzz_bidon  → 22P02 invalid input value
-- ════════════════════════════════════════════════════════════════════════════
