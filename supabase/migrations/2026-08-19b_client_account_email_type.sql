-- 2026-08-19 (b) — Une 5ᵉ valeur d'email_log_type pour le lien "Client Account".
--
-- Documents → Overview gagne une colonne pour créer/voir/renvoyer le lien perso
-- `?share=<token>` d'une résa (shared_links, type='client') sans sortir vers
-- Options → Shared Links. "Renvoyer" doit être un vrai envoi tracé, comme les
-- 4 documents existants — donc email_logs a besoin d'un 5ᵉ type.
--
-- Fichier seul, à la différence de 2026-08-14a/b : rien ici n'utilise la
-- nouvelle valeur dans la même transaction (pas d'INSERT/CHECK qui s'en sert
-- tout de suite), donc pas de risque du classique
-- `55P04 unsafe use of new value "..." of enum type ...` — un seul fichier suffit.
--
-- send-email/index.ts est déjà générique sur `type` (aucune logique par type,
-- juste un insert email_logs typé par la colonne) : rien à redéployer côté
-- Edge Function.

ALTER TYPE email_log_type ADD VALUE IF NOT EXISTS 'client_account';

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — sur TEST et PROD, après avoir passé ce fichier :
--
--   SELECT unnest(enum_range(NULL::email_log_type));
--   → doit contenir 'client_account'
--
-- Le curl-anon-avec-contrôle-négatif habituel NE PROUVE RIEN ici : email_logs
-- est admin-only, zéro GRANT anon (contrairement à shared_links) — la requête
-- ci-dessus (SQL editor, ou service_role) est la seule vérification valable.
-- ════════════════════════════════════════════════════════════════════════════
