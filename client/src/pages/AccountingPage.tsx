import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBookings, useBookingRooms, useBookingRoomPrices, useBookingParticipants, usePayments } from '../hooks/useBookings'
import { useClients } from '../hooks/useClients'
import { useAccommodations, useRooms } from '../hooks/useAccommodations'
import { useLessons } from '../hooks/useLessons'
import { useInstructors } from '../hooks/useInstructors'
import { useEquipment, useEquipmentRentals } from '../hooks/useEquipment'
import { useTaxiTrips } from '../hooks/useTaxis'
import { useTable } from '../hooks/useSupabase'
import AccountingDashboard  from '../components/accounting/AccountingDashboard'
import BookingFinances      from '../components/accounting/BookingFinances'
import InstructorPayroll    from '../components/accounting/InstructorPayroll'
import PalmeirasTab         from '../components/accounting/PalmeirasTab'
import HousesTab            from '../components/accounting/HousesTab'
import CashFlow             from '../components/accounting/CashFlow'
import ExpensesTab          from '../components/accounting/ExpensesTab'
import EventsTab            from '../components/accounting/EventsTab'
import type {
  ExternalAccommodation, ExternalAccommodationBooking, HouseRental, Season,
  Payment, InstructorDebt, InstructorPayment, LessonRateOverride, EquipmentRental,
  Expense, PalmeirasRent, PalmeirasReversal, PalmeirasEntry, PalmeirasSubLet,
  DiningEvent,
} from '../types/database'

type Tab = 'dashboard' | 'bookings' | 'instructors' | 'houses' | 'palmeiras' | 'cashflow' | 'expenses' | 'events'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '📊' },
  { id: 'bookings',    label: 'Bookings',    icon: '📋' },
  { id: 'instructors', label: 'Instructors', icon: '🏄' },
  { id: 'houses',      label: 'Houses',      icon: '🏠' },
  { id: 'palmeiras',   label: 'Palmeiras',   icon: '🏨' },
  { id: 'cashflow',    label: 'Cash Flow',   icon: '💸' },
  { id: 'expenses',    label: 'Expenses',    icon: '🧾' },
  { id: 'events',      label: 'Events',      icon: '🍽️' },
]

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('dashboard')

  // ── Read-only data (Supabase hooks) ───────────────────────────────────────
  const { data: accommodations }           = useAccommodations()
  const { data: houseRentals }             = useTable<HouseRental>('house_rentals', { order: 'start_date', ascending: true })
  const { data: bookings }                 = useBookings()
  const { data: bookingParticipants }      = useBookingParticipants()
  const { data: clients }                  = useClients()
  const { data: rooms }                    = useRooms()
  const { data: bookingRooms }             = useBookingRooms()
  const { data: bookingRoomPrices }        = useBookingRoomPrices()
  const { data: externalAccommodations }   = useTable<ExternalAccommodation>('external_accommodations')
  const { data: externalAccommodationBkgs }= useTable<ExternalAccommodationBooking>('external_accommodation_bookings')
  const { data: diningEvents }             = useTable<DiningEvent>('dining_events', { order: 'date', ascending: false })
  const { data: lessons }                  = useLessons()
  const { data: instructors }              = useInstructors()
  const { data: equipment }                = useEquipment()
  const { data: equipmentRentalsData }     = useEquipmentRentals()
  const [equipmentRentals, setEquipmentRentals] = useState<EquipmentRental[]>([])
  const { data: taxiTrips }                = useTaxiTrips()
  const { data: seasons }                  = useTable<Season>('seasons')

  // ── Mutable state (Supabase) ──────────────────────────────────────────────
  const { data: paymentsData }           = usePayments()
  const { data: instructorDebtsData }    = useTable<InstructorDebt>('instructor_debts', { order: 'date', ascending: false })
  const { data: instructorPaymentsData } = useTable<InstructorPayment>('instructor_payments', { order: 'date', ascending: false })
  const { data: lessonOverridesData }    = useTable<LessonRateOverride>('lesson_rate_overrides')
  const { data: expensesData }           = useTable<Expense>('expenses', { order: 'date', ascending: false })
  const { data: palmeirasRentsData }     = useTable<PalmeirasRent>('palmeiras_rents', { order: 'month', ascending: false })
  const { data: palmeirasReversalsData } = useTable<PalmeirasReversal>('palmeiras_reversals', { order: 'date', ascending: false })
  const { data: palmeirasEntriesData }   = useTable<PalmeirasEntry>('palmeiras_entries', { order: 'date', ascending: false })
  const { data: palmeirasSubLetsData }   = useTable<PalmeirasSubLet>('palmeiras_sub_lets', { order: 'month', ascending: false })

  const [payments,           setPayments]           = useState<Payment[]>([])
  const [instructorDebts,    setInstructorDebts]    = useState<InstructorDebt[]>([])
  const [instructorPayments, setInstructorPayments] = useState<InstructorPayment[]>([])
  const [lessonRateOverrides,setLessonRateOverrides]= useState<LessonRateOverride[]>([])
  const [expenses,           setExpenses]           = useState<Expense[]>([])
  const [palmeirasRents,     setPalmeirasRents]     = useState<PalmeirasRent[]>([])
  const [palmeirasReversals, setPalmeirasReversals] = useState<PalmeirasReversal[]>([])
  const [palmeirasEntries,   setPalmeirasEntries]   = useState<PalmeirasEntry[]>([])
  const [palmeirasSubLets,   setPalmeirasSubLets]   = useState<PalmeirasSubLet[]>([])

  useEffect(() => setEquipmentRentals(equipmentRentalsData),  [equipmentRentalsData])
  useEffect(() => setPayments(paymentsData),                   [paymentsData])
  useEffect(() => setInstructorDebts(instructorDebtsData),     [instructorDebtsData])
  useEffect(() => setInstructorPayments(instructorPaymentsData),[instructorPaymentsData])
  useEffect(() => setLessonRateOverrides(lessonOverridesData), [lessonOverridesData])
  useEffect(() => setExpenses(expensesData),                   [expensesData])
  useEffect(() => setPalmeirasRents(palmeirasRentsData),       [palmeirasRentsData])
  useEffect(() => setPalmeirasReversals(palmeirasReversalsData),[palmeirasReversalsData])
  useEffect(() => setPalmeirasEntries(palmeirasEntriesData),   [palmeirasEntriesData])
  useEffect(() => setPalmeirasSubLets(palmeirasSubLetsData),   [palmeirasSubLetsData])

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
    externalAccommodationBkgs,
    externalAccommodations,
    diningEvents,
    lessons,
    instructors,
    equipment,
    equipmentRentals,
    taxiTrips,
    seasons,
    payments,
    instructorDebts,
    instructorPayments,
    lessonRateOverrides,
    expenses,
    palmeirasRents,
    palmeirasReversals,
    palmeirasEntries,
    palmeirasSubLets,
  }

  // ── Handlers (optimistic local update + Supabase fire-and-forget) ─────────
  const handlers = {
    updateRental: (r: EquipmentRental) => {
      setEquipmentRentals(prev => prev.map(x => x.id === r.id ? r : x))
      const { id, ...fields } = r
      supabase.from('equipment_rentals').update(fields).eq('id', id)
    },
    addPayment: (p: Payment) => {
      setPayments(prev => [...prev, p])
      const { id, ...fields } = p
      supabase.from('payments').insert([{ id, ...fields }])
    },
    updatePayment: (p: Payment) => {
      setPayments(prev => prev.map(x => x.id === p.id ? p : x))
      const { id, ...fields } = p
      supabase.from('payments').update(fields).eq('id', id)
    },
    deletePayment: (id: string) => {
      setPayments(prev => prev.filter(x => x.id !== id))
      supabase.from('payments').delete().eq('id', id)
    },

    addInstructorDebt: (d: InstructorDebt) => {
      setInstructorDebts(prev => [...prev, d])
      supabase.from('instructor_debts').insert([d])
    },
    deleteInstructorDebt: (id: string) => {
      setInstructorDebts(prev => prev.filter(x => x.id !== id))
      supabase.from('instructor_debts').delete().eq('id', id)
    },

    addInstructorPayment: (p: InstructorPayment) => {
      setInstructorPayments(prev => [...prev, p])
      supabase.from('instructor_payments').insert([p])
    },
    deleteInstructorPayment: (id: string) => {
      setInstructorPayments(prev => prev.filter(x => x.id !== id))
      supabase.from('instructor_payments').delete().eq('id', id)
    },

    setLessonOverride: (o: LessonRateOverride) => {
      setLessonRateOverrides(prev => {
        const idx = prev.findIndex(x => x.lesson_id === o.lesson_id)
        return idx >= 0 ? prev.map((x, i) => i === idx ? o : x) : [...prev, o]
      })
      supabase.from('lesson_rate_overrides').upsert([o])
    },
    removeLessonOverride: (lesson_id: string) => {
      setLessonRateOverrides(prev => prev.filter(x => x.lesson_id !== lesson_id))
      supabase.from('lesson_rate_overrides').delete().eq('lesson_id', lesson_id)
    },

    addExpense: (e: Expense) => {
      setExpenses(prev => [...prev, e])
      supabase.from('expenses').insert([e])
    },
    deleteExpense: (id: string) => {
      setExpenses(prev => prev.filter(x => x.id !== id))
      supabase.from('expenses').delete().eq('id', id)
    },

    addPalmeirasRent: (r: PalmeirasRent) => {
      setPalmeirasRents(prev => [...prev, r])
      supabase.from('palmeiras_rents').insert([r])
    },
    updatePalmeirasRent: (r: PalmeirasRent) => {
      setPalmeirasRents(prev => prev.map(x => x.id === r.id ? r : x))
      const { id, ...fields } = r
      supabase.from('palmeiras_rents').update(fields).eq('id', id)
    },

    addPalmeirasReversal: (r: PalmeirasReversal) => {
      setPalmeirasReversals(prev => [...prev, r])
      supabase.from('palmeiras_reversals').insert([r])
    },
    updatePalmeirasReversal: (r: PalmeirasReversal) => {
      setPalmeirasReversals(prev => prev.map(x => x.id === r.id ? r : x))
      const { id, ...fields } = r
      supabase.from('palmeiras_reversals').update(fields).eq('id', id)
    },

    addPalmeirasEntry: (e: PalmeirasEntry) => {
      setPalmeirasEntries(prev => [...prev, e])
      supabase.from('palmeiras_entries').insert([e])
    },
    deletePalmeirasEntry: (id: string) => {
      setPalmeirasEntries(prev => prev.filter(x => x.id !== id))
      supabase.from('palmeiras_entries').delete().eq('id', id)
    },

    addPalmeirasSubLet: (s: PalmeirasSubLet) => {
      setPalmeirasSubLets(prev => [...prev, s])
      supabase.from('palmeiras_sub_lets').insert([s])
    },
    updatePalmeirasSubLet: (s: PalmeirasSubLet) => {
      setPalmeirasSubLets(prev => prev.map(x => x.id === s.id ? s : x))
      const { id, ...fields } = s
      supabase.from('palmeiras_sub_lets').update(fields).eq('id', id)
    },
    deletePalmeirasSubLet: (id: string) => {
      setPalmeirasSubLets(prev => prev.filter(x => x.id !== id))
      supabase.from('palmeiras_sub_lets').delete().eq('id', id)
    },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Accounting</h1>
          <p className="text-gray-500 mt-1">Financial overview of the kite center</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm border border-gray-200 p-1 mb-8 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex-1 justify-center ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'dashboard'   && <AccountingDashboard data={sharedData} />}
        {tab === 'bookings'    && <BookingFinances     data={sharedData} handlers={handlers} />}
        {tab === 'instructors' && <InstructorPayroll   data={sharedData} handlers={handlers} />}
        {tab === 'houses'      && <HousesTab            data={sharedData} />}
        {tab === 'palmeiras'   && <PalmeirasTab        data={sharedData} handlers={handlers} />}
        {tab === 'cashflow'    && <CashFlow            data={sharedData} />}
        {tab === 'expenses'    && <ExpensesTab         data={sharedData} handlers={handlers} />}
        {tab === 'events'      && <EventsTab           data={sharedData} />}
      </div>
    </div>
  )
}
