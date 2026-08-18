import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBookings, useBookingRooms, useBookingRoomPrices, useBookingParticipants, usePayments } from '../hooks/useBookings'
import { useClients } from '../hooks/useClients'
import { useAccommodations, useRooms } from '../hooks/useAccommodations'
import { useLessons } from '../hooks/useLessons'
import { useInstructors } from '../hooks/useInstructors'
import { useEquipment, useEquipmentRentals } from '../hooks/useEquipment'
import { useTaxiTrips } from '../hooks/useTaxis'
import { useActivityBookings, useActivityPayments } from '../hooks/useActivities'
import { useAgencies, useAgencyRateItems, useAgencyBillingLines } from '../hooks/useAgencies'
import { useTable } from '../hooks/useSupabase'
import { usePriceTiers } from '../hooks/usePriceTiers'
import { persist } from '../components/accounting/persist'
import { getRoomNightlyRate } from '../components/accounting/utils'
import AccountingDashboard  from '../components/accounting/AccountingDashboard'
import BookingFinances      from '../components/accounting/BookingFinances'
import InstructorPayroll    from '../components/accounting/InstructorPayroll'
import PalmeirasTab         from '../components/accounting/PalmeirasTab'
import HousesTab            from '../components/accounting/HousesTab'
import CashFlow             from '../components/accounting/CashFlow'
import ExpensesTab          from '../components/accounting/ExpensesTab'
import EventsTab            from '../components/accounting/EventsTab'
import UnverifiedPayments   from '../components/accounting/UnverifiedPayments'
import AgencyBillingTab     from '../components/accounting/AgencyBillingTab'
import type {
  ExternalAccommodationBooking, HouseRental, Season,
  Payment, InstructorDebt, InstructorPayment, LessonRateOverride, EquipmentRental,
  Expense, PalmeirasRent, PalmeirasReversal, PalmeirasEntry,
  TaxiPricingDefaults, TaxiManagerPayment,
  DiningEvent, BookingRoomPrice, RoomRate, PriceItem, Lesson,
  AgencyBillingLine, TaxiTrip,
} from '../types/database'

type Tab = 'dashboard' | 'bookings' | 'instructors' | 'houses' | 'palmeiras' | 'agencies' | 'cashflow' | 'expenses' | 'events' | 'unverified'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '📊' },
  { id: 'bookings',    label: 'Bookings',    icon: '📋' },
  { id: 'instructors', label: 'Instructors', icon: '🏄' },
  { id: 'houses',      label: 'Accommodations', icon: '🏠' },
  { id: 'palmeiras',   label: 'Palmeiras',   icon: '🏨' },
  { id: 'agencies',    label: 'Agencies',    icon: '🤝' },
  { id: 'cashflow',    label: 'Cash Flow',   icon: '💸' },
  { id: 'expenses',    label: 'Expenses',    icon: '🧾' },
  { id: 'events',      label: 'Events',      icon: '🍽️' },
  { id: 'unverified',  label: 'To Verify',   icon: '⚠️' },
]

export default function AccountingPage({ onOpenBooking }: { onOpenBooking?: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>('dashboard')

  // ── Read-only data (Supabase hooks) ───────────────────────────────────────
  const { data: accommodations }           = useAccommodations()
  const { data: houseRentals }             = useTable<HouseRental>('house_rentals', { order: 'start_date', ascending: true })
  const { data: bookings }                 = useBookings()
  const { data: bookingParticipants }      = useBookingParticipants()
  const { data: clients }                  = useClients()
  const { data: rooms }                    = useRooms()
  const { data: bookingRooms }             = useBookingRooms()
  const { data: bookingRoomPricesData }    = useBookingRoomPrices()
  const { data: roomRates }                = useTable<RoomRate>('room_rates')
  const { data: externalAccommodationBkgs }= useTable<ExternalAccommodationBooking>('external_accommodation_bookings')
  const { data: diningEvents }             = useTable<DiningEvent>('dining_events', { order: 'date', ascending: false })
  const { data: lessonsData }              = useLessons()
  const { data: instructors }              = useInstructors()
  const { data: equipment }                = useEquipment()
  const { data: equipmentRentalsData }     = useEquipmentRentals()
  const [equipmentRentals, setEquipmentRentals] = useState<EquipmentRental[]>([])
  const { data: taxiTripsData }            = useTaxiTrips()
  const { data: taxiManagerPayments }      = useTable<TaxiManagerPayment>('taxi_manager_payments', { order: 'date', ascending: false })
  // order matters: several rows may exist, every screen must pick the most recent (8000€ bug)
  const { data: taxiPricingDefaults }      = useTable<TaxiPricingDefaults>('taxi_pricing_defaults', { order: 'updated_at', ascending: false })
  const { data: activityBookings }         = useActivityBookings()
  const { data: activityPayments }         = useActivityPayments()
  const { data: agencies }                 = useAgencies()
  const { data: agencyRateItems }          = useAgencyRateItems()
  // Ordered on purpose: four tabs read `seasons[seasons.length - 1]` as "the
  // current season". Without an ORDER BY, Postgres returns rows in whatever order
  // it likes, so "the last one" was a coin flip as soon as a second season exists.
  const { data: seasons }                  = useTable<Season>('seasons', { order: 'start_date' })
  const { data: priceItems }               = useTable<PriceItem>('price_items')
  const { data: priceTiers }               = usePriceTiers()

  // ── Mutable state (Supabase) ──────────────────────────────────────────────
  const { data: paymentsData }           = usePayments()
  const { data: agencyBillingLinesData } = useAgencyBillingLines()
  const { data: instructorDebtsData }    = useTable<InstructorDebt>('instructor_debts', { order: 'date', ascending: false })
  const { data: instructorPaymentsData } = useTable<InstructorPayment>('instructor_payments', { order: 'date', ascending: false })
  const { data: lessonOverridesData }    = useTable<LessonRateOverride>('lesson_rate_overrides')
  const { data: expensesData }           = useTable<Expense>('expenses', { order: 'date', ascending: false })
  const { data: palmeirasRentsData }     = useTable<PalmeirasRent>('palmeiras_rents', { order: 'month', ascending: false })
  const { data: palmeirasReversalsData } = useTable<PalmeirasReversal>('palmeiras_reversals', { order: 'month', ascending: false })
  const { data: palmeirasEntriesData }   = useTable<PalmeirasEntry>('palmeiras_entries', { order: 'month', ascending: false })

  const [lessons,            setLessons]            = useState<Lesson[]>([])
  const [taxiTrips,          setTaxiTrips]          = useState<TaxiTrip[]>([])
  const [agencyBillingLines, setAgencyBillingLines] = useState<AgencyBillingLine[]>([])
  const [bookingRoomPrices,  setBookingRoomPrices]  = useState<BookingRoomPrice[]>([])
  const [payments,           setPayments]           = useState<Payment[]>([])
  const [instructorDebts,    setInstructorDebts]    = useState<InstructorDebt[]>([])
  const [instructorPayments, setInstructorPayments] = useState<InstructorPayment[]>([])
  const [lessonRateOverrides,setLessonRateOverrides]= useState<LessonRateOverride[]>([])
  const [expenses,           setExpenses]           = useState<Expense[]>([])
  const [palmeirasRents,     setPalmeirasRents]     = useState<PalmeirasRent[]>([])
  const [palmeirasReversals, setPalmeirasReversals] = useState<PalmeirasReversal[]>([])
  const [palmeirasEntries,   setPalmeirasEntries]   = useState<PalmeirasEntry[]>([])

  useEffect(() => setLessons(lessonsData),                     [lessonsData])
  useEffect(() => setTaxiTrips(taxiTripsData),                 [taxiTripsData])
  useEffect(() => setAgencyBillingLines(agencyBillingLinesData), [agencyBillingLinesData])
  useEffect(() => setBookingRoomPrices(bookingRoomPricesData), [bookingRoomPricesData])
  useEffect(() => setEquipmentRentals(equipmentRentalsData),  [equipmentRentalsData])
  useEffect(() => setPayments(paymentsData),                   [paymentsData])
  useEffect(() => setInstructorDebts(instructorDebtsData),     [instructorDebtsData])
  useEffect(() => setInstructorPayments(instructorPaymentsData),[instructorPaymentsData])
  useEffect(() => setLessonRateOverrides(lessonOverridesData), [lessonOverridesData])
  useEffect(() => setExpenses(expensesData),                   [expensesData])
  useEffect(() => setPalmeirasRents(palmeirasRentsData),       [palmeirasRentsData])
  useEffect(() => setPalmeirasReversals(palmeirasReversalsData),[palmeirasReversalsData])
  useEffect(() => setPalmeirasEntries(palmeirasEntriesData),   [palmeirasEntriesData])

  // ── Shared computed data passed down to tabs ──────────────────────────────
  const sharedData = {
    accommodations,
    bookingParticipants,
    houseRentals,
    bookings,
    clients,
    rooms,
    bookingRooms,
    bookingRoomPrices,
    roomRates,
    externalAccommodationBkgs,
    diningEvents,
    lessons,
    instructors,
    priceItems,
    priceTiers,
    equipment,
    equipmentRentals,
    taxiTrips,
    taxiManagerPayments,
    eurMznRate: taxiPricingDefaults[0]?.eur_mzn_rate ?? 65,
    seasons,
    payments,
    instructorDebts,
    instructorPayments,
    lessonRateOverrides,
    expenses,
    palmeirasRents,
    palmeirasReversals,
    palmeirasEntries,
    activityBookings,
    activityPayments,
    agencies,
    agencyRateItems,
    agencyBillingLines,
  }

  // ── Handlers (optimistic local update, rolled back if the DB refuses) ─────
  //
  // Every write here is optimistic: the screen changes first and the DB call
  // follows. Each one passes a snapshot of the state it touched to `persist`,
  // which puts it back if the write fails — otherwise a rejected write (RLS,
  // a constraint, a dropped connection) left the books showing money that was
  // never recorded, and said nothing until the next refresh.
  const handlers = {
    upsertBookingRoomPrice: (p: BookingRoomPrice) => {
      const before = bookingRoomPrices
      setBookingRoomPrices(prev => {
        const idx = prev.findIndex(x => x.booking_id === p.booking_id && x.room_id === p.room_id)
        return idx >= 0 ? prev.map((x, i) => i === idx ? p : x) : [...prev, p]
      })
      persist(supabase.from('booking_room_prices').upsert([p]),
        () => setBookingRoomPrices(before), 'the room price')
    },
    deleteBookingRoomPrice: (bookingId: string, roomId: string) => {
      const before = bookingRoomPrices
      setBookingRoomPrices(prev => prev.filter(x => !(x.booking_id === bookingId && x.room_id === roomId)))
      persist(supabase.from('booking_room_prices').delete().eq('booking_id', bookingId).eq('room_id', roomId),
        () => setBookingRoomPrices(before), 'the room price removal')
    },
    updateRental: (r: EquipmentRental) => {
      const before = equipmentRentals
      setEquipmentRentals(prev => prev.map(x => x.id === r.id ? r : x))
      const { id, ...fields } = r
      persist(supabase.from('equipment_rentals').update(fields).eq('id', id),
        () => setEquipmentRentals(before), 'the rental')
    },
    addPayment: (p: Payment) => {
      const before = payments
      setPayments(prev => [...prev, p])
      const { id, ...fields } = p
      persist(supabase.from('payments').insert([{ id, ...fields }]),
        () => setPayments(before), 'the payment')
    },
    updatePayment: (p: Payment) => {
      const before = payments
      setPayments(prev => prev.map(x => x.id === p.id ? p : x))
      const { id, ...fields } = p
      persist(supabase.from('payments').update(fields).eq('id', id),
        () => setPayments(before), 'the payment')
    },
    deletePayment: (id: string) => {
      const before = payments
      setPayments(prev => prev.filter(x => x.id !== id))
      persist(supabase.from('payments').delete().eq('id', id),
        () => setPayments(before), 'the payment deletion')
    },
    verifyPayment: (id: string) => {
      const before = payments
      setPayments(prev => prev.map(p => p.id === id ? { ...p, is_verified: true } : p))
      persist(supabase.from('payments').update({ is_verified: true }).eq('id', id),
        () => setPayments(before), 'the payment verification')
    },

    addInstructorDebt: (d: InstructorDebt) => {
      const before = instructorDebts
      setInstructorDebts(prev => [...prev, d])
      persist(supabase.from('instructor_debts').insert([d]),
        () => setInstructorDebts(before), 'the debt')
    },
    deleteInstructorDebt: (id: string) => {
      const before = instructorDebts
      setInstructorDebts(prev => prev.filter(x => x.id !== id))
      persist(supabase.from('instructor_debts').delete().eq('id', id),
        () => setInstructorDebts(before), 'the debt deletion')
    },

    addInstructorPayment: (p: InstructorPayment) => {
      const before = instructorPayments
      setInstructorPayments(prev => [...prev, p])
      persist(supabase.from('instructor_payments').insert([p]),
        () => setInstructorPayments(before), 'the instructor payment')
    },
    deleteInstructorPayment: (id: string) => {
      const before = instructorPayments
      setInstructorPayments(prev => prev.filter(x => x.id !== id))
      persist(supabase.from('instructor_payments').delete().eq('id', id),
        () => setInstructorPayments(before), 'the instructor payment deletion')
    },

    setLessonPrice: (lesson_id: string, price_per_hour: number | null) => {
      const before = lessons
      setLessons(prev => prev.map(l => l.id === lesson_id ? { ...l, price_per_hour } : l))
      persist(supabase.from('lessons').update({ price_per_hour }).eq('id', lesson_id),
        () => setLessons(before), 'the lesson price')
    },

    setLessonOverride: (o: LessonRateOverride) => {
      const before = lessonRateOverrides
      setLessonRateOverrides(prev => {
        const idx = prev.findIndex(x => x.lesson_id === o.lesson_id)
        return idx >= 0 ? prev.map((x, i) => i === idx ? o : x) : [...prev, o]
      })
      persist(supabase.from('lesson_rate_overrides').upsert([o]),
        () => setLessonRateOverrides(before), 'the pay override')
    },
    removeLessonOverride: (lesson_id: string) => {
      const before = lessonRateOverrides
      setLessonRateOverrides(prev => prev.filter(x => x.lesson_id !== lesson_id))
      persist(supabase.from('lesson_rate_overrides').delete().eq('lesson_id', lesson_id),
        () => setLessonRateOverrides(before), 'the pay override removal')
    },

    addExpense: (e: Expense) => {
      const before = expenses
      setExpenses(prev => [...prev, e])
      persist(supabase.from('expenses').insert([e]),
        () => setExpenses(before), 'the expense')
    },
    deleteExpense: (id: string) => {
      const before = expenses
      setExpenses(prev => prev.filter(x => x.id !== id))
      persist(supabase.from('expenses').delete().eq('id', id),
        () => setExpenses(before), 'the expense deletion')
    },

    addPalmeirasRent: (r: PalmeirasRent) => {
      const before = palmeirasRents
      setPalmeirasRents(prev => [...prev, r])
      persist(supabase.from('palmeiras_rents').insert([r]),
        () => setPalmeirasRents(before), 'the rent')
    },
    updatePalmeirasRent: (r: PalmeirasRent) => {
      const before = palmeirasRents
      setPalmeirasRents(prev => prev.map(x => x.id === r.id ? r : x))
      const { id, ...fields } = r
      persist(supabase.from('palmeiras_rents').update(fields).eq('id', id),
        () => setPalmeirasRents(before), 'the rent')
    },

    addPalmeirasReversal: (r: PalmeirasReversal) => {
      const before = palmeirasReversals
      setPalmeirasReversals(prev => [...prev, r])
      persist(supabase.from('palmeiras_reversals').insert([r]),
        () => setPalmeirasReversals(before), 'the reversal')
    },
    updatePalmeirasReversal: (r: PalmeirasReversal) => {
      const before = palmeirasReversals
      setPalmeirasReversals(prev => prev.map(x => x.id === r.id ? r : x))
      const { id, ...fields } = r
      persist(supabase.from('palmeiras_reversals').update(fields).eq('id', id),
        () => setPalmeirasReversals(before), 'the reversal')
    },

    addPalmeirasEntry: (e: PalmeirasEntry) => {
      const before = palmeirasEntries
      setPalmeirasEntries(prev => [...prev, e])
      persist(supabase.from('palmeiras_entries').insert([e]),
        () => setPalmeirasEntries(before), 'the entry')
    },
    deletePalmeirasEntry: (id: string) => {
      const before = palmeirasEntries
      setPalmeirasEntries(prev => prev.filter(x => x.id !== id))
      persist(supabase.from('palmeiras_entries').delete().eq('id', id),
        () => setPalmeirasEntries(before), 'the entry deletion')
    },

    // ── Partner-agency billing ────────────────────────────────────────────
    addAgencyBillingLine: (l: AgencyBillingLine) => {
      const before = agencyBillingLines
      setAgencyBillingLines(prev => [...prev, l])
      persist(supabase.from('agency_billing_lines').insert([l]),
        () => setAgencyBillingLines(before), 'the agency billing line')
    },
    updateAgencyBillingLine: (l: AgencyBillingLine) => {
      const before = agencyBillingLines
      setAgencyBillingLines(prev => prev.map(x => x.id === l.id ? l : x))
      const { id, ...fields } = l
      persist(supabase.from('agency_billing_lines').update(fields).eq('id', id),
        () => setAgencyBillingLines(before), 'the agency billing line')
    },
    deleteAgencyBillingLine: (id: string) => {
      // Detach everything first: the FK is ON DELETE SET NULL, but the local
      // state has to follow or the screen keeps showing services attached to a
      // line that no longer exists — and they would stay off the client's bill.
      const beforeLines = agencyBillingLines
      const beforeLessons = lessons, beforeRentals = equipmentRentals
      const beforeTaxis = taxiTrips, beforeRoomPrices = bookingRoomPrices
      const detach = <T extends { agency_billing_line_id?: string | null }>(rows: T[]) =>
        rows.map(r => r.agency_billing_line_id === id ? { ...r, agency_billing_line_id: null } : r)
      setAgencyBillingLines(prev => prev.filter(x => x.id !== id))
      setLessons(detach); setEquipmentRentals(detach); setTaxiTrips(detach); setBookingRoomPrices(detach)
      persist(supabase.from('agency_billing_lines').delete().eq('id', id), () => {
        setAgencyBillingLines(beforeLines)
        setLessons(beforeLessons); setEquipmentRentals(beforeRentals)
        setTaxiTrips(beforeTaxis); setBookingRoomPrices(beforeRoomPrices)
      }, 'the agency billing line deletion')
    },

    setLessonAgencyLine: (lesson_id: string, lineId: string | null) => {
      const before = lessons
      setLessons(prev => prev.map(l => l.id === lesson_id ? { ...l, agency_billing_line_id: lineId } : l))
      persist(supabase.from('lessons').update({ agency_billing_line_id: lineId }).eq('id', lesson_id),
        () => setLessons(before), 'the lesson billing link')
    },
    setRentalAgencyLine: (rental_id: string, lineId: string | null) => {
      const before = equipmentRentals
      setEquipmentRentals(prev => prev.map(r => r.id === rental_id ? { ...r, agency_billing_line_id: lineId } : r))
      persist(supabase.from('equipment_rentals').update({ agency_billing_line_id: lineId }).eq('id', rental_id),
        () => setEquipmentRentals(before), 'the rental billing link')
    },
    setTaxiAgencyLine: (trip_id: string, lineId: string | null) => {
      const before = taxiTrips
      setTaxiTrips(prev => prev.map(t => t.id === trip_id ? { ...t, agency_billing_line_id: lineId } : t))
      persist(supabase.from('taxi_trips').update({ agency_billing_line_id: lineId }).eq('id', trip_id),
        () => setTaxiTrips(before), 'the transfer billing link')
    },
    setRoomAgencyLine: (booking_id: string, room_id: string, lineId: string | null) => {
      // booking_room_prices has no id: the row is keyed by (booking, room), and
      // it may not exist yet — a room left at its base rate has no snapshot. In
      // that case freeze today's rate on the way in, exactly like an edit does,
      // rather than writing a row with a price of 0.
      const before = bookingRoomPrices
      const existing = bookingRoomPrices.find(p => p.booking_id === booking_id && p.room_id === room_id)
      const row: BookingRoomPrice = existing
        ? { ...existing, agency_billing_line_id: lineId }
        : {
            booking_id, room_id,
            price_per_night: getRoomNightlyRate(booking_id, room_id, sharedData),
            override_note: null,
            agency_billing_line_id: lineId,
          }
      setBookingRoomPrices(prev => {
        const idx = prev.findIndex(p => p.booking_id === booking_id && p.room_id === room_id)
        return idx >= 0 ? prev.map((x, i) => i === idx ? row : x) : [...prev, row]
      })
      persist(supabase.from('booking_room_prices').upsert([row]),
        () => setBookingRoomPrices(before), 'the room billing link')
    },
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200">Accounting</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Financial overview of the kite center</p>
        </div>

        {/* Tab bar — a 9-way horizontal scroller doesn't work on a phone (most
            tabs sit off-screen with only a faint arrow hinting they exist), so
            mobile gets a native <select> instead; sm: and up keep the strip. */}
        <select
          value={tab}
          onChange={e => setTab(e.target.value as Tab)}
          className="md:hidden w-full mb-8 px-4 py-2.5 rounded-xl font-medium text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200"
        >
          {TABS.map(t => {
            const unverifiedCount = t.id === 'unverified' ? payments.filter(p => !p.is_verified).length : 0
            return (
              <option key={t.id} value={t.id}>
                {t.icon} {t.label}{unverifiedCount > 0 ? ` (${unverifiedCount})` : ''}
              </option>
            )
          })}
        </select>
        <div className="hidden md:flex gap-1 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-1 mb-8 overflow-x-auto">
          {TABS.map(t => {
            const unverifiedCount = t.id === 'unverified' ? payments.filter(p => !p.is_verified).length : 0
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex-1 justify-center ${
                  tab === t.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
                {unverifiedCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${tab === t.id ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}>
                    {unverifiedCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {tab === 'dashboard'   && <AccountingDashboard data={sharedData} onOpenBooking={onOpenBooking} />}
        {tab === 'bookings'    && <BookingFinances     data={sharedData} handlers={handlers} />}
        {tab === 'instructors' && <InstructorPayroll   data={sharedData} handlers={handlers} />}
        {tab === 'houses'      && <HousesTab            data={sharedData} />}
        {tab === 'palmeiras'   && <PalmeirasTab        data={sharedData} handlers={handlers} />}
        {tab === 'agencies'    && <AgencyBillingTab    data={sharedData} handlers={handlers} />}
        {tab === 'cashflow'    && <CashFlow            data={sharedData} />}
        {tab === 'expenses'    && <ExpensesTab         data={sharedData} handlers={handlers} />}
        {tab === 'events'      && <EventsTab           data={sharedData} />}
        {tab === 'unverified'  && <UnverifiedPayments  data={sharedData} handlers={handlers} />}
      </div>
    </div>
  )
}
