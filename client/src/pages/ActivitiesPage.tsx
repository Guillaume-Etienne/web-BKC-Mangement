import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useActivityProviders, useActivityBookings, useActivityPayments } from '../hooks/useActivities'
import { useBookingParticipants } from '../hooks/useBookings'
import { useTable } from '../hooks/useSupabase'
import type {
  ActivityProvider, ActivityBooking, ActivityPayment,
  ActivityProviderType, ActivityPaymentFlow, ActivityPaymentDirection,
  SharedLink, BookingRef,
} from '../types/database'

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ActivityProviderType, string> = {
  activity: 'Activity',
  safari:   'Safari',
}

const FLOW_LABELS: Record<ActivityPaymentFlow, string> = {
  we_pay_provider:  'We pay provider',
  provider_pays_us: 'Provider pays us',
}

const today = () => new Date().toISOString().slice(0, 10)

// ── Module-scope forms ─────────────────────────────────────────────────────────

interface ProviderFormProps {
  initial?: ActivityProvider
  onSave:   (p: Omit<ActivityProvider, 'id' | 'created_at'>) => void
  onCancel: () => void
}
function ProviderForm({ initial, onSave, onCancel }: ProviderFormProps) {
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [type,        setType]        = useState<ActivityProviderType>(initial?.type ?? 'activity')
  const [phone,       setPhone]       = useState(initial?.phone       ?? '')
  const [email,       setEmail]       = useState(initial?.email       ?? '')
  const [website,     setWebsite]     = useState(initial?.website     ?? '')
  const [notes,       setNotes]       = useState(initial?.notes       ?? '')
  const [isActive,    setIsActive]    = useState(initial?.is_active   ?? true)
  const [showPrices,  setShowPrices]  = useState(initial?.show_prices ?? false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name, type,
      phone:       phone || null,
      email:       email || null,
      website:     website || null,
      notes:       notes || null,
      is_active:   isActive,
      show_prices: showPrices,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input required value={name} onChange={e => setName(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={type} onChange={e => setType(e.target.value as ActivityProviderType)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {(Object.entries(TYPE_LABELS) as [ActivityProviderType, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
          <input value={website} onChange={e => setWebsite(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded" />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={showPrices} onChange={e => setShowPrices(e.target.checked)}
            className="w-4 h-4 rounded" />
          Show prices on public page
        </label>
      </div>
      <div className="flex gap-3 pt-2 border-t">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
        <button type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save</button>
      </div>
    </form>
  )
}

interface BookingFormProps {
  initial?:      ActivityBooking
  providers:     ActivityProvider[]
  bookingRefs:   BookingRef[]
  allParticipants: { id: string; booking_id: string; first_name: string; last_name: string }[]
  onSave:        (b: Omit<ActivityBooking, 'id' | 'created_at'>) => void
  onCancel:      () => void
}
function BookingForm({ initial, providers, bookingRefs, allParticipants, onSave, onCancel }: BookingFormProps) {
  const [providerId,   setProviderId]   = useState(initial?.provider_id   ?? providers[0]?.id ?? '')
  const [bookingId,    setBookingId]    = useState(initial?.booking_id    ?? '')
  const [date,         setDate]         = useState(initial?.date          ?? today())
  const [label,        setLabel]        = useState(initial?.label         ?? '')
  const [nbPersons,    setNbPersons]    = useState(String(initial?.nb_persons ?? 1))
  const [participantIds, setParticipantIds] = useState<string[]>(initial?.participant_ids ?? [])
  const [priceClient,  setPriceClient]  = useState(String(initial?.price_client  ?? 0))
  const [priceProvider,setPriceProvider]= useState(String(initial?.price_provider ?? 0))
  const [paymentFlow,  setPaymentFlow]  = useState<ActivityPaymentFlow>(initial?.payment_flow ?? 'we_pay_provider')
  const [notes,        setNotes]        = useState(initial?.notes ?? '')

  const bookingParticipants = bookingId
    ? allParticipants.filter(p => p.booking_id === bookingId)
    : []

  function toggleParticipant(id: string) {
    setParticipantIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      setNbPersons(String(next.length || 1))
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      provider_id:     providerId,
      booking_id:      bookingId || null,
      date, label,
      nb_persons:      parseInt(nbPersons) || 1,
      participant_ids: participantIds,
      price_client:    parseFloat(priceClient)   || 0,
      price_provider:  parseFloat(priceProvider) || 0,
      payment_flow:    paymentFlow,
      notes:           notes || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Provider *</label>
          <select required value={providerId} onChange={e => setProviderId(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
          <input type="date" required value={date} onChange={e => setDate(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
          <input required value={label} onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Whale shark tour, Safari day 1…"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Booking (optional)</label>
          <select value={bookingId} onChange={e => { setBookingId(e.target.value); setParticipantIds([]) }}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">— No linked booking —</option>
            {bookingRefs.map(b => (
              <option key={b.id} value={b.id}>
                #{String(b.booking_number).padStart(3,'0')} · {b.client?.first_name} {b.client?.last_name} · {b.check_in}
              </option>
            ))}
          </select>
        </div>

        {/* Participant picker — shown when booking selected */}
        {bookingParticipants.length > 0 && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-2">Participants (select or leave empty to use count)</label>
            <div className="flex flex-wrap gap-2">
              {bookingParticipants.map(p => (
                <label key={p.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                  participantIds.includes(p.id)
                    ? 'bg-blue-100 border-blue-400 text-blue-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}>
                  <input type="checkbox" className="hidden"
                    checked={participantIds.includes(p.id)}
                    onChange={() => toggleParticipant(p.id)} />
                  {p.first_name} {p.last_name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {participantIds.length > 0 ? `Persons (${participantIds.length} selected)` : 'Persons'}
          </label>
          <input type="number" min="1" value={nbPersons} onChange={e => setNbPersons(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment flow</label>
          <select value={paymentFlow} onChange={e => setPaymentFlow(e.target.value as ActivityPaymentFlow)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {(Object.entries(FLOW_LABELS) as [ActivityPaymentFlow, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Client price (€)</label>
          <input type="number" min="0" step="0.01" value={priceClient} onChange={e => setPriceClient(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Provider price (€)</label>
          <input type="number" min="0" step="0.01" value={priceProvider} onChange={e => setPriceProvider(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div className="flex gap-3 pt-2 border-t">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
        <button type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save</button>
      </div>
    </form>
  )
}

interface PaymentFormProps {
  providerId: string
  onSave:     (p: Omit<ActivityPayment, 'id' | 'created_at'>) => void
  onCancel:   () => void
}
function PaymentForm({ providerId, onSave, onCancel }: PaymentFormProps) {
  const [date,      setDate]      = useState(today())
  const [amount,    setAmount]    = useState('')
  const [direction, setDirection] = useState<ActivityPaymentDirection>('to_provider')
  const [notes,     setNotes]     = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    onSave({ provider_id: providerId, date, amount: amt, direction, notes: notes || null })
    setAmount(''); setNotes(''); setDate(today())
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Add payment</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input type="date" required value={date} onChange={e => setDate(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (€)</label>
          <input type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Direction</label>
          <select value={direction} onChange={e => setDirection(e.target.value as ActivityPaymentDirection)}
            className="w-full text-sm border rounded px-2 py-1.5">
            <option value="to_provider">We paid them</option>
            <option value="from_provider">They paid us</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+ Add</button>
      </div>
    </form>
  )
}

// ── Share link section (same pattern as DriverStatementPanel) ──────────────────

function ShareLinkSection({ providerLink, onGenerate }: {
  providerLink: SharedLink | null
  onGenerate:   () => Promise<void>
}) {
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]         = useState(false)
  const shareUrl = providerLink
    ? `${window.location.protocol}//${window.location.host}?share=${providerLink.token}`
    : null

  async function handleGenerate() { setGenerating(true); await onGenerate(); setGenerating(false) }
  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (!shareUrl) return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-gray-400 italic flex-1">No share link yet</p>
      <button onClick={handleGenerate} disabled={generating}
        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
        {generating ? 'Generating…' : 'Generate link'}
      </button>
    </div>
  )

  return (
    <div className="flex items-center gap-2">
      <input readOnly value={shareUrl} onClick={e => (e.target as HTMLInputElement).select()}
        className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono truncate" />
      <button onClick={handleCopy}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <a href={shareUrl} target="_blank" rel="noopener noreferrer"
        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200">Open</a>
    </div>
  )
}

// ── Provider statement panel ───────────────────────────────────────────────────

interface ProviderPanelProps {
  provider:     ActivityProvider
  bookings:     ActivityBooking[]
  payments:     ActivityPayment[]
  providerLink: SharedLink | null
  bookingRefs:  BookingRef[]
  allParticipants: { id: string; booking_id: string; first_name: string; last_name: string }[]
  onGenerateLink:  () => Promise<void>
  onEdit:          () => void
  onDelete:        () => void
  onAddBooking:    (b: Omit<ActivityBooking, 'id' | 'created_at'>) => Promise<void>
  onEditBooking:   (b: ActivityBooking) => Promise<void>
  onDeleteBooking: (id: string) => Promise<void>
  onAddPayment:    (p: Omit<ActivityPayment, 'id' | 'created_at'>) => Promise<void>
  onDeletePayment: (id: string) => Promise<void>
}

function ProviderPanel({
  provider, bookings, payments, providerLink, bookingRefs, allParticipants,
  onGenerateLink, onEdit, onDelete,
  onAddBooking, onEditBooking, onDeleteBooking,
  onAddPayment, onDeletePayment,
}: ProviderPanelProps) {
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [editingBooking,  setEditingBooking]  = useState<ActivityBooking | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  // Financial summary
  const wePayBookings   = bookings.filter(b => b.payment_flow === 'we_pay_provider')
  const theyPayBookings = bookings.filter(b => b.payment_flow === 'provider_pays_us')
  const wePaid          = payments.filter(p => p.direction === 'to_provider').reduce((s, p) => s + p.amount, 0)
  const theyPaid        = payments.filter(p => p.direction === 'from_provider').reduce((s, p) => s + p.amount, 0)
  const weOwe           = wePayBookings.reduce((s, b) => s + b.price_provider, 0) - wePaid
  const theyOwe         = theyPayBookings.reduce((s, b) => s + b.price_provider, 0) - theyPaid

  function clientName(b: ActivityBooking) {
    const ref = bookingRefs.find(r => r.id === b.booking_id)
    return ref?.client ? `${ref.client.first_name} ${ref.client.last_name}` : '–'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold">{provider.name}</h3>
            <span className="text-xs px-2 py-0.5 bg-emerald-500 rounded-full font-medium">
              {TYPE_LABELS[provider.type]}
            </span>
          </div>
          <p className="text-emerald-200 text-sm mt-0.5">
            {[provider.phone, provider.email].filter(Boolean).join(' · ') || 'No contact info'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium">✏️ Edit</button>
          <button onClick={onDelete}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm font-medium">🗑️</button>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Share link */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Provider share link
            {!provider.show_prices && <span className="ml-2 text-amber-500">(prices hidden)</span>}
          </p>
          <ShareLinkSection providerLink={providerLink} onGenerate={onGenerateLink} />
        </div>

        {/* Financial KPIs */}
        <div className="grid grid-cols-2 gap-4">
          {wePayBookings.length > 0 && (
            <div className={`rounded-lg border px-4 py-3 ${weOwe > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">We owe them</p>
              <p className={`text-2xl font-bold mt-1 ${weOwe > 0 ? 'text-orange-800' : 'text-green-700'}`}>
                {weOwe > 0 ? weOwe.toFixed(2) : '✓ Settled'} {weOwe > 0 ? '€' : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{wePayBookings.length} booking{wePayBookings.length !== 1 ? 's' : ''}</p>
            </div>
          )}
          {theyPayBookings.length > 0 && (
            <div className={`rounded-lg border px-4 py-3 ${theyOwe > 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">They owe us</p>
              <p className={`text-2xl font-bold mt-1 ${theyOwe > 0 ? 'text-blue-800' : 'text-green-700'}`}>
                {theyOwe > 0 ? theyOwe.toFixed(2) : '✓ Settled'} {theyOwe > 0 ? '€' : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{theyPayBookings.length} booking{theyPayBookings.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>

        {/* Bookings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Activity bookings ({bookings.length})</h4>
            {!showBookingForm && !editingBooking && (
              <button onClick={() => setShowBookingForm(true)}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">+ Add booking</button>
            )}
          </div>

          {(showBookingForm || editingBooking) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                {editingBooking ? 'Edit booking' : 'New booking'}
              </h4>
              <BookingForm
                initial={editingBooking ?? undefined}
                providers={[provider]}
                bookingRefs={bookingRefs}
                allParticipants={allParticipants}
                onSave={async (b) => {
                  if (editingBooking) await onEditBooking({ ...editingBooking, ...b })
                  else await onAddBooking(b)
                  setShowBookingForm(false); setEditingBooking(null)
                }}
                onCancel={() => { setShowBookingForm(false); setEditingBooking(null) }}
              />
            </div>
          )}

          {bookings.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No bookings yet.</p>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-500 text-left">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Label</th>
                    <th className="px-3 py-2 font-medium">Client</th>
                    <th className="px-3 py-2 font-medium text-center">Pax</th>
                    <th className="px-3 py-2 font-medium">Flow</th>
                    <th className="px-3 py-2 font-medium text-right">Client €</th>
                    <th className="px-3 py-2 font-medium text-right">Provider €</th>
                    <th className="px-3 py-2 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.sort((a, b) => b.date.localeCompare(a.date)).map(b => (
                    <tr key={b.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{b.date}</td>
                      <td className="px-3 py-2 text-gray-700">{b.label}</td>
                      <td className="px-3 py-2 text-gray-600">{clientName(b)}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{b.nb_persons}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          b.payment_flow === 'we_pay_provider'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>{b.payment_flow === 'we_pay_provider' ? '→ them' : '← us'}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{b.price_client > 0 ? `${b.price_client}€` : '–'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">{b.price_provider > 0 ? `${b.price_provider}€` : '–'}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => setEditingBooking(b)}
                            className="text-gray-400 hover:text-blue-600 px-1">✏️</button>
                          <button onClick={() => onDeleteBooking(b.id)}
                            className="text-gray-400 hover:text-red-600 px-1">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Payments ({payments.length})</h4>
            {!showPaymentForm && (
              <button onClick={() => setShowPaymentForm(true)}
                className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-medium hover:bg-gray-700">+ Add payment</button>
            )}
          </div>

          {showPaymentForm && (
            <PaymentForm
              providerId={provider.id}
              onSave={async (p) => { await onAddPayment(p); setShowPaymentForm(false) }}
              onCancel={() => setShowPaymentForm(false)}
            />
          )}

          {payments.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-500 text-left">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Direction</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700">{p.date}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          p.direction === 'to_provider' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>{p.direction === 'to_provider' ? 'We paid them' : 'They paid us'}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">{p.amount}€</td>
                      <td className="px-3 py-2 text-gray-400 italic">{p.notes ?? ''}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => onDeletePayment(p.id)}
                          className="text-gray-300 hover:text-red-500">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const { data: providers,  refresh: refreshProviders  } = useActivityProviders()
  const { data: bookings,   refresh: refreshBookings   } = useActivityBookings()
  const { data: payments,   refresh: refreshPayments   } = useActivityPayments()
  const { data: bpData }                                  = useBookingParticipants()
  const { data: bookingRefs } = useTable<BookingRef>('bookings', {
    select: 'id, booking_number, check_in, check_out, luggage_count, boardbag_count, client:clients(first_name, last_name)',
    order: 'check_in', ascending: false,
  })
  const { data: sharedLinksData, refresh: refreshLinks } = useTable<SharedLink>('shared_links')
  const providerLinks = sharedLinksData.filter(l => l.type === 'activity_provider')

  const allParticipants = bpData.map(p => ({
    id:         p.id,
    booking_id: p.booking_id,
    first_name: p.first_name,
    last_name:  p.last_name ?? '',
  }))

  const [tab,              setTab]              = useState<'providers' | 'bookings'>('providers')
  const [viewingId,        setViewingId]        = useState<string | null>(null)
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [editingProvider,  setEditingProvider]  = useState<ActivityProvider | null>(null)
  const [filterProvider,   setFilterProvider]   = useState<string>('all')

  // ── Provider CRUD ────────────────────────────────────────────────────────────

  async function saveProvider(data: Omit<ActivityProvider, 'id' | 'created_at'>) {
    if (editingProvider) {
      await supabase.from('activity_providers').update(data).eq('id', editingProvider.id)
    } else {
      await supabase.from('activity_providers').insert([data])
    }
    refreshProviders()
    setShowProviderForm(false); setEditingProvider(null)
  }

  async function deleteProvider(id: string) {
    if (!confirm('Delete this provider? All their bookings will also be deleted.')) return
    await supabase.from('activity_providers').delete().eq('id', id)
    refreshProviders(); setViewingId(null)
  }

  // ── Booking CRUD ─────────────────────────────────────────────────────────────

  async function addBooking(b: Omit<ActivityBooking, 'id' | 'created_at'>) {
    await supabase.from('activity_bookings').insert([b])
    refreshBookings()
  }

  async function editBooking(b: ActivityBooking) {
    const { id, created_at, ...fields } = b
    await supabase.from('activity_bookings').update(fields).eq('id', id)
    refreshBookings()
  }

  async function deleteBooking(id: string) {
    if (!confirm('Delete this booking?')) return
    await supabase.from('activity_bookings').delete().eq('id', id)
    refreshBookings()
  }

  // ── Payment CRUD ─────────────────────────────────────────────────────────────

  async function addPayment(p: Omit<ActivityPayment, 'id' | 'created_at'>) {
    await supabase.from('activity_payments').insert([p])
    refreshPayments()
  }

  async function deletePayment(id: string) {
    if (!confirm('Delete this payment?')) return
    await supabase.from('activity_payments').delete().eq('id', id)
    refreshPayments()
  }

  // ── Share link ───────────────────────────────────────────────────────────────

  async function generateProviderLink(provider: ActivityProvider) {
    const existing = providerLinks.find(l => l.params?.provider_id === provider.id)
    if (existing) return
    const token = `activity_${Math.random().toString(36).slice(2, 12)}`
    await supabase.from('shared_links').insert([{
      token, type: 'activity_provider',
      label:      `${TYPE_LABELS[provider.type]}: ${provider.name}`,
      params:     { provider_id: provider.id },
      created_at: new Date().toISOString().slice(0, 10),
      expires_at: null, is_active: true,
    }])
    refreshLinks()
  }

  // ── Bookings tab — filtered list ─────────────────────────────────────────────

  const filteredBookings = filterProvider === 'all'
    ? bookings
    : bookings.filter(b => b.provider_id === filterProvider)

  function providerName(id: string) {
    return providers.find(p => p.id === id)?.name ?? '–'
  }
  function clientName(b: ActivityBooking) {
    const ref = bookingRefs.find(r => r.id === b.booking_id)
    return ref?.client ? `${ref.client.first_name} ${ref.client.last_name}` : '–'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800">🏕️ Activities & Safaris</h1>
        <p className="text-gray-500 mt-1">Manage external activity providers and bookings</p>

        {/* Tabs */}
        <div className="flex gap-4 mt-8 mb-8 border-b">
          {(['providers', 'bookings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 font-medium transition-colors ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}>
              {t === 'providers' ? '🏕️ Providers' : '📋 All Bookings'}
            </button>
          ))}
        </div>

        {/* ── Providers tab ── */}
        {tab === 'providers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Providers</h2>
              <button onClick={() => { setEditingProvider(null); setShowProviderForm(true) }}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-sm">
                + New provider
              </button>
            </div>

            {/* New/Edit provider form */}
            {showProviderForm && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4">
                  {editingProvider ? 'Edit provider' : 'New provider'}
                </h3>
                <ProviderForm
                  initial={editingProvider ?? undefined}
                  onSave={saveProvider}
                  onCancel={() => { setShowProviderForm(false); setEditingProvider(null) }}
                />
              </div>
            )}

            {/* Provider selector grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {providers.map(p => {
                const pBookings = bookings.filter(b => b.provider_id === p.id)
                const hasLink   = providerLinks.some(l => l.params?.provider_id === p.id)
                const isViewing = viewingId === p.id
                return (
                  <button key={p.id} onClick={() => setViewingId(isViewing ? null : p.id)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      isViewing
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                        : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                    }`}>
                    <p className={`font-bold text-base ${isViewing ? 'text-white' : 'text-gray-800'}`}>{p.name}</p>
                    <p className={`text-xs mt-0.5 ${isViewing ? 'text-emerald-200' : 'text-gray-400'}`}>
                      {TYPE_LABELS[p.type]}{!p.is_active ? ' · Inactive' : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isViewing ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {pBookings.length} booking{pBookings.length !== 1 ? 's' : ''}
                      </span>
                      {hasLink && <span className={`text-xs ${isViewing ? 'text-emerald-200' : 'text-green-500'}`}>🔗</span>}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Provider detail panel */}
            {viewingId && (() => {
              const provider = providers.find(p => p.id === viewingId)
              if (!provider) return null
              return (
                <ProviderPanel
                  provider={provider}
                  bookings={bookings.filter(b => b.provider_id === provider.id)}
                  payments={payments.filter(p => p.provider_id === provider.id)}
                  providerLink={providerLinks.find(l => l.params?.provider_id === provider.id) ?? null}
                  bookingRefs={bookingRefs}
                  allParticipants={allParticipants}
                  onGenerateLink={() => generateProviderLink(provider)}
                  onEdit={() => { setEditingProvider(provider); setShowProviderForm(true); setViewingId(null) }}
                  onDelete={() => deleteProvider(provider.id)}
                  onAddBooking={addBooking}
                  onEditBooking={editBooking}
                  onDeleteBooking={deleteBooking}
                  onAddPayment={addPayment}
                  onDeletePayment={deletePayment}
                />
              )
            })()}
          </div>
        )}

        {/* ── Bookings tab ── */}
        {tab === 'bookings' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-800 flex-1">All Bookings</h2>
              <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="all">All providers</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {filteredBookings.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-8 text-center">No bookings found.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-500 text-xs text-left">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Provider</th>
                      <th className="px-4 py-3 font-medium">Label</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium text-center">Pax</th>
                      <th className="px-4 py-3 font-medium">Flow</th>
                      <th className="px-4 py-3 font-medium text-right">Client €</th>
                      <th className="px-4 py-3 font-medium text-right">Provider €</th>
                      <th className="px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.sort((a, b) => b.date.localeCompare(a.date)).map(b => (
                      <tr key={b.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{b.date}</td>
                        <td className="px-4 py-3 text-gray-600">{providerName(b.provider_id)}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{b.label}</td>
                        <td className="px-4 py-3 text-gray-600">{clientName(b)}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{b.nb_persons}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            b.payment_flow === 'we_pay_provider'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>{b.payment_flow === 'we_pay_provider' ? '→ them' : '← us'}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{b.price_client > 0 ? `${b.price_client}€` : '–'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">{b.price_provider > 0 ? `${b.price_provider}€` : '–'}</td>
                        <td className="px-4 py-3 text-gray-400 italic text-xs">{b.notes ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
