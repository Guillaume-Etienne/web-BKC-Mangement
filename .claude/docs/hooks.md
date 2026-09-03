# Hooks Reference
> Tous les hooks dans `client/src/hooks/`

---

## Hook de base

### `useTable<T>` — `useSupabase.ts`
Hook Supabase SELECT générique.

**Signature :**
```ts
useTable<T>(table: string, options?: {
  order?: string
  ascending?: boolean   // défaut : true
  select?: string       // défaut : '*'
}): QueryState<T>
```

**Retour `QueryState<T>` :**
| Field | Type |
|-------|------|
| data | T[] |
| loading | boolean |
| error | string \| null |
| refresh | () => void |

**Comportement :** Se lance au mount, annulable, supporte les select avec joins (e.g. `'*, participants(*)'`).

---

## Hooks domaine

### `useAccommodations.ts`
| Hook | Table | Order | Retourne |
|------|-------|-------|---------|
| `useAccommodations()` | `accommodations` | `name` | `QueryState<Accommodation>` |
| `useRooms()` | `rooms` | `name` | `QueryState<Room>` |

---

### `useBookings.ts`
| Hook | Table | Select / Order | Retourne |
|------|-------|----------------|---------|
| `useBookings()` | `bookings` | `'*, client:clients(first_name, last_name)'`, check_in DESC | `QueryState<Booking>` |
| `useBookingRooms()` | `booking_rooms` | défaut | `QueryState<BookingRoom>` |
| `useBookingRoomPrices()` | `booking_room_prices` | défaut | `QueryState<BookingRoomPrice>` |
| `useBookingParticipants()` | `booking_participants` | created_at ASC | `QueryState<BookingParticipant>` |
| `usePayments()` | `payments` | date DESC | `QueryState<Payment>` |
> ⚠️ `useBookings` ne joint plus participants. Fetcher séparément via `useBookingParticipants()`.

---

### `useClientDossier.ts` *(2026-09-03)*
`useClientDossier(clientId: string | null, bookings: Booking[]): ClientDossier`

Tout ce qui est jamais arrivé à une personne, **chargé seulement quand sa fiche est ouverte**
(requêtes bornées `.in(bookingIds)` — Clients est un écran de liste, tout charger au montage
ferait payer la liste entière pour la seule ligne cliquée).

| Champ | Type | Notes |
|---|---|---|
| events | `DossierEvent[]` | assemblé par `utils/dossier.ts`, plus récent en premier |
| payments | `Payment[]` | la **source de vérité** des paiements, jamais `bookings.amount_paid` |
| bookings | `Booking[]` | ceux de ce client |
| loading / error | | `error` liste ce qui a échoué au chargement — une frise à moitié vide se lit « il ne se passe plus rien » |
| notesTableMissing | boolean | `client_notes` absente (42P01) = migration en attente, **pas** une panne |
| addNote(body) | `Promise<string \| null>` | écrit une note datée ; renvoie le message d'erreur, ou `null` |

⚠️ Dépend de `bookingKey` (les ids joints), **pas** du tableau `bookings` : celui-ci est
recréé à chaque rendu du parent et re-déclencherait le fetch en boucle.

---

### `useClients.ts`
| Hook | Table | Order | Retourne |
|------|-------|-------|---------|
| `useClients()` | `clients` | `last_name` | `QueryState<Client>` |

---

### `useDocumentTemplates.ts`
| Hook | Table | Retourne |
|------|-------|---------|
| `useDocumentSections(docType)` | `document_templates` (filtré `doc_type`, order `sort_order`) | `{ saved, loading, saving, save }` |

- `docType` : `'travel_guide' \| 'welcome_guide'` — `saved: TravelGuideSection[] \| null` (**null = table vide** pour ce doc, l'appelant retombe sur les défauts / localStorage legacy).
- `save(sections)` : upsert (`onConflict: 'doc_type,id'`) + delete des ids disparus, met à jour `saved`. Retourne `null` ou le message d'erreur.
- Utilisé uniquement par DocumentsPage (SaveBar explicite, pas d'autosave).

---

### `useEquipment.ts`
| Hook | Table | Order | Retourne |
|------|-------|-------|---------|
| `useEquipment()` | `equipment` | `name` | `QueryState<Equipment>` |
| `useEquipmentRentals()` | `equipment_rentals` | date DESC | `QueryState<EquipmentRental>` |

---

### `useInstructors.ts`
| Hook | Table | Order | Retourne |
|------|-------|-------|---------|
| `useInstructors()` | `instructors` | `last_name` | `QueryState<Instructor>` |

---

### `useLessons.ts`
| Hook | Table | Order | Retourne |
|------|-------|-------|---------|
| `useLessons()` | `lessons` | `date` | `QueryState<Lesson>` |
| `useDayActivities()` | `day_activities` | `date` | `QueryState<DayActivity>` |

---

### `useTaxis.ts`
| Hook | Table | Order | Retourne |
|------|-------|-------|---------|
| `useTaxiDrivers()` | `taxi_drivers` | `name` | `QueryState<TaxiDriver>` |
| `useTaxiTrips()` | `taxi_trips` | date DESC | `TaxiTripsState` (spécial) |

**`TaxiTripsState`** (retour pour `useTaxiTrips`) :
| Field | Type | Notes |
|-------|------|-------|
| data | TaxiTrip[] | Mapping direct du row Supabase (pas de normalisation) |
| loading | boolean | |
| error | string \| null | |
| refresh | () => void | |

> Mai 2026 : `normalizeTrip` (fallback legacy) et le flag `schemaOutdated` ont été supprimés — la DB est à jour, `select('*')` cast directement en `TaxiTrip`.

---

### `useActivities.ts`
| Hook | Table | Order | Retourne |
|------|-------|-------|---------|
| `useActivityProviders()` | `activity_providers` | `name` ASC | `QueryState<ActivityProvider>` |
| `useActivityBookings()` | `activity_bookings` | `date` DESC | `QueryState<ActivityBooking>` |
| `useActivityPayments()` | `activity_payments` | `date` DESC | `QueryState<ActivityPayment>` |

---

### `useBookingDrag.ts`
Hook custom pour le drag-and-drop sur la grille planning.

**Signature :**
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

**`DragState` :**
```ts
{ bookingId: string; roomId: string; mode: 'move'|'resize-left'|'resize-right'; dayDelta: number; targetRoomId: string | null }
```

**Constantes :** `CELL_W = 32` px par colonne jour (Tailwind `w-8`).
**Comportement :** Convertit les px souris en unités jour. Détecte la chambre cible par Y. Déclenche les handlers au pointer up.

---

## Pattern : données mutables dans les pages

Quand une table nécessite des mutations (add/update/delete) :
```ts
const { data: fooData, refresh: refreshFoo } = useTable<Foo>('foos')
const [foos, setFoos] = useState<Foo[]>([])
useEffect(() => setFoos(fooData), [fooData])

// Add (optimistic) :
setFoos(prev => [...prev, item])
supabase.from('foos').insert([item])

// Update (optimistic) :
setFoos(prev => prev.map(x => x.id === item.id ? item : x))
const { id, ...fields } = item
supabase.from('foos').update(fields).eq('id', id)

// Delete (optimistic) :
setFoos(prev => prev.filter(x => x.id !== id))
supabase.from('foos').delete().eq('id', id)
```

**Quand utiliser refresh() plutôt qu'optimistic :**
TaxiPage, ManagementPage, ActivitiesPage → `await supabase...` puis `refresh()` (les données ne sont pas dans un state local mutable).
