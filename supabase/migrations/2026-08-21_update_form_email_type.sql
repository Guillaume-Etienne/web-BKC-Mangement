-- 2026-08-21 — Une 6ᵉ valeur d'email_log_type pour le lien "Update Form".
--
-- Documents → Overview gagne une colonne pour créer/voir/renvoyer un lien vers
-- le formulaire public complet, cette fois pointé sur une résa DÉJÀ EN BASE
-- (params.target_booking_id) au lieu d'une enquiry — pour laisser le client
-- compléter lui-même dates de visa, passeports, contact d'urgence sur une
-- résa provisoire. "Renvoyer" doit être un vrai envoi tracé, même modèle que
-- Client Account (2026-08-19b) et les 4 documents d'origine.
--
-- Fichier seul, même raison que 2026-08-19b : rien ici n'utilise la nouvelle
-- valeur dans la même transaction.
--
-- send-email/index.ts est déjà générique sur `type` : rien à redéployer côté
-- Edge Function.

ALTER TYPE email_log_type ADD VALUE IF NOT EXISTS 'update_form';

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — sur TEST et PROD, après avoir passé ce fichier :
--
--   SELECT unnest(enum_range(NULL::email_log_type));
--   → doit contenir 'update_form'
--
-- email_logs est admin-only, zéro GRANT anon : le curl-anon-avec-contrôle-négatif
-- ne prouve rien ici (même remarque que pour client_account) — utiliser le SQL
-- editor ou service_role.
-- ════════════════════════════════════════════════════════════════════════════
