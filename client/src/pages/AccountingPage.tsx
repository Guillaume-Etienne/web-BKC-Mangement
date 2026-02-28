import { useState } from 'react'
import {
  mockBookings, mockClients, mockRooms, mockBookingRooms,
  mockBookingRoomPrices, mockExternalAccommodationBookings, mockExternalAccommodations,
  mockLessons, mockInstructors, mockEquipmentRentals, mockTaxiTrips,
  mockPayments, mockInstructorDebts, mockInstructorPayments, mockLessonRateOverrides,
  mockExpenses, mockPalmeirasRents, mockPalmeirasReversals, mockSeasons,
} from '../data/mock'
import AccountingDashboard  from '../components/accounting/AccountingDashboard'
import BookingFinances      from '../components/accounting/BookingFinances'
import InstructorPayroll    from '../components/accounting/InstructorPayroll'
import PalmeirasTab         from '../components/accounting/PalmeirasTab'
import CashFlow             from '../components/accounting/CashFlow'
import ExpensesTab          from '../components/accounting/ExpensesTab'
import type {
  Payment, InstructorDebt, InstructorPayment, LessonRateOverride,
  Expense, PalmeirasRent, PalmeirasReversal,
} from '../types/database'

type Tab = 'dashboard' | 'bookings' | 'instructors' | 'palmeiras' | 'cashflow' | 'expenses'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '📊' },
  { id: 'bookings',    label: 'Bookings',    icon: '📋' },
  { id: 'instructors', label: 'Instructors', icon: '🏄' },
  { id: 'palmeiras',   label: 'Palmeiras',   icon: '🏨' },
  { id: 'cashflow',    label: 'Cash Flow',   icon: '💸' },
  { id: 'expenses',    label: 'Expenses',    icon: '🧾' },
]

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('dashboard')

  // ── Mutable state (mock — will be Supabase later) ─────────────────────────
  const [payments,             setPayments]             = useState<Payment[]>([...mockPayments])
  const [instructorDebts,      setInstructorDebts]      = useState<InstructorDebt[]>([...mockInstructorDebts])
  const [instructorPayments,   setInstructorPayments]   = useState<InstructorPayment[]>([...mockInstructorPayments])
  const [lessonRateOverrides,  setLessonRateOverrides]  = useState<LessonRateOverride[]>([...mockLessonRateOverrides])
  const [expenses,             setExpenses]             = useState<Expense[]>([...mockExpenses])
  const [palmeirasRents,       setPalmeirasRents]       = useState<PalmeirasRent[]>([...mockPalmeirasRents])
  const [palmeirasReversals,   setPalmeirasReversals]   = useState<PalmeirasReversal[]>([...mockPalmeirasReversals])

  // ── Shared computed data passed down to tabs ──────────────────────────────
  const sharedData = {
    bookings:                    mockBookings,
    clients:                     mockClients,
    rooms:                       mockRooms,
    bookingRooms:                mockBookingRooms,
    bookingRoomPrices:           mockBookingRoomPrices,
    externalAccommodationBkgs:   mockExternalAccommodationBookings,
    externalAccommodations:      mockExternalAccommodations,
    lessons:                     mockLessons,
    instructors:                 mockInstructors,
    equipmentRentals:            mockEquipmentRentals,
    taxiTrips:                   mockTaxiTrips,
    seasons:                     mockSeasons,
    payments,
    instructorDebts,
    instructorPayments,
    lessonRateOverrides,
    expenses,
    palmeirasRents,
    palmeirasReversals,
  }

  const handlers = {
    addPayment:            (p: Payment)              => setPayments(prev => [...prev, p]),
    updatePayment:         (p: Payment)              => setPayments(prev => prev.map(x => x.id === p.id ? p : x)),
    deletePayment:         (id: string)              => setPayments(prev => prev.filter(x => x.id !== id)),
    addInstructorDebt:     (d: InstructorDebt)       => setInstructorDebts(prev => [...prev, d]),
    deleteInstructorDebt:  (id: string)              => setInstructorDebts(prev => prev.filter(x => x.id !== id)),
    addInstructorPayment:  (p: InstructorPayment)    => setInstructorPayments(prev => [...prev, p]),
    deleteInstructorPayment:(id: string)             => setInstructorPayments(prev => prev.filter(x => x.id !== id)),
    setLessonOverride:     (o: LessonRateOverride)   => setLessonRateOverrides(prev => {
      const idx = prev.findIndex(x => x.lesson_id === o.lesson_id)
      return idx >= 0 ? prev.map((x, i) => i === idx ? o : x) : [...prev, o]
    }),
    removeLessonOverride:  (lesson_id: string)       => setLessonRateOverrides(prev => prev.filter(x => x.lesson_id !== lesson_id)),
    addExpense:            (e: Expense)              => setExpenses(prev => [...prev, e]),
    deleteExpense:         (id: string)              => setExpenses(prev => prev.filter(x => x.id !== id)),
    addPalmeirasRent:      (r: PalmeirasRent)        => setPalmeirasRents(prev => [...prev, r]),
    updatePalmeirasRent:   (r: PalmeirasRent)        => setPalmeirasRents(prev => prev.map(x => x.id === r.id ? r : x)),
    addPalmeirasReversal:  (r: PalmeirasReversal)    => setPalmeirasReversals(prev => [...prev, r]),
    updatePalmeirasReversal:(r: PalmeirasReversal)   => setPalmeirasReversals(prev => prev.map(x => x.id === r.id ? r : x)),
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
        {tab === 'palmeiras'   && <PalmeirasTab        data={sharedData} handlers={handlers} />}
        {tab === 'cashflow'    && <CashFlow            data={sharedData} />}
        {tab === 'expenses'    && <ExpensesTab         data={sharedData} handlers={handlers} />}
      </div>
    </div>
  )
}
