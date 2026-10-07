// Read-only page for a partner hotel (Hotel CasaMoz, Maputo), opened through a
// 'partner_hotel' share link (params.hotel_id). The hotel sees its stays and
// the account between us, money included (decision gui, 2026-10-07).
//
// ⚠️ Every select lists its columns: the three tables are column-restricted
// for anon (2026-10-07b_partner_hotels.sql). Never internal_notes, never
// booking_id — naming one of them sends the whole query to 42501.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PartnerHotelStay, PartnerHotelPayment } from '../types/database'
import { todayISO, fmtDate } from '../utils/dates'
import {
  stayNights, stayTotalMzn, stayCommissionMzn, stayExpectedMzn, hotelBalanceMzn, fmtMzn,
} from '../utils/partnerHotel'

interface Props { hotelId: string }

const STAY_COLUMNS = 'id, hotel_id, display_name, check_in, check_out, nb_persons, couples_count, children_count, '
  + 'rooms, commission_pct, airport_transfer, transfer_time, big_bags, hotel_confirmed, guests_paid, paid_by, notes'

function StayCard({ s }: { s: PartnerHotelStay }) {
  const expected = stayExpectedMzn(s)
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-200">{s.display_name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {fmtDate(s.check_in)} → {fmtDate(s.check_out)} · {stayNights(s)} night{stayNights(s) === 1 ? '' : 's'}
          </p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${s.hotel_confirmed
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
          {s.hotel_confirmed ? '✓ Confirmed' : 'To confirm'}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
        <span>👥 {s.nb_persons} guest{s.nb_persons === 1 ? '' : 's'}
          {s.couples_count > 0 && ` · ${s.couples_count} couple${s.couples_count > 1 ? 's' : ''}`}
          {s.children_count > 0 && ` · ${s.children_count} child${s.children_count > 1 ? 'ren' : ''}`}
        </span>
        {s.airport_transfer && <span>✈️ Airport transfer {s.transfer_time ? `at ${s.transfer_time}` : '(time to confirm)'}</span>}
        {s.big_bags > 0 && <span className="font-semibold">🧳 {s.big_bags} big bag{s.big_bags > 1 ? 's' : ''}</span>}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        {s.rooms.map((r, i) => <span key={i} className="mr-3">{r.label || 'Room'} · {fmtMzn(r.rate_mzn)}/night</span>)}
      </div>

      {s.notes && <p className="text-sm text-gray-600 dark:text-gray-400 italic">{s.notes}</p>}

      <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
        <span className="text-gray-600 dark:text-gray-400">
          Total {fmtMzn(stayTotalMzn(s))} · commission {s.commission_pct}% = {fmtMzn(stayCommissionMzn(s))}
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          Guests pay {s.paid_by === 'guest_to_hotel' ? 'the hotel' : 'BKC'} · {s.guests_paid ? '✓ paid' : 'not paid yet'}
          {' · '}
          <span className="font-semibold">
            {expected > 0 ? `Hotel → BKC ${fmtMzn(expected)}` : `BKC → hotel ${fmtMzn(-expected)}`}
          </span>
        </span>
      </div>
    </div>
  )
}

export default function PartnerHotelSharePage({ hotelId }: Props) {
  const [name,     setName]     = useState<string | null>(null)
  const [stays,    setStays]    = useState<PartnerHotelStay[]>([])
  const [payments, setPayments] = useState<PartnerHotelPayment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [failed,   setFailed]   = useState(false)
  const [showPast, setShowPast] = useState(false)

  useEffect(() => {
    async function load() {
      const [hRes, sRes, pRes] = await Promise.all([
        supabase.from('partner_hotels').select('id, name, commission_pct').eq('id', hotelId).maybeSingle(),
        supabase.from('partner_hotel_stays').select(STAY_COLUMNS).eq('hotel_id', hotelId).order('check_in'),
        supabase.from('partner_hotel_payments').select('id, hotel_id, date, amount_mzn, direction, notes')
          .eq('hotel_id', hotelId).order('date', { ascending: false }),
      ])
      const err = hRes.error ?? sRes.error ?? pRes.error
      if (err) { console.error('PartnerHotelSharePage:', err.message); setFailed(true) }
      setName((hRes.data as { name: string } | null)?.name ?? null)
      setStays((sRes.data ?? []) as unknown as PartnerHotelStay[])
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
  const upcoming = stays.filter(s => s.check_out >= today)
  const past = stays.filter(s => s.check_out < today).reverse()
  const balance = hotelBalanceMzn(stays, payments)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-xl text-white px-6 py-5">
          <p className="text-sky-200 text-sm font-medium uppercase tracking-wide mb-1">Bilene Kite Center · guests</p>
          <h1 className="text-2xl font-bold">{name}</h1>
        </div>

        {/* Account */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Account between us</p>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-200 mt-1">
            {balance === 0 ? 'All settled' : balance > 0 ? `Hotel owes BKC ${fmtMzn(balance)}` : `BKC owes the hotel ${fmtMzn(-balance)}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Counts only the stays the guests have paid, minus the payments below.</p>
        </div>

        {/* Upcoming */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">Upcoming stays ({upcoming.length})</h2>
          {upcoming.length === 0
            ? <p className="text-sm text-gray-400 italic">No upcoming stay.</p>
            : upcoming.map(s => <StayCard key={s.id} s={s} />)}
        </div>

        {/* Past */}
        {past.length > 0 && (
          <div className="space-y-3">
            <button onClick={() => setShowPast(v => !v)} className="text-sm font-bold text-gray-700 dark:text-gray-300">
              {showPast ? '▾' : '▸'} Past stays ({past.length})
            </button>
            {showPast && past.map(s => <StayCard key={s.id} s={s} />)}
          </div>
        )}

        {/* Payments */}
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

        <p className="text-center text-xs text-gray-300 dark:text-gray-500">
          Read-only page · Updated {new Date().toLocaleDateString('en-GB')}
        </p>
      </div>
    </div>
  )
}
