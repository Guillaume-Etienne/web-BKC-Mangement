// Read-only page for a partner hotel (Hotel CasaMoz, Maputo), opened through a
// 'partner_hotel' share link (params.hotel_id). The hotel sees its
// reservations and the account between us, money included (decision gui,
// 2026-10-07). Two views, remembered on the device: grouped by reservation
// (like our admin tab) or day by day (front-desk: who arrives, stays, leaves).
//
// ⚠️ Every select lists its columns: the three tables are column-restricted
// for anon (2026-10-07b_partner_hotels.sql). Never internal_notes, never
// booking_id — naming one of them sends the whole query to 42501.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PartnerHotelStay, PartnerHotelPayment } from '../types/database'
import { todayISO, fmtDate, fromISODate } from '../utils/dates'
import {
  stayNights, stayExpectedMzn, hotelBalanceMzn, fmtMzn, groupStays, hotelDays,
  type StayGroup,
} from '../utils/partnerHotel'
import { usePref, Segmented } from './taxiShareUI'

interface Props { hotelId: string }

type View = 'grouped' | 'days'

const BASE_COLUMNS = 'id, hotel_id, display_name, check_in, check_out, nb_persons, couples_count, children_count, '
  + 'rooms, commission_pct, airport_transfer, transfer_time, big_bags, hotel_confirmed, guests_paid, paid_by, notes'

function paxLine(s: PartnerHotelStay): string {
  return [
    `${s.nb_persons} guest${s.nb_persons === 1 ? '' : 's'}`,
    s.couples_count > 0 && `${s.couples_count} couple${s.couples_count > 1 ? 's' : ''}`,
    s.children_count > 0 && `${s.children_count} child${s.children_count > 1 ? 'ren' : ''}`,
  ].filter(Boolean).join(' · ')
}

function roomsLine(s: PartnerHotelStay): string {
  return s.rooms.map(r => `${r.label || 'Room'} (${fmtMzn(r.rate_mzn)}/night)`).join(' + ')
}

function longDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function Confirmed({ ok }: { ok: boolean }) {
  return (
    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${ok
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
      {ok ? '✓ Confirmed' : 'To confirm'}
    </span>
  )
}

function Extras({ s }: { s: PartnerHotelStay }) {
  if (!s.airport_transfer && s.big_bags === 0) return null
  return (
    <span className="flex flex-wrap gap-x-3 text-sm">
      {s.airport_transfer && <span>✈️ Airport transfer {s.transfer_time ? `at ${s.transfer_time}` : '(time to confirm)'}</span>}
      {s.big_bags > 0 && <span className="font-semibold">🧳 {s.big_bags} big bag{s.big_bags > 1 ? 's' : ''}</span>}
    </span>
  )
}

// ── Grouped view: one card per reservation ─────────────────────────────────────

function ReservationCard({ g }: { g: StayGroup }) {
  const f = g.first
  const owed = g.stays.reduce((s, st) => s + stayExpectedMzn(st), 0)
  const allPaid = g.stays.every(s => s.guests_paid)
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{f.display_name}</p>
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{g.nights} night{g.nights === 1 ? '' : 's'}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{paxLine(f)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{roomsLine(f)}</p>
      </div>

      <div className="space-y-2">
        {g.stays.map((s, i) => {
          const absence = i > 0 ? g.absences.find(a => a.to === s.check_in) : undefined
          return (
            <div key={s.id}>
              {absence && (
                <p className="text-xs text-gray-400 italic text-center py-1">
                  — away {fmtDate(absence.from)} → {fmtDate(absence.to)} —
                </p>
              )}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {fmtDate(s.check_in)} → {fmtDate(s.check_out)}
                    <span className="text-gray-400 font-normal"> · {stayNights(s)} night{stayNights(s) === 1 ? '' : 's'}</span>
                  </span>
                  <Confirmed ok={s.hotel_confirmed} />
                </div>
                <div className="text-gray-700 dark:text-gray-300"><Extras s={s} /></div>
              </div>
            </div>
          )
        })}
      </div>

      {f.notes && <p className="text-sm text-gray-600 dark:text-gray-400 italic">{f.notes}</p>}

      <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
        <span>Total {fmtMzn(g.totalMzn)} · commission {f.commission_pct}% = {fmtMzn(g.commissionMzn)}</span>
        <span>
          Guests pay {f.paid_by === 'guest_to_hotel' ? 'the hotel' : 'BKC'} · {allPaid ? '✓ paid' : 'not paid yet'} ·{' '}
          <span className="font-semibold">{owed > 0 ? `Hotel → BKC ${fmtMzn(owed)}` : `BKC → hotel ${fmtMzn(-owed)}`}</span>
        </span>
      </div>
    </div>
  )
}

// ── Day-by-day view: the front desk ────────────────────────────────────────────

function DayEntry({ s, tone }: { s: PartnerHotelStay; tone: 'in' | 'stay' | 'out' }) {
  const color = tone === 'in' ? 'border-emerald-400' : tone === 'out' ? 'border-orange-400' : 'border-gray-300 dark:border-gray-600'
  return (
    <div className={`border-l-4 ${color} pl-3 py-1`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-gray-800 dark:text-gray-200">{s.display_name}</span>
        {tone !== 'out' && <Confirmed ok={s.hotel_confirmed} />}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{paxLine(s)} · {roomsLine(s)}</p>
      {tone === 'in' && <div className="text-gray-700 dark:text-gray-300"><Extras s={s} /></div>}
      {tone === 'out' && s.big_bags > 0 && <p className="text-xs text-gray-600 dark:text-gray-400">🧳 {s.big_bags} big bag{s.big_bags > 1 ? 's' : ''}</p>}
      {tone === 'in' && s.notes && <p className="text-xs text-gray-500 italic">{s.notes}</p>}
    </div>
  )
}

function DaysView({ stays }: { stays: PartnerHotelStay[] }) {
  const today = todayISO()
  const days = hotelDays(stays, today)
  if (days.length === 0) return <p className="text-sm text-gray-400 italic">Nothing planned from today.</p>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
      {days.map(d => (
        <div key={d.date} className={`bg-white dark:bg-gray-900 rounded-xl border p-4 space-y-3 ${d.date === today
          ? 'border-sky-400 dark:border-sky-600' : 'border-gray-200 dark:border-gray-800'}`}>
          <p className="font-semibold text-gray-800 dark:text-gray-200">
            {longDate(d.date)}{d.date === today && <span className="ml-2 text-xs text-sky-600 dark:text-sky-400">today</span>}
          </p>
          {d.arrivals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Arriving ({d.arrivals.length})</p>
              {d.arrivals.map(s => <DayEntry key={s.id} s={s} tone="in" />)}
            </div>
          )}
          {d.staying.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Staying ({d.staying.length})</p>
              {d.staying.map(s => <DayEntry key={s.id} s={s} tone="stay" />)}
            </div>
          )}
          {d.departures.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">Leaving ({d.departures.length})</p>
              {d.departures.map(s => <DayEntry key={s.id} s={s} tone="out" />)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PartnerHotelSharePage({ hotelId }: Props) {
  const [name,     setName]     = useState<string | null>(null)
  const [stays,    setStays]    = useState<PartnerHotelStay[]>([])
  const [payments, setPayments] = useState<PartnerHotelPayment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [failed,   setFailed]   = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [view,     setView]     = usePref<View>('partner_hotel_view', 'grouped')

  useEffect(() => {
    async function load() {
      const staysQuery = (cols: string) => supabase.from('partner_hotel_stays').select(cols).eq('hotel_id', hotelId).order('check_in')
      const [hRes, sFirst, pRes] = await Promise.all([
        supabase.from('partner_hotels').select('id, name, commission_pct').eq('id', hotelId).maybeSingle(),
        staysQuery(`${BASE_COLUMNS}, group_id`),
        supabase.from('partner_hotel_payments').select('id, hotel_id, date, amount_mzn, direction, notes')
          .eq('hotel_id', hotelId).order('date', { ascending: false }),
      ])
      // group_id came with 2026-10-08b. Should the page ship before that
      // migration, read without it rather than show nothing: each night is
      // then its own reservation.
      let sRes = sFirst
      if (sRes.error && ['42703', '42501'].includes(sRes.error.code)) sRes = await staysQuery(BASE_COLUMNS)

      const err = hRes.error ?? sRes.error ?? pRes.error
      if (err) { console.error('PartnerHotelSharePage:', err.message); setFailed(true) }
      setName((hRes.data as { name: string } | null)?.name ?? null)
      setStays(((sRes.data ?? []) as unknown as PartnerHotelStay[]).map(s => ({ ...s, group_id: s.group_id ?? null })))
      setPayments((pRes.data ?? []) as PartnerHotelPayment[])
      setLoading(false)
    }
    load()
  }, [hotelId])

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Loading…</p>
    </div>
  }
  if (failed || !name) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 text-center">
      <p className="text-gray-500 dark:text-gray-400">This page could not be loaded. Please reload it, or ask BKC for a new link.</p>
    </div>
  }

  const today = todayISO()
  const groups = groupStays(stays)
  const upcoming = groups.filter(g => g.end >= today)
  const past = groups.filter(g => g.end < today).reverse()
  const balance = hotelBalanceMzn(stays, payments)
  const toConfirm = stays.filter(s => !s.hotel_confirmed && s.check_out >= today).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-xl text-white px-5 sm:px-6 py-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sky-200 text-sm font-medium uppercase tracking-wide mb-1">Bilene Kite Center · guests</p>
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-sm text-sky-100 mt-1">
              {upcoming.length} upcoming reservation{upcoming.length === 1 ? '' : 's'}
              {toConfirm > 0 && ` · ${toConfirm} night${toConfirm === 1 ? '' : 's'} to confirm`}
            </p>
          </div>
          <Segmented<View> value={view} onChange={setView} options={[
            { v: 'grouped', label: 'By reservation' },
            { v: 'days',    label: 'Day by day' },
          ]} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-6 items-start">
          {/* Main */}
          <div className="space-y-6 min-w-0">
            {view === 'days' ? <DaysView stays={stays} /> : (
              <>
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">Upcoming reservations ({upcoming.length})</h2>
                  {upcoming.length === 0
                    ? <p className="text-sm text-gray-400 italic">No upcoming reservation.</p>
                    : <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                        {upcoming.map(g => <ReservationCard key={g.key} g={g} />)}
                      </div>}
                </div>
                {past.length > 0 && (
                  <div className="space-y-3">
                    <button onClick={() => setShowPast(v => !v)} className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {showPast ? '▾' : '▸'} Past reservations ({past.length})
                    </button>
                    {showPast && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                        {past.map(g => <ReservationCard key={g.key} g={g} />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Account */}
          <aside className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Account between us</p>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-200 mt-1">
                {balance === 0 ? 'All settled' : balance > 0 ? `Hotel owes BKC ${fmtMzn(balance)}` : `BKC owes the hotel ${fmtMzn(-balance)}`}
              </p>
              <p className="text-xs text-gray-400 mt-1">Counts only the nights the guests have paid, minus the payments below.</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">Payments</h2>
              {payments.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No payment recorded yet.</p>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                  {payments.map(p => (
                    <div key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{fmtDate(p.date)}</span>
                      <span className="text-gray-700 dark:text-gray-300">{p.direction === 'hotel_to_us' ? 'Hotel → BKC' : 'BKC → hotel'}</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtMzn(p.amount_mzn)}</span>
                      {p.notes && <span className="basis-full text-xs text-gray-400 italic">{p.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        <p className="text-center text-xs text-gray-300 dark:text-gray-500">
          Read-only page · Updated {new Date().toLocaleDateString('en-GB')}
        </p>
      </div>
    </div>
  )
}
