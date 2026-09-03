# Index rapide — où chercher quoi ?

> 📋 **Reste à faire / tâches en cours** → **`BACKLOG.md`** (source de vérité unique, à jour).
> 🗄️ Chantiers clos & audits historiques → `.claude/archive/memory/`.
> 🌱 Seed de démo base TEST → `supabase/seed/README.md` (jamais en PROD).

## 🔧 Runbooks — « comment faire X » (étapes prêtes à suivre)
| Je veux… | Où |
|----------|-----|
| Ajouter un **type de page partagée** (type TS + enum migration + dispatch + label…) | `taxi-and-shares.md` § RUNBOOK — Ajouter un nouveau type |
| Ajouter un **champ à une page partagée** | `taxi-and-shares.md` § RUNBOOK — Ajouter un champ |
| Ajouter/modifier une **policy anon** (sans fuiter de données) | `security-rls.md` § Checklist |
| Ajouter un **enum** (valeur) en base | migration `ALTER TYPE … ADD VALUE IF NOT EXISTS` (seule, hors txn) + `schema.sql` |
| Ajouter une **colonne** | migration + `schema.sql` + type TS + **`mock.ts`** (sinon build strict casse) + form admin |
| Créer une **migration** | `supabase/migrations/AAAA-MM-JJ_nom.sql`, idempotent, appliquer **TEST puis PROD** |
| Manipuler une **date calendaire** (jour, mois) | `client/src/utils/dates.ts` — **jamais** `.toISOString()`, voir ⚠️ ci-dessous |
| **Écrire en base** depuis un écran | vérifier l'erreur, toujours — voir ⚠️ ci-dessous |
| Ajouter une **page** | `App.tsx` : `lazy(() => import(...))` comme les autres (chargement à la demande) |
| **Créer un client** depuis un chemin automatique | `utils/clientIdentity.ts` — réutiliser avant d'insérer (lien explicite, puis email exact, **jamais un nom**) |
| **Voir tout ce qu'on sait d'une personne** | Clients → fiche → onglet **Timeline** (`utils/dossier.ts`) · MCP `get_client_dossier` |
| **Retrouver quelqu'un sans savoir où il est** | **⌘K / Ctrl-K** dans l'app · MCP `search_everything` |
| **Ajouter une source à la frise** du dossier | `utils/dossier.ts` : un `for` de plus dans `buildDossier` + un test. Ne jamais **copier** la donnée |

> ⚠️ Toujours `npm run build` avant push (Vercel = TS strict : unused/locals, types incomplets dans `mock.ts`).
>
> ⚠️ **Dates : jamais `new Date().toISOString().slice(0, 10)`.** Ça convertit en UTC
> d'abord, donc au Mozambique (UTC+2) ça renvoie **la veille** entre minuit et 2h — et
> toute la journée pour une `Date` calée à minuit local. Ça a mal daté des locations, des
> trajets taxi et des paiements, et décalé un mois comptable. Tout passe par
> **`client/src/utils/dates.ts`** (`todayISO`, `toISODate`, `addDaysISO`, `thisMonthISO`,
> `daysBetween`), testé dans `dates.test.ts`. Corrigé partout le 2026-07-31.
>
> ⚠️ **Une écriture Supabase dont on ne lit pas l'erreur ment à l'écran.** Le refus (RLS,
> contrainte, réseau coupé) est silencieux : l'app affiche la réservation déplacée, le
> paiement encaissé, le tarif enregistré — et la base n'a rien. Corrigé partout le
> 2026-07-31. Pattern selon l'écran :
> - état local optimiste → **`components/accounting/persist.ts`** (snapshot avant,
>   restauration + alerte si ça échoue ; testé dans `persist.test.ts`)
> - écriture suivie d'un `refresh()` → lire `{ error }` et le dire (cf. `ActivitiesPage`)
> - séquence d'écritures (wizard résa) → collecter les échecs et les afficher ensemble

## Par sujet

### Données / Base de données
| Besoin | Fichier | Section |
|--------|---------|---------|
| Champs d'une table SQL / interface TS | `data-model.md` | Section correspondante |
| Tous les enums et leurs valeurs | `data-model.md` | Union Types / Enums |
| Modèle financier taxi (MZN) | `data-model.md` | § taxi_trips |
| Modèle financier activités (EUR) | `data-model.md` | § activity_bookings |
| SharedAccountingData (quels champs ?) | `data-model.md` | § Types accounting partagés |
| Fonctions de calcul (computeXxx) | `data-model.md` | § Types accounting partagés → utils.ts |
| SharedLink params par type | `data-model.md` | § shared_links |
| Formulaire public : table file d'attente | `data-model.md` | § form_submissions |
| **Avant-réservation (demandes / prospects)** — conception + avancement | `ENQUIRIES.md` | tout |
| **Intégrer le formulaire de demande sur le site** (iframe, `lang`, en-têtes) | `ENQUIRY_FORM_EMBED.md` | à donner tel quel au projet site web |
| BookingFormPayload (champs du form) | `data-model.md` | § form_submissions |
| Guides clients (Travel/Welcome, table document_templates) | `data-model.md` | § Guides — document_templates |
| EmailLog / EmailLogType / EmailLogStatus | `data-model.md` | § Email Logs |
| PendingAction / ActionPriority / règles | `data-model.md` | § Pending Actions |
| Schéma SQL complet | `supabase/schema.sql` | — |
| Data integrity issues (audit) | `project_accounting_issues.md` | § Issue 1–4 |
| **Sécurité / RLS / accès anon** ⚠️ | **`security-rls.md`** | **avant toute policy anon ou page partagée** |
| Design Phase 2 (RLS token-aware, lignes) | `phase2-rls-token-aware.md` | matrice d'accès + rollout |
| Design CashFlow sorties MZN (taxi) | `cashflow-mzn-design.md` | options + runbook |
| Quelles tables exposées publiquement | `security-rls.md` | § Ce qui est exposé |
| Checklist avant page partagée | `security-rls.md` | § Checklist |

### Hooks
| Besoin | Fichier | Section |
|--------|---------|---------|
| Signature d'un hook spécifique | `hooks.md` | Section du hook |
| useTable (générique) | `hooks.md` | § Base Hook |
| useActivityProviders/Bookings/Payments | `hooks.md` | § useActivities.ts |
| useTaxiTrips (mapping direct) | `hooks.md` | § useTaxis.ts |
| Pattern mutation optimiste | `hooks.md` | § Pattern : données mutables |
| Quand refresh() vs optimistic | `hooks.md` | § Pattern : données mutables |

### Pages
| Besoin | Fichier | Section |
|--------|---------|---------|
| Routing App.tsx (sharedLink → page) | `pages.md` | § Logique de routing |
| Liste des pages publiques + props | `pages.md` | § Pages publiques |
| **Pages partagées + liens (réf.)** ⭐ | **`taxi-and-shares.md`** | tout le fichier |
| Les 3 pages partagées taxi | `taxi-and-shares.md` | § Les 3 pages partagées TAXI |
| Où se créent les liens (Shared Links) | `taxi-and-shares.md` | § Où se créent les liens |
| Convention taxi privé / seats | `taxi-and-shares.md` | § Conventions taxi |
| i18n PT/EN pages partagées | `taxi-and-shares.md` | § infra i18n/UI |
| Quelle page utilise quels hooks | `pages.md` | Page concernée |
| PlanningView (draft mode, validation) | `pages.md` | § PlanningView |
| Wizard booking (étapes 1-6, save logic) | `pages.md` | § BookingsPage |
| TaxiPage (onglets planning/finance/drivers) | `pages.md` | § TaxiPage |
| ActivitiesPage (state, onglets, CRUD) | `pages.md` | § ActivitiesPage |
| DriverSharePage / ActivityProviderSharePage | `pages.md` | § Pages publiques |
| BookingFormPage (form public FR/EN/ES) | `pages.md` | § BookingFormPage |
| SubmissionsPage (file validation admin) | `pages.md` | § SubmissionsPage |
| AccountingPage (21 hooks, sharedData) | `pages.md` | § AccountingPage |

### Composants
| Besoin | Fichier | Section |
|--------|---------|---------|
| Props d'un composant | `components.md` | Section du composant |
| Arbre composants complet | `components.md` | § Arbre de composants |
| Navigation (items, types) | `components.md` | § Navigation |
| PlanningRow (drag, unavailableDays) | `components.md` | § PlanningRow |
| NowView (dining events) | `components.md` | § NowView |
| DriverStatementPanel | `components.md` | § DriverStatementPanel |
| TaxiFinanceTab (manager payments) | `components.md` | § TaxiFinanceTab |
| AccountingDashboard (revenue breakdown) | `components.md` | § AccountingDashboard |
| BookingFinances (paiements, discounts) | `components.md` | § BookingFinances |
| CashFlow (quoi est dans "billed") | `components.md` | § CashFlow |
| Règles archi (module-scope, CELL_W…) | `components.md` | § Règles architecturales |

---

## Par module

| Module | Doc principale | Notes |
|--------|----------------|-------|
| Planning / Grille | `components.md` → PlanningView | CELL_W=32, drag |
| Bookings | `pages.md` → BookingsPage | wizard 6 étapes |
| Clients | `pages.md` → ClientsPage | recherche, filtres, détail |
| Taxis | `pages.md` → TaxiPage + `data-model.md` → taxi | modèle MZN |
| Activities | `pages.md` → ActivitiesPage + `data-model.md` → Activities | modèle EUR bidirectionnel |
| Equipment | `pages.md` → EquipmentPage | |
| Documents | `pages.md` → DocumentsPage | PDF, email (Resend), templates guide |
| Pending Actions | `data-model.md` → § Pending Actions | règles, badge nav, HomePage |
| Email system | `data-model.md` → § Email Logs + `pages.md` → DocumentsPage | Resend, Edge Function, email_logs |
| Accounting | `pages.md` → AccountingPage + `components.md` → Accounting | sharedData pattern |
| Management | `pages.md` → ManagementPage | shared links, pricing |
| Pages publiques | `pages.md` → Pages publiques | 6 types de SharedLink |
| Formulaire public + validation | `pages.md` → BookingFormPage / SubmissionsPage + `data-model.md` → form_submissions | i18n FR/EN/ES, waiver, file admin |
