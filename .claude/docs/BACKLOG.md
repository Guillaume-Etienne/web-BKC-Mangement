# BACKLOG — reste à faire (source de vérité unique)

> **La** liste canonique des tâches restantes. Mise à jour à chaque session (ajouter/rayer ici,
> pas dans la mémoire). Chaque entrée dit : quoi, pourquoi, et comment s'y prendre.
> Rappels transverses : migrations = **TEST + PROD dans la foulée, une seule tâche** ;
> vérifier les migrations sécu par **curl anon direct** (pas seulement `has_table_privilege`) ;
> Claude commit, **gui push lui-même** ; `npm run build` avant tout push.

---

## 🔴 Sécurité anon — chantier en cours (validé par gui en 3 lots)

Contexte : `.claude/docs/security-rls.md` (état exposé + checklist). Lot A ✅ fait (commit `b2e4255`).

### Lot B — `bookings` full read (LE trou 🔴) — ✅ codé 2026-07-04, ⏳ migration à appliquer
Fait : migration `2026-07-04_lot_b_bookings_columns.sql` (REVOKE + GRANT colonnes
`id, booking_number, check_in, check_out, status, client_id, num_center_access,
center_access_rate`), select de ClientSharePage narrowé, schema.sql à jour, build OK.
**Reste** : gui applique la migration **TEST + PROD** → puis vérifier par curl anon
(commandes en bas du fichier de migration) + ouvrir pages client/restaurant/taxi en TEST.

### Lot C — instructors / taxi_drivers / activity_providers
phone/email/notes lisibles anon. **Décisions métier champ par champ AVEC gui** (le phone du
chauffeur est peut-être volontairement visible sur les pages taxi). Ensuite : même pattern
GRANT colonnes que Lot B. ⚠️ ClientSharePage a besoin des rates instructeurs.

### Phase 2 — RLS token-aware (filtrer les LIGNES, pas juste les colonnes)
Aujourd'hui anon lit toutes les lignes des tables exposées (tous bookings, tous clients en
identité…). Cible décidée : **RLS token-aware** (header `x-share-token` + policies vérifiant
`shared_links`), préférée aux Edge Functions. **Étape 1 = écrire le design** (quelles tables,
quelles policies, ordre de migration, compat pages existantes) avant toute implémentation.

---

## 🟠 Compta

### CashFlow — sorties MZN chauffeurs/manager comptées nulle part
Les paiements réels aux chauffeurs et au manager taxi (MZN) ne sont saisis ni en Expenses ni
ailleurs → le net cash mensuel de CashFlow est optimiste. **D'abord une décision de modèle avec
gui** (où saisir ces sorties : Expenses ? table dédiée ? depuis TaxiFinanceTab ?), puis spécifier,
puis coder. Ne pas coder avant la décision.

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
