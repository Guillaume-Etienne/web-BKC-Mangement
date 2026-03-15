# Components Reference
> All components in `client/src/components/`

---

## Layout

### `Navigation` — `layout/Navigation.tsx`
**Props:** `{ currentPage: Page; onNavigate: (p: Page) => void; onLogout: () => void }`
- Top sticky navbar: logo, 9 nav items, sign out button
- Mobile: hamburger → dropdown
- State: `mobileMenuOpen: boolean`

---

## Planning

### `PlanningView` — `planning/PlanningView.tsx`
*(Used as a page, no props — uses hooks directly)*
- Main planning grid: horizontal timeline Sep→Mar
- 4 sub-tabs: planning (grid), lessons (LessonWeekView), now (NowView), forecast (ForecastView)
- Manages: season year selector, drag state (`useBookingDrag`), Supabase mutations
- Renders: PlanningRow × N, TotalsRow × 3, sub-tab component

### `PlanningRow` — `planning/PlanningRow.tsx`
**Props:** `{ roomId, label, totalDays, seasonStart, bookings, bookingParticipants: BookingParticipant[], dragState, onPointerDown }`
- One grid row for one room (label + day columns + booking bars)
- `CELL_W = 32px` per day. Weekend highlighting. Drag handles on booking edges.
- Uses `bookingParticipants.filter(p => p.booking_id === b.id).length` for guest count badges
- Fully controlled (no internal state)

### `BookingBar` — `planning/BookingBar.tsx`
**Props:** `{ booking, startCol, endCol, totalDays }`
- Colored bar: confirmed=emerald, provisional=amber, cancelled=gray
- Truncated client name, tooltip with details
- CSS grid positioning

### `TotalsRow` — `planning/TotalsRow.tsx`
**Props:** `{ label, totalDays, seasonStart, bookings, bookingParticipants: BookingParticipant[], type: 'lessons'|'equipment'|'guests' }`
- Summary row with daily counts per day column
- Emerald if > 0, gray if 0. Weekend highlighting.
- `type='guests'`: counts via `bookingParticipants.filter(p => p.booking_id === booking.id).length`

### `LessonWeekView` — `planning/LessonWeekView.tsx`
*(Props: hooks-derived data + mutation callbacks + `bookingParticipants: BookingParticipant[]` + `clients: Client[]`)*
- Week navigator (Mon–Sun)
- 3 slots/day (morning, afternoon, evening)
- List lessons/activities/rentals per slot
- Modals: add/edit lesson, add/edit activity, add/edit rental
- ⚠️ Forms defined at **module scope** (not inside render) to avoid focus loss

**Key helper functions:**
- `activeParticipantsForDate(date)` — returns participants from bookings active on that date (`check_in <= date <= check_out`). Falls back to all `bookingParticipants` if none found.
- `bookingForParticipant(participantId)` — returns booking_id for a participant
- `bookingClient(bookingId)` — returns display name from booking's client (fallback when no participant linked)

**Participant display in lessons/rentals:**
1. Look up `BookingParticipant` by `participant_ids[0]` or `participant_id`
2. Fall back to `bookingClient(booking_id)` if not found

**Rental edit modal** — fully expanded fields: guest selector (BookingParticipant), type buttons (kite/board/surfboard/foilboard), equipment selectors, slot (morning/afternoon/full_day), price, notes. Derives type from `equipment.category`.

### `NowView` — `planning/NowView.tsx`
**Props:** `{ instructors: Instructor[]; bookingParticipants: BookingParticipant[] }` + internal `useTable<DiningEvent>`
- Dining event editor for the "Now" sub-tab
- Date picker (±1 day)
- Event list → select → attendee table
- EventType: `'count'` (headcount) or `'menu'` (per-person menu fields)
- Attendee: toggle attending, price override, menu fields (starter/main/side/dessert)
- ⚠️ All sub-forms at **module scope**
- Mutations: fire-and-forget to `dining_events` table

### `ForecastView` — `planning/ForecastView.tsx`
*(Props: hooks-derived data + mutation callbacks)*
- Instructor schedule time grid (same layout as ForecastSharePage but editable)
- Date picker, instructor columns, lesson blocks (color by type)
- Rentals panel (slot-based)
- Add/edit lesson modal
- Mobile: instructor carousel

---

## Taxi

### `TaxiListView` — `taxi/TaxiListView.tsx`
**Props:**
```ts
{
  trips: TaxiTrip[]; drivers: TaxiDriver[]; bookings: BookingRef[]
  bookingParticipants: BookingParticipant[]
  pricingDefaults: TaxiPricingDefaults | null
  onAddTrip: (t: Omit<TaxiTrip,'id'>) => Promise<TaxiTrip|null>
  onUpdateTrip: (t: TaxiTrip) => Promise<void>
  onDeleteTrip: (id: string) => Promise<void>
  onUpdateRate: (rate: number) => void
}
```
- Summary table (done vs. planned: client MZN, EUR, driver, manager, centre)
- Trip table: date, time, type, driver, guest, status, persons, luggage, financials
- Guest count: `bookingParticipants.filter(p => p.booking_id === b.id).length || 1`
- Add → opens modal pre-filled with `pricingDefaults`
- Status badges: confirmed=gray, needs_details=red, done=green

### `TaxiKanbanView` — `taxi/TaxiKanbanView.tsx`
**Props:** Same as TaxiListView (including `bookingParticipants`)
- 3 columns: Confirmed / Needs Details / Done
- Drag card between columns → updates `status` via `onUpdateTrip`
- Same summary table as ListView
- Same modal for add/edit

---

## Clients

### `ImportCSVModal` — `clients/ImportCSVModal.tsx`
**Props:**
```ts
{
  existingClients: Client[]; existingBookings: Booking[]
  nextBookingNumber: number
  onImport: (newClients: Client[], newBookings: Booking[]) => void
  onClose: () => void
}
```
- 4-step wizard: Pick file → Review rows → Resolve conflicts → Confirm
- Parses Google Forms CSV → extracts client + booking data
- Dedup key: `import_id` (Google Forms timestamp)
- Conflict: same import_id → choose keep/replace

---

## Accounting

All accounting components share:
- **Props pattern:** `{ data: SharedAccountingData }` or `{ data, handlers: AccountingHandlers }`
- **Utils:** `components/accounting/utils.ts` — compute functions + `fmtEur()`, `fmtMonth()`
- **Types:** `components/accounting/types.ts` — SharedAccountingData, AccountingHandlers

### `AccountingDashboard` — `accounting/AccountingDashboard.tsx`
**Props:** `{ data }`
- KPI cards: revenue by category (accommodation, lessons, rentals, taxis)
- Collections progress (due vs. paid)
- Instructor balances list
- Palmeiras net
- Net result
- No mutations

### `BookingFinances` — `accounting/BookingFinances.tsx`
**Props:** `{ data, handlers }`
- Booking list with totals (due / paid / balance)
- Click booking → detail: room breakdown, lesson breakdown, rentals, taxis, dining
- Payment list: add / edit (✏️) / delete (✕); verified badge (✓ green / ⚠ orange); discount lines in purple
- **Module-scope forms:** `PaymentForm` (add+edit, `is_verified` checkbox), `DiscountForm` (amount + reason), `EditRentalForm`, `LessonRateForm`
- Buttons: `+ Payment` (blue) and `+ Discount` (purple) — mutually exclusive with add forms
- Guest count: `data.bookingParticipants.filter(p => p.booking_id === b.id).length`

### `UnverifiedPayments` — `accounting/UnverifiedPayments.tsx`
**Props:** `{ data, handlers }`
- Table of all `payments` where `is_verified=false`, sorted by date
- Columns: date, booking #, client, method, amount, notes, "✓ Verify" button
- Footer: total unverified amount
- Empty state: "✅ All payments have been verified."

### `InstructorPayroll` — `accounting/InstructorPayroll.tsx`
**Props:** `{ data, handlers }`
- Instructor list: earned / debts / paid / balance (color-coded)
- Click → detail drawer: lesson list, debts, payments, add debt/payment forms
- Lesson rate overrides (per-lesson rate override with required note)
- Forms at module scope

### `PalmeirasTab` — `accounting/PalmeirasTab.tsx`
**Props:** `{ data, handlers }`
- Month selector
- 4 sub-tabs: Rent | Reversals | Sub-lets | Free Entries
- Rent: add/edit monthly rent
- Reversals: gross × % → auto-calc net
- Sub-lets: bungalow track (cost vs. sell margin)
- Free Entries: income/expense free-form lines
- Monthly summary at bottom

### `CashFlow` — `accounting/CashFlow.tsx`
**Props:** `{ data }`
- Period selector: month / season / custom date range
- Chart type: bars / diverging / line
- Monthly table: billed, collected, palmIn, expenses, rent, instrPaid, net
- No mutations

### `ExpensesTab` — `accounting/ExpensesTab.tsx`
**Props:** `{ data, handlers }`
- 2 views: List (table + filters) / Summary (matrix month × category)
- Categories: free-form strings, default list `DEFAULT_CATEGORIES` (Equipment, Maintenance, Transport, Staff, Admin, Other)
- Add/delete expenses
- Category PALETTE: 10 colors (cyclic)
- Form `AddExpenseForm` at module scope

---

## Kite Level Display

`KiteLevel` values used in ClientsPage, BookingsPage, ManagementPage:
| Value | Label | Color |
|-------|-------|-------|
| `beg-total` | Beg-Total | lime |
| `beg-bodydrag` | Beg-BodyDrag | green |
| `beg-waterstart` | Beg-WaterStart | emerald |
| `intermediate` | Intermediate | blue |
| `advanced` | Advanced | purple |

---

## Key Architectural Rules

1. **Module-scope forms** — any component with text inputs that re-renders on state change MUST define the form component outside the parent render function to avoid focus loss on keystroke
2. **Optimistic updates** — for mutations: update local state immediately, fire-and-forget Supabase call (no await)
3. **`refresh()` pattern** — after insert/update/delete in TaxiPage and ManagementPage (non-optimistic): call `refresh()` from hook after awaiting Supabase
4. **`useEffect` sync** — when hook data feeds local mutable state: `useEffect(() => setState(data), [data])`
5. **`CELL_W = 32`** — px per day column in planning grid (must match Tailwind `w-8`)

---

## Component Tree

```
App
├── LoginPage
├── Navigation
└── [pages]
    ├── HomePage
    ├── PlanningView
    │   ├── PlanningRow[] → BookingBar[]
    │   ├── TotalsRow[]
    │   ├── LessonWeekView  (sub-tab 'lessons')
    │   ├── NowView         (sub-tab 'now')
    │   └── ForecastView    (sub-tab 'forecast')
    ├── BookingsPage  (6-step wizard)
    ├── ClientsPage → ImportCSVModal
    ├── TaxiPage → TaxiListView | TaxiKanbanView
    ├── EquipmentPage
    ├── DocumentsPage
    ├── AccountingPage
    │   ├── AccountingDashboard
    │   ├── BookingFinances
    │   ├── InstructorPayroll
    │   ├── HousesTab
    │   ├── PalmeirasTab
    │   ├── CashFlow
    │   ├── ExpensesTab
    │   ├── EventsTab
    │   └── UnverifiedPayments
    ├── ManagementPage
    ├── ForecastSharePage  (public)
    ├── TaxiSharePage      (public)
    └── ClientSharePage    (public)
```
