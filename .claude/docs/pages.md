# Pages Reference
> Toutes les pages dans `client/src/pages/`
> Routing dans `client/src/App.tsx`

---

## Logique de routing (`App.tsx`)

1. `?share=<token>` dans l'URL → vérifie `shared_links` → affiche page publique (sans auth)
2. `session === undefined` → spinner de chargement
3. `session === null` → `LoginPage`
4. `session` → app authentifiée avec `Navigation` + page switcher

**Pages publiques (SharedLinkType) :**
| type | Composant | Props |
|------|-----------|-------|
| `'forecast'` | `ForecastSharePage` | — |
| `'taxi'` | `TaxiSharePage` | — |
| `'client'` | `ClientSharePage` | `bookingNumber` depuis `sharedLink.params.booking_number` |
| `'driver'` | `DriverSharePage` | `driverId` depuis `sharedLink.params.driver_id` |
| `'activity_provider'` | `ActivityProviderSharePage` | `providerId` depuis `sharedLink.params.provider_id` |

**Pages authentifiées (type `Page`) :**
`'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting' | 'activities'`

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

### `ActivityProviderSharePage`
- **Accès :** `?share=<activity_provider_token>` où le token a `params.provider_id`
- **Props :** `{ providerId: string }`
- **But :** Relevé prestataire activités (planning + compta)
- **Data :** `activity_providers` + `activity_bookings` + `activity_payments`
- **Onglets :**
  - **Planning** (toujours visible) : bookings passés/futurs, filtre par année, prix visibles si `show_prices=true`
  - **Accounting** (seulement si `show_prices=true`) : bilan (center owes you / you owe us), lignes bookings avec flux, historique paiements
- **Filtres :** "All time" + boutons par année

---

## Pages authentifiées

### `LoginPage`
- **Affiché quand :** `session === null`
- **Auth :** `supabase.auth.signInWithPassword()`

### `HomePage`
- **Route :** `'home'`
- **Props :** `{ onNavigate }`
- **But :** Page d'accueil avec cartes de navigation (statique)

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
- **Hooks :** useClients, useBookings, useBookingRooms, **useBookingRoomPrices**, useBookingParticipants, useAccommodations, useRooms, **useTable<HouseRental>**
- **State :** `showWizard`, `wizardStep (1-6)` (not 0-5), `wizardData`, `editingBooking`, `selectedBooking`
- **Wizard steps (1-6):** 1. Client → 2. Stay → 3. Guests → 4. Transport → 5. KiteCenter → 6. Payment
- **Step 3 (Guests) :** Gère `booking_participants` — delete-all + re-insert au save. Auto-ajoute le client principal si aucun participant saisi (nouveaux bookings).
- **Save (nouveaux bookings, isNew=true) :**
  1. Upsert client → upsert booking → delete+insert `booking_participants` → delete+insert booking_rooms → delete+insert booking_room_prices
  2. Si `amount_paid > 0` → insert `payments` (`method:'transfer'`, `is_verified:false`, note "Auto-created…")
  3. Si `taxi_arrival` → insert `taxi_trips` (`type:'aero-to-center'`, `date:check_in`, ...)
  4. Si `taxi_departure` → insert `taxi_trips` (`type:'center-to-aero'`, `date:check_out`, ...)

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
  - `drivers` → Grid de cartes → sélection → `DriverStatementPanel`
- **DriverStatementPanel :** trips passés/à venir, KPIs MZN, section share link (génère `shared_link` type `'driver'`, params `{ driver_id }`)
- **Règle financière :** `price_driver_mzn = price_client_mzn - margin_manager_mzn - margin_centre_mzn`

### `EquipmentPage`
- **Route :** `'equipment'`
- **Hooks :** useEquipment, useEquipmentRentals
- **Features :** Inventaire, badges condition, compteur usage, CRUD

### `DocumentsPage`
- **Route :** `'documents'`
- **Hooks :** useBookings, useBookingRooms, useBookingParticipants, useRooms, useAccommodations
- **State :** `tab: 'visa'|'summary'|'guide'`, travelGuideSections
- **PDF :** `printVisaLetter(booking, participants)` et `printBookingSummary(...)` → `window.open()` + browser print
- **Travel guide :** 6 sections, 3 langues (en/fr/es), state non persisté en DB

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
- **Shared links :** formulaire manuel pour types `forecast`, `taxi`, `client` uniquement.
  `driver` et `activity_provider` exclus (créés depuis leurs pages dédiées).
- **`LINK_TYPE_LABELS`** : utilisé pour afficher le type dans la liste, inclut tous les 5 types.

### `ActivitiesPage`
- **Route :** `'activities'`
- **Hooks :** useActivityProviders, useActivityBookings, useActivityPayments, useBookingParticipants, useTable<BookingRef>, useTable<SharedLink>
- **State :** `tab: 'providers'|'bookings'`, `viewingId`, `showProviderForm`, `editingProvider`, `filterProvider`
- **Onglet Providers :** grille de cartes → sélection → `ProviderPanel` avec KPIs financiers, liste bookings, liste paiements, share link
- **Onglet Bookings :** tableau de tous les bookings filtrables par prestataire
- **ProviderPanel :** CRUD bookings + paiements, section share link (génère `shared_link` type `'activity_provider'`, params `{ provider_id }`)
- **show_prices toggle :** sur le form provider, contrôle la visibilité de l'onglet Accounting sur la page publique
- **Formulaires module-scope :** `ProviderForm`, `BookingForm` (avec participant picker), `PaymentForm`
