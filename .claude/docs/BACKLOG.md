# BACKLOG — reste à faire (source de vérité unique)

> **La** liste canonique des tâches restantes. Mise à jour à chaque session (ajouter/rayer ici,
> pas dans la mémoire). Chaque entrée dit : quoi, pourquoi, et comment s'y prendre.
> Rappels transverses : migrations = **TEST + PROD dans la foulée, une seule tâche** ;
> vérifier les migrations sécu par **curl anon direct** (pas seulement `has_table_privilege`) ;
> Claude commit, **gui push lui-même** ; `npm run build` avant tout push.

---

## 🔴 Sécurité anon — chantier en cours (validé par gui en 3 lots)

Contexte : `.claude/docs/security-rls.md` (état exposé + checklist). Lot A ✅ fait (commit `b2e4255`).

### Lot B — `bookings` full read — ✅ TERMINÉ & VÉRIFIÉ (2026-07-04)
Migration `2026-07-04_lot_b_bookings_columns.sql` appliquée **TEST + PROD** par gui, vérifiée
par curl anon direct sur les 2 bases : 42501 sur `select=*` / notes / amount_paid /
emergency_contact / visa ; 200 sur les 8 colonnes autorisées + embed `client:clients`.
ClientSharePage narrowé (commit `86b6a5a`). Dernier check visuel : ouvrir la page client
du seed en TEST après le prochain déploiement Vercel.

### Lot C — instructors / taxi_drivers / activity_providers
phone/email/notes lisibles anon. **Décisions métier champ par champ AVEC gui** (le phone du
chauffeur est peut-être volontairement visible sur les pages taxi). Ensuite : même pattern
GRANT colonnes que Lot B. ⚠️ ClientSharePage a besoin des rates instructeurs.

### Phase 2 — RLS token-aware (filtrer les LIGNES, pas juste les colonnes)
**✅ Design écrit (2026-07-04) : `phase2-rls-token-aware.md`** — mécanisme header
`x-share-token`, helpers SQL, matrice d'accès complète (7 types × 20 tables), pièges
(ordre front→DB, realtime, embeds), runbook de rollout + curls de vérif.
**Reste** : (1) trancher D1–D4 avec gui (§5 du design), (2) implémenter en suivant le §6 —
mécanique, faisable par Opus en une session.

---

## 🟠 Compta

### CashFlow — sorties MZN chauffeurs/manager comptées nulle part
**✅ Design écrit (2026-07-04) : `cashflow-mzn-design.md`** — manager : brancher
`taxi_manager_payments` (déjà saisis, jamais comptés) ; chauffeurs : 3 options selon **Q1**
(quand gui paye-t-il réellement les chauffeurs ?), reco = proxy par trajet `done` (option A,
zéro migration). **Reste** : poser Q1 à gui, puis implémenter (§4 du design — mécanique, Opus).

---

## 🟡 Quand gui veut

- **Bug prix taxi 8000 €** — fix code fait (`order updated_at desc` des 2 côtés, commit `4364316`).
  Reste : lancer `supabase/migrations/diagnostics_taxi_pricing.sql` sur TEST+PROD, corriger
  `default_price_eur` (=120), supprimer les lignes en double de `taxi_pricing_defaults`.
- **Anti-spam formulaire public** — risque réel = quota Resend (2 emails auto/soumission), pas la DB.
  Combo **honeypot + délai mini 3s** (~15 min, zéro DB) ; kill switch déjà dispo
  (`shared_links.is_active=false`). Turnstile seulement si le lien devient vraiment public
  (nécessiterait une Edge Function pour l'insert).
- **Waiver EN/ES** — traductions auto à faire relire (FR = source gui). `WAIVER_VERSION = 'v1-2026'`.
- **Supprimer l'import CSV** — `ImportCSVModal` + `parseGoogleFormsCSV.ts` toujours branchés dans
  ClientsPage ; à retirer maintenant que le formulaire public est validé en prod.
- **Logo sur documents** — préciser avec gui QUELS documents avant d'agir.
  Assets : `client/public/docs/logo-mas.png`, `signature-mas.png`.
- **Lien partagé `restaurant` en PROD** — à créer depuis Options → Shared Links quand besoin.

## 🧹 Housekeeping

- **Révoquer le PAT Supabase** du 2026-06-26 (https://supabase.com/dashboard/account/tokens) — gui.
- Supprimer `supabase/seed/supabase_logs.json` (283 Ko, non commité) — gui.
- Redéployer `notify-submission` (TEST et/ou PROD) **seulement si** l'email admin semble pauvre —
  la chaîne fonctionne, c'est juste la richesse du récap (non bloquant).
- Nettoyer `client/.env.local` des restes de session (records DNS, secrets collés).

## 🧊 Gelé / à NE PAS faire

- **Kanban taxi** (`TaxiKanbanView`) — gelé, peut-être l'an prochain. Ne pas factoriser la
  duplication Kanban↔List tant que c'est gelé. Améliorations planning taxi = **List view** only.
- **Refactor des gros fichiers** (BookingsPage 1600 l., ManagementPage…) — ça marche, c'est
  documenté ; mauvais rapport risque/bénéfice.
- **UI d'édition des textes d'emails** `notify-submission` — décision gui : textes EN DUR dans
  l'Edge Function ; pour changer le wording → éditer `notify-submission/index.ts` + redéployer.

---

*Historique des chantiers clos : `.claude/archive/memory/` (README explicatif dedans).*
