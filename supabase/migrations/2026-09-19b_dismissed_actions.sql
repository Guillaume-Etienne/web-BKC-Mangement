-- 2026-09-19 — « Affaire classée » : ranger une ligne de la liste d'accueil
--              sans mentir sur les données qui l'ont fait apparaître.
--
-- Le problème, dans les mots de gui : « certaines ne le sont pas vraiment »
-- (des choses à faire). Le guide de voyage parti par WhatsApp, l'acompte reçu
-- en main propre, la course de taxi qui n'aura jamais de réservation : l'alerte
-- reste vraie du point de vue de la base, et fausse du point de vue de gui.
-- Jusqu'ici la seule façon de la faire taire était de maquiller la donnée
-- (inventer un email envoyé, un paiement) — un mensonge qui se paie plus tard,
-- dans la compta ou dans l'historique d'envoi.
--
-- Cette table dit donc autre chose que « c'est fait » : elle dit « j'ai vu, et
-- je m'en occupe ailleurs ». Les données ne bougent pas, l'alerte descend dans
-- l'accordéon « Closed cases » de la page d'accueil, et se rouvre d'un clic.
--
-- LA CLÉ (`dismiss_key`) N'EST PAS `PendingAction.id`
--   `id` change avec l'urgence : `travel-guide-week-<uuid>` devient
--   `travel-guide-urgent-<uuid>` à J-2. Une affaire classée sur `id` se
--   rouvrirait toute seule le jour où elle presse — exactement quand on ne veut
--   plus la voir. La clé est donc **stable par sujet** : `travel-guide:<uuid>`.
--   Elle est construite dans `components/pending/pendingActions.ts`, un seul
--   endroit, à côté du texte de l'alerte.
--
-- `up_to_count` — POURQUOI UNE ALERTE PEUT SE ROUVRIR SEULE
--   Deux familles d'alertes cohabitent :
--     • celles qui parlent d'UNE réservation (« guide de voyage non envoyé ») :
--       `up_to_count` reste NULL, l'affaire est classée jusqu'à réouverture
--       manuelle.
--     • celles qui comptent (« 3 nouvelles demandes à lire », « 2 paiements non
--       vérifiés ») : on enregistre le nombre classé. Tant que le compte reste
--       sous cette barre, silence ; dès qu'il la dépasse, la ligne remonte.
--   Sans cette colonne, classer « 3 demandes à lire » masquerait aussi la
--   quatrième, arrivée après — une alerte qui se tait sur du neuf, c'est
--   précisément le piège qu'on refuse.
--
-- CE QUI EST DÉLIBÉRÉMENT ABSENT
--   • Pas d'auteur : deux comptes admin, tous deux gui ou son associé (même
--     argument que `client_notes`).
--   • Pas de motif : un champ libre que personne ne relit. Ce que la ligne
--     disait est de toute façon recalculé à l'affichage.
--   • Pas de ménage automatique : quand la situation disparaît (le paiement est
--     vérifié, la résa part), l'alerte n'est plus calculée du tout et la ligne
--     ici ne sert plus à rien — elle ne se voit nulle part, ne coûte rien, et
--     resservira si la même situation revient. Quelques dizaines de lignes au
--     plus.
--
-- Idempotente : peut être repassée sans dommage. À appliquer sur TEST **et**
-- PROD (une seule tâche, cf. feedback gui).

BEGIN;

CREATE TABLE IF NOT EXISTS dismissed_actions (
  dismiss_key   TEXT PRIMARY KEY,
  up_to_count   INTEGER,
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pas d'index : la page d'accueil lit la table ENTIÈRE (quelques dizaines de
-- lignes) et fait la correspondance en mémoire, là où les clés sont construites.

ALTER TABLE dismissed_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON dismissed_actions;
CREATE POLICY "admin_all" ON dismissed_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Strictement admin : ces clés contiennent des identifiants de réservation et
-- disent ce que gui a choisi de ne pas traiter. Aucune page partagée n'a à les
-- atteindre — l'absence de policy anon suffirait, le REVOKE ferme deux fois.
REVOKE ALL ON dismissed_actions FROM anon;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (à passer après, sur chaque base)
--
--   -- 1. La table existe et le classement tient :
--   INSERT INTO dismissed_actions (dismiss_key, up_to_count)
--        VALUES ('travel-guide:00000000-0000-0000-0000-000000000000', NULL);
--   SELECT * FROM dismissed_actions;
--   DELETE FROM dismissed_actions
--    WHERE dismiss_key = 'travel-guide:00000000-0000-0000-0000-000000000000';
--   -- attendu : une ligne, puis plus rien.
--
--   -- 2. anon ne voit rien, même avec un jeton de partage valide :
--   curl "$SUPABASE_URL/rest/v1/dismissed_actions?select=dismiss_key" \
--        -H "apikey: $ANON_KEY" -H "x-share-token: <un jeton valide>"
--   -- attendu : [] ou une erreur de permission — jamais une clé.
--
--   -- 3. À l'écran : classer une ligne sur la page d'accueil, recharger.
--   -- attendu : elle est toujours dans « Closed cases », pas revenue en haut.
-- ════════════════════════════════════════════════════════════════════════════
