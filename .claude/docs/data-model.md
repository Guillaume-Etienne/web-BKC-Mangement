# Data Model Reference
> Source of truth : `client/src/types/database.ts` + `supabase/schema.sql`
> Room labels : "Maison X" → "H-X", "Chambre 1" → "F" (Front), "Chambre 2" → "B" (Back)

---

## Union Types / Enums

| Type | Valeurs |
|------|---------|
| `AccommodationType` | `'house' \| 'bungalow' \| 'other'` |
| `BookingStatus` | `'confirmed' \| 'provisional' \| 'cancelled'` |
| `KiteLevel` | `'beg-total' \| 'beg-bodydrag' \| 'beg-waterstart' \| 'intermediate' \| 'advanced'` |
| `LessonType` | `'private' \| 'group' \| 'supervision'` |
| `DaySlot` | `'morning' \| 'afternoon' \| 'evening'` |
| `PriceCategory` | `'lesson' \| 'activity' \| 'rental' \| 'taxi'` |
| `TaxiTripType` | `'aero-to-center' \| 'center-to-aero' \| 'aero-to-spot' \| 'spot-to-aero' \| 'center-to-town' \| 'town-to-center' \| 'other'` |
| `TaxiTripStatus` | `'confirmed' \| 'needs_details' \| 'done'` |
| `SharedLinkType` | `'forecast' \| 'taxi' \| 'client' \| 'driver' \| 'activity_provider'` |
| `EquipmentCategory` | `'kite' \| 'board' \| 'surfboard' \| 'foilboard'` |
| `EquipmentCondition` | `'new' \| 'good' \| 'fair' \| 'damaged' \| 'retired'` |
| `RentalSlot` | `'morning' \| 'afternoon' \| 'full_day'` |
| `PaymentMethod` | `'cash_eur' \| 'cash_mzn' \| 'transfer' \| 'card_palmeiras'` |
| `ConsumptionType` | `'lesson' \| 'rental' \| 'activity' \| 'center_access'` |
| `EventType` | `'count' \| 'menu'` |
| `ExternalAccommodationProvider` | `'palmeiras' \| 'other'` |
| `ActivityProviderType` | `'activity' \| 'safari'` |
| `ActivityPaymentFlow` | `'we_pay_provider' \| 'provider_pays_us'` |
| `ActivityPaymentDirection` | `'to_provider' \| 'from_provider'` |
| `EmailLogType` | `'booking_confirmation' \| 'visa_letter' \| 'travel_guide'` |
| `EmailLogStatus` | `'pending' \| 'sent' \| 'delivered' \| 'opened' \| 'failed'` |
| `ActionPriority` | `'urgent' \| 'week' \| 'monitor'` |

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
| capacity | number | personnes |

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
| kite_level | `KiteLevel \| null` |
| import_id | string \| null (Google Forms dedup key) |
| emergency_contact_name | string \| null |
| emergency_contact_phone | string \| null |
| emergency_contact_email | string \| null |
| emergency_contact_relation | string \| null |

### `booking_participants` → `BookingParticipant`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| booking_id | string (FK → bookings) | |
| first_name | string | |
| last_name | string \| null | |
| passport_number | string \| null | Requis pour lettre visa |
| client_id | string \| null | Lien optionnel vers Client existant |
| kite_level | `KiteLevel \| null` | |
| notes | string \| null | |
| created_at | string (ISO timestamp) | |
> Remplace l'ancienne table `participants` (supprimée). Modèle unifié pour visa + leçons + location.

### `bookings` → `Booking`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| booking_number | number | Séquentiel, affiché #001 |
| client_id | string (FK → clients) | |
| check_in | string (ISO date) | |
| check_out | string (ISO date) | |
| visa_entry_date | string \| null | Entrée Mozambique (lettre visa) |
| visa_exit_date | string \| null | Sortie Mozambique (lettre visa) |
| status | BookingStatus | |
| notes | string \| null | |
| num_lessons | number | Personnes voulant des leçons |
| num_equipment_rentals | number | |
| num_center_access | number | Sans leçon ni location |
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
| client? | Client | Join optionnel |
| emergency_contact_* | string \| null | |
> Participants dans `booking_participants` (requête séparée via `useBookingParticipants()`).

**Projection minimale `BookingRef`** (utilisée par taxi/activity pickers) :
`id, booking_number, check_in, check_out, luggage_count, boardbag_count, client?{first_name, last_name}`

### `booking_rooms` → `BookingRoom`
| Field | Type |
|-------|------|
| booking_id | string (FK) |
| room_id | string (FK) |
> Junction many-to-many.

### `booking_room_prices` → `BookingRoomPrice`
| Field | Type | Notes |
|-------|------|-------|
| booking_id | string (FK) | |
| room_id | string (FK) | |
| price_per_night | number (EUR) | Figé au moment du booking |
| override_note | string \| null | |

### `room_rates` → `RoomRate`
| Field | Type |
|-------|------|
| id | string (UUID) |
| room_id | string (FK ou `'full_{accommodation_id}'` pour tarif maison entière) |
| price_per_night | number (EUR) |
| notes | string \| null |

---

## Planning / Leçons

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
| participant_ids | string[] | booking_participants.id[] — 1 pour private/supervision, N pour group |
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
| type | EventType | `'count'` = effectif seulement, `'menu'` = menu complet |
| price_per_person | number | |
| notes | string | |
| attendees | EventAttendee[] | Dénormalisé JSONB |

### `event_attendees` → `EventAttendee`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| person_id | string | |
| person_type | `'instructor' \| 'participant' \| 'extra'` | |
| person_name | string | |
| room_label | string | e.g. "H-1/F" |
| is_attending | boolean | |
| price_override? | number | Surcharge individuelle |
| starter | string | Menu item (always present) |
| main | string | Menu item (always present) |
| side | string | Menu item (always present) |
| dessert | string | Menu item (always present) |
> Les champs menu (starter/main/side/dessert) sont toujours présents (strings vides si non utilisés), pas conditionnels à type='menu'.

---

## Équipement

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
| equipment_id | string \| null (FK) |
| booking_id | string \| null (FK) |
| participant_id | string \| null (FK → booking_participants) |
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
| booking_id | string \| null | null = trip standalone (sans booking) |
| nb_persons | number | |
| nb_luggage | number | |
| nb_boardbags | number | |
| notes | string \| null | |
| price_eur | number | Fixed EUR price charged to client (e.g. 120€) |
| price_driver_mzn | number | What driver gets (MZN) |
| margin_manager_mzn | number | Manager commission (MZN) |
| exchange_rate | number | EUR/MZN reference rate |
> ⚠️ `useTaxiTrips()` normalise les anciens noms de colonnes DB (`schemaOutdated` flag).
> Trips sans `booking_id` : revenue compté dans compta via `computeStandaloneTaxiRevenue()`.
> **Modèle simplifié (avril 2026)** : client paie en EUR (prix fixe), driver + manager payés en MZN. Plus de `price_client_mzn` ni `margin_centre_mzn`.

### `taxi_pricing_defaults` → `TaxiPricingDefaults`
| Field | Type | Default |
|-------|------|---------|
| id | string (UUID) | |
| default_price_eur | number | 120 |
| default_driver_mzn | number | 6000 |
| default_manager_mzn | number | 1000 |
| eur_mzn_rate | number | 65 |
| updated_at | string (ISO timestamp) | |
> Singleton. Pré-remplit les nouveaux trips. Modifiable dans Management → Pricing.

### `taxi_manager_payments` → `TaxiManagerPayment`
| Field | Type |
|-------|------|
| id | string (UUID) |
| date | string (ISO date) |
| amount_mzn | number |
| notes | string \| null |

---

## Activities & Safaris

### `activity_providers` → `ActivityProvider`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | |
| type | ActivityProviderType | `'activity'` ou `'safari'` |
| phone | string \| null | |
| email | string \| null | |
| website | string \| null | |
| notes | string \| null | |
| is_active | boolean | |
| show_prices | boolean | Si true → onglet Accounting visible sur page publique |
| created_at | string | |

### `activity_bookings` → `ActivityBooking`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| provider_id | string (FK) | |
| booking_id | string \| null (FK → bookings) | Lien optionnel |
| date | string (ISO date) | |
| label | string | e.g. "Whale shark tour" |
| nb_persons | number | |
| participant_ids | string[] | booking_participants.id[] |
| price_client | number (EUR) | Ce que paie le client au centre |
| price_provider | number (EUR) | Ce que paie/reçoit le prestataire |
| payment_flow | ActivityPaymentFlow | |
| notes | string \| null | |
| created_at | string | |

**Modèle financier :**
- `we_pay_provider` : client paie le centre (price_client), centre paie prestataire (price_provider). Marge centre = price_client − price_provider.
- `provider_pays_us` : client paie le prestataire directement, prestataire nous reverse price_provider.

### `activity_payments` → `ActivityPayment`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| provider_id | string (FK) | |
| date | string (ISO date) | |
| amount | number (EUR) | |
| direction | ActivityPaymentDirection | `'to_provider'` = on les paie, `'from_provider'` = ils nous paient |
| notes | string \| null | |
| created_at | string | |

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
| token | string | Aléatoire `{type}_{10chars}` |
| type | SharedLinkType | |
| label | string | |
| params | Record<string, string> | `{ booking_number }` / `{ driver_id }` / `{ provider_id }` |
| created_at | string (ISO date) | |
| expires_at | string \| null | |
| is_active | boolean | |

**Paramètres par type :**
| type | params |
|------|--------|
| `client` | `{ booking_number: '42' }` |
| `driver` | `{ driver_id: 'uuid' }` |
| `activity_provider` | `{ provider_id: 'uuid' }` |
| `forecast` / `taxi` | `{}` |

> Créés automatiquement (pas via le form links) pour `driver` et `activity_provider` depuis leurs pages dédiées.

---

## Accounting

### `seasons` → `Season`
| Field | Type |
|-------|------|
| id | string (UUID) |
| label | string (e.g. "2025-2026") |
| start_date | string (ISO date) |
| end_date | string (ISO date) |

### `house_rentals` → `HouseRental`
| Field | Type |
|-------|------|
| id | string (UUID) |
| accommodation_id | string (FK) |
| start_date | string (ISO date) |
| end_date | string (ISO date) |
| total_cost | number (EUR) |
| notes | string \| null |

### `external_accommodations` → `ExternalAccommodation`
| Field | Type |
|-------|------|
| id | string (UUID) |
| name | string |
| provider | ExternalAccommodationProvider |
| cost_per_night | number (EUR, ce qu'on paie) |
| sell_price_per_night | number (EUR, ce qu'on facture) |
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
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| booking_id | string (FK) | |
| date | string (ISO date) | |
| amount | number (EUR) | Toujours positif |
| method | PaymentMethod | |
| is_deposit | boolean | |
| is_verified | boolean | false = "à vérifier" |
| is_discount | boolean | true = remise (réduit le solde) |
| notes | string \| null | |
> Auto-création : nouveau booking avec `amount_paid > 0` → insert Payment (`method:'transfer'`, `is_verified:false`).
> Discounts : positif, `is_discount:true`. Réduit outstanding (Total − Paid).

### `participant_consumptions` → `ParticipantConsumption`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| booking_id | string (FK) | |
| participant_id | string (FK → booking_participants) | |
| type | ConsumptionType | `'lesson' \| 'rental' \| 'activity' \| 'center_access'` |
| quantity | number | |
| unit_price | number (EUR) | |
| notes | string \| null | |
> ⚠️ Table définie mais jamais alimentée en pratique. ClientSharePage utilise les tables sources directes (lessons, equipment_rentals, activity_bookings) au lieu de cette table.

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
| lesson_id | string (FK, UNIQUE) |
| rate | number (EUR/h) |
| note | string (requis) |

### `expenses` → `Expense`
| Field | Type |
|-------|------|
| id | string (UUID) |
| date | string (ISO date) |
| category | string (free-form) |
| amount | number (EUR) |
| description | string |
> Catégories par défaut : Equipment, Maintenance, Transport, Staff, Admin, Other

### Palmeiras
| Table | Interface | Clé |
|-------|-----------|-----|
| `palmeiras_rents` | `PalmeirasRent` | `month` YYYY-MM |
| `palmeiras_reversals` | `PalmeirasReversal` | `month` + gross/percent/net |
| `palmeiras_entries` | `PalmeirasEntry` | `month` + type income/expense |
| `palmeiras_sub_lets` | `PalmeirasSubLet` | `month` + bungalow + cost/sell/nights |

---

## Documents

### `travel_guide_sections` → `TravelGuideSection`
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| key | string (UNIQUE) | Identifiant (e.g. "getting_there", "packing") |
| title_fr | string | Français |
| title_en | string | English |
| title_es | string | Español |
| body_fr | string | Contenu français |
| body_en | string | Contenu anglais |
| body_es | string | Contenu espagnol |
| sort_order | number | Ordre d'affichage |
| updated_at | string (ISO timestamp) | |
> Utilisé dans DocumentsPage (onglet Travel Guide). i18n intégré dans schema.

---

## Email Logs (`email_logs` → `EmailLog`)

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| booking_id | string (FK → bookings) | |
| type | EmailLogType | `booking_confirmation \| visa_letter \| travel_guide` |
| status | EmailLogStatus | `pending \| sent \| delivered \| opened \| failed` |
| recipient_email | string | |
| sent_at | string (ISO) \| null | |
| delivered_at | string (ISO) \| null | mis à jour par webhook Resend (non encore implémenté) |
| opened_at | string (ISO) \| null | idem |
| error | string \| null | message d'erreur si `failed` |
| created_at | string (ISO) | |

RLS : authentifié seulement (pas d'accès anon). Envoi via Edge Function `send-email` (proxy Resend, clé `RESEND_API_KEY` en secret Supabase).

---

## Pending Actions (`components/pending/pendingActions.ts`)

Types purement calculés, pas de table DB.

**`ActionPriority`** : `'urgent' | 'week' | 'monitor'`

**`PendingAction`** :
| Field | Type | Notes |
|-------|------|-------|
| id | string | identifiant unique de la règle + bookingId |
| priority | ActionPriority | |
| message | string | texte affiché |
| bookingRef | string \| undefined | ex. `#003 — John Smith` |
| route | Page | page vers laquelle naviguer |
| routeLabel | string | label du lien |

**`PendingActionsData`** : `{ bookings: Booking[]; payments: Payment[]; taxiTripUnlinkedCount: number }`

**Règles implémentées :**
| Priorité | Condition |
|----------|-----------|
| 🔴 urgent | Paiement non vérifié (`is_verified=false`) |
| 🔴 urgent | Réservation provisoire + check_in ≤ J+2 |
| 🔴 urgent | `visa_entry_date` ≤ J+4 |
| 🔴 urgent | Aucun paiement + check_in ≤ J+1 |
| 🟡 week | Provisoire + check_in ≤ J+7 |
| 🟡 week | Aucun paiement + check_in ≤ J+7 |
| 🟡 week | `visa_entry_date` J+5 à J+7 |
| 🟢 monitor | Trajets taxi sans `booking_id` |

Chargé dans `App.tsx` au login (3 requêtes parallèles légères), passé à `HomePage` + `Navigation` (badge rouge).

---

## Types accounting partagés (`components/accounting/types.ts`)

**`SharedAccountingData`** — bundle passé à tous les sous-composants :
`accommodations, bookingParticipants, houseRentals, bookings, clients, rooms, bookingRooms, bookingRoomPrices, externalAccommodationBkgs, externalAccommodations, diningEvents, lessons, instructors, equipment, equipmentRentals, taxiTrips, seasons, payments, instructorDebts, instructorPayments, lessonRateOverrides, expenses, palmeirasRents, palmeirasReversals, palmeirasEntries, palmeirasSubLets, activityBookings, activityPayments`

**`AccountingHandlers`** — mutations add/update/delete pour chaque entité mutable.

**`utils.ts`** — fonctions de calcul clés :
| Fonction | Retourne |
|----------|---------|
| `computeBookingTotal(b, data)` | Total facturé pour un booking |
| `computeAccommodationRevenue(b, data)` | Revenu hébergement |
| `computeLessonsRevenue(b, data)` | Revenu leçons |
| `computeRentalsRevenue(b, data)` | Revenu location matériel |
| `computeTaxiRevenue(b, data)` | Revenu taxi lié à un booking |
| `computeStandaloneTaxiRevenue(data)` | Revenu trips taxi sans booking |
| `computeActivityNetRevenue(data)` | Marge nette activités (we_pay: price_client−price_provider ; provider_pays: price_provider) |
| `computeInstructorBalance(id, data)` | Solde dû à un instructeur |
| `fmtEur(n)` | Formatage EUR |
| `fmtMonth(yyyymm)` | "Feb 2026" |
