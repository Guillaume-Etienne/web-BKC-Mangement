import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTable } from '../hooks/useSupabase'
import type { FormSubmission, FormSubmissionStatus, Lang } from '../types/database'
import { activityCountColumns } from '../utils/bookingActivity'

// Admin review queue for public booking-form submissions.
// English UI (admin chrome). Approving turns a submission into a real
// client + booking (provisional) + booking_participants.

const LANG_FLAG: Record<Lang, string> = { fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸' }

const STATUS_BADGE: Record<FormSubmissionStatus, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500',
}

function addDays(iso: string, days: number): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  // Format from local parts (avoid UTC shift from toISOString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) return { first: full.trim(), last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function fmtDate(iso: string | null): string {
  return iso ? iso : '—'
}

// ─── Detail / review panel (module scope = focus-safe inputs) ─────────────────
interface DetailProps { s: FormSubmission; onDone: () => void }
function SubmissionDetail({ s, onDone }: DetailProps) {
  const p = s.payload
  const [checkIn, setCheckIn] = useState(p.country_entry_date || '')
  const [checkOut, setCheckOut] = useState(
    p.country_entry_date ? addDays(p.country_entry_date, p.nights_bilene || 0) : ''
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'reject' | 'reopen' | null>(null)

  const alreadyCreated = !!s.created_booking_id
  const datesValid = !!(checkIn && checkOut && checkOut > checkIn)

  async function createBooking() {
    if (!datesValid || alreadyCreated) return
    setBusy(true)
    setError(null)

    // 1. Client
    const { first, last } = splitName(p.reference_name)
    const { data: client, error: cErr } = await supabase.from('clients').insert({
      first_name: first || p.reference_name || 'Unknown',
      last_name: last || '',
      email: p.email || null,
      phone: p.phone || null,
      notes: null, nationality: null, passport_number: null, birth_date: null, kite_level: null,
      import_id: s.id,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_phone: p.emergency_contact_phone || null,
      emergency_contact_email: p.emergency_contact_email || null,
      emergency_contact_relation: p.emergency_contact_relation || null,
    }).select('id').single()
    if (cErr || !client) { setError('Client: ' + (cErr?.message ?? 'unknown')); setBusy(false); return }

    // 2. Booking (provisional)
    const noteBits: string[] = ['Created from public booking form.']
    if (p.single_beds) noteBits.push(`Single beds requested: ${p.single_beds}.`)
    if (p.taxi_arrival && p.transfer_to_bilene_date) noteBits.push(`Transfer to Bilene: ${p.transfer_to_bilene_date}${p.transfer_to_bilene_time ? ` ${p.transfer_to_bilene_time}` : ''}.`)
    if (p.taxi_departure && p.transfer_to_airport_date) noteBits.push(`Transfer to airport: ${p.transfer_to_airport_date}${p.transfer_to_airport_time ? ` ${p.transfer_to_airport_time}` : ''}.`)
    if (p.referral_source) noteBits.push(`Heard about us: ${p.referral_source}.`)
    // Activity counters derived from the per-traveler form flags (kept in sync on the participants below)
    const formTravelers = (p.travelers ?? []).filter(t => t.first_name.trim())
    const { data: booking, error: bErr } = await supabase.from('bookings').insert({
      client_id: client.id,
      check_in: checkIn,
      check_out: checkOut,
      ...activityCountColumns(formTravelers),
      visa_entry_date: p.country_entry_date || null,
      visa_exit_date: p.country_exit_date || null,
      status: 'provisional',
      notes: noteBits.join(' '),
      arrival_time: p.arrival_time || null,
      departure_time: p.departure_time || null,
      luggage_count: p.luggage_count || 0,
      boardbag_count: p.boardbag_count || 0,
      taxi_arrival: !!p.taxi_arrival,
      taxi_departure: !!p.taxi_departure,
      couples_count: p.double_beds || 0,
      children_count: 0,
      amount_paid: 0,
      has_travel_insurance: !!p.has_travel_insurance,
      waiver_accepted_at: p.waiver_accepted ? s.submitted_at : null,
      waiver_version: p.waiver_accepted ? p.waiver_version : null,
      referral_source: p.referral_source || null,
      import_id: s.id,
      emergency_contact_name: p.emergency_contact_name || null,
      emergency_contact_phone: p.emergency_contact_phone || null,
      emergency_contact_email: p.emergency_contact_email || null,
    }).select('id').single()
    if (bErr || !booking) { setError('Booking: ' + (bErr?.message ?? 'unknown')); setBusy(false); return }

    // 3. Participants — keep the per-traveler activity flags (source of truth for the counters above)
    const travelers = formTravelers
    if (travelers.length > 0) {
      const { error: pErr } = await supabase.from('booking_participants').insert(
        travelers.map(t => ({
          booking_id: booking.id,
          first_name: t.first_name.trim(),
          last_name: t.last_name.trim() || null,
          passport_number: t.passport_number.trim() || null,
          kite_level: t.does_kite ? (t.kite_level ?? null) : null,
          does_kite: !!t.does_kite,
          brings_own_gear: !!t.brings_own_gear,
          needs_storage: !!t.needs_storage,
          wants_kite_lessons: !!t.wants_kite_lessons,
          wants_kite_rental: !!t.wants_kite_rental,
          wants_wing_lessons: !!t.wants_wing_lessons,
          client_id: null,
          notes: null,
        }))
      )
      if (pErr) { setError('Participants: ' + pErr.message); setBusy(false); return }
    }

    // 4. Mark submission approved
    const { error: uErr } = await supabase.from('form_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), created_booking_id: booking.id })
      .eq('id', s.id)
    if (uErr) { setError('Submission update: ' + uErr.message); setBusy(false); return }

    setBusy(false)
    onDone()
  }

  async function reject() {
    setBusy(true)
    setError(null)
    const { error: uErr } = await supabase.from('form_submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', s.id)
    setBusy(false)
    if (uErr) { setError(uErr.message); return }
    onDone()
  }

  async function reopen() {
    setBusy(true)
    setError(null)
    const { error: uErr } = await supabase.from('form_submissions')
      .update({ status: 'pending', reviewed_at: null })
      .eq('id', s.id)
    setBusy(false)
    if (uErr) { setError(uErr.message); return }
    onDone()
  }

  const rowCls = 'flex justify-between gap-4 py-1.5 border-b border-gray-50 text-sm'

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-5 py-4 space-y-5">
      {/* Trip */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Trip</h4>
        <div className={rowCls}><span className="text-gray-500">Country entry (visa)</span><span className="font-medium">{fmtDate(p.country_entry_date)} {p.arrival_time && `· ${p.arrival_time}`}</span></div>
        <div className={rowCls}><span className="text-gray-500">Country exit (visa)</span><span className="font-medium">{fmtDate(p.country_exit_date)} {p.departure_time && `· ${p.departure_time}`}</span></div>
        <div className={rowCls}><span className="text-gray-500">Nights in Bilene</span><span className="font-medium">{p.nights_bilene}</span></div>
        <div className={rowCls}>
          <span className="text-gray-500">Transfer to Bilene</span>
          <span className="font-medium">{p.taxi_arrival ? `🚕 ${fmtDate(p.transfer_to_bilene_date)}${p.transfer_to_bilene_time ? ` · ${p.transfer_to_bilene_time}` : ''}` : 'No'}</span>
        </div>
        <div className={rowCls}>
          <span className="text-gray-500">Transfer to airport</span>
          <span className="font-medium">{p.taxi_departure ? `🚕 ${fmtDate(p.transfer_to_airport_date)}${p.transfer_to_airport_time ? ` · ${p.transfer_to_airport_time}` : ''}` : 'No'}</span>
        </div>
      </div>

      {/* Logistics */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Logistics</h4>
        <div className={rowCls}><span className="text-gray-500">Bags / Kite bags</span><span className="font-medium">{p.luggage_count} / {p.boardbag_count}</span></div>
        <div className={rowCls}><span className="text-gray-500">Double beds / Single beds</span><span className="font-medium">{p.double_beds} / {p.single_beds}</span></div>
        <div className={rowCls}><span className="text-gray-500">Travel insurance</span><span className="font-medium">{p.has_travel_insurance ? 'Yes' : 'No'}</span></div>
      </div>

      {/* Crew */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Crew ({p.travelers?.length ?? 0})</h4>
        <div className="space-y-1">
          {(p.travelers ?? []).map((t, i) => {
            const kiteFlags = t.does_kite ? [
              t.kite_level,
              t.brings_own_gear ? (t.needs_storage ? 'own gear + storage' : 'own gear') : null,
              t.wants_kite_lessons ? 'lessons' : null,
              t.wants_kite_rental ? 'rental' : null,
              t.wants_wing_lessons ? 'wing' : null,
            ].filter(Boolean).join(' · ') : null
            return (
              <div key={i} className="py-1.5 border-b border-gray-50 space-y-0.5">
                <div className="text-sm flex justify-between gap-4">
                  <span className="font-medium">{t.first_name} {t.last_name}</span>
                  <span className="text-gray-500">{t.passport_number || '— no passport —'}</span>
                </div>
                {t.does_kite
                  ? <p className="text-xs text-sky-600">🪁 {kiteFlags || 'kiter'}</p>
                  : <p className="text-xs text-gray-400">— no kite</p>
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Emergency + waiver */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Emergency contact</h4>
        <div className={rowCls}><span className="text-gray-500">Name</span><span className="font-medium">{p.emergency_contact_name || '—'}</span></div>
        <div className={rowCls}><span className="text-gray-500">Phone / Email</span><span className="font-medium">{p.emergency_contact_phone || '—'} · {p.emergency_contact_email || '—'}</span></div>
        <div className={rowCls}><span className="text-gray-500">Relationship</span><span className="font-medium">{p.emergency_contact_relation || '—'}</span></div>
        <div className={rowCls}><span className="text-gray-500">Waiver accepted</span><span className="font-medium">{p.waiver_accepted ? `✅ ${p.waiver_version}` : '❌'}</span></div>
      </div>

      {/* Bilene dates + actions */}
      {s.status === 'pending' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs text-gray-500">Confirm the Bilene check-in / check-out before creating the booking (defaulted from country entry + nights).</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in (Bilene)</label>
              <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-out (Bilene)</label>
              <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {!datesValid && <p className="text-xs text-rose-500">Check-out must be after check-in.</p>}
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {confirmAction === 'reject' ? (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm text-gray-600">Reject this submission?</span>
              <button type="button" onClick={() => { setConfirmAction(null); reject() }} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition">
                Yes, reject
              </button>
              <button type="button" onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-300 hover:bg-gray-100 transition">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={createBooking} disabled={!datesValid || busy || alreadyCreated}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${datesValid && !busy && !alreadyCreated ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                {busy ? 'Working…' : alreadyCreated ? 'Already created' : 'Create booking'}
              </button>
              <button type="button" onClick={() => setConfirmAction('reject')} disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 border border-gray-300 hover:bg-gray-100 transition">
                Reject
              </button>
            </div>
          )}
        </div>
      )}
      {s.status === 'approved' && s.created_booking_id && (
        <p className="text-sm text-green-700">✅ Approved — booking created.</p>
      )}
      {s.status === 'rejected' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm text-gray-500">This submission was rejected.</p>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {confirmAction === 'reopen' ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Move back to pending?</span>
              <button type="button" onClick={() => { setConfirmAction(null); reopen() }} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition">
                Yes, reconsider
              </button>
              <button type="button" onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-300 hover:bg-gray-100 transition">
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmAction('reopen')} disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-medium text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition">
              ↩ Reconsider (move back to pending)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SubmissionsPage() {
  const { data: submissions, loading, refresh } = useTable<FormSubmission>('form_submissions', { order: 'submitted_at', ascending: false })
  const [tab, setTab] = useState<FormSubmissionStatus>('pending')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = submissions.filter(s => s.status === tab)
  const counts: Record<FormSubmissionStatus, number> = {
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  }

  const tabs: FormSubmissionStatus[] = ['pending', 'approved', 'rejected']

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📝 Booking form submissions</h1>
          <p className="text-sm text-gray-500">Review public form submissions and turn them into bookings.</p>
        </div>
      </div>

      {/* Reminder: notification emails are hardcoded, not editable in the app */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
        <span aria-hidden>✉️</span>
        <p>
          When a client submits this form, two emails go out automatically: an acknowledgment to the
          client and a notification to <span className="font-medium">contact@bilenekite.com</span>.
          Their wording is hardcoded in the <code className="rounded bg-sky-100 px-1">notify-submission</code> function —
          <span className="font-medium"> ask Claude to edit them</span>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map(t => (
          <button key={t} onClick={() => { setTab(t); setOpenId(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t} <span className="opacity-70">({counts[t]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No {tab} submissions.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const open = openId === s.id
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button onClick={() => setOpenId(open ? null : s.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{LANG_FLAG[s.language]}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{s.reference_name || '—'}</p>
                      <p className="text-xs text-gray-400">
                        {s.num_travelers ?? '?'} traveler(s) · arrival {fmtDate(s.arrival_date)} · {s.submitted_at.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                    <span className="text-gray-300 text-sm">{open ? '▲' : '▼'}</span>
                  </div>
                </button>
                {open && <SubmissionDetail s={s} onDone={() => { setOpenId(null); refresh() }} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
