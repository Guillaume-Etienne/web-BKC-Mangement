# Pages Reference
> Toutes les pages dans `client/src/pages/`
> Routing dans `client/src/App.tsx`

---

## Logique de routing (`App.tsx`)

1. `?share=<token>` dans l'URL → vérifie `shared_links` → affiche page publique (sans auth)
2. `session === undefined` → spinner de chargement
3. `session === null` → `LoginPage`
4. `session` → app authentifiée avec `Navigation` + page switcher
5. Au login : charge en parallèle `bookings` (+ join client), `payments` (4 colonnes), `taxi_trips` (booking_id seul), **count `form_submissions` `pending`** → calcule `pendingActions` via `computePendingActions()` → passe `urgentCount` + **`submissionsCount`** à `Navigation`, `pendingActions` à `HomePage`

**Pages publiques (SharedLinkType) :** → réf. complète + runbooks dans **`taxi-and-shares.md`**
| type | Composant | Props |
|------|-----------|-------|
| `'forecast'` | `ForecastSharePage` | — |
| `'taxi'` | `TaxiSharePage` | — (Public Taxi Schedule, PT/EN, places libres) |
| `'client'` | `ClientSharePage` | `bookingNumber` depuis `sharedLink.params.booking_number` |
| `'driver'` | `DriverSharePage` | `driverId` depuis `sharedLink.params.driver_id` (PT/EN) |
| `'taxi_manager'` | `TaxiManagerSharePage` | — (Geraldo, PT/EN, finances + tous trajets managés) |
| `'activity_provider'` | `ActivityProviderSharePage` | `providerId` depuis `sharedLink.params.provider_id` |
| `'booking_form'` | `BookingFormPage` | — (lien public unique, le client choisit sa langue) |
| `'restaurant'` | `RestaurantSharePage` | — (Hotel Restaurant Planning, PT/EN, timeline des séjours) |

**Pages authentifiées (type `Page`) :**
`'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting' | 'activities' | 'submissions'`

> ⚠️ Le type `Page` est dupliqué dans `App.tsx`, `pendingActions.ts` et `Navigation.tsx` (unions inline) → ajouter une nouvelle page = éditer les 3.

---

## Pages publiques

### `ForecastSharePage`
- **Accès :** `?share=<forecast_token>`
- **But :** Planning instructeurs + locations en lecture seule pour une date donnée
- **Hooks :** `useTable` pour lessons, rentals, instructors, clients, equipment
- **State :** `selectedDate` (défaut : demain), `mobileInstrIdx`
- **Layout :** Grille horaire 8:00–19:00 (30 min/slot, 36px), colonnes instructeurs, panel locations

### `TaxiSharePage`
- **Accès :** `?share=<taxi_token>`
- **But :** Planning taxi groupé par date, lecture seule
- **Hooks :** `useTable` pour TaxiTrip, TaxiDriver, Booking (avec join client)
- **State :** `showPast`, `filterDriver`
- **Layout :** Groupes date → cartes trip (type, client, bagages, statut)

### `ClientSharePage`
- **Accès :** `?share=<client_token>` où le token a `params.booking_number`
- **Props :** `{ bookingNumber: number }`
- **But :** Compte client (hébergement, services, paiements, solde)
- **Data :** Requêtes Supabase directes (booking → rooms → payments → consumptions)
- **Layout :** 4 sections : tableau hébergement, services, paiements, carte solde

### `DriverSharePage`
- **Accès :** `?share=<driver_token>` où le token a `params.driver_id`
- **Props :** `{ driverId: string }`
- **But :** Relevé conducteur (trips à venir + passés avec détails client)
- **Data :** `taxi_drivers` + `taxi_trips` avec join `booking:bookings(client:clients(first_name, last_name))`
- **Layout :** 3 KPI cards (Completed/Upcoming/Total MZN) + 2 tables de trips
- **Colonnes trips :** Date, Time, Route, Client name, Pax, Bags, Boards, Notes, Driver MZN

### `RestaurantSharePage`
- **Accès :** `?share=<restaurant_token>`
- **But :** Timeline mensuelle des séjours (qui part quand) pour la manager du restaurant de l'hôtel — encaisser les notes avant le départ
- **Hooks :** `useTable` bookings (select restreint : id, booking_number, check_in, check_out, status + join clients identité)
- **State :** `lang` (PT défaut/EN via `usePref`), `month` ('YYYY-MM')
- **Layout :** Bandeau « Próximas partidas » (3 jours), nav mois, timeline 1 ligne/booking (`CELL_W = 32`), barres vert/ambre par statut, cap foncé 🧳 = jour de départ, annulés exclus

### `ActivityProviderSharePage`
- **Accès :** `?share=<activity_provider_token>` où le token a `params.provider_id`
- **Props :** `{ providerId: string }`
- **But :** Relevé prestataire activités (planning + compta)
- **Data :** `activity_providers` + `activity_bookings` + `activity_payments`
- **Onglets :**
  - **Planning** (toujours visible) : bookings passés/futurs, filtre par année, prix visibles si `show_prices=true`
  - **Accounting** (seulement si `show_prices=true`) : bilan (center owes you / you owe us), lignes bookings avec flux, historique paiements
- **Filtres :** "All time" + boutons par année

### `BookingFormPage`
- **Accès :** `?share=<booking_form_token>` (un seul lien public permanent, créé dans Management → Links)
- **But :** Formulaire public d'inscription client (remplace l'import CSV). Le client crée une demande de réservation lui-même.
- **Langues :** trilingue **FR/EN/ES** — sélecteur de drapeaux en haut, défaut = langue navigateur (`detectLang()`). Tous les textes dans `data/formI18n.ts` (`tr.key[lang]`), waiver dans `data/waiver.ts`.
- **Wizard 5 étapes** (barre de progression avec kite 🪁, transitions CSS) :
  1. 👤 **Group** — nom référent, email, téléphone, "how did you hear about us"
  2. ✈️ **Trip** — nb nuits Bilene ; bloc **Arrivée** (date+heure vol Maputo + toggle transfert→Bilene + date/heure prise en charge si Oui) ; bloc **Départ** (date+heure vol retour + toggle transfert→aéroport + date/heure dépose si Oui). Le transfert se pré-remplit depuis le vol mais reste éditable.
  3. 🧳 **Logistics** — bagages, bagages kite, lits doubles, lits simples, assurance voyage
  4. 🪂 **Crew** — liste **dynamique** de voyageurs (prénom/nom/passeport)
  5. 🧾 **Finish** — contact d'urgence + waiver déroulant + case obligatoire
- **Validation par étape** (`canProceed`), submit désactivé tant que waiver non coché.
- **Submit :** `supabase.from('form_submissions').insert([...])` (status `pending`, `payload`=`BookingFormPayload` complet + colonnes dénormalisées `reference_name`/`email`/`num_travelers`/`arrival_date`). **PAS de `.select()`** (anon n'a pas de SELECT sur la table). Puis écran de fin 🎉.
- **Composants module-scope** (focus-safe) : `Field`, `Counter`, `YesNo`, `TravelerCard`.

---

## Pages authentifiées

### `LoginPage`
- **Affiché quand :** `session === null`
- **Auth :** `supabase.auth.signInWithPassword()`

### `HomePage`
- **Route :** `'home'`
- **Props :** `{ onNavigate; pendingActions?: PendingAction[] }`
- **But :** Page d'accueil + liste d'actions en attente
- **Pending actions :** liste color-codée (🔴 urgent / 🟡 week / 🟢 monitor), chaque item a un lien vers la page concernée. Calculé dans `App.tsx` au login via `computePendingActions()` (`pendingActions.ts`).

### `PlanningView` *(rendu comme page)*
- **Route :** `'planning'`
- **Fichier :** `components/planning/PlanningView.tsx`
- **Hooks :** useAccommodations, useRooms, useBookings, useBookingRooms, useBookingParticipants, useLessons, useDayActivities, useInstructors, useClients, useEquipment, useEquipmentRentals, **useBookingDrag, useTable<HouseRental>, useTable<PriceItem>**
- **State :** `seasonYear`, `currentTab: 'planning'|'lessons'|'now'|'forecast'`, drag state, **draftMoves (Map), showValidateModal, lessonView, weekStart**
- **Sub-tabs :**
  - `planning` → grille avec BookingBars (draggable)
  - `lessons` → `LessonWeekView`
  - `now` → `NowView` (dining events)
  - `forecast` → `ForecastView`
- **Mutations :**
  - **Drag/resize booking** → Draft mode with validation modal, then bulk apply
  - Lesson/activity/rental CRUD → direct Supabase
- **Important :** Drag operations use draft map, not direct updates. Validation modal before commit.

### `BookingsPage`
- **Route :** `'bookings'`
- **Hooks :** useClients, useBookings, useBookingRooms, **useBookingRoomPrices**, useBookingParticipants, useAccommodations, useRooms, **useTable<HouseRental>**, **useTaxiDrivers**
- **State :** `showWizard`, `wizardStep (1-6)` (not 0-5), `wizardData`, `editingBooking`, `selectedBooking`
- **Wizard steps (1-6):** 1. Client → 2. Stay → 3. Guests → 4. Transport → 5. KiteCenter → 6. Payment
- **Step 2 (Stay) :** Bandeau rouge si `check_in >= check_out` (Next désactivé). **Full house** = ligne de prix unique (défaut 100€, split 50/50 entre les 2 chambres en interne).
- **Step 3 (Guests) :** Gère `booking_participants` — delete-all + re-insert au save. Auto-ajoute le client principal si aucun participant saisi (nouveaux bookings).
- **Step 4 (Transport) :** Si taxi arrivée/départ coché → sélecteur **chauffeur optionnel** (`taxi_driver_id`). Pré-assigne le chauffeur + ses `default_*` aux trajets auto-créés. Nouveaux bookings uniquement.
- **Step 5 (KiteCenter) :** Si `num_center_access > 0` → champ **tarif center access** (`center_access_rate`, €/jour, défaut 5).
- **Save (nouveaux bookings, isNew=true) :**
  1. Upsert client → upsert booking → delete+insert `booking_participants` → delete+insert booking_rooms → delete+insert booking_room_prices
  2. Si `amount_paid > 0` → insert `payments` (`method:'transfer'`, `is_verified:false`, note "Auto-created…")
  3. Trajets taxi : si chauffeur pré-assigné → trajets avec ses tarifs + statut `confirmed` ; sinon prix 0 + statut `needs_details`. `taxi_arrival` → `aero-to-center`@check_in ; `taxi_departure` → `center-to-aero`@check_out

### `ClientsPage`
- **Route :** `'clients'`
- **Props :** `{ onNavigate }`
- **Hooks :** useClients, useBookings
- **State :** `showImport`, `searchTerm`, `filterLevel`, `filterNationality`, `selectedClient`
- **Features :** Recherche/filtres, tiroir détail (infos + historique bookings), import CSV via `ImportCSVModal`

### `TaxiPage`
- **Route :** `'taxis'`
- **Hooks :** useTaxiTrips, useTaxiDrivers, useBookingParticipants, useTable<BookingRef>, useTable<TaxiPricingDefaults>, useTable<SharedLink>, **useTable<TaxiManagerPayment>**
- **State :** `tab: 'planning'|'finance'|'drivers'`, `planningView: 'kanban'|'list'`, `viewingDriverId`
- **Onglets :**
  - `planning` → Kanban/List views for trip management
  - `finance` → Manager payment history and summaries
  - `drivers` → Grid de cartes → sélection → `DriverStatementPanel`. Form chauffeur inclut les **tarifs par défaut** (`default_price_eur` / `default_driver_mzn` / `default_manager_mzn`).
- **DriverStatementPanel :** trips passés/à venir, KPIs MZN, section share link (génère `shared_link` type `'driver'`, params `{ driver_id }`)
- **Modèle financier :** Client paie `price_eur` (EUR fixe par trajet), driver `price_driver_mzn`, manager `margin_manager_mzn` (MZN). **Taux UNIQUE GLOBAL** (`taxi_pricing_defaults.eur_mzn_rate`, réglé dans Management) — plus de taux par trajet. Marge centre affichée par trajet (`computeTaxiMarginEur`). Plus de bandeau migration `schemaOutdated`.

### `EquipmentPage`
- **Route :** `'equipment'`
- **Hooks :** useEquipment, useEquipmentRentals
- **Features :** Inventaire, badges condition, compteur usage, CRUD

### `DocumentsPage`
- **Route :** `'documents'`
- **Hooks :** useBookings, useBookingRooms, useBookingParticipants, useRooms, useAccommodations
- **State :** `tab: 'visa'|'summary'|'guide'|'templates'`, `guideSections` (localStorage `bkc_guide_sections`), `emailLogs`, `logsRefresh`, `sending: EmailLogType|null`
- **Onglets :**
  - `'visa'` → lettre visa (portugais) : sélecteur booking, aperçu dates/guests, Generate PDF + Send email
  - `'summary'` → confirmation réservation : booking, langue (FR/EN/ES), total auto-calculé (9 requêtes parallèles + `compute*`), Generate PDF + Send email
  - `'guide'` → guide voyage : sélecteur booking, langue, toggles sections (is_active), Generate PDF + Send email
  - `'templates'` → éditeur contenu de base des sections guide (toutes langues), 3 boutons Preview PDF (FR/EN/ES)
- **PDF :**
  - `printVisaLetter(booking, participants)`
  - `printBookingSummary(booking, rooms, lang, total, sections, participants)`
  - `printTravelGuide(booking|null, lang, sections)` — `null` pour preview sans booking
- **Email system :** via Edge Function `send-email` (proxy Resend)
  - `SendEmailRow` : champ email pré-rempli depuis `client.email` + bouton Send + `EmailHistory` (3 derniers envois)
  - Types : `visa_letter`, `booking_confirmation`, `travel_guide`
  - Logs fetchés par booking, refresh via compteur `logsRefresh` (incrémenté après envoi réussi)
- **Travel guide sections :** persistées dans `localStorage` (`bkc_guide_sections`), partagées entre onglets Guide et Templates. Fallback sur `defaultTravelGuideSections` si localStorage vide.

### `AccountingPage`
- **Route :** `'accounting'`
- **Hooks :** 21 hooks (useAccommodations, useHouseRentals, useBookings, useBookingParticipants, useClients, useRooms, useBookingRooms, useBookingRoomPrices, useExternalAccommodations, useExternalAccommodationBkgs, useDiningEvents, useLessons, useInstructors, useEquipment, useEquipmentRentals, useTaxiTrips, useActivityBookings, useActivityPayments, useSeasons, usePayments, + états mutables)
- **State :** `tab: 'dashboard'|'bookings'|'instructors'|'houses'|'palmeiras'|'cashflow'|'expenses'|'events'|'unverified'`
- **Pattern :** objet `sharedData` + objet `handlers` passés aux sous-composants
- **Mutations :** state local optimiste + appel Supabase fire-and-forget
- **Onglet "⚠️ To Verify"** — liste les `payments` où `is_verified=false`. Badge count sur l'onglet.

### `ManagementPage`
- **Route :** `'management'`
- **Hooks :** useInstructors, useLessons, useTable<PriceItem>, useTable<TaxiPricingDefaults>, useTable<SharedLink>, useBookings, useBookingParticipants
- **State :** `tab: 'instructors'|'houses'|'pricing'|'links'|'bookguest'`
- **Onglets :** Instructors CRUD, Houses, Pricing (items + taxi defaults), Shared links, Bookings & Guests
- **Shared links :** formulaire manuel pour types `forecast`, `taxi`, `client`, **`booking_form`**.
  `driver` et `activity_provider` exclus (créés depuis leurs pages dédiées). `booking_form` = lien public du formulaire d'inscription (un seul suffit).
- **`LINK_TYPE_LABELS`** : utilisé pour afficher le type dans la liste, inclut les 6 types.

### `SubmissionsPage`
- **Route :** `'submissions'` — nav item "Submissions" 📝 avec **badge bleu** = nombre de soumissions `pending`.
- **Hooks :** `useTable<FormSubmission>('form_submissions', { order: 'submitted_at', ascending: false })`
- **But :** File de validation des soumissions du `BookingFormPage`.
- **State :** `tab: 'pending'|'approved'|'rejected'` (défaut pending), `openId` (ligne dépliée).
- **Détail (`SubmissionDetail`, module-scope) :** affiche tout le `payload` (trip + transferts taxi avec date/heure, logistics, crew, contact urgence, waiver). Champs date `check_in`/`check_out` Bilene **pré-remplis** (`country_entry_date` + `nights_bilene`) et **éditables** avant création.
- **« Create booking » :** crée séquentiellement `clients` (nom splitté, email, phone, emergency_*, `import_id = submission.id`) → `bookings` (status `provisional`, `visa_entry/exit_date` = dates pays, `check_in/out` confirmés, taxis, `couples_count`=double_beds, `has_travel_insurance`, `waiver_accepted_at`/`waiver_version`, `referral_source`, transferts + lits simples dans les **notes**, `import_id`) → `booking_participants` (1/voyageur). Puis soumission → `approved` + `created_booking_id`. **Anti-doublon** : bouton désactivé si `created_booking_id` déjà set.
- **« Reject » :** soumission → `rejected`.

### `ActivitiesPage`
- **Route :** `'activities'`
- **Hooks :** useActivityProviders, useActivityBookings, useActivityPayments, useBookingParticipants, useTable<BookingRef>, useTable<SharedLink>
- **State :** `tab: 'providers'|'bookings'`, `viewingId`, `showProviderForm`, `editingProvider`, `filterProvider`
- **Onglet Providers :** grille de cartes → sélection → `ProviderPanel` avec KPIs financiers, liste bookings, liste paiements, share link
- **Onglet Bookings :** tableau de tous les bookings filtrables par prestataire
- **ProviderPanel :** CRUD bookings + paiements, section share link (génère `shared_link` type `'activity_provider'`, params `{ provider_id }`)
- **show_prices toggle :** sur le form provider, contrôle la visibilité de l'onglet Accounting sur la page publique
- **Formulaires module-scope :** `ProviderForm`, `BookingForm` (avec participant picker), `PaymentForm`
