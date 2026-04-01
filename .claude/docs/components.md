# Components Reference
> Tous les composants dans `client/src/components/`

---

## Layout

### `Navigation` — `layout/Navigation.tsx`
**Props :** `{ currentPage: Page; onNavigate: (p: Page) => void; onLogout: () => void; urgentCount?: number }`
- Navbar sticky top : logo, 10 items, bouton sign out
- Mobile : hamburger → dropdown
- **Items :** Home, Clients, Planning, Bookings, Accounting, Documents, Options, Equipment, Taxis, Activities
- **Badge Home :** si `urgentCount > 0`, badge rouge sur le bouton Home avec le compte d'actions urgentes (vient de `computePendingActions` dans `App.tsx`)
- State : `mobileMenuOpen: boolean`

---

## Planning

### `PlanningView` — `planning/PlanningView.tsx`
*(Utilisé comme page, pas de props — hooks directs)*
- Grille planning horizontale Sep→Mar
- 4 sub-tabs : planning (grille), lessons (LessonWeekView), now (NowView), forecast (ForecastView)
- Gère : sélecteur d'année, drag state (`useBookingDrag`), mutations Supabase
- Rend : PlanningRow × N, TotalsRow × 3, composant sub-tab

### `PlanningRow` — `planning/PlanningRow.tsx`
**Props :** `{ roomId, label, totalDays, seasonStart, bookings, bookingParticipants: BookingParticipant[], dragState, onPointerDown, unavailableDays?: Set<number> }`
- Une ligne grille pour une chambre (label + colonnes jour + barres booking)
- `CELL_W = 32px` par jour. Highlighting weekend. Poignées drag sur les bords.
- `unavailableDays` (optional): Set de day-of-season indices pour highlighting unavailable periods
- Utilise `bookingParticipants.filter(p => p.booking_id === b.id).length` pour les badges
- Entièrement contrôlé (pas d'état interne)

### `BookingBar` — `planning/BookingBar.tsx`
**Props :** `{ booking, startCol, endCol, totalDays }`
- Barre colorée : confirmed=emerald, provisional=amber, cancelled=gray
- Nom client tronqué, tooltip avec détails
- Positionnement CSS grid

### `TotalsRow` — `planning/TotalsRow.tsx`
**Props :** `{ label, totalDays, seasonStart, bookings, bookingParticipants: BookingParticipant[], type: 'lessons'|'equipment'|'guests' }`
- Ligne résumé avec comptes journaliers
- Emerald si > 0, gray si 0. Highlighting weekend.

### `LessonWeekView` — `planning/LessonWeekView.tsx`
*(Props : données des hooks + callbacks mutations + `bookingParticipants: BookingParticipant[]` + `clients: Client[]`)*
- Navigateur semaine (Lun–Dim)
- 3 slots/jour (morning, afternoon, evening)
- Modals add/edit lesson, activity, rental
- ⚠️ Formulaires définis au **scope module** (pas dans le render) pour éviter la perte de focus

### `NowView` — `planning/NowView.tsx`
**Props :** `{ bookings: Booking[]; bookingParticipants: BookingParticipant[]; bookingRooms: BookingRoom[]; rooms: Room[]; accommodations: Accommodation[]; instructors: Instructor[] }` + `useTable<DiningEvent>` interne
- Éditeur d'événements dining pour le sub-tab "Now"
- Sélecteur de date (±1 jour)
- EventType : `'count'` (effectif) ou `'menu'` (champs par personne)
- Calcule room_label des participants à partir de bookingRooms/rooms/accommodations
- ⚠️ Formulaires au **scope module**

### `ForecastView` — `planning/ForecastView.tsx`
*(Props : données des hooks + callbacks mutations)*
- Grille horaire instructeurs (même layout que ForecastSharePage mais éditable)
- Sélecteur de date, colonnes instructeurs, blocs de leçons (couleur par type)
- Modal add/edit leçon

---

## Taxi

### `TaxiListView` — `taxi/TaxiListView.tsx`
**Props :**
```ts
{
  trips: TaxiTrip[]; drivers: TaxiDriver[]; bookings: BookingRef[]
  bookingParticipants: BookingParticipant[]
  pricingDefaults: TaxiPricingDefaults  // always present (required)
  onAddTrip: (t: Omit<TaxiTrip,'id'>) => Promise<TaxiTrip|null>
  onUpdateTrip: (t: TaxiTrip) => Promise<void>
  onDeleteTrip: (id: string) => Promise<void>
  onUpdateRate: (rate: number) => void
}
```
- Tableau récapitulatif (done vs. planned : client MZN, EUR, driver, manager, centre)
- Tableau trips : date, heure, type, driver, client, statut, personnes, bagages, financials
- Add → modal pré-rempli avec `pricingDefaults`
- Badges statut : confirmed=gray, needs_details=red, done=green

### `TaxiKanbanView` — `taxi/TaxiKanbanView.tsx`
**Props :** Identiques à TaxiListView
- 3 colonnes : Confirmed / Needs Details / Done
- Drag carte entre colonnes → update `status`

### `TaxiFinanceTab` — `taxi/TaxiFinanceTab.tsx`
**Props :** `{ trips: TaxiTrip[]; onAddPayment; onUpdatePayment; onDeletePayment }`
- Onglet Finance pour TaxiPage
- Manager payment history (tableau des paiements)
- Summaries par statut (completed, pending, total)
- ⚠️ Module-scope form `AddPaymentForm` pour mutations manager payments

### `DriverStatementPanel` — `taxi/DriverStatementPanel.tsx`
**Props :** `{ driver, trips, driverLink: SharedLink|null, onGenerateLink, onEdit, onDelete }`
- 3 KPI cards : Completed / Upcoming / Total (MZN)
- Tables trips passés et à venir (date, heure, route, client, pax, bags, boards, notes, MZN)
- Section share link : bouton "Generate link" → URL + Copy + Open
- Génère un `shared_link` de type `'driver'` avec `params.driver_id`

---

## Clients

### `ImportCSVModal` — `clients/ImportCSVModal.tsx`
**Props :**
```ts
{
  existingClients: Client[]; existingBookings: Booking[]
  nextBookingNumber: number
  onImport: (newClients: Client[], newBookings: Booking[]) => void
  onClose: () => void
}
```
- Wizard 4 étapes : Choisir fichier → Réviser lignes → Résoudre conflits → Confirmer
- Parse CSV Google Forms → extrait données client + booking
- Clé dedup : `import_id` (timestamp Google Forms)

---

## Accounting

Tous les composants accounting partagent :
- **Pattern Props :** `{ data: SharedAccountingData }` ou `{ data, handlers: AccountingHandlers }`
- **Utils :** `components/accounting/utils.ts` — fonctions compute + `fmtEur()`, `fmtMonth()`
- **Types :** `components/accounting/types.ts` — SharedAccountingData, AccountingHandlers

### `AccountingDashboard` — `accounting/AccountingDashboard.tsx`
**Props :** `{ data }`
- KPI cards : Total revenue, Collected, Outstanding
- Ventilation revenus : Accommodation / Lessons / Equipment / Taxis / Activities / Events
- Coûts : instructor costs, taxi net margin, Palmeiras net, expenses
- Bandeau net result
- Liste des soldes instructeurs
- Pas de mutations

### `BookingFinances` — `accounting/BookingFinances.tsx`
**Props :** `{ data, handlers }`
- Liste bookings avec totaux (dû / payé / solde)
- Clic booking → détail : hébergement, leçons, locations, taxis, dining
- Liste paiements : add / edit (✏️) / delete (✕) ; badge vérifié ; lignes discount en violet
- **Formulaires module-scope :** `PaymentForm`, `DiscountForm`, `EditRentalForm`, `LessonRateForm`
- Boutons `+ Payment` (bleu) et `+ Discount` (violet)
- Section "Unlinked taxi trips" (amber) pour les trips sans booking_id

### `UnverifiedPayments` — `accounting/UnverifiedPayments.tsx`
**Props :** `{ data, handlers }`
- Tableau de tous les `payments` où `is_verified=false`, trié par date
- Colonnes : date, booking #, client, méthode, montant, notes, bouton "✓ Verify"
- Footer : total non-vérifié
- État vide : "✅ All payments have been verified."

### `InstructorPayroll` — `accounting/InstructorPayroll.tsx`
**Props :** `{ data, handlers }`
- Liste instructeurs : earned / debts / paid / balance (code couleur)
- Clic → tiroir détail : liste leçons, dettes, paiements, formulaires add dette/paiement
- Overrides de taux de leçon (par leçon, avec note obligatoire)

### `PalmeirasTab` — `accounting/PalmeirasTab.tsx`
**Props :** `{ data, handlers }`
- Sélecteur de mois
- 4 sub-tabs : Rent | Reversals | Sub-lets | Free Entries
- Résumé mensuel en bas

### `CashFlow` — `accounting/CashFlow.tsx`
**Props :** `{ data }`
- Sélecteur de période : month / season / custom
- Types de chart : bars / diverging / line
- Tableau mensuel : billed (incl. activités), collected, palmIn, expenses, rent, instrPaid, net
- "Billed" inclut : booking totals + taxi standalone + activity net margin par mois
- Pas de mutations

### `ExpensesTab` — `accounting/ExpensesTab.tsx`
**Props :** `{ data, handlers }`
- 2 vues : List (tableau + filtres) / Summary (matrice mois × catégorie)
- Catégories free-form, liste par défaut `DEFAULT_CATEGORIES`
- Form `AddExpenseForm` au scope module

### `EventsTab` — `accounting/EventsTab.tsx`
**Props :** `{ data, handlers }`
- Gestion des dining events
- CRUD events + attendees

### `HousesTab` (accounting) — `accounting/HousesTab.tsx`
**Props :** `{ data, handlers }`
- Locations de maisons (house_rentals)
- Tarifs par chambre (room_rates)

---

## Management

### `HousesTab` (management) — `management/HousesTab.tsx`
**Props :** `{ accommodations, rooms, ... }`
- Gestion des maisons et bungalows
- Add/edit/toggle active

---

## Kite Level Display

Utilisé dans ClientsPage, BookingsPage, ManagementPage :
| Value | Label | Couleur |
|-------|-------|---------|
| `beg-total` | Beg-Total | lime |
| `beg-bodydrag` | Beg-BodyDrag | green |
| `beg-waterstart` | Beg-WaterStart | emerald |
| `intermediate` | Intermediate | blue |
| `advanced` | Advanced | purple |

---

## Règles architecturales clés

1. **Formulaires au scope module** — tout composant avec des inputs texte qui re-rend sur changement de state DOIT définir le composant formulaire hors de la fonction parent pour éviter la perte de focus à chaque frappe
2. **Mise à jour optimiste** — pour les mutations : update state local immédiatement, appel Supabase fire-and-forget (sans await)
3. **Pattern refresh()** — après insert/update/delete dans TaxiPage, ManagementPage, ActivitiesPage (pas d'état local mutable) : `await supabase...` puis `refresh()`
4. **`useEffect` sync** — quand les données du hook alimentent un state local mutable : `useEffect(() => setState(data), [data])`
5. **`CELL_W = 32`** — px par colonne jour dans la grille planning (doit correspondre au Tailwind `w-8`)

---

## Arbre de composants

```
App
├── LoginPage
├── Navigation (10 items)
└── [pages]
    ├── HomePage
    ├── PlanningView
    │   ├── PlanningRow[] → BookingBar[]
    │   ├── TotalsRow[]
    │   ├── LessonWeekView   (sub-tab 'lessons')
    │   ├── NowView          (sub-tab 'now')
    │   └── ForecastView     (sub-tab 'forecast')
    ├── BookingsPage  (wizard 6 étapes)
    ├── ClientsPage → ImportCSVModal
    ├── TaxiPage
    │   ├── TaxiListView | TaxiKanbanView  (onglet 'planning')
    │   └── DriverStatementPanel           (onglet 'drivers')
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
    ├── ManagementPage → HousesTab (management)
    ├── ActivitiesPage            (onglets providers + bookings)
    ├── ForecastSharePage         (public)
    ├── TaxiSharePage             (public)
    ├── ClientSharePage           (public)
    ├── DriverSharePage           (public)
    └── ActivityProviderSharePage (public)
```
