# Data Model Reference
> Source of truth: `client/src/types/database.ts` + `supabase/schema.sql`
> Room labels: "Maison X" → "H-X", "Chambre 1" → "F" (Front), "Chambre 2" → "B" (Back)

---

## Union Types / Enums

| Type | Values |
|------|--------|
| `AccommodationType` | `'house' \| 'bungalow' \| 'other'` |
| `BookingStatus` | `'confirmed' \| 'provisional' \| 'cancelled'` |
| `LessonType` | `'private' \| 'group' \| 'supervision'` |
| `DaySlot` | `'morning' \| 'afternoon' \| 'evening'` |
| `PriceCategory` | `'lesson' \| 'activity' \| 'rental' \| 'taxi'` |
| `TaxiTripType` | `'aero-to-center' \| 'center-to-aero' \| 'aero-to-spot' \| 'spot-to-aero' \| 'center-to-town' \| 'town-to-center' \| 'other'` |
| `TaxiTripStatus` | `'confirmed' \| 'needs_details' \| 'done'` |
| `SharedLinkType` | `'forecast' \| 'taxi' \| 'client'` |
| `EquipmentCategory` | `'kite' \| 'board' \| 'surfboard' \| 'foilboard'` |
| `EquipmentCondition` | `'new' \| 'good' \| 'fair' \| 'damaged' \| 'retired'` |
| `RentalSlot` | `'morning' \| 'afternoon' \| 'full_day'` |
| `PaymentMethod` | `'cash_eur' \| 'cash_mzn' \| 'transfer' \| 'card_palmeiras'` |
| `ConsumptionType` | `'lesson' \| 'rental' \| 'activity' \| 'center_access'` |
| `EventType` | `'count' \| 'menu'` |
| `ExternalAccommodationProvider` | `'palmeiras' \| 'other'` |

---

## Core Tables

### `accommodations` → `Accommodation`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | e.g. "Maison 1", "Bungalow A" |
| type | AccommodationType | |
| total_rooms | number | |
| is_active | boolean | |

### `rooms` → `Room`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| accommodation_id | string (FK) | |
| name | string | "Chambre 1" → F, "Chambre 2" → B |
| capacity | number | persons |

### `clients` → `Client`
| Field | Type |
|-------|------|
| id | string (UUID) |
| first_name | string |
| last_name | string |
| email | string \| null |
| phone | string \| null |
| notes | string \| null |
| nationality | string \| null |
| passport_number | string \| null |
| birth_date | string \| null (ISO date) |
| kite_level | `'beginner' \| 'intermediate' \| 'advanced' \| null` |
| import_id | string \| null (Google Forms dedup key) |
| emergency_contact_name | string \| null |
| emergency_contact_phone | string \| null |
| emergency_contact_email | string \| null |
| emergency_contact_relation | string \| null |

### `participants` → `Participant`
| Field | Type |
|-------|------|
| id | string (UUID) |
| first_name | string |
| last_name | string |
| passport_number | string |
> Non-client persons in a booking. Linked via `participants` array in Booking (join).

### `bookings` → `Booking`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| booking_number | number | Sequential, displayed as #001 |
| client_id | string (FK → clients) | |
| check_in | string (ISO date) | Actual kite center arrival |
| check_out | string (ISO date) | Actual kite center departure |
| visa_entry_date | string \| null | Mozambique entry (visa letter) |
| visa_exit_date | string \| null | Mozambique exit (visa letter) |
| status | BookingStatus | |
| notes | string \| null | |
| num_lessons | number | Persons wanting lessons |
| num_equipment_rentals | number | |
| num_center_access | number | No lesson/rental |
| arrival_time | string \| null (HH:MM) | |
| departure_time | string \| null (HH:MM) | |
| luggage_count | number | |
| boardbag_count | number | |
| taxi_arrival | boolean | |
| taxi_departure | boolean | |
| couples_count | number | |
| children_count | number | |
| amount_paid | number (EUR) | |
| import_id | string \| null | Google Forms dedup |
| participants | Participant[] | Joined array |
| client? | Client | Optional join |
| emergency_contact_* | string \| null | Duplicated from client |

**Minimal projection `BookingRef`** (used by taxi/activity pickers):
`id, booking_number, check_in, check_out, luggage_count, boardbag_count, participants?[{id}], client?{first_name, last_name}`

### `booking_rooms` → `BookingRoom`
| Field | Type |
|-------|------|
| booking_id | string (FK) |
| room_id | string (FK) |
> Many-to-many junction.

### `booking_room_prices` → `BookingRoomPrice`
| Field | Type | Notes |
|-------|------|-------|
| booking_id | string (FK) | |
| room_id | string (FK) | |
| price_per_night | number (EUR) | Frozen at booking time |
| override_note | string \| null | |

### `room_rates` → `RoomRate`
| Field | Type |
|-------|------|
| id | string (UUID) |
| room_id | string (FK or `'full_{accommodation_id}'` for full-house rate) |
| price_per_night | number (EUR) |
| notes | string \| null |

---

## Planning / Lessons

### `instructors` → `Instructor`
| Field | Type |
|-------|------|
| id | string (UUID) |
| first_name | string |
| last_name | string |
| email | string \| null |
| phone | string \| null |
| specialties | string[] |
| rate_private | number (EUR/h) |
| rate_group | number (EUR/h) |
| rate_supervision | number (EUR/h) |
| notes | string \| null |

### `lessons` → `Lesson`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| booking_id | string (FK) | |
| instructor_id | string (FK) | |
| client_ids | string[] | 1 for private/supervision, N for group |
| date | string (ISO date) | |
| start_time | string (HH:MM) | |
| duration_hours | number | |
| type | LessonType | |
| notes | string \| null | |
| kite_id | string \| null (FK → equipment) | |
| board_id | string \| null (FK → equipment) | |

### `day_activities` → `DayActivity`
| Field | Type |
|-------|------|
| id | string (UUID) |
| date | string (ISO date) |
| slot | DaySlot |
| name | string |
| notes | string \| null |

### `dining_events` → `DiningEvent`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | |
| date | string (ISO date) | |
| time | string (HH:MM) | |
| type | EventType | `'count'` = headcount only, `'menu'` = full menu |
| price_per_person | number | |
| notes | string | |
| attendees | EventAttendee[] | Joined |

### `event_attendees` → `EventAttendee`
| Field | Type |
|-------|------|
| id | string (UUID) |
| person_id | string |
| person_type | `'instructor' \| 'client' \| 'extra'` |
| person_name | string |
| room_label | string (e.g. "H-1/F") |
| is_attending | boolean |
| price_override? | number |
| starter / main / side / dessert | string (for type='menu') |

---

## Equipment

### `equipment` → `Equipment`
| Field | Type |
|-------|------|
| id | string (UUID) |
| name | string |
| category | EquipmentCategory |
| brand | string \| null |
| size | string \| null |
| year | number \| null |
| condition | EquipmentCondition |
| notes | string \| null |
| is_active | boolean |

### `equipment_rentals` → `EquipmentRental`
| Field | Type |
|-------|------|
| id | string (UUID) |
| equipment_id | string (FK) |
| booking_id | string \| null |
| client_id | string \| null |
| date | string (ISO date) |
| slot | RentalSlot |
| price | number (EUR) |
| notes | string \| null |

---

## Taxi

### `taxi_drivers` → `TaxiDriver`
| Field | Type |
|-------|------|
| id | string (UUID) |
| name | string |
| phone | string \| null |
| email | string \| null |
| vehicle | string \| null |
| notes | string \| null |
| margin_percent | number |

### `taxi_trips` → `TaxiTrip`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| date | string (ISO date) | |
| start_time | string (HH:MM) | |
| type | TaxiTripType | |
| status | TaxiTripStatus | |
| taxi_driver_id | string \| null | |
| booking_id | string \| null | |
| nb_persons | number | |
| nb_luggage | number | |
| nb_boardbags | number | |
| notes | string \| null | |
| price_client_mzn | number | What client pays |
| margin_manager_mzn | number | Intermediate manager cut |
| margin_centre_mzn | number | Our centre margin |
| price_driver_mzn | number | = client − manager − centre |
| price_eur | number | Frozen at save time |
| exchange_rate | number | EUR/MZN at save time |
> ⚠️ `useTaxiTrips()` normalizes old DB column names automatically (`schemaOutdated` flag).

### `taxi_pricing_defaults` → `TaxiPricingDefaults`
| Field | Type | Default |
|-------|------|---------|
| id | string (UUID) | |
| price_client_mzn | number | 8000 |
| margin_manager_mzn | number | 1000 |
| margin_centre_mzn | number | 1000 |
| eur_mzn_rate | number | 65 |
| updated_at | string (ISO timestamp) | |
> Singleton table. New trips pre-fill from this. Editable in Management → Pricing.

---

## Management

### `price_items` → `PriceItem`
| Field | Type |
|-------|------|
| id | string (UUID) |
| category | PriceCategory |
| name | string |
| description | string \| null |
| price | number |
| unit | string \| null |

### `shared_links` → `SharedLink`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| token | string | Random `{type}_{10chars}` |
| type | SharedLinkType | `'forecast' \| 'taxi' \| 'client'` |
| label | string | |
| params | Record<string, string> | e.g. `{ booking_number: '42' }` for 'client' type |
| created_at | string (ISO date) | |
| expires_at | string \| null | |
| is_active | boolean | |

---

## Accounting

### `seasons` → `Season`
| Field | Type |
|-------|------|
| id | string (UUID) |
| label | string (e.g. "2025-2026") |
| start_date | string (ISO date) |
| end_date | string (ISO date) |

### `external_accommodations` → `ExternalAccommodation`
| Field | Type |
|-------|------|
| id | string (UUID) |
| name | string |
| provider | ExternalAccommodationProvider |
| cost_per_night | number (EUR, what we pay) |
| sell_price_per_night | number (EUR, what we charge) |
| notes | string \| null |
| is_active | boolean |

### `external_accommodation_bookings` → `ExternalAccommodationBooking`
| Field | Type |
|-------|------|
| id | string (UUID) |
| booking_id | string (FK) |
| external_accommodation_id | string (FK) |
| check_in | string (ISO date) |
| check_out | string (ISO date) |
| cost_per_night | number (snapshot) |
| sell_price_per_night | number (snapshot) |
| notes | string \| null |

### `payments` → `Payment`
| Field | Type |
|-------|------|
| id | string (UUID) |
| booking_id | string (FK) |
| date | string (ISO date) |
| amount | number (always EUR) |
| method | PaymentMethod |
| is_deposit | boolean |
| notes | string \| null |

### `participant_consumptions` → `ParticipantConsumption`
| Field | Type |
|-------|------|
| id | string (UUID) |
| booking_id | string (FK) |
| participant_id | string (FK) |
| type | ConsumptionType |
| quantity | number |
| unit_price | number |
| notes | string \| null |

### `instructor_debts` → `InstructorDebt`
| Field | Type |
|-------|------|
| id | string (UUID) |
| instructor_id | string (FK) |
| date | string (ISO date) |
| amount | number (EUR) |
| description | string |

### `instructor_payments` → `InstructorPayment`
| Field | Type |
|-------|------|
| id | string (UUID) |
| instructor_id | string (FK) |
| date | string (ISO date) |
| amount | number (EUR) |
| method | PaymentMethod |
| notes | string \| null |

### `lesson_rate_overrides` → `LessonRateOverride`
| Field | Type |
|-------|------|
| id | string (UUID) |
| lesson_id | string (FK) |
| rate | number (EUR/h) |
| note | string (required) |

### `expenses` → `Expense`
| Field | Type |
|-------|------|
| id | string (UUID) |
| date | string (ISO date) |
| category | string (free-form) |
| amount | number (EUR) |
| description | string |
> Default categories: Equipment, Maintenance, Transport, Staff, Admin, Other

### `palmeiras_rents` → `PalmeirasRent`
| Field | Type |
|-------|------|
| id | string (UUID) |
| month | string (YYYY-MM) |
| amount | number (EUR) |
| notes | string \| null |

### `palmeiras_reversals` → `PalmeirasReversal`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| month | string (YYYY-MM) | |
| gross_amount | number (EUR) | Collected by Palmeiras |
| percent | number | % owed to us |
| net_amount | number (EUR) | gross × percent / 100 |
| notes | string \| null | |

### `palmeiras_entries` → `PalmeirasEntry`
| Field | Type |
|-------|------|
| id | string (UUID) |
| month | string (YYYY-MM) |
| type | `'expense' \| 'income'` |
| description | string |
| amount | number (EUR) |

### `palmeiras_sub_lets` → `PalmeirasSubLet`
| Field | Type |
|-------|------|
| id | string (UUID) |
| month | string (YYYY-MM) |
| bungalow | string |
| check_in | string (ISO date) |
| check_out | string (ISO date) |
| nights | number |
| cost_per_night | number (EUR, what we pay) |
| sell_per_night | number (EUR, what we charge) |
| booking_ref | string \| null |
| notes | string \| null |

---

## Accounting Helper Types (`components/accounting/types.ts`)

- **`SharedAccountingData`** — bundle passed to all accounting sub-components (all tables read-only)
- **`AccountingHandlers`** — interface for all mutations (add/update/delete per entity)
