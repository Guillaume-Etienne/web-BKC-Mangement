# Index rapide — où chercher quoi ?

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
| BookingFormPayload (champs du form) | `data-model.md` | § form_submissions |
| TravelGuideSection (6 sections i18n) | `data-model.md` | § TravelGuideSection |
| EmailLog / EmailLogType / EmailLogStatus | `data-model.md` | § Email Logs |
| PendingAction / ActionPriority / règles | `data-model.md` | § Pending Actions |
| Schéma SQL complet | `supabase/schema.sql` | — |
| Data integrity issues (audit) | `project_accounting_issues.md` | § Issue 1–4 |

### Hooks
| Besoin | Fichier | Section |
|--------|---------|---------|
| Signature d'un hook spécifique | `hooks.md` | Section du hook |
| useTable (générique) | `hooks.md` | § Base Hook |
| useActivityProviders/Bookings/Payments | `hooks.md` | § useActivities.ts |
| useTaxiTrips (normalisation, schemaOutdated) | `hooks.md` | § useTaxis.ts |
| Pattern mutation optimiste | `hooks.md` | § Pattern : données mutables |
| Quand refresh() vs optimistic | `hooks.md` | § Pattern : données mutables |

### Pages
| Besoin | Fichier | Section |
|--------|---------|---------|
| Routing App.tsx (sharedLink → page) | `pages.md` | § Logique de routing |
| Liste des pages publiques + props | `pages.md` | § Pages publiques |
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
| Clients | `pages.md` → ClientsPage | import CSV |
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
