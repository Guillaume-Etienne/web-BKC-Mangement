# Hooks Reference
> All hooks in `client/src/hooks/`

---

## Base Hook

### `useTable<T>` — `useSupabase.ts`
Generic Supabase SELECT hook.

**Signature:**
```ts
useTable<T>(table: string, options?: {
  order?: string
  ascending?: boolean   // default: true
  select?: string       // default: '*'
}): QueryState<T>
```

**Return `QueryState<T>`:**
| Field | Type |
|-------|------|
| data | T[] |
| loading | boolean |
| error | string \| null |
| refresh | () => void |

**Behavior:** Runs on mount, cancellable, supports join selects (e.g. `'*, participants(*)'`).

---

## Domain Hooks

### `useAccommodations.ts`

| Hook | Table | Order | Returns |
|------|-------|-------|---------|
| `useAccommodations()` | `accommodations` | `name` | `QueryState<Accommodation>` |
| `useRooms()` | `rooms` | `name` | `QueryState<Room>` |

---

### `useBookings.ts`

| Hook | Table | Select / Order | Returns |
|------|-------|----------------|---------|
| `useBookings()` | `bookings` | `'*, participants(*)'`, check_in DESC | `QueryState<Booking>` |
| `useBookingRooms()` | `booking_rooms` | default | `QueryState<BookingRoom>` |
| `useBookingRoomPrices()` | `booking_room_prices` | default | `QueryState<BookingRoomPrice>` |
| `usePayments()` | `payments` | date DESC | `QueryState<Payment>` |

---

### `useClients.ts`

| Hook | Table | Order | Returns |
|------|-------|-------|---------|
| `useClients()` | `clients` | `last_name` | `QueryState<Client>` |

---

### `useEquipment.ts`

| Hook | Table | Order | Returns |
|------|-------|-------|---------|
| `useEquipment()` | `equipment` | `name` | `QueryState<Equipment>` |
| `useEquipmentRentals()` | `equipment_rentals` | date DESC | `QueryState<EquipmentRental>` |

---

### `useInstructors.ts`

| Hook | Table | Order | Returns |
|------|-------|-------|---------|
| `useInstructors()` | `instructors` | `last_name` | `QueryState<Instructor>` |

---

### `useLessons.ts`

| Hook | Table | Order | Returns |
|------|-------|-------|---------|
| `useLessons()` | `lessons` | `date` | `QueryState<Lesson>` |
| `useDayActivities()` | `day_activities` | `date` | `QueryState<DayActivity>` |

---

### `useTaxis.ts`

| Hook | Table | Order | Returns |
|------|-------|-------|---------|
| `useTaxiDrivers()` | `taxi_drivers` | `name` | `QueryState<TaxiDriver>` |
| `useTaxiTrips()` | `taxi_trips` | date DESC | `TaxiTripsState` (special) |

**`TaxiTripsState`** (extended return for `useTaxiTrips`):
| Field | Type | Notes |
|-------|------|-------|
| data | TaxiTrip[] | Normalized |
| loading | boolean | |
| error | string \| null | |
| schemaOutdated | boolean | true if old DB columns (pre-MZN migration) |
| refresh | () => void | |

**Normalization** (`normalizeTrip`): maps old column names to new ones, computes `price_eur = round(price_client_mzn / exchange_rate)` if absent.

---

### `useBookingDrag.ts`

Custom hook for drag-and-drop on the planning grid.

**Signature:**
```ts
useBookingDrag(options: {
  onBookingUpdate: (bookingId, dayDelta, mode) => void
  onBookingMove: (bookingId, fromRoomId, toRoomId) => void
  gridRef: React.RefObject<HTMLDivElement | null>
}): {
  dragState: DragState | null
  onPointerDown: (e, bookingId, roomId, mode) => void
  onPointerMove: (e) => void
  onPointerUp: () => void
}
```

**`DragState`:**
```ts
{ bookingId: string; roomId: string; mode: 'move'|'resize-left'|'resize-right'; dayDelta: number; targetRoomId: string | null }
```

**Constants:** `CELL_W = 32` px per day column.
**Behavior:** Tracks mouse px → converts to day units. Detects target room by Y. Fires handlers on pointer up only.

---

## Pattern: Mutable Data in Pages

When a table needs mutations (add/update/delete), the pattern is:
```ts
const { data: fooData, refresh: refreshFoo } = useTable<Foo>('foos')
const [foos, setFoos] = useState<Foo[]>([])
useEffect(() => setFoos(fooData), [fooData])

// Add (optimistic):
setFoos(prev => [...prev, item])
supabase.from('foos').insert([item])

// Update (optimistic):
setFoos(prev => prev.map(x => x.id === item.id ? item : x))
const { id, ...fields } = item
supabase.from('foos').update(fields).eq('id', id)

// Delete (optimistic):
setFoos(prev => prev.filter(x => x.id !== id))
supabase.from('foos').delete().eq('id', id)
```
