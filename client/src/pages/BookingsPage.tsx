import { Fragment, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { i18n } from '../data/i18n'
import { useClients } from '../hooks/useClients'
import { useBookings, useBookingRooms, useBookingRoomPrices, useBookingParticipants } from '../hooks/useBookings'
import { useAccommodations, useRooms } from '../hooks/useAccommodations'
import { useTaxiDrivers, useTaxiTrips } from '../hooks/useTaxis'
import { useAgencies } from '../hooks/useAgencies'
import { useTable } from '../hooks/useSupabase'
import { referralLabel } from '../utils/referral'
import type { Booking, BookingParticipant, BookingRoom, BookingStatus, Client, Room, Accommodation, HouseRental, KiteLevel, RoomRate, PriceItem, TaxiDriver, TaxiTrip, Lesson, EquipmentRental, Payment, ExternalAccommodationBooking, Agency, Enquiry, EnquirySource, Lang } from '../types/database'
import { deriveActivityCounts, activityCountColumns } from '../utils/bookingActivity'
import { getFullHouseRate, getBaseNightlyRate } from '../utils/roomPricing'
import { getConfiguredRate, agencyMarker } from '../components/accounting/utils'
import { todayISO, fmtDate } from '../utils/dates'
import { getMissingFields, MISSING_LABELS } from '../utils/bookingCompleteness'
import EnquiryOriginPanel from '../components/enquiries/EnquiryOriginPanel'
import { intentGaps } from '../utils/intentGap'

// ─── Types ────────────────────────────────────────────────────────────────────

/** What a stay in an externally-billed place costs us and earns us. Two figures
 *  and not one: the margin on these places is the whole point of tracking them. */
interface ExternalStayAmounts { cost: number; sell: number }

interface WizardData {
  // Step 1 – Client
  client_id: string
  // new client inline
  new_client_first_name: string
  new_client_last_name: string
  new_client_email: string
  new_client_phone: string
  new_client_nationality: string
  new_client_kite_level: KiteLevel | ''
  // Referred by a partner agency (Fun&Fly & co.) — foundations only, posed 2026-08-16.
  // Doesn't change billing yet: the wizard still charges the client normally.
  // Just tags the booking so Phase 3+ (consumption, client-side hiding) has
  // something to hang off. '' = direct booking, no agency.
  agency_id: string
  /** An enquiry_sources id, or the literal 'other'. '' = never asked. */
  source_id: string
  /** The free line, only when the choice is 'other'. */
  referral_source: string
  // Step 2 – Stay
  check_in: string
  check_out: string
  visa_entry_date: string
  visa_exit_date: string
  room_ids: string[]
  room_prices: Record<string, number>
  // Stays in a place we don't price ourselves (`accommodations.external_billing`,
  // e.g. San Martinho): one flat amount for the whole stay, never a nightly rate —
  // moving a departure date must not silently re-price what was agreed with the
  // hotel. Keyed by accommodation id: taking two spots there is still one stay,
  // one bill. `cost` is what we pay them, `sell` what the guest is charged.
  external_stays: Record<string, ExternalStayAmounts>
  status: BookingStatus
  // Step 3 – Guests
  participants: ParticipantData[]
  couples_count: number
  children_count: number
  // Step 4 – Transport
  arrival_time: string
  departure_time: string
  taxi_arrival: boolean
  taxi_departure: boolean
  taxi_driver_id: string | null  // pre-assigned driver for auto-created trips
  luggage_count: number
  boardbag_count: number
  // Step 5 – KiteCenter — activity is per-traveler (see ParticipantData flags).
  // The booking num_* counters are derived from those flags via deriveActivityCounts().
  center_access_rate: number // €/day per center-access (own-gear) person
  // Step 6 – Payment
  amount_paid: number
  notes: string
}

const EMPTY_WIZARD: WizardData = {
  client_id: '',
  new_client_first_name: '', new_client_last_name: '', new_client_email: '',
  new_client_phone: '', new_client_nationality: '', new_client_kite_level: '',
  agency_id: '', source_id: '', referral_source: '',
  check_in: '', check_out: '', visa_entry_date: '', visa_exit_date: '', room_ids: [], room_prices: {},
  external_stays: {}, status: 'provisional',
  participants: [], couples_count: 0, children_count: 0,
  arrival_time: '', departure_time: '',
  taxi_arrival: false, taxi_departure: false, taxi_driver_id: null,
  luggage_count: 0, boardbag_count: 0,
  // Filled from Options → Pricing when the wizard opens: the rate used to be a 5
  // hardcoded here, which nobody could change without a developer.
  center_access_rate: 0,
  amount_paid: 0, notes: '',
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function getSteps(lang: Lang) {
  return [
    { n: 1, icon: '👤', label: i18n.bookings.step_client[lang] },
    { n: 2, icon: '🏠', label: i18n.bookings.step_stay[lang] },
    { n: 3, icon: '👥', label: i18n.bookings.step_guests[lang] },
    { n: 4, icon: '🚕', label: i18n.bookings.step_transport[lang] },
    { n: 5, icon: '🏄', label: i18n.bookings.step_kitecenter[lang] },
    { n: 6, icon: '💰', label: i18n.bookings.step_payment[lang] },
  ]
}

interface StepBarProps { current: number; onGoto: (n: number) => void; maxReached: number; lang: Lang }
function StepBar({ current, onGoto, maxReached, lang }: StepBarProps) {
  const STEPS = getSteps(lang)
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = s.n < current
        const active = s.n === current
        const reachable = s.n <= maxReached
        return (
          <div key={s.n} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => reachable && onGoto(s.n)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${active ? 'bg-blue-600 text-white' : done ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800' : reachable ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700' : 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-500 cursor-default'}`}
            >
              <span>{done ? '✓' : s.icon}</span>
              <span className="hidden sm:block">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`w-3 h-px ${done ? 'bg-blue-300' : 'bg-gray-200 dark:bg-gray-700'}`} />}
          </div>
        )
      })}
    </div>
  )
}


// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const numCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center'

function Counter({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-lg leading-none flex items-center justify-center">−</button>
      <span className="w-8 text-center font-semibold text-gray-800 dark:text-gray-200">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-lg leading-none flex items-center justify-center">+</button>
    </div>
  )
}

// ─── Participant row (module-scope for focus safety) ──────────────────────────

type ParticipantData = {
  id: string; first_name: string; last_name: string; passport_number: string; kite_level: KiteLevel | ''; client_id: string
  // Per-traveler kite activity (source of truth for the booking num_* counters)
  does_kite: boolean
  brings_own_gear: boolean
  needs_storage: boolean
  wants_kite_lessons: boolean
  wants_kite_rental: boolean
  wants_wing_lessons: boolean
}

const EMPTY_ACTIVITY = {
  does_kite: false, brings_own_gear: false, needs_storage: false,
  wants_kite_lessons: false, wants_kite_rental: false, wants_wing_lessons: false,
}

interface ParticipantRowProps {
  p: ParticipantData
  clients: Client[]
  onChange: (patch: Partial<ParticipantData>) => void
  onRemove: () => void
}

function ParticipantRow({ p, clients, onChange, onRemove }: ParticipantRowProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const linkedClient = p.client_id ? clients.find(c => c.id === p.client_id) : null

  const suggestions = search.length >= 1
    ? clients.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : []

  function linkClient(c: Client) {
    onChange({
      client_id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      passport_number: c.passport_number ?? '',
      kite_level: c.kite_level ?? '',
    })
    setSearch('')
    setOpen(false)
  }

  function unlink() {
    onChange({ client_id: '' })
  }

  const levelBtnCls = (lvl: string) =>
    `px-2 py-1 rounded text-xs font-medium border transition-colors ${p.kite_level === lvl
      ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500'
      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'}`

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
      {/* Client link row */}
      <div className="relative">
        {linkedClient ? (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-400 px-2 py-1 rounded font-medium flex-1 truncate">
              🔗 {linkedClient.first_name} {linkedClient.last_name}
            </span>
            <button type="button" onClick={unlink}
              className="text-xs text-gray-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 shrink-0">Unlink</button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              placeholder="Link to existing client (optional)…"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {open && suggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg mt-0.5 max-h-36 overflow-y-auto">
                {suggestions.map(c => (
                  <button key={c.id} type="button"
                    onMouseDown={() => linkClient(c)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between gap-2">
                    <span className="font-medium">{c.first_name} {c.last_name}</span>
                    {c.kite_level && <span className="text-gray-400 dark:text-gray-400 capitalize">{c.kite_level}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Name + passport */}
      <div className="grid grid-cols-3 gap-1.5">
        <input placeholder="First name" value={p.first_name}
          onChange={e => onChange({ first_name: e.target.value })}
          className="px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <input placeholder="Last name" value={p.last_name}
          onChange={e => onChange({ last_name: e.target.value })}
          className="px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <input placeholder="Passport #" value={p.passport_number}
          onChange={e => onChange({ passport_number: e.target.value })}
          className="px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      {/* Kite level + remove */}
      <div className="flex flex-wrap items-center gap-1 gap-y-1">
        <span className="text-xs text-gray-400 dark:text-gray-400 mr-0.5">Kite:</span>
        {(['beg-total', 'beg-bodydrag', 'beg-waterstart', 'intermediate', 'advanced'] as const).map(lvl => (
          <button key={lvl} type="button"
            onClick={() => onChange({ kite_level: p.kite_level === lvl ? '' : lvl })}
            className={levelBtnCls(lvl)}>
            {KITE_LEVEL_LABELS[lvl]}
          </button>
        ))}
        <div className="flex-1" />
        <button type="button" onClick={onRemove}
          className="text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400 text-lg leading-none px-0.5">✕</button>
      </div>
    </div>
  )
}

// ─── Wizard component (top-level for focus safety) ────────────────────────────

interface WizardProps {
  initial: WizardData
  clients: Client[]
  clientsLoading: boolean
  rooms: Room[]
  accommodations: Accommodation[]
  agencies: Agency[]
  /** The "how did you hear about us" list, Options → Sources. */
  sources: EnquirySource[]
  houseRentals: HouseRental[]
  roomRates: RoomRate[]
  drivers: TaxiDriver[]
  bookings: Booking[]
  bookingRooms: BookingRoom[]
  taxiTrips: TaxiTrip[]
  editingBookingId: string | null
  isEditing: boolean
  /** The enquiry this booking was converted from, when there was one. */
  originEnquiry: Enquiry | null
  /** Sum of non-discount payments already recorded — the accounting source of truth */
  recordedPaid: number
  onCancel: () => void
  onSave: (data: WizardData, isNew: boolean, editingId?: string | null) => void
  lang: Lang
}

function BookingWizard({ initial, clients, clientsLoading, rooms, accommodations, agencies, sources, houseRentals, roomRates, drivers, bookings, bookingRooms, taxiTrips, editingBookingId, isEditing, originEnquiry, recordedPaid, onCancel, onSave, lang }: WizardProps) {
  const [step, setStep] = useState(1)
  const [maxReached, setMaxReached] = useState(isEditing ? 6 : 1)
  const [d, setD] = useState<WizardData>(initial)
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientSearch, setClientSearch] = useState('')

  function update(patch: Partial<WizardData>) { setD(prev => ({ ...prev, ...patch })) }

  function goTo(n: number) {
    if (n === 3 && !isEditing && d.participants.length === 0) {
      const firstName = d.client_id
        ? (clients.find(c => c.id === d.client_id)?.first_name ?? '')
        : d.new_client_first_name
      const lastName = d.client_id
        ? (clients.find(c => c.id === d.client_id)?.last_name ?? '')
        : d.new_client_last_name
      if (firstName || lastName) {
        const autoClientId = d.client_id || ''
        const autoKiteLevel = d.client_id ? (clients.find(c => c.id === d.client_id)?.kite_level ?? '') : ''
        const autoPassport = d.client_id ? (clients.find(c => c.id === d.client_id)?.passport_number ?? '') : ''
        update({ participants: [{ id: `p${Date.now()}`, first_name: firstName, last_name: lastName, passport_number: autoPassport, kite_level: autoKiteLevel as ParticipantData['kite_level'], client_id: autoClientId, ...EMPTY_ACTIVITY }] })
      }
    }
    setStep(n)
    if (n > maxReached) setMaxReached(n)
  }
  function next() { goTo(Math.min(6, step + 1)) }
  function back() { setStep(s => Math.max(1, s - 1)) }

  // Nights count
  const nights = d.check_in && d.check_out
    ? Math.max(0, (new Date(d.check_out).getTime() - new Date(d.check_in).getTime()) / 86400000)
    : 0

  const filteredClients = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email ?? ''}`
      .toLowerCase()
      .includes(clientSearch.toLowerCase())
  )

  // Participant helpers
  function addParticipant() {
    update({ participants: [...d.participants, { id: `p${Date.now()}`, first_name: '', last_name: '', passport_number: '', kite_level: '', client_id: '', ...EMPTY_ACTIVITY }] })
  }
  function updateParticipant(i: number, patch: Partial<ParticipantData>) {
    const parts = [...d.participants]
    parts[i] = { ...parts[i], ...patch }
    update({ participants: parts })
  }
  function removeParticipant(i: number) {
    update({ participants: d.participants.filter((_, idx) => idx !== i) })
  }

  // Rooms grouped by accommodation
  const roomsByAcco = accommodations.map(acc => ({
    acc,
    rooms: rooms.filter(r => r.accommodation_id === acc.id),
  })).filter(g => g.rooms.length > 0)

  function isExternallyBilled(accId: string | undefined): boolean {
    return !!accId && !!accommodations.find(a => a.id === accId)?.external_billing
  }

  /** One stay line per externally-billed accommodation among the selected rooms:
   *  created when its first spot is taken, dropped with its last. Amounts already
   *  typed are kept — adding a second spot must not wipe the agreed price. */
  function syncExternalStays(roomIds: string[]): Record<string, ExternalStayAmounts> {
    const next: Record<string, ExternalStayAmounts> = {}
    for (const rid of roomIds) {
      const accId = rooms.find(r => r.id === rid)?.accommodation_id
      if (!accId || !isExternallyBilled(accId)) continue
      next[accId] = d.external_stays[accId] ?? { cost: 0, sell: 0 }
    }
    return next
  }

  // Room selection helpers
  function toggleRoom(roomId: string) {
    if (d.room_ids.includes(roomId)) {
      const newPrices = { ...d.room_prices }
      delete newPrices[roomId]
      const nextIds = d.room_ids.filter(id => id !== roomId)
      update({ room_ids: nextIds, room_prices: newPrices, external_stays: syncExternalStays(nextIds) })
    } else {
      // Externally-billed spots carry no nightly rate by design: their money lives
      // on the stay line below, so the per-night price stays at 0 on purpose.
      const baseRate = roomRates.find(r => r.room_id === roomId)?.price_per_night ?? 0
      const nextIds = [...d.room_ids, roomId]
      update({
        room_ids: nextIds,
        room_prices: { ...d.room_prices, [roomId]: d.room_prices[roomId] ?? baseRate },
        external_stays: syncExternalStays(nextIds),
      })
    }
  }
  function toggleFullHouse(accId: string, accRoomIds: string[]) {
    const allSelected = accRoomIds.every(id => d.room_ids.includes(id))
    if (allSelected) {
      const newPrices = { ...d.room_prices }
      accRoomIds.forEach(id => delete newPrices[id])
      const nextIds = d.room_ids.filter(id => !accRoomIds.includes(id))
      update({ room_ids: nextIds, room_prices: newPrices, external_stays: syncExternalStays(nextIds) })
    } else {
      // Full house has a single flat price (Management → "Full house €/night"),
      // not the sum of both rooms. Split evenly across rooms so the per-room
      // total equals the house price.
      // No configured full-house rate → 0, and the wizard shows it: better an
      // obvious zero to correct than a 100 nobody chose (it was hardcoded here).
      const newPrices = { ...d.room_prices }
      const each = (getFullHouseRate(accId, roomRates) ?? 0) / accRoomIds.length
      accRoomIds.forEach(id => { newPrices[id] = each })
      const nextIds = [...d.room_ids.filter(id => !accRoomIds.includes(id)), ...accRoomIds]
      update({ room_ids: nextIds, room_prices: newPrices, external_stays: syncExternalStays(nextIds) })
    }
  }
  function isHouseAvailable(accId: string): boolean | null {
    if (!d.check_in || !d.check_out) return null
    const rentals = houseRentals.filter(r => r.accommodation_id === accId)
    if (rentals.length === 0) return false
    return rentals.some(r => r.start_date <= d.check_in && r.end_date >= d.check_out)
  }

  // Half-day convention: same-day check-out/check-in is NOT a conflict (strict comparisons)
  function isRoomConflicted(roomId: string): boolean {
    if (!d.check_in || !d.check_out) return false
    return bookingRooms.some(br => {
      if (br.room_id !== roomId) return false
      if (br.booking_id === editingBookingId) return false
      const b = bookings.find(b => b.id === br.booking_id)
      if (!b || b.status === 'cancelled') return false
      return b.check_in < d.check_out && b.check_out > d.check_in
    })
  }

  const canProceed: Record<number, boolean> = {
    1: creatingClient
      ? !!(d.new_client_first_name && d.new_client_last_name)
      : !!d.client_id,
    2: !!(d.check_in && d.check_out && d.check_in < d.check_out),
    3: true,
    4: true,
    5: true,
    6: true,
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
              {isEditing ? i18n.bookings.title_edit_booking[lang] : i18n.bookings.title_new_booking[lang]}
            </h2>
            <button onClick={onCancel} className="text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-bold text-xl w-8 h-8 flex items-center justify-center">✕</button>
          </div>
          <StepBar current={step} onGoto={goTo} maxReached={maxReached} lang={lang} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* ── Step 1: Client ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* First thing on the first step: what was said before this
                  booking existed. Until now it was only reachable by hunting
                  through the archived enquiries, if gui remembered there was
                  one. */}
              {originEnquiry && (
                <EnquiryOriginPanel
                  enquiry={originEnquiry}
                  // Computed from the live wizard state, not from the saved row:
                  // the warning has to clear as gui fills step 3 in, or it would
                  // still be shouting about a gap he has just closed.
                  gaps={intentGaps(originEnquiry, {
                    participantCount: d.participants.filter(p => p.first_name.trim()).length,
                    wantsLessons: d.participants.some(p => p.wants_kite_lessons || p.wants_wing_lessons),
                    wantsRental: d.participants.some(p => p.wants_kite_rental),
                    hasAccommodation: d.room_ids.length > 0 || Object.keys(d.external_stays).length > 0,
                  })}
                />
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">Who is booking? Select an existing client or create a new one.</p>

              {!creatingClient ? (
                <>
                  <Field label="Search client">
                    <input type="text" placeholder="Name or email…" value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)} className={inputCls} />
                  </Field>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {clientsLoading ? (
                      <p className="text-sm text-gray-400 dark:text-gray-400 italic px-1 py-2">Loading clients…</p>
                    ) : filteredClients.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-400 italic px-1">No client found.</p>
                    ) : filteredClients.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => update({ client_id: c.id })}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                          ${d.client_id === c.id ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200'}`}
                      >
                        <div className="font-medium">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-400">{c.email ?? c.phone ?? c.nationality ?? '—'}</div>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => { setCreatingClient(true); update({ client_id: '' }) }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400 font-medium">
                    + Create new client
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                    This client will be added to the client list on save.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name *">
                      <input type="text" value={d.new_client_first_name}
                        onChange={e => update({ new_client_first_name: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Last name *">
                      <input type="text" value={d.new_client_last_name}
                        onChange={e => update({ new_client_last_name: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email">
                      <input type="email" value={d.new_client_email}
                        onChange={e => update({ new_client_email: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Phone">
                      <input type="tel" value={d.new_client_phone}
                        onChange={e => update({ new_client_phone: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nationality">
                      <input type="text" value={d.new_client_nationality}
                        onChange={e => update({ new_client_nationality: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Kite level">
                      <select value={d.new_client_kite_level}
                        onChange={e => update({ new_client_kite_level: e.target.value as WizardData['new_client_kite_level'] })}
                        className={inputCls}>
                        <option value="">— unknown —</option>
                        <option value="beg-total">Beg-Total</option>
                        <option value="beg-bodydrag">Beg-BodyDrag</option>
                        <option value="beg-waterstart">Beg-WaterStart</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </Field>
                  </div>
                  <button type="button" onClick={() => setCreatingClient(false)}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">← Back to list</button>
                </>
              )}

              {/* The same question the two public forms ask, from the same list.
                  It was missing here, and that gap was the whole reason the
                  attribution table read "Unknown" for most guests: a booking
                  typed straight into this wizard had no origin at all. */}
              <Field label="How did you hear about us? (optional)"
                hint="Same list as the public forms — Options → Sources. This is what the end-of-season attribution counts.">
                <select value={d.source_id} onChange={e => update({ source_id: e.target.value, referral_source: '' })} className={inputCls}>
                  <option value="">— not asked —</option>
                  {sources.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>{s.label?.en || s.label?.fr || ''}</option>
                  ))}
                  <option value="other">Other</option>
                </select>
                {d.source_id === 'other' && (
                  <input className={`${inputCls} mt-2`} placeholder="In their words — a friend, a kite school…"
                    value={d.referral_source} onChange={e => update({ referral_source: e.target.value })} />
                )}
              </Field>

              {agencies.length > 0 && (
                <Field label="Referred by (optional)" hint="A partner agency (Fun&Fly & co.) — doesn't change billing yet, just tags the booking.">
                  <select value={d.agency_id} onChange={e => update({ agency_id: e.target.value })} className={inputCls}>
                    <option value="">— direct booking —</option>
                    {agencies.filter(a => a.is_active).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}

          {/* ── Step 2: Stay ────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Kite center dates */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">🏄 Kite center stay</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Check-in *">
                    <input type="date" value={d.check_in}
                      onChange={e => {
                        const val = e.target.value
                        update({ check_in: val, ...(d.visa_entry_date === '' || d.visa_entry_date === d.check_in ? { visa_entry_date: val } : {}) })
                      }} className={inputCls} />
                  </Field>
                  <Field label="Check-out *">
                    <input type="date" value={d.check_out}
                      onChange={e => {
                        const val = e.target.value
                        update({ check_out: val, ...(d.visa_exit_date === '' || d.visa_exit_date === d.check_out ? { visa_exit_date: val } : {}) })
                      }} className={inputCls} />
                  </Field>
                </div>
                {nights > 0 && (
                  <p className="text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-lg px-3 py-2 font-medium mt-2">
                    {nights} night{nights > 1 ? 's' : ''}
                  </p>
                )}
                {d.check_in && d.check_out && d.check_in >= d.check_out && (
                  <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2 font-medium mt-2">
                    ⚠ Check-out must be after check-in.
                  </p>
                )}
              </div>

              {/* Visa / Mozambique dates */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">🛂 Mozambique — visa dates</p>
                <p className="text-xs text-gray-400 dark:text-gray-400 mb-2">Entry/exit dates in the country, used for the visa invitation letter. Can differ from the center stay.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Entry date">
                    <input type="date" value={d.visa_entry_date}
                      onChange={e => update({ visa_entry_date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Exit date">
                    <input type="date" value={d.visa_exit_date}
                      onChange={e => update({ visa_exit_date: e.target.value })} className={inputCls} />
                  </Field>
                </div>
              </div>

              <Field label="Rooms" hint="Optional — can be assigned later in the planning view">
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {d.room_ids.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-400 italic px-1">No room selected — click to assign.</p>
                  )}
                  {(['house', 'bungalow', 'other'] as const).map(type => {
                    const typeAccos = roomsByAcco.filter(g => g.acc.type === type)
                    if (typeAccos.length === 0) return null
                    const typeLabel = type === 'house' ? '🏠 Houses' : type === 'bungalow' ? '🏡 Bungalows' : '🏨 Other'
                    return (
                      <div key={type}>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest px-1 mb-1 mt-1">{typeLabel}</p>
                        {typeAccos.map(({ acc, rooms: accRooms }) => {
                          const isHouse = acc.type === 'house'
                          const accRoomIds = accRooms.map(r => r.id)
                          const allSelected = accRoomIds.every(id => d.room_ids.includes(id))
                          const availability = isHouse ? isHouseAvailable(acc.id) : null
                          return (
                            <div key={acc.id} className="mb-2">
                              <div className="flex items-center gap-2 px-1 mb-1">
                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide">{acc.name}</p>
                                {isHouse && availability === false && (
                                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">Not rented</span>
                                )}
                                {isHouse && availability === true && (
                                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">Available</span>
                                )}
                              </div>
                              <div className="space-y-1">
                                {isHouse && accRooms.length === 2 && (
                                  <button type="button" onClick={() => toggleFullHouse(acc.id, accRoomIds)}
                                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors font-medium
                                      ${allSelected ? 'border-purple-500 dark:border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-400' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                    🏠 Full house (F + B)
                                  </button>
                                )}
                                {accRooms.map(r => {
                                  const conflicted = isRoomConflicted(r.id)
                                  const selected = d.room_ids.includes(r.id)
                                  return (
                                    <button key={r.id} type="button" onClick={() => toggleRoom(r.id)}
                                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between
                                        ${selected ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 font-medium'
                                          : conflicted ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-gray-700 dark:text-gray-300'
                                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                      <span>
                                        {acc.name} / {r.name}
                                        <span className="text-xs text-gray-400 dark:text-gray-400 ml-2">capacity {r.capacity}</span>
                                      </span>
                                      {conflicted && !selected && (
                                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded font-medium shrink-0">⚠ Booked</span>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </Field>


              {d.room_ids.length > 0 && nights > 0 && (
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">💰 Pricing</p>
                  <div className="space-y-2">
                    {(() => {
                      // Group selected rooms into price units: a house with BOTH rooms
                      // selected is one "full house" unit (single price), others stay per-room.
                      type Unit = { key: string; label: string; roomIds: string[] }
                      const byAcc = new Map<string, string[]>()
                      for (const rid of d.room_ids) {
                        const room = rooms.find(r => r.id === rid)
                        if (!room) continue
                        byAcc.set(room.accommodation_id, [...(byAcc.get(room.accommodation_id) ?? []), rid])
                      }
                      const units: Unit[] = []
                      for (const [accId, accRoomIds] of byAcc) {
                        const acc = accommodations.find(a => a.id === accId)
                        // Externally-billed places are priced per stay, below — they
                        // have no €/night line to show here.
                        if (acc?.external_billing) continue
                        const accTotalRooms = rooms.filter(r => r.accommodation_id === accId).length
                        const isFullHouse = acc?.type === 'house' && accTotalRooms === 2 && accRoomIds.length === 2
                        if (isFullHouse) {
                          units.push({ key: accId, label: `${acc?.name} (full house)`, roomIds: accRoomIds })
                        } else {
                          for (const rid of accRoomIds) {
                            const room = rooms.find(r => r.id === rid)
                            units.push({ key: rid, label: `${acc?.name} / ${room?.name}`, roomIds: [rid] })
                          }
                        }
                      }
                      return units.map(unit => {
                        const price = unit.roomIds.reduce((s, id) => s + (d.room_prices[id] ?? 0), 0)
                        return (
                          <div key={unit.key} className="flex items-center gap-2">
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{unit.label}</span>
                            <input
                              type="number" min="0" step="1"
                              value={price}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0
                                const next = { ...d.room_prices }
                                const each = val / unit.roomIds.length
                                unit.roomIds.forEach(id => { next[id] = each })
                                update({ room_prices: next })
                              }}
                              className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-400 shrink-0">€/night</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right shrink-0">= {price * nights} €</span>
                          </div>
                        )
                      })
                    })()}

                    {/* Externally-billed stays: one flat amount for the whole stay,
                        and what we pay the place alongside it — the margin is the
                        only reason these bookings are worth tracking at all. */}
                    {Object.entries(d.external_stays).map(([accId, amt]) => {
                      const acc = accommodations.find(a => a.id === accId)
                      const spots = d.room_ids.filter(id => rooms.find(r => r.id === id)?.accommodation_id === accId).length
                      const setAmt = (patch: Partial<ExternalStayAmounts>) =>
                        update({ external_stays: { ...d.external_stays, [accId]: { ...amt, ...patch } } })
                      return (
                        <div key={accId} className="border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                              {acc?.name ?? 'External stay'}
                              <span className="text-xs text-gray-400 dark:text-gray-400 ml-2">
                                {spots} spot{spots === 1 ? '' : 's'} · whole stay
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">We pay the place</span>
                            <input
                              type="number" min="0" step="1" value={amt.cost}
                              onChange={e => setAmt({ cost: parseFloat(e.target.value) || 0 })}
                              className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-400 w-16 shrink-0">€ total</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">Charged to the guest</span>
                            <input
                              type="number" min="0" step="1" value={amt.sell}
                              onChange={e => setAmt({ sell: parseFloat(e.target.value) || 0 })}
                              className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-400 w-16 shrink-0">€ total</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {amt.sell === 0 && amt.cost === 0
                              ? 'Nothing goes through the center — tracked for the planning only.'
                              : <>Margin <span className={amt.sell - amt.cost < 0 ? 'text-red-500 dark:text-red-400 font-medium' : 'font-medium'}>{amt.sell - amt.cost} €</span> for the whole stay</>}
                          </p>
                        </div>
                      )
                    })}

                    {(d.room_ids.length > 1 || Object.keys(d.external_stays).length > 0) && (
                      <div className="flex justify-between items-center pt-2 border-t text-sm font-semibold text-gray-700 dark:text-gray-300">
                        <span>Total accommodation</span>
                        <span>
                          {d.room_ids.reduce((s, id) => s + (d.room_prices[id] ?? 0) * nights, 0)
                            + Object.values(d.external_stays).reduce((s, a) => s + a.sell, 0)} €
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Field label="Status">
                <div className="flex gap-2">
                  {(['provisional', 'confirmed', 'cancelled'] as BookingStatus[]).map(s => (
                    <button key={s} type="button" onClick={() => update({ status: s })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-colors
                        ${d.status === s
                          ? s === 'confirmed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                            : s === 'cancelled' ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-400 dark:border-gray-600'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                          : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* ── Step 3: Guests ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add each person staying — their names and passport numbers are needed for the visa document.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Couples">
                  <Counter value={d.couples_count} onChange={v => update({ couples_count: v })} />
                </Field>
                <Field label="Children">
                  <Counter value={d.children_count} onChange={v => update({ children_count: v })} />
                </Field>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Participants
                    <span className="ml-2 font-normal text-gray-400 dark:text-gray-400">{d.participants.length} person{d.participants.length !== 1 ? 's' : ''}</span>
                  </h3>
                  <button type="button" onClick={addParticipant}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400 font-medium">+ Add</button>
                </div>

                {d.participants.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-400 italic">No participants yet. Add them for visa document generation.</p>
                )}

                <div className="space-y-2">
                  {d.participants.map((p, i) => (
                    <ParticipantRow
                      key={p.id}
                      p={p}
                      clients={clients}
                      onChange={patch => updateParticipant(i, patch)}
                      onRemove={() => removeParticipant(i)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Transport ───────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Passenger total — helps pick the right taxi/vehicle */}
              {(() => {
                const pax = d.participants.filter(p => p.first_name.trim()).length
                return (
                  <div className="flex items-center justify-between p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-xl text-sm">
                    <span className="text-sky-800 dark:text-sky-400 flex items-center gap-2">👥 Total passengers</span>
                    <span className="font-semibold text-sky-900 dark:text-sky-400">{pax} {pax === 1 ? 'person' : 'people'}</span>
                  </div>
                )
              })()}

              {/* Arrival */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">✈️ Arrival</h3>
                <div className="space-y-3">
                  <Field label="Arrival time">
                    <input type="time" value={d.arrival_time}
                      onChange={e => update({ arrival_time: e.target.value })} className={inputCls} />
                  </Field>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={d.taxi_arrival}
                      onChange={e => update({ taxi_arrival: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">🚕 Taxi needed on arrival</span>
                  </label>
                  {isEditing && !d.taxi_arrival && taxiTrips.some(t => t.booking_id === editingBookingId && t.type === 'aero-to-center') && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">⚠ A transfer already exists for this booking in Taxis — unchecking here won't remove it, delete it there if it's no longer needed.</p>
                  )}
                  {isEditing && d.taxi_arrival && !taxiTrips.some(t => t.booking_id === editingBookingId && t.type === 'aero-to-center') && (
                    <p className="text-xs text-gray-400 dark:text-gray-400">A transfer request will be created in Taxis when you save.</p>
                  )}
                </div>
              </div>

              {/* Departure */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">🛫 Departure</h3>
                <div className="space-y-3">
                  <Field label="Departure time">
                    <input type="time" value={d.departure_time}
                      onChange={e => update({ departure_time: e.target.value })} className={inputCls} />
                  </Field>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={d.taxi_departure}
                      onChange={e => update({ taxi_departure: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">🚕 Taxi needed on departure</span>
                  </label>
                  {isEditing && !d.taxi_departure && taxiTrips.some(t => t.booking_id === editingBookingId && t.type === 'center-to-aero') && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">⚠ A transfer already exists for this booking in Taxis — unchecking here won't remove it, delete it there if it's no longer needed.</p>
                  )}
                  {isEditing && d.taxi_departure && !taxiTrips.some(t => t.booking_id === editingBookingId && t.type === 'center-to-aero') && (
                    <p className="text-xs text-gray-400 dark:text-gray-400">A transfer request will be created in Taxis when you save.</p>
                  )}
                </div>
              </div>

              {/* Pre-assign taxi driver (only relevant if a taxi is needed; new bookings only) */}
              {!isEditing && (d.taxi_arrival || d.taxi_departure) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">🚕 Taxi driver</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-400 mb-2">Optional — pre-assigns this driver and their default prices to the arrival/departure trips. Editable later in the Taxi page.</p>
                  <select value={d.taxi_driver_id ?? ''}
                    onChange={e => update({ taxi_driver_id: e.target.value || null })}
                    className={inputCls}>
                    <option value="">— Assign later —</option>
                    {drivers.map(dr => (
                      <option key={dr.id} value={dr.id}>{dr.name} ({dr.default_price_eur}€ / {dr.default_driver_mzn.toLocaleString()} MZN driver)</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Baggage */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🧳 Baggage</h3>
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Suitcases / bags">
                    <Counter value={d.luggage_count} onChange={v => update({ luggage_count: v })} />
                  </Field>
                  <Field label="Boardbags">
                    <Counter value={d.boardbag_count} onChange={v => update({ boardbag_count: v })} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: KiteCenter ──────────────────────────────────────── */}
          {step === 5 && (() => {
            const counts = deriveActivityCounts(d.participants)
            return (
            <div className="space-y-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Set what each traveler does at the center. Own-gear riders are billed center access.
              </p>

              {d.participants.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-400 italic">No travelers yet — add them in the Guests step first.</p>
              )}

              <div className="space-y-3">
                {d.participants.map((p, i) => (
                  <div key={p.id} className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate">
                        {p.first_name || `Traveler ${i + 1}`}{p.last_name ? ` ${p.last_name}` : ''}
                      </p>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 shrink-0">
                        <input type="checkbox" checked={p.does_kite}
                          onChange={e => updateParticipant(i, { does_kite: e.target.checked })} />
                        🪁 Kites
                      </label>
                    </div>
                    {p.does_kite && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 text-xs">
                        <label className="flex items-center gap-1.5 text-purple-800 dark:text-purple-400">
                          <input type="checkbox" checked={p.wants_kite_lessons}
                            onChange={e => updateParticipant(i, { wants_kite_lessons: e.target.checked })} />
                          📚 Lessons
                        </label>
                        <label className="flex items-center gap-1.5 text-cyan-800 dark:text-cyan-400">
                          <input type="checkbox" checked={p.wants_wing_lessons}
                            onChange={e => updateParticipant(i, { wants_wing_lessons: e.target.checked })} />
                          🪽 Wing
                        </label>
                        <label className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
                          <input type="checkbox" checked={p.wants_kite_rental}
                            onChange={e => updateParticipant(i, { wants_kite_rental: e.target.checked })} />
                          🛹 Rental
                        </label>
                        <label className="flex items-center gap-1.5 text-blue-800 dark:text-blue-400">
                          <input type="checkbox" checked={p.brings_own_gear}
                            onChange={e => updateParticipant(i, { brings_own_gear: e.target.checked, needs_storage: e.target.checked ? p.needs_storage : false })} />
                          🏖️ Own gear (center access)
                        </label>
                        {p.brings_own_gear && (
                          <label className="flex items-center gap-1.5 text-blue-800 dark:text-blue-400">
                            <input type="checkbox" checked={p.needs_storage}
                              onChange={e => updateParticipant(i, { needs_storage: e.target.checked })} />
                            📦 Storage
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Center access rate — shown when at least one own-gear traveler */}
              {counts.centerAccess > 0 && (
                <div className="flex items-center justify-between gap-2 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl">
                  <span className="text-xs text-blue-700 dark:text-blue-400">🏖️ Center access rate ({counts.centerAccess} own-gear · per person / day)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="0.5"
                      value={d.center_access_rate}
                      onChange={e => update({ center_access_rate: parseFloat(e.target.value) || 0 })}
                      className="w-20 px-2 py-1.5 border border-blue-300 dark:border-blue-800 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-blue-600 dark:text-blue-400">€/day</span>
                  </div>
                </div>
              )}

              {(counts.lessons + counts.rentals + counts.wing + counts.centerAccess) > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-right">
                  {[
                    counts.lessons > 0 && `${counts.lessons} lessons`,
                    counts.wing > 0 && `${counts.wing} wing`,
                    counts.rentals > 0 && `${counts.rentals} rental`,
                    counts.centerAccess > 0 && `${counts.centerAccess} center access`,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            )
          })()}

          {/* ── Step 6: Payment ─────────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-4">
              <Field label="Amount already paid (€)">
                <input type="number" min="0" value={d.amount_paid || ''}
                  onChange={e => update({ amount_paid: parseFloat(e.target.value) || 0 })}
                  placeholder="0" className={numCls} />
              </Field>

              {/* Saving only ever ADDS the difference as a new payment. Lowering this
                  field writes nothing, so it would silently disagree with the payments
                  already recorded — which is what the accounting actually reads. */}
              {isEditing && d.amount_paid < recordedPaid && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-400">
                    ⚠️ Lowering this will not remove anything
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 mt-1">
                    {recordedPaid} € of payments are already recorded on this booking.
                    Saving {d.amount_paid} € here adds nothing, and the accounting will keep
                    showing {recordedPaid} € collected. To take money back off, edit or delete
                    the payment in <strong>Accounting → Bookings</strong>.
                  </p>
                </div>
              )}
              {isEditing && d.amount_paid > recordedPaid && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Saving will add a payment of {d.amount_paid - recordedPaid} € (to verify),
                  on top of the {recordedPaid} € already recorded.
                </p>
              )}

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Summary</p>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Status</span>
                  <span className={`font-medium capitalize ${d.status === 'confirmed' ? 'text-emerald-700 dark:text-emerald-400' : d.status === 'cancelled' ? 'text-gray-500 dark:text-gray-400' : 'text-amber-700 dark:text-amber-400'}`}>{d.status}</span>
                </div>
                {d.check_in && d.check_out && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>🏄 Stay</span>
                    <span>{fmtDate(d.check_in)} → {fmtDate(d.check_out)} ({nights}N)</span>
                  </div>
                )}
                {(d.visa_entry_date || d.visa_exit_date) && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>🛂 Visa dates</span>
                    <span>{d.visa_entry_date || '?'} → {d.visa_exit_date || '?'}</span>
                  </div>
                )}
                {d.room_ids.length > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Room{d.room_ids.length > 1 ? 's' : ''}</span>
                    <span>{d.room_ids.map(rid => {
                      const r = rooms.find(r => r.id === rid)
                      const a = accommodations.find(a => a.id === r?.accommodation_id)
                      return r ? `${a?.name}/${r.name}` : '—'
                    }).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Participants</span>
                  <span>{d.participants.length} person{d.participants.length !== 1 ? 's' : ''}</span>
                </div>
                {(d.taxi_arrival || d.taxi_departure) && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Taxis</span>
                    <span>{[d.taxi_arrival && 'arrival', d.taxi_departure && 'departure'].filter(Boolean).join(' + ')}</span>
                  </div>
                )}
                {(d.luggage_count > 0 || d.boardbag_count > 0) && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Baggage</span>
                    <span>{d.luggage_count} bag{d.luggage_count !== 1 ? 's' : ''}{d.boardbag_count > 0 ? ` · ${d.boardbag_count} boardbag${d.boardbag_count !== 1 ? 's' : ''}` : ''}</span>
                  </div>
                )}
                {(() => {
                  const c = deriveActivityCounts(d.participants)
                  if (c.lessons + c.rentals + c.wing + c.centerAccess === 0) return null
                  return (
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>KiteCenter</span>
                      <span>
                        {[
                          c.lessons > 0 && `${c.lessons} lesson${c.lessons > 1 ? 's' : ''}`,
                          c.wing > 0 && `${c.wing} wing`,
                          c.rentals > 0 && `${c.rentals} rental${c.rentals > 1 ? 's' : ''}`,
                          c.centerAccess > 0 && `${c.centerAccess} access`,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )
                })()}
              </div>

              <Field label="Internal notes">
                <textarea value={d.notes} onChange={e => update({ notes: e.target.value })}
                  rows={3} placeholder="Allergies, special requests, Google Form reference…" className={inputCls} />
              </Field>
            </div>
          )}

        </div>

        {/* Footer nav */}
        <div className="px-5 py-4 border-t flex gap-3 bg-white dark:bg-gray-900">
          {step > 1 && (
            <button type="button" onClick={back}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm">
              ← {i18n.common.btn_back[lang]}
            </button>
          )}
          <div className="flex-1" />
          {step < 6 ? (
            <button type="button" onClick={next} disabled={!canProceed[step]}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white rounded-lg font-semibold text-sm transition-colors">
              {i18n.common.btn_next[lang]} →
            </button>
          ) : (
            <button type="button" onClick={() => onSave(d, !isEditing, editingBookingId)}
              className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors">
              ✓ {i18n.bookings.btn_save_booking[lang]}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusLabel(lang: Lang): Record<BookingStatus, string> {
  return {
    confirmed:   i18n.bookings.status_confirmed[lang],
    provisional: i18n.bookings.status_provisional[lang],
    cancelled:   i18n.bookings.status_cancelled[lang],
  }
}
const statusColor: Record<BookingStatus, string> = {
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
  provisional: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
  cancelled: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
}

const KITE_LEVEL_LABELS: Record<KiteLevel, string> = {
  'beg-total':      'Beg-Total',
  'beg-bodydrag':   'Beg-BodyDrag',
  'beg-waterstart': 'Beg-WaterStart',
  'intermediate':   'Intermediate',
  'advanced':       'Advanced',
}

/** Who is actually staying, unfolded under the booking row.
 *
 *  This is what Options → "Bookings & Guests" was for, and the only thing it
 *  did that this page could not. Reading a guest list used to mean either that
 *  tab or reopening the six-step wizard — so the list moved here, next to the
 *  ⚠️ that says something about those guests is missing.
 *
 *  Module scope: a component redefined on every render is remounted on every
 *  render. Read-only, so nothing to lose yet, but the rule is the rule. */
function GuestList({ guests }: { guests: BookingParticipant[] }) {
  if (guests.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 italic">No guests listed — the visa document needs them.</p>
  }
  return (
    <ul className="space-y-1.5">
      {guests.map(p => (
        <li key={p.id} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-800 dark:text-gray-200">{p.first_name} {p.last_name ?? ''}</span>
          {p.kite_level && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
              {KITE_LEVEL_LABELS[p.kite_level]}
            </span>
          )}
          {p.passport_number?.trim()
            ? <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{p.passport_number}</span>
            // Named, not counted: the ⚠️ says a passport is missing, this says whose.
            : <span className="text-xs text-amber-600 dark:text-amber-400">no passport number</span>}
          {p.notes && <span className="text-xs text-gray-400 dark:text-gray-500 italic">{p.notes}</span>}
        </li>
      ))}
    </ul>
  )
}

function getNights(b: Booking) {
  if (!b.check_in || !b.check_out) return 0
  return Math.max(0, (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)
}

type FilterKey = 'all' | 'complete' | 'incomplete' | 'upcoming' | 'active' | 'confirmed' | 'provisional' | 'cancelled'

type SortKey = 'booking_number' | 'client' | 'check_in' | 'status'
type SortDir = 'asc' | 'desc'

function getFilters(lang: Lang): { key: FilterKey; label: string }[] {
  return [
    { key: 'all',         label: i18n.bookings.filter_all[lang] },
    { key: 'complete',    label: `✅ ${i18n.bookings.filter_complete[lang]}` },
    { key: 'incomplete',  label: `⚠️ ${i18n.bookings.filter_incomplete[lang]}` },
    { key: 'upcoming',    label: `📅 ${i18n.bookings.filter_upcoming[lang]}` },
    { key: 'active',      label: `🏄 ${i18n.bookings.filter_active[lang]}` },
    { key: 'confirmed',   label: i18n.bookings.status_confirmed[lang] },
    { key: 'provisional', label: i18n.bookings.status_provisional[lang] },
    { key: 'cancelled',   label: i18n.bookings.status_cancelled[lang] },
  ]
}

// ─── Main page ─────────────────────────────────────────────────────────────────

interface BookingsPageProps {
  initialEditBookingId?: string | null
  onEditOpened?: () => void
}

export default function BookingsPage({ initialEditBookingId, onEditOpened }: BookingsPageProps = {}) {
  const { lang } = useLanguage()
  const FILTERS = getFilters(lang)
  const statusLabel = getStatusLabel(lang)
  const { data: bookings, loading, error, refresh: refreshBookings } = useBookings()
  const { data: clients, loading: clientsLoading, refresh: refreshClients } = useClients()
  const { data: bookingRooms, refresh: refreshBookingRooms } = useBookingRooms()
  const { data: bookingRoomPricesData } = useBookingRoomPrices()
  const { data: rooms } = useRooms()
  const { data: accommodations } = useAccommodations()
  const { data: agencies } = useAgencies()
  const { data: houseRentals } = useTable<HouseRental>('house_rentals')
  // The list only ever marks whole bookings, so no invoice lines are needed:
  // agencyMarker falls straight through to the booking's own agency_id.
  const agencyLookup = { agencies, bookings, agencyBillingLines: [] }
  // Read only to show where a booking came from (enquiries.booking_id). Nothing
  // here writes to enquiries — the conversion already did that.
  const { data: enquiries } = useTable<Enquiry>('enquiries')
  const { data: sources } = useTable<EnquirySource>('enquiry_sources', { order: 'sort_order' })
  const { data: roomRatesData } = useTable<RoomRate>('room_rates')
  const { data: externalStaysData, refresh: refreshExternalStays } =
    useTable<ExternalAccommodationBooking>('external_accommodation_bookings')
  const { data: priceItemsData } = useTable<PriceItem>('price_items')
  // €/day per own-gear guest, from Options → Pricing. 0 when nothing is configured:
  // the rate is shown and editable on the booking, so a missing one is visible.
  const centerAccessRate = getConfiguredRate(priceItemsData, 'center_access') ?? 0
  const { data: taxiDrivers } = useTaxiDrivers()
  const { data: taxiTrips, refresh: refreshTaxiTrips } = useTaxiTrips()
  const { data: participantsData } = useBookingParticipants()
  const { data: lessonsData } = useTable<Lesson>('lessons')
  const { data: rentalsData } = useTable<EquipmentRental>('equipment_rentals')
  const { data: paymentsData } = useTable<Payment>('payments')
  const [bookingParticipants, setBookingParticipants] = useState<BookingParticipant[]>([])
  useEffect(() => setBookingParticipants(participantsData), [participantsData])

  const [wizard, setWizard] = useState<{ open: boolean; editing: Booking | null }>({ open: false, editing: null })
  const [filter, setFilter] = useState<FilterKey>('all')
  const [nameSearch, setNameSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'booking_number', dir: 'desc' })
  /** Which booking has its guest list unfolded. One at a time: the point is to
   *  answer "who is in #023", not to turn the list into a wall of names. */
  const [openGuestsId, setOpenGuestsId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const getClientName = (id: string) => {
    const c = clients.find(c => c.id === id)
    return c ? `${c.first_name} ${c.last_name}` : '?'
  }

  /** The enquiry a booking was converted from, if any — the 📣 in the list. */
  const originOf = (bookingId: string) => enquiries.find(e => e.booking_id === bookingId) ?? null

  const getRoomLabel = (bookingId: string) => {
    const brs = bookingRooms.filter(b => b.booking_id === bookingId)
    if (brs.length === 0) return '—'
    return brs.map(br => {
      const r = rooms.find(r => r.id === br.room_id)
      const a = accommodations.find(a => a.id === r?.accommodation_id)
      return r ? `${a?.name}/${r.name}` : '—'
    }).join(', ')
  }

  function openNew() { setWizard({ open: true, editing: null }) }
  function openEdit(b: Booking) { setWizard({ open: true, editing: b }) }
  function closeWizard() { setWizard({ open: false, editing: null }) }

  useEffect(() => {
    if (!initialEditBookingId || loading) return
    const b = bookings.find(b => b.id === initialEditBookingId)
    if (b) { openEdit(b); onEditOpened?.() }
  }, [initialEditBookingId, bookings, loading])

  async function handleSave(data: WizardData, isNew: boolean, editingId: string | null = null) {
    setSaving(true)
    let clientId = data.client_id

    // 0. Check for date conflicts on rooms
    const hasConflict = data.room_ids.some(roomId => {
      const existingBookings = bookings.filter(b =>
        b.id !== editingId && // exclude current booking if editing
        bookingRooms.some(br => br.booking_id === b.id && br.room_id === roomId)
      )
      return existingBookings.some(b => {
        const checkIn = new Date(data.check_in).getTime()
        const checkOut = new Date(data.check_out).getTime()
        const existingIn = new Date(b.check_in).getTime()
        const existingOut = new Date(b.check_out).getTime()
        return !(checkOut <= existingIn || checkIn >= existingOut)
      })
    })
    if (hasConflict) {
      alert('⚠️ This room is already booked during this period. Please choose different dates or rooms.')
      setSaving(false)
      return
    }

    // 0 bis. Refuse to cancel a booking that already consumed billable services.
    // Cancelling would drop the revenue while the instructor still gets paid —
    // a silent loss on the season result. Taxi transfers are excluded: they are
    // auto-created with the booking, long before anything actually happened.
    if (data.status === 'cancelled' && editingId) {
      const lessonCount = lessonsData.filter(l => l.booking_id === editingId).length
      const rentalCount = rentalsData.filter(r => r.booking_id === editingId).length
      if (lessonCount > 0 || rentalCount > 0) {
        const what = [
          lessonCount > 0 && `${lessonCount} lesson${lessonCount > 1 ? 's' : ''}`,
          rentalCount > 0 && `${rentalCount} rental${rentalCount > 1 ? 's' : ''}`,
        ].filter(Boolean).join(' and ')
        alert(
          `⛔ This booking cannot be cancelled — it already has ${what} recorded.\n\n` +
          `Those are billed to the client and paid to the instructor. Remove them from ` +
          `the Planning first if they really did not happen, then cancel the booking.`
        )
        setSaving(false)
        return
      }
    }

    // 1. Create new client if needed
    if (!clientId && data.new_client_first_name) {
      const { data: newClientData, error: clientErr } = await supabase
        .from('clients')
        .insert({
          first_name: data.new_client_first_name,
          last_name: data.new_client_last_name,
          email: data.new_client_email || null,
          phone: data.new_client_phone || null,
          nationality: data.new_client_nationality || null,
          kite_level: data.new_client_kite_level || null,
          notes: null, passport_number: null, birth_date: null, import_id: null,
          emergency_contact_name: null, emergency_contact_phone: null,
          emergency_contact_email: null, emergency_contact_relation: null,
        })
        .select('id')
        .single()
      if (clientErr) {
        console.error('Client insert error:', clientErr)
        alert('Error creating client: ' + clientErr.message)
        setSaving(false)
        return
      }
      clientId = newClientData.id
      refreshClients()
    }

    if (!clientId) {
      alert('Please select or create a client.')
      setSaving(false)
      return
    }

    // 2. Insert or update booking
    const bookingFields = {
      client_id: clientId,
      agency_id: data.agency_id || null,
      check_in: data.check_in,
      check_out: data.check_out,
      visa_entry_date: data.visa_entry_date || null,
      visa_exit_date: data.visa_exit_date || null,
      status: data.status,
      notes: data.notes || null,
      // num_* counters derived from the per-traveler activity flags (kept in sync below)
      ...activityCountColumns(data.participants.filter(p => p.first_name.trim())),
      center_access_rate: data.center_access_rate,
      arrival_time: data.arrival_time || null,
      departure_time: data.departure_time || null,
      luggage_count: data.luggage_count,
      boardbag_count: data.boardbag_count,
      taxi_arrival: data.taxi_arrival,
      taxi_departure: data.taxi_departure,
      couples_count: data.couples_count,
      children_count: data.children_count,
      amount_paid: data.amount_paid,
      // The label, resolved to English like the public form does, so a source
      // picked here and one picked there are the same answer in the stats.
      referral_source: referralLabel({ sourceId: data.source_id, freeText: data.referral_source }, sources) || null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_email: null,
    }

    let bookingId: string
    if (isNew) {
      // booking_number auto-assigned by DB sequence
      const { data: saved, error: bookingErr } = await supabase
        .from('bookings')
        .insert({ ...bookingFields, import_id: null })
        .select('id')
        .single()
      if (bookingErr) {
        console.error('Booking insert error:', bookingErr)
        alert('Error saving booking: ' + bookingErr.message)
        setSaving(false)
        return
      }
      bookingId = saved.id
    } else {
      const { data: saved, error: bookingErr } = await supabase
        .from('bookings')
        .update({ ...bookingFields, import_id: wizard.editing?.import_id ?? null })
        .eq('id', wizard.editing!.id)
        .select('id')
        .single()
      if (bookingErr) {
        console.error('Booking update error:', bookingErr)
        alert('Error saving booking: ' + bookingErr.message)
        setSaving(false)
        return
      }
      bookingId = saved.id
    }

    // Steps 2b and 4–7 each write a different table, and none of them used to
    // be checked: a booking could come out of a "successful" save with no rooms,
    // no frozen prices, or a payment that was never recorded. Failures are
    // collected and shown together rather than swallowed.
    const problems: string[] = []

    // 2b. The chosen source id, in its own UPDATE — on purpose.
    //     `bookings.source_id` arrives with the 2026-09-03 migration. Folding it
    //     into the insert above would mean a database without that migration
    //     could not create a booking at all: the front door, broken by a
    //     statistic. Here the worst case is a line in the "not everything went
    //     with it" summary, and the label is already saved either way.
    const chosenSourceId = data.source_id && data.source_id !== 'other' ? data.source_id : null
    const { error: sourceErr } = await supabase.from('bookings')
      .update({ source_id: chosenSourceId }).eq('id', bookingId)
    if (sourceErr) problems.push(`the "how did you hear about us" answer was not recorded (${sourceErr.message})`)

    // 3. Guests — delete all + re-insert to booking_participants
    const { error: delErr } = await supabase.from('booking_participants').delete().eq('booking_id', bookingId)
    if (delErr) console.error('booking_participants delete error:', delErr)

    // If no participants entered, auto-add the main client
    const named = data.participants.filter(p => p.first_name.trim())
    const autoList = named.length === 0 ? (() => {
      const firstName = data.new_client_first_name || clients.find(c => c.id === clientId)?.first_name || ''
      const lastName  = data.new_client_last_name  || clients.find(c => c.id === clientId)?.last_name  || ''
      return firstName ? [{ first_name: firstName, last_name: lastName }] : []
    })() : []
    const participantsToInsert = [
      ...named.map(p => ({ first_name: p.first_name.trim(), last_name: p.last_name.trim() || null, passport_number: p.passport_number.trim() || null, kite_level: p.kite_level || null, client_id: p.client_id || null,
        does_kite: p.does_kite, brings_own_gear: p.brings_own_gear, needs_storage: p.needs_storage,
        wants_kite_lessons: p.wants_kite_lessons, wants_kite_rental: p.wants_kite_rental, wants_wing_lessons: p.wants_wing_lessons })),
      ...autoList.map(p => ({ ...p, passport_number: null, kite_level: null, client_id: null, ...EMPTY_ACTIVITY })),
    ]
    if (participantsToInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase.from('booking_participants').insert(
        participantsToInsert.map(p => ({
          booking_id: bookingId,
          first_name: p.first_name,
          last_name: p.last_name || null,
          passport_number: p.passport_number || null,
          kite_level: p.kite_level || null,
          client_id: p.client_id || null,
          does_kite: p.does_kite, brings_own_gear: p.brings_own_gear, needs_storage: p.needs_storage,
          wants_kite_lessons: p.wants_kite_lessons, wants_kite_rental: p.wants_kite_rental, wants_wing_lessons: p.wants_wing_lessons,
          notes: null,
        }))
      ).select()
      if (insErr) {
        console.error('booking_participants insert error:', insErr)
        alert('Error saving guests: ' + insErr.message)
      } else if (inserted) {
        setBookingParticipants(prev => [
          ...prev.filter(p => p.booking_id !== bookingId),
          ...(inserted as BookingParticipant[]),
        ])
      }
    } else {
      setBookingParticipants(prev => prev.filter(p => p.booking_id !== bookingId))
    }

    // 4. Booking rooms (delete all + re-insert)
    //    Destructive on purpose: the old set goes before the new one lands, so a
    //    failed re-insert leaves the booking with NO rooms. That has to be said
    //    out loud — not discovered weeks later in the planning.
    const { error: roomsDelErr } = await supabase.from('booking_rooms').delete().eq('booking_id', bookingId)
    if (roomsDelErr) problems.push(`Rooms were not updated (${roomsDelErr.message}). The previous ones are still in place.`)
    else if (data.room_ids.length > 0) {
      const { error: roomsInsErr } = await supabase.from('booking_rooms').insert(
        data.room_ids.map(rid => ({ booking_id: bookingId, room_id: rid }))
      )
      if (roomsInsErr) problems.push(`⚠️ THIS BOOKING NOW HAS NO ROOMS (${roomsInsErr.message}). Re-open it and set them again.`)
    }

    // 5. Booking room prices (delete all + re-insert)
    //    Same shape, and these are the frozen prices: losing them makes the
    //    booking fall back to today's rates instead of the agreed ones.
    const { error: pricesDelErr } = await supabase.from('booking_room_prices').delete().eq('booking_id', bookingId)
    if (pricesDelErr) problems.push(`Room prices were not updated (${pricesDelErr.message}). The previous ones are still in place.`)
    else if (data.room_ids.length > 0) {
      const { error: pricesInsErr } = await supabase.from('booking_room_prices').insert(
        data.room_ids.map(rid => ({
          booking_id: bookingId,
          room_id: rid,
          price_per_night: data.room_prices[rid] ?? 0,
          override_note: null,
        }))
      )
      if (pricesInsErr) problems.push(`⚠️ THIS BOOKING HAS NO FROZEN PRICES (${pricesInsErr.message}). Re-open it and set them again, or it will be billed at today's rates.`)
    }

    // 5b. External stays (delete all + re-insert, same shape as the rooms above).
    //     Nothing to freeze per night here: the row IS the agreed price, for the
    //     whole stay. One row per externally-billed accommodation, even when the
    //     booking occupies several of its spots.
    const { error: extDelErr } = await supabase
      .from('external_accommodation_bookings').delete().eq('booking_id', bookingId)
    if (extDelErr) problems.push(`External stays were not updated (${extDelErr.message}). The previous ones are still in place.`)
    else {
      const extRows = Object.entries(data.external_stays).map(([accId, amt]) => ({
        booking_id:       bookingId,
        accommodation_id: accId,
        check_in:         data.check_in,
        check_out:        data.check_out,
        total_cost:       amt.cost,
        total_sell_price: amt.sell,
        notes:            null,
      }))
      if (extRows.length > 0) {
        const { error: extInsErr } = await supabase.from('external_accommodation_bookings').insert(extRows)
        if (extInsErr) problems.push(`⚠️ THE EXTERNAL STAY WAS NOT SAVED (${extInsErr.message}). Its cost and price are lost — re-open the booking and set them again.`)
      }
    }

    // 6. Auto-create an unverified payment for any INCREASE in "amount already paid".
    //    New booking → previous is 0. Edit → only the added delta (idempotent: re-saving
    //    without changing the field creates nothing; bumping it creates the difference).
    //    Reductions are ignored here (adjust manually in Accounting → Bookings).
    const prevPaid  = isNew ? 0 : (wizard.editing?.amount_paid ?? 0)
    const paidDelta = data.amount_paid - prevPaid
    if (paidDelta > 0) {
      const { error: payErr } = await supabase.from('payments').insert({
        booking_id:  bookingId,
        date:        todayISO(),
        amount:      paidDelta,
        method:      'transfer',
        is_deposit:  false,
        is_verified: false,
        is_discount: false,
        notes:       'Auto-created from booking — to verify',
      })
      if (payErr) problems.push(`⚠️ THE ${paidDelta}€ PAYMENT WAS NOT RECORDED (${payErr.message}). Add it by hand in Accounting → Bookings.`)
    }

    // 7. Auto-create taxi trips — on a new booking, or on an edit, whenever the
    //    checkbox is on and no trip of that leg exists yet for this booking.
    //    Existence, not "did the checkbox just change", is the right condition:
    //    it also self-heals a booking whose checkbox was already on with no
    //    trip behind it (the exact gap that prompted this — edits used to skip
    //    trip creation entirely), and re-saving an already-covered booking still
    //    creates nothing, so it stays as idempotent as the payment delta above.
    const existingTripTypes = new Set(taxiTrips.filter(t => t.booking_id === bookingId).map(t => t.type))
    const wantsNewArrival   = data.taxi_arrival   && !existingTripTypes.has('aero-to-center')
    const wantsNewDeparture = data.taxi_departure && !existingTripTypes.has('center-to-aero')

    if (wantsNewArrival || wantsNewDeparture) {
      const nbPersons = data.participants.filter(p => p.first_name.trim()).length || 1
      const driver = data.taxi_driver_id ? taxiDrivers.find(dr => dr.id === data.taxi_driver_id) : null
      const taxiBase = {
        booking_id:         bookingId,
        taxi_driver_id:     driver?.id ?? null,
        status:             (driver ? 'confirmed' : 'needs_details') as 'confirmed' | 'needs_details',
        nb_persons:         nbPersons,
        nb_luggage:         data.luggage_count,
        nb_boardbags:       data.boardbag_count,
        notes:              null,
        price_eur:          driver?.default_price_eur ?? 0,
        price_driver_mzn:   driver?.default_driver_mzn ?? 0,
        margin_manager_mzn: driver?.default_manager_mzn ?? 0,
      }
      if (wantsNewArrival) {
        const { error: taxiInErr } = await supabase.from('taxi_trips').insert({
          ...taxiBase,
          date:       data.check_in,
          start_time: data.arrival_time || '00:00',
          type:       'aero-to-center',
        })
        if (taxiInErr) problems.push(`The arrival transfer was not created (${taxiInErr.message}). Add it in Taxis.`)
      }
      if (wantsNewDeparture) {
        const { error: taxiOutErr } = await supabase.from('taxi_trips').insert({
          ...taxiBase,
          date:       data.check_out,
          start_time: data.departure_time || '00:00',
          type:       'center-to-aero',
        })
        if (taxiOutErr) problems.push(`The departure transfer was not created (${taxiOutErr.message}). Add it in Taxis.`)
      }
      refreshTaxiTrips()
    }

    refreshBookings()
    refreshBookingRooms()
    refreshExternalStays()
    setSaving(false)

    if (problems.length > 0) {
      // The booking row itself saved (steps 1–3 return early on failure); it is
      // the rows hanging off it that are missing. Keep the wizard open so the
      // booking is right there to fix.
      alert(`The booking was saved, but not everything went with it:\n\n${problems.map(p => `• ${p}`).join('\n\n')}`)
      return
    }
    closeWizard()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this booking?')) return
    const { error: err } = await supabase.from('bookings').delete().eq('id', id)
    if (err) { alert('Delete error: ' + err.message); return }
    refreshBookings()
    refreshBookingRooms()
  }

  function bookingToWizard(b: Booking): WizardData {
    const brs = bookingRooms.filter(r => r.booking_id === b.id)
    const existingPrices = bookingRoomPricesData.filter(p => p.booking_id === b.id)
    const room_prices: Record<string, number> = {}
    const bookedRoomIds = brs.map(br => br.room_id)
    brs.forEach(br => {
      const snap = existingPrices.find(p => p.room_id === br.room_id)
      room_prices[br.room_id] = snap?.price_per_night
        ?? getBaseNightlyRate(br.room_id, bookedRoomIds, rooms, accommodations, roomRatesData)
    })
    return {
      ...EMPTY_WIZARD,
      client_id: b.client_id,
      agency_id: b.agency_id ?? '',
      // 'other' when a label was typed but no listed source was chosen — that is
      // exactly what the free line means on the way back in.
      source_id: b.source_id ?? (b.referral_source ? 'other' : ''),
      referral_source: b.source_id ? '' : (b.referral_source ?? ''),
      check_in: b.check_in, check_out: b.check_out,
      visa_entry_date: b.visa_entry_date ?? '', visa_exit_date: b.visa_exit_date ?? '',
      room_ids: brs.map(r => r.room_id),
      room_prices,
      external_stays: Object.fromEntries(
        externalStaysData
          .filter(e => e.booking_id === b.id)
          .map(e => [e.accommodation_id, { cost: e.total_cost, sell: e.total_sell_price }])
      ),
      status: b.status,
      participants: (() => {
        const existing = bookingParticipants.filter(p => p.booking_id === b.id).map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name ?? '',
          passport_number: p.passport_number ?? '',
          kite_level: (p.kite_level ?? '') as ParticipantData['kite_level'],
          client_id: p.client_id ?? '',
          does_kite: p.does_kite, brings_own_gear: p.brings_own_gear, needs_storage: p.needs_storage,
          wants_kite_lessons: p.wants_kite_lessons, wants_kite_rental: p.wants_kite_rental, wants_wing_lessons: p.wants_wing_lessons,
        }))
        if (existing.length > 0) return existing
        // No participants yet — pre-fill with main client
        const c = clients.find(cl => cl.id === b.client_id)
        return c ? [{ id: `pre_${b.id}`, first_name: c.first_name, last_name: c.last_name, passport_number: c.passport_number ?? '', kite_level: (c.kite_level ?? '') as ParticipantData['kite_level'], client_id: c.id, ...EMPTY_ACTIVITY }] : []
      })(),
      couples_count: b.couples_count, children_count: b.children_count,
      arrival_time: b.arrival_time ?? '', departure_time: b.departure_time ?? '',
      taxi_arrival: b.taxi_arrival, taxi_departure: b.taxi_departure, taxi_driver_id: null,
      luggage_count: b.luggage_count, boardbag_count: b.boardbag_count,
      center_access_rate: b.center_access_rate ?? centerAccessRate,
      amount_paid: b.amount_paid, notes: b.notes ?? '',
    }
  }

  const today = todayISO()

  const nameQuery = nameSearch.trim().toLowerCase()
  function matchesNameSearch(b: Booking): boolean {
    if (!nameQuery) return true
    const client = clients.find(c => c.id === b.client_id)
    if (client) {
      if (`${client.first_name} ${client.last_name}`.toLowerCase().includes(nameQuery)) return true
      if (client.email?.toLowerCase().includes(nameQuery)) return true
      if (client.passport_number?.toLowerCase().includes(nameQuery)) return true
    }
    return bookingParticipants.some(p =>
      p.booking_id === b.id && (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(nameQuery) ||
        p.passport_number?.toLowerCase().includes(nameQuery)
      )
    )
  }

  const unsortedFilteredBookings = bookings.filter(b => {
    if (!matchesNameSearch(b)) return false
    const hasRoom = bookingRooms.some(br => br.booking_id === b.id)
    const missing = getMissingFields(b, hasRoom, bookingParticipants)
    const isComplete = missing.length === 0
    const isUpcoming = b.check_in > today
    const isActive = b.check_in <= today && b.check_out > today
    switch (filter) {
      case 'complete':    return isComplete
      case 'incomplete':  return !isComplete && b.status !== 'cancelled'
      case 'upcoming':    return isUpcoming && b.status !== 'cancelled'
      case 'active':      return isActive && b.status !== 'cancelled'
      case 'confirmed':   return b.status === 'confirmed'
      case 'provisional': return b.status === 'provisional'
      case 'cancelled':   return b.status === 'cancelled'
      default:            return true
    }
  })

  function toggleSort(key: SortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const filteredBookings = [...unsortedFilteredBookings].sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case 'booking_number': cmp = a.booking_number - b.booking_number; break
      case 'client':          cmp = getClientName(a.client_id).localeCompare(getClientName(b.client_id)); break
      case 'check_in':        cmp = a.check_in.localeCompare(b.check_in); break
      case 'status':          cmp = a.status.localeCompare(b.status); break
    }
    return sort.dir === 'asc' ? cmp : -cmp
  })

  function SortHeader({ sortKey, label, className }: { sortKey: SortKey; label: string; className?: string }) {
    const active = sort.key === sortKey
    return (
      <th className={`px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300 ${className ?? ''}`}
        onClick={() => toggleSort(sortKey)}>
        {label}{active && <span className="ml-1">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
      </th>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">{i18n.bookings.msg_loading_bookings[lang]}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-6 max-w-md">
          <p className="text-red-700 dark:text-red-400 font-semibold">{i18n.bookings.msg_error_loading[lang]}</p>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200">{i18n.bookings.page_title[lang]}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{filteredBookings.length} of {bookings.length} booking{bookings.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openNew}
            className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
            + {i18n.bookings.btn_new_booking[lang]}
          </button>
        </div>

        {/* Search by name */}
        <div className="relative mb-4 max-w-xs">
          <input
            type="text"
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            placeholder="🔍 Search by name, email, passport…"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {nameSearch && (
            <button type="button" onClick={() => setNameSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm">✕</button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <SortHeader sortKey="booking_number" label="#" className="w-12" />
                <SortHeader sortKey="client" label={i18n.bookings.col_client[lang]} />
                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">{i18n.bookings.col_stay[lang]}</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">{i18n.bookings.col_room[lang]}</th>
                <SortHeader sortKey="check_in" label={i18n.bookings.col_dates[lang]} />
                <SortHeader sortKey="status" label={i18n.common.label_status[lang]} />
                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">⚠</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(b => {
                const hasRoom = bookingRooms.some(br => br.booking_id === b.id)
                const missing = getMissingFields(b, hasRoom, bookingParticipants)
                const nights = getNights(b)
                const isIncomplete = missing.length > 0
                const isCancelled = b.status === 'cancelled'
                const isActive = b.check_in <= today && b.check_out > today

                // Compact info codes
                const guests = bookingParticipants.filter(p => p.booking_id === b.id)
                const guestsOpen = openGuestsId === b.id
                const codes = [
                  nights > 0 && `${nights}N`,
                  b.num_lessons > 0 && `${b.num_lessons}LK`,
                  b.num_equipment_rentals > 0 && `${b.num_equipment_rentals}R`,
                  b.num_wing_lessons > 0 && `${b.num_wing_lessons}LW`,
                  b.num_center_access > 0 && `${b.num_center_access}C`,
                ].filter(Boolean).join(' · ')

                const rowBg = isCancelled
                  ? 'bg-gray-50 dark:bg-gray-800 opacity-60'
                  : isIncomplete
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-l-2 border-l-amber-400'
                    : isActive
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-l-2 border-l-blue-400'
                      : ''

                return (
                  <Fragment key={b.id}>
                  <tr
                    className={`border-b hover:brightness-95 cursor-pointer transition-colors ${rowBg}`}
                    onClick={() => openEdit(b)}>
                    <td className="px-3 py-2 font-mono text-gray-400 dark:text-gray-400 whitespace-nowrap">
                      #{String(b.booking_number).padStart(3, '0')}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {agencyMarker({ booking_id: b.id }, agencyLookup) && (
                        <span className="mr-1 text-gray-500 dark:text-gray-400" title="Booking from a partner agency">
                          {agencyMarker({ booking_id: b.id }, agencyLookup)}
                        </span>
                      )}
                      {getClientName(b.client_id)}
                      {originOf(b.id) && (
                        <span className="ml-1 cursor-help"
                          title={`From the enquiry of ${originOf(b.id)!.name} — open the booking to read it`}>📣</span>
                      )}
                      {/* The note was readable nowhere without reopening the
                          edit wizard on the booking. A marker plus the text on
                          hover is enough to know there is something to read. */}
                      {b.notes && <span className="ml-1 cursor-help" title={b.notes}>📝</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono text-xs"
                      onClick={e => e.stopPropagation()}>
                      {/* The guest count is the handle: clicking it unfolds who
                          they are, instead of reopening the whole wizard. */}
                      <button type="button"
                        onClick={() => setOpenGuestsId(guestsOpen ? null : b.id)}
                        title={guestsOpen ? 'Hide the guests' : 'Show the guests'}
                        className={`mr-1 px-1 rounded font-mono hover:bg-gray-200 dark:hover:bg-gray-700 ${
                          guestsOpen ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : ''}`}>
                        {guests.length}G {guestsOpen ? '▲' : '▼'}
                      </button>
                      {codes}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {getRoomLabel(b.id)}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[b.status]}`}>
                        {statusLabel[b.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isIncomplete && !isCancelled && (
                        <span title={missing.map(m => MISSING_LABELS[m]).join(', ')}
                          className="text-amber-500 dark:text-amber-400 cursor-help text-sm">⚠️</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(b)} className="text-gray-400 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mr-2">✏️</button>
                      <button onClick={() => handleDelete(b.id)} className="text-gray-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400">🗑️</button>
                    </td>
                  </tr>
                  {guestsOpen && (
                    <tr className="border-b bg-gray-50 dark:bg-gray-800">
                      <td colSpan={8} className="px-6 py-3">
                        <GuestList guests={guests} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
              {filteredBookings.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-400 text-sm">{i18n.bookings.msg_no_match[lang]}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-400">
          <span>Stay codes:</span>
          <span><b className="text-gray-500 dark:text-gray-400">G</b> guests (click to see who) · <b className="text-gray-500 dark:text-gray-400">N</b> nights · <b className="text-gray-500 dark:text-gray-400">LK</b> kite lessons · <b className="text-gray-500 dark:text-gray-400">LW</b> wing lessons · <b className="text-gray-500 dark:text-gray-400">R</b> rentals · <b className="text-gray-500 dark:text-gray-400">C</b> center access</span>
          <span className="ml-4 flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-400 dark:border-blue-700 rounded-sm" /> Active now</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-amber-100 dark:bg-amber-900/30 border-l-2 border-amber-400 dark:border-amber-700 rounded-sm" /> Incomplete</span>
          <span>📣 came from an enquiry</span>
          <span>📝 has a note (hover to read)</span>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-4">
          {filteredBookings.map(b => {
            const guests = bookingParticipants.filter(p => p.booking_id === b.id)
            const guestsOpen = openGuestsId === b.id
            const missing = getMissingFields(b, bookingRooms.some(br => br.booking_id === b.id), bookingParticipants)
            return (
            <div key={b.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-4" onClick={() => openEdit(b)}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-800 dark:text-gray-200">
                    <span className="font-mono text-gray-400 dark:text-gray-400 text-xs mr-1">#{String(b.booking_number).padStart(3, '0')}</span>
                    {agencyMarker({ booking_id: b.id }, agencyLookup) && (
                      <span className="mr-1 font-normal text-gray-500 dark:text-gray-400" title="Booking from a partner agency">
                        {agencyMarker({ booking_id: b.id }, agencyLookup)}
                      </span>
                    )}
                    {getClientName(b.client_id)}
                    {originOf(b.id) && <span className="ml-1" title="Came from an enquiry">📣</span>}
                    {b.notes && <span className="ml-1" title={b.notes}>📝</span>}
                  </p>
                  {b.notes && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5 line-clamp-2">{b.notes}</p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">{getRoomLabel(b.id)}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor[b.status]}`}>
                  {statusLabel[b.status]}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                <p>📅 {fmtDate(b.check_in)} → {fmtDate(b.check_out)}</p>
                <p onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => setOpenGuestsId(guestsOpen ? null : b.id)}
                    className="underline decoration-dotted underline-offset-2">
                    👥 {guests.length} pax {guestsOpen ? '▲' : '▼'}
                  </button>
                  {' '}· 📚 {b.num_lessons} lessons
                  {(b.taxi_arrival || b.taxi_departure) && ` · 🚕`}
                </p>
                {guestsOpen && (
                  <div className="pt-1 pb-1" onClick={e => e.stopPropagation()}>
                    <GuestList guests={guests} />
                  </div>
                )}
                {/* The ⚠️ existed only in the desktop table, so a passport missing
                    on a phone said nothing at all. */}
                {missing.length > 0 && b.status !== 'cancelled' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ {missing.map(m => MISSING_LABELS[m]).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => openEdit(b)}
                  className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium text-sm hover:bg-blue-200 dark:hover:bg-blue-800">✏️ {i18n.common.btn_edit[lang]}</button>
                <button onClick={() => handleDelete(b.id)}
                  className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded font-medium text-sm hover:bg-red-200 dark:hover:bg-red-800">🗑️ {i18n.common.btn_delete[lang]}</button>
              </div>
            </div>
            )
          })}
        </div>
      </div>

      {/* Wizard */}
      {wizard.open && (
        <BookingWizard
          initial={wizard.editing ? bookingToWizard(wizard.editing) : { ...EMPTY_WIZARD, center_access_rate: centerAccessRate }}
          clients={clients}
          clientsLoading={clientsLoading}
          rooms={rooms}
          accommodations={accommodations}
          agencies={agencies}
          sources={sources}
          houseRentals={houseRentals}
          roomRates={roomRatesData}
          drivers={taxiDrivers}
          bookings={bookings}
          bookingRooms={bookingRooms}
          taxiTrips={taxiTrips}
          editingBookingId={wizard.editing?.id ?? null}
          isEditing={!!wizard.editing}
          originEnquiry={wizard.editing ? (enquiries.find(e => e.booking_id === wizard.editing!.id) ?? null) : null}
          recordedPaid={paymentsData
            .filter(p => p.booking_id === wizard.editing?.id && !p.is_discount)
            .reduce((s, p) => s + p.amount, 0)}
          lang={lang}
          onCancel={closeWizard}
          onSave={handleSave}
        />
      )}

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-900 rounded-lg px-8 py-5 shadow-xl">
            <p className="text-gray-700 dark:text-gray-300 font-medium">Saving...</p>
          </div>
        </div>
      )}
    </div>
  )
}
