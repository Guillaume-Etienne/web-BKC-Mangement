# Pages Reference
> All pages in `client/src/pages/`
> Routing in `client/src/App.tsx`

---

## Routing Logic (`App.tsx`)

1. `?share=<token>` in URL → check `shared_links` table → show public page (no auth)
2. `session === undefined` → loading spinner
3. `session === null` → `LoginPage`
4. `session` → authenticated app with `Navigation` + page switcher

**Public pages (SharedLinkType):**
| type | Component |
|------|-----------|
| `'forecast'` | `ForecastSharePage` |
| `'taxi'` | `TaxiSharePage` |
| `'client'` | `ClientSharePage` (props: `bookingNumber` from `sharedLink.params.booking_number`) |

**Authenticated pages (Page union):**
`'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting'`

---

## Public Pages

### `ForecastSharePage`
- **Access:** `?share=<forecast_token>`
- **Purpose:** Read-only instructor schedule + rentals for a given date
- **Hooks:** `useTable` for lessons, rentals, instructors, clients, equipment
- **Key state:** `selectedDate` (default: tomorrow), `mobileInstrIdx`
- **Layout:** Time grid 8:00–19:00 (30-min slots, 36px each), instructor columns, rentals panel

### `TaxiSharePage`
- **Access:** `?share=<taxi_token>`
- **Purpose:** Read-only taxi schedule grouped by date
- **Hooks:** `useTable` for TaxiTrip, TaxiDriver, Booking (with client join)
- **Key state:** `showPast`, `filterDriver`
- **Layout:** Date groups → trip cards (type, guest, luggage, status)

### `ClientSharePage`
- **Access:** `?share=<client_token>` where token has `params.booking_number`
- **Props:** `{ bookingNumber: number }`
- **Purpose:** Client-facing booking account (accommodation, services, payments, balance)
- **Data:** Direct supabase queries (booking → rooms → payments → consumptions)
- **Layout:** 4 sections: Accommodation table, Services table, Payments table, Balance card

---

## Authenticated Pages

### `LoginPage`
- **Shown when:** `session === null`
- **Auth:** `supabase.auth.signInWithPassword()`

### `HomePage`
- **Route:** `'home'`
- **Props:** `{ onNavigate }`
- **Purpose:** Landing page with navigation cards (static)

### `PlanningView` *(rendered as page)*
- **Route:** `'planning'`
- **File:** `components/planning/PlanningView.tsx`
- **Hooks:** useAccommodations, useRooms, useBookings, useBookingRooms, useBookingParticipants, useLessons, useDayActivities, useInstructors, useClients, useEquipment, useEquipmentRentals
- **Key state:** `seasonYear`, `currentTab: 'planning'|'lessons'|'now'|'forecast'`, drag state
- **Sub-tabs:**
  - `planning` → grid with BookingBars (draggable)
  - `lessons` → `LessonWeekView`
  - `now` → `NowView` (dining events)
  - `forecast` → `ForecastView`
- **Mutations:** booking drag/resize → supabase update; lesson/activity/rental CRUD

### `BookingsPage`
- **Route:** `'bookings'`
- **Hooks:** useClients, useBookings, useBookingRooms, useBookingParticipants, useAccommodations, useRooms
- **Key state:** `showWizard`, `wizardStep (0-5)`, `wizardData`, `editingBooking`, `selectedBooking`
- **Wizard steps:** Client → Stay → Guests → Transport → KiteCenter → Payment
- **Wizard step 3 (Guests):** manages `booking_participants` — delete-all + re-insert on save. Auto-adds main client if no participants entered (new bookings). Falls back to main client in `bookingToWizard` for old bookings.
- **Save (new bookings only — isNew=true):**
  1. Upsert client → upsert booking → delete+insert `booking_participants` → delete+insert booking_rooms → delete+insert booking_room_prices
  2. If `amount_paid > 0` → insert `payments` (`method:'transfer'`, `is_verified:false`, `is_discount:false`, note "Auto-created from booking — to verify")
  3. If `taxi_arrival` → insert `taxi_trips` (`type:'aero-to-center'`, `date:check_in`, `start_time:arrival_time||'00:00'`, `status:'needs_details'`, nb_persons/luggage/boardbags from booking)
  4. If `taxi_departure` → insert `taxi_trips` (`type:'center-to-aero'`, `date:check_out`, `start_time:departure_time||'00:00'`)
- **WizardData.participants:** `{ id, first_name, last_name, passport_number, kite_level, client_id }[]`

### `ClientsPage`
- **Route:** `'clients'`
- **Props:** `{ onNavigate }`
- **Hooks:** useClients, useBookings
- **Key state:** `showImport`, `searchTerm`, `filterLevel`, `filterNationality`, `selectedClient`
- **Features:** Search/filter, detail drawer (info + booking history), CSV import via `ImportCSVModal`

### `TaxiPage`
- **Route:** `'taxis'`
- **Hooks:** useTaxiTrips, useTaxiDrivers, useBookingParticipants, useTable<BookingRef>(`bookings`, select for picker), useTable<TaxiPricingDefaults>
- **Key state:** `tab: 'planning'|'drivers'`, `planningView: 'kanban'|'list'`, `pricingDefaults`
- **Sub-components:** TaxiListView or TaxiKanbanView, Driver form modal
- **Financial rule:** `price_driver_mzn = price_client_mzn - margin_manager_mzn - margin_centre_mzn`

### `EquipmentPage`
- **Route:** `'equipment'`
- **Hooks:** useEquipment, useEquipmentRentals
- **Key state:** editModal, filters
- **Features:** Inventory list, condition badges, usage count, add/edit/delete

### `DocumentsPage`
- **Route:** `'documents'`
- **Hooks:** useBookings (with client join), useBookingRooms, useBookingParticipants, useRooms, useAccommodations
- **Key state:** `tab: 'visa'|'summary'|'guide'`, travelGuideSections
- **PDF generation:** `printVisaLetter(booking, participants)` and `printBookingSummary(...)` → `window.open()` + browser print
- **Visa letter:** participants shown with passport numbers from `bookingParticipants` (⚠ if none listed)
- **Travel guide:** 6 sections, 3 languages (en/fr/es), state not persisted to DB yet

### `AccountingPage`
- **Route:** `'accounting'`
- **Hooks:** 19 hooks total (see components.md for full list)
- **Key state:** `tab: 'dashboard'|'bookings'|'instructors'|'houses'|'palmeiras'|'cashflow'|'expenses'|'events'|'unverified'`
- **Pattern:** `sharedData` object + `handlers` object passed to sub-components
- **Mutations:** optimistic local state + fire-and-forget supabase call
- **Tab "⚠️ To Verify"** — lists all `payments` where `is_verified=false`. Badge count on tab. `verifyPayment(id)` handler sets `is_verified=true` optimistically.

### `ManagementPage`
- **Route:** `'management'`
- **Hooks:** useInstructors, useLessons, useTable<PriceItem>, useTable<TaxiPricingDefaults>, useTable<SharedLink>, useBookings, useBookingParticipants
- **Key state:** `tab: 'instructors'|'houses'|'pricing'|'links'|'bookguest'`
- **Tabs:** Instructors CRUD, Houses, Pricing (items + taxi defaults), Shared links, Bookings & Guests
- **Shared link creation:** type 'client' requires `booking_number` field → stored in `params`
- **Tab "👥 Bookings & Guests"** — filters (All/Active/Upcoming/Past + status), search, stats (active now / upcoming / confirmed), per-booking dropdown listing participants with kite level badges
