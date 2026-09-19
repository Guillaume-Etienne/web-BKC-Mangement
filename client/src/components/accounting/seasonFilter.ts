import type { SharedAccountingData } from './types'
import { addDaysISO } from '../../utils/dates'

/** The window a season covers. A `Season` row fits this shape as-is. */
export interface DateRange {
  start_date: string   // YYYY-MM-DD, inclusive
  end_date: string     // YYYY-MM-DD, inclusive
}

const inRange = (date: string, r: DateRange) =>
  !!date && date >= r.start_date && date <= r.end_date

/** Palmeiras rows carry a month (`YYYY-MM`), not a day. A season that starts on
 *  15 September still owns the whole of September for them — splitting a monthly
 *  lease across two seasons would need a rule nobody has asked for. */
const monthInRange = (month: string, r: DateRange) =>
  !!month && month >= r.start_date.slice(0, 7) && month <= r.end_date.slice(0, 7)

/**  La fenêtre qu'une saison possède POUR SES DÉPENSES — plus large que la
 *   saison elle-même : elle commence **le lendemain de la fin de la saison
 *   précédente**.
 *
 *   Pourquoi (décision gui, 2026-09-19) : un centre saisonnier dépense pour sa
 *   saison bien avant qu'elle n'ouvre. Les billets d'avion s'achètent en avril
 *   parce qu'ils y sont moins chers, le matériel et les contrats saisonniers se
 *   règlent l'été. Filtrer les dépenses sur la seule fenêtre 15/09 → 15/03
 *   laissait **53 % de l'argent dépensé en PROD hors de toute saison**
 *   (2071,91 € sur 3873,35 € au 2026-09-19) : un vol intitulé
 *   « Flight 15 Sept to 15 March » payé le 23/08 ne comptait nulle part.
 *   L'inter-saison est donc rattachée à la saison qu'elle prépare.
 *
 *   Les fenêtres ne se chevauchent pas — celle de la saison N commence où
 *   s'arrête celle de N−1 — donc rien n'est compté deux fois dans une
 *   comparaison saison par saison. La toute première saison n'a pas de borne
 *   basse : ce qui la précède lui appartient, faute de mieux.
 *
 *   ⚠️ Limite assumée : la règle est automatique et SANS RECOURS. Une dépense
 *   d'avril qui SOLDE la saison passée (un moniteur payé en retard) sera
 *   rattachée à la suivante. La colonne `season_id` qui aurait permis de
 *   corriger au cas par cas a été écartée par gui — à ressortir si le cas se
 *   présente vraiment.
 */
export function expenseWindow(range: DateRange, seasons: DateRange[]): DateRange {
  const previous = seasons
    .filter(s => s.end_date < range.start_date)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
    .at(-1)
  return {
    start_date: previous ? addDaysISO(previous.end_date, 1) : '0000-01-01',
    end_date: range.end_date,
  }
}

/** Narrow a full accounting dataset to one season, so every existing computation
 *  can be run over it unchanged.
 *
 *  The attribution rule, decided with gui (2026-08-02):
 *
 *  - **Anything hanging off a booking follows that booking**, and a booking
 *    belongs to the season containing its `check_in`. A stay from 28 March to
 *    4 April lands wholly in the season it started in. This is already the
 *    convention `buildCashFlowRows` documents for months, and it is what keeps a
 *    booking's revenue and its costs in the same season — filtering each lesson
 *    by its own date would put the revenue in one season and the instructor's pay
 *    in the next, with nothing to reconcile them.
 *  - **Anything standalone follows its own date**: expenses, meals, payroll,
 *    provider settlements, taxi trips and activities with no booking, Palmeiras.
 *  - **Reference data is never filtered** (rooms, instructors, price list…): it
 *    describes the centre, not a period, and every computation looks rows up in it.
 *
 *  Cancelled bookings are kept when their check-in falls in the season —
 *  `computeSeasonTotals` excludes them from revenue itself, while still charging
 *  their lessons to the instructor, and that deliberate asymmetry must survive.
 */
export function filterDataToSeason(
  data: SharedAccountingData,
  range: DateRange,
  /** Toutes les saisons connues, pour élargir la fenêtre des DÉPENSES à
   *  l'inter-saison (cf. `expenseWindow`). Omis = ancien comportement, les
   *  dépenses suivent la fenêtre stricte — les appelants qui ont la liste la
   *  passent, pour que tous les écrans racontent la même chose. */
  seasons?: DateRange[],
): SharedAccountingData {
  const expRange = seasons ? expenseWindow(range, seasons) : range
  const bookings = data.bookings.filter(b => inRange(b.check_in, range))
  const keptBookingIds = new Set(bookings.map(b => b.id))

  /** Rows that name a booking follow it; rows that name none (a forecast lesson,
   *  a walk-in rental) fall back to their own date. */
  const followsBooking = <T extends { booking_id?: string | null; date?: string }>(rows: T[]) =>
    rows.filter(row =>
      row.booking_id
        ? keptBookingIds.has(row.booking_id)
        : inRange(row.date ?? '', range)
    )

  const byBookingId = <T extends { booking_id: string }>(rows: T[]) =>
    rows.filter(row => keptBookingIds.has(row.booking_id))

  const byOwnDate = <T extends { date: string }>(rows: T[]) =>
    rows.filter(row => inRange(row.date, range))

  return {
    ...data,

    // ── Reference data: left whole on purpose ──────────────────────────────
    // accommodations, clients, rooms, roomRates, instructors, priceItems,
    // equipment, seasons, eurMznRate and lessonRateOverrides all come through
    // untouched via the spread above.

    // ── The booking, and everything that hangs off it ──────────────────────
    bookings,
    bookingParticipants:       byBookingId(data.bookingParticipants),
    bookingRooms:              byBookingId(data.bookingRooms),
    bookingRoomPrices:         byBookingId(data.bookingRoomPrices),
    externalAccommodationBkgs: byBookingId(data.externalAccommodationBkgs),
    payments:                  byBookingId(data.payments),
    lessons:                   followsBooking(data.lessons),
    equipmentRentals:          followsBooking(data.equipmentRentals),
    taxiTrips:                 followsBooking(data.taxiTrips),
    activityBookings:          followsBooking(data.activityBookings),
    // An invoice line has no date of its own — it is invoiced when the stay it
    // belongs to happens, so it follows the booking like everything else.
    // `agencies` and `agencyRateItems` are reference data, left whole above.
    agencyBillingLines:        byBookingId(data.agencyBillingLines),

    // ── Standalone: each row carries the date that places it ───────────────
    // ⚠️ Les dépenses, et elles seules, suivent la fenêtre ÉLARGIE : ce qui a
    // été payé pendant l'inter-saison prépare la saison qui vient.
    expenses:            data.expenses.filter(e => inRange(e.date, expRange)),
    diningEvents:        byOwnDate(data.diningEvents),
    instructorDebts:     byOwnDate(data.instructorDebts),
    instructorPayments:  byOwnDate(data.instructorPayments),
    taxiManagerPayments: byOwnDate(data.taxiManagerPayments),
    activityPayments:    byOwnDate(data.activityPayments),
    // A house is rented for a stretch; the season it opens in is the one that pays.
    houseRentals:        data.houseRentals.filter(r => inRange(r.start_date, range)),

    palmeirasRents:     data.palmeirasRents.filter(r => monthInRange(r.month, range)),
    palmeirasReversals: data.palmeirasReversals.filter(r => monthInRange(r.month, range)),
    palmeirasEntries:   data.palmeirasEntries.filter(e => monthInRange(e.month, range)),
  }
}
