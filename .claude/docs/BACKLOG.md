# BACKLOG — reste à faire (source de vérité unique)

> **La** liste canonique des tâches restantes. Mise à jour à chaque session (ajouter/rayer ici,
> pas dans la mémoire). Chaque entrée dit : quoi, pourquoi, et comment s'y prendre.
> Rappels transverses : migrations = **TEST + PROD dans la foulée, une seule tâche** ;
> vérifier les migrations sécu par **curl anon direct** (pas seulement `has_table_privilege`) ;
> Claude commit, **gui push lui-même** ; `npm run build` avant tout push.

---

## ✅ Sécurité anon — CHANTIER TERMINÉ (2026-07-06)

Lots A+B+C (colonnes) + Phase 2 (lignes token-aware) tous appliqués & vérifiés par curl anon
sur TEST **et** PROD. État final + pièges : `.claude/docs/security-rls.md`. Ce qui reste de
sécu vit dans « Quand gui veut » (anti-spam) et Housekeeping (PAT).
**Micro-reste** : smoke visuel des vrais liens PROD par gui (Geraldo/driver/client) —
les curls sont verts, il s'agit juste de confirmer l'affichage des pages.

### Lot B — `bookings` full read — ✅ TERMINÉ & VÉRIFIÉ (2026-07-04)
Migration `2026-07-04_lot_b_bookings_columns.sql` appliquée **TEST + PROD** par gui, vérifiée
par curl anon direct sur les 2 bases : 42501 sur `select=*` / notes / amount_paid /
emergency_contact / visa ; 200 sur les 8 colonnes autorisées + embed `client:clients`.
ClientSharePage narrowé (commit `86b6a5a`). Dernier check visuel : ouvrir la page client
du seed en TEST après le prochain déploiement Vercel.

### Lot C — instructors / taxi_drivers / activity_providers — ✅ TERMINÉ & VÉRIFIÉ (2026-07-06)
Décisions gui (recos confirmées) : instructors → identité + tarifs (ClientSharePage en a
besoin) ; taxi_drivers → id/name/phone (gardé volontairement)/vehicle/seats ; providers →
tout sauf `notes`. Migration `2026-07-06_lot_c_columns.sql` + 6 pages narrowées + schema.sql.
Vérifié par curl sur TEST (6 types de tokens, colonnes bloquées → 42501, pages non cassées)
et PROD (grants). Seul type jamais curl-testé avec token : `activity_provider` (policies du
même gabarit ; à tester si un lien provider déconne un jour).

### Phase 2 — RLS token-aware — ✅ TERMINÉ & VÉRIFIÉ TEST + PROD (2026-07-06)
D1–D4 tranchés par gui (= les 4 recos). Header `x-share-token` dans `supabase.ts` +
migration `2026-07-06_phase2_token_rls.sql` (5 helpers + 22 policies) + `schema.sql` sync.
Vérifié par curls anon sur les 2 bases : sans token / token bidon → `[]` sur les 22 tables ;
en TEST avec les 5 tokens du seed : chaque type ne voit que SES lignes (D1 prouvé — Beach BBQ
invisible pour le client ; D4 prouvé — trajet margin=0 invisible pour Geraldo). Smoke visuel
des pages partagées TEST fait par gui. ⚠️ Piège vécu : première « application PROD » était en
fait sur TEST (SQL editor sur le mauvais projet, migration idempotente = aucun message
d'erreur) — détecté par curl, refaite sur le vrai PROD `oslsbansxaajcpwhivmx`.
**Micro-reste** : (a) gui ouvre ses vrais liens PROD (Geraldo, driver, client) pour smoke
visuel ; (b) tokens `restaurant` / `activity_provider` absents du seed → types non
curl-testés (policies identiques aux autres ; à couvrir si un lien de ces types déconne).
⚠️ Realtime : pages partagées sans live-update (websocket sans header) — assumé, refresh OK.

---

## 🟠 Compta

### CashFlow — sorties MZN chauffeurs/manager — ✅ IMPLÉMENTÉ (2026-07-04)
Q1 répondue (chauffeurs payés au trajet, Geraldo au réel) → colonne « Taxi out » dans CashFlow
(drivers = trips `done`, manager = `taxi_manager_payments`, MZN→€ taux global) + TaxiFinanceTab
bi-devise (MZN + ≈€) avec colonne Centre margin. Détail : `cashflow-mzn-design.md`.

### Dashboard compta — marge taxi mise en avant — ✅ FAIT (2026-07-04, validé gui)
Card inversée : « Taxi margin » en gros chiffre, « X€ billed − Y€ costs (MZN→€) » en sous-titre.
La barre « Taxis » du Revenue breakdown reste en BRUT (cohérence Billed/Collected/Outstanding —
les clients doivent le brut). Formule du Net result inchangée.

---

## ✅ Responsive mobile — Home/Clients/Planning/Management (2026-07-09)

Commit `5b32f44`. Home : 6 raccourcis compacts (+ Accounting/Equipment/Taxis/Activities) +
pending actions sur une ligne (troncature). Clients : toggle List/Cards mobile (défaut
List si écran <768px), bouton delete ajouté au panneau détail. Planning : contrôles
saison/mois/now + barre d'onglets compressés sur une ligne mobile (libellés abrégés).
Management : barre d'onglets qui débordait à droite en mobile — corrigée (scroll fallback
+ libellés compacts). Pas de vérif visuelle par Claude (login admin requis) — testé par gui.

---

## 🟠 Templates de documents en DB + Welcome Guide (2026-07-09) — reste le Save initial par gui

Code fait & build OK. Découverte : les sections des guides vivaient en **localStorage**
(par navigateur, perdues au clear cache, pas partagées entre admins) et chaque frappe
était « sauvée » sans validation. Refonte :
- Table **`document_templates`** (admin-only, REVOKE anon) — sections des 2 guides.
- Nouveau document **Welcome Guide** 🏝️ (infos sur place : wifi, repas, eau, élec,
  programme, linge, argent, urgences, check-out — défauts avec placeholders `[…]` à
  personnaliser dans Templates) : onglet dédié, PDF FR/EN/ES + email (`welcome_guide`).
- Édition en brouillon + **bouton Save explicite** (Cancel, indicateur unsaved) dans les
  onglets Travel Guide / Welcome Guide / Templates (switcher Travel/Welcome).
- Premier Save sème la table (fallback : localStorage legacy pour le travel guide → les
  éditions existantes de gui sont récupérées **dans le navigateur habituel**).

1. ~~Migration TEST + PROD~~ ✅ appliquée par gui (2026-07-10).
2. ~~Vérif curl anon~~ ✅ FAIT (2026-07-10) sur les 2 bases : SELECT **et** INSERT anon sur
   `document_templates` → `42501 permission denied` (pas `[]` — REVOKE effectif, table
   présente). Enum `welcome_guide` prouvé présent : `email_logs?type=eq.welcome_guide`
   passe le parseur (`[]`) alors que `eq.zzz_bidon` → `22P02 invalid input value`.
3. **RESTE** : gui ouvre Documents → Travel Guide **dans son navigateur habituel** et clique
   **Save** (migre ses textes localStorage vers la DB — sur PROD **et** TEST si les textes
   diffèrent) ; idem Welcome Guide après avoir rempli les placeholders `[…]`.
4. **RESTE — traductions EN/ES des textes FR de gui** (workflow convenu 2026-07-10,
   Claude n'a pas accès à la table — anon 42501) : gui rédige le FR dans l'app + Save,
   puis colle à Claude le résultat de
   `SELECT id, title->>'fr', content->>'fr' FROM document_templates WHERE doc_type='welcome_guide' ORDER BY sort_order;`
   → Claude rend un script `UPDATE … jsonb_set(…)` en/es idempotent → gui l'applique
   **TEST + PROD**. Retouches ponctuelles ensuite : simple copier-coller chat → éditeur
   Templates. (Plan C : Claude in Chrome sur la session admin — lent, dernier recours.)

---

## 🟡 Quand gui veut

- **Bug prix taxi 8000 €** — fix code fait (`order updated_at desc` des 2 côtés, commit `4364316`).
  Diag `diagnostics_taxi_pricing.sql` : **TEST fait le 06/07 → OK, rien à corriger** ;
  **PROD en attente** (incident Supabase le 06/07 au soir) → relancer sur PROD dès que
  rétabli, puis corriger si besoin (`default_price_eur`=120, purger doublons
  `taxi_pricing_defaults`).
- ~~**Anti-spam formulaire public**~~ ✅ FAIT (2026-07-06, `318e467`) : honeypot off-screen
  (`website`) + refus silencieux des soumissions <3s après chargement — les deux tombent sur
  le faux écran de succès (zéro insert, zéro email, le bot n'apprend rien). Kill switch
  inchangé (`shared_links.is_active=false`). Turnstile seulement si le lien devient vraiment
  public un jour (nécessiterait une Edge Function pour l'insert).
- **Waiver EN/ES** — traductions auto à faire relire (FR = source gui). `WAIVER_VERSION = 'v1-2026'`.
- ~~**Supprimer l'import CSV**~~ ✅ FAIT (2026-07-06) : `ImportCSVModal` + `parseGoogleFormsCSV.ts`
  supprimés, ClientsPage nettoyée (bouton, state, handleImport). `import_id` conservé
  (dédup SubmissionsPage).
- **Logo sur documents** — préciser avec gui QUELS documents avant d'agir.
  Assets : `client/public/docs/logo-mas.png`, `signature-mas.png`.
- **Lien partagé `restaurant` en PROD** — à créer depuis Options → Shared Links quand besoin.

## 🧹 Housekeeping

- ~~Révoquer le PAT Supabase du 2026-06-26~~ ✅ RÉGLÉ (2026-07-06) : `Juin2026TEMP` était
  temporaire (Expired de lui-même) et supprimé du dashboard ; token CLI `cli_gui@LAPTOP…`
  révoqué aussi. **Plus aucun token Supabase actif.**
- ~~Supprimer `supabase/seed/supabase_logs.json`~~ ✅ FAIT (2026-07-06).
- Redéployer `notify-submission` (TEST et/ou PROD) **seulement si** l'email admin semble pauvre —
  la chaîne fonctionne, c'est juste la richesse du récap (non bloquant).
- ~~Nettoyer `client/.env.local`~~ ✅ FAIT (2026-07-06) : clés Resend + records DNS retirés,
  ne restent que URLs + clés anon des 2 bases (utiles curls). ⚠️ Les clés Resend ne sont plus
  QUE dans les secrets Edge Functions Supabase (et le dashboard Resend).

## 🧊 Gelé / à NE PAS faire

- **Kanban taxi** (`TaxiKanbanView`) — gelé, peut-être l'an prochain. Ne pas factoriser la
  duplication Kanban↔List tant que c'est gelé. Améliorations planning taxi = **List view** only.
- **Refactor des gros fichiers** (BookingsPage 1600 l., ManagementPage…) — ça marche, c'est
  documenté ; mauvais rapport risque/bénéfice.
- **UI d'édition des textes d'emails** `notify-submission` — décision gui : textes EN DUR dans
  l'Edge Function ; pour changer le wording → éditer `notify-submission/index.ts` + redéployer.

---

*Historique des chantiers clos : `.claude/archive/memory/` (README explicatif dedans).*
