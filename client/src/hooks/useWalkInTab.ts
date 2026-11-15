import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  ActivityBooking, Associate, Booking, BookingCharge, BookingParticipant, DiningEvent,
  EquipmentRental, Lesson, Payment, PriceItem,
} from '../types/database'
import { visitBalances, type VisitBalance } from '../utils/walkInTab'
import { isMissingTable } from '../utils/supabaseErrors'

/** The balances of one client's walk-in visits (utils/walkInTab.ts), fetched
 *  only when his file is opened — same reasoning as useClientDossier: Clients
 *  is a list screen, nobody pays for the rows they never click.
 *
 *  Reads every source computeBookingTotal adds up for a visit, so the tab says
 *  what accounting says, not a quick lessons-only sum. */
export interface WalkInTab {
  balances: VisitBalance[]
  /** Empty until the associates migration is in: the selector then stays
   *  hidden and the column is never written (same guard as PaymentForm). */
  associates: Associate[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useWalkInTab(visits: Booking[]): WalkInTab {
  const [data, setData] = useState<{
    lessons: Lesson[]; equipmentRentals: EquipmentRental[]; payments: Payment[]
    bookingCharges: BookingCharge[]; activityBookings: ActivityBooking[]
    bookingParticipants: BookingParticipant[]; diningEvents: DiningEvent[]; priceItems: PriceItem[]
  } | null>(null)
  const [associates, setAssociates] = useState<Associate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  // Keyed on ids, not on the array: the parent hands a fresh array each render.
  const key = visits.map(v => v.id).sort().join(',')
  const firstDay = visits.reduce((m, v) => (m && m < v.check_in ? m : v.check_in), '')
  const lastDay = visits.reduce((m, v) => (m > v.check_in ? m : v.check_in), '')

  useEffect(() => {
    if (!key) { setData(null); setError(null); return }
    let cancelled = false
    setLoading(true)
    setError(null)

    const run = async () => {
      const ids = key.split(',')
      const problems: string[] = []

      // Participants first: a group lesson is filed on another booking and
      // reaches this visit only through them (lessonsForBooking).
      const partsRes = await supabase.from('booking_participants').select('*').in('booking_id', ids)
      if (partsRes.error) problems.push(`participants (${partsRes.error.message})`)
      const parts = (partsRes.data ?? []) as BookingParticipant[]
      const partIds = parts.map(p => p.id)

      const [lesRes, rentRes, payRes, chgRes, actRes, dinRes, piRes, asRes] = await Promise.all([
        supabase.from('lessons').select('*').or(
          [`booking_id.in.(${ids.join(',')})`, partIds.length ? `participant_ids.ov.{${partIds.join(',')}}` : null]
            .filter(Boolean).join(','),
        ),
        supabase.from('equipment_rentals').select('*').in('booking_id', ids),
        supabase.from('payments').select('*').in('booking_id', ids),
        supabase.from('booking_charges').select('*').in('booking_id', ids),
        supabase.from('activity_bookings').select('*').in('booking_id', ids),
        // A visit lasts a day: only the dinners of those days can carry him.
        supabase.from('dining_events').select('*').gte('date', firstDay).lte('date', lastDay),
        supabase.from('price_items').select('*'),
        supabase.from('associates').select('*').order('sort_order'),
      ])
      if (lesRes.error) problems.push(`lessons (${lesRes.error.message})`)
      if (rentRes.error) problems.push(`rentals (${rentRes.error.message})`)
      if (payRes.error) problems.push(`payments (${payRes.error.message})`)
      if (chgRes.error && !isMissingTable(chgRes.error)) problems.push(`extras (${chgRes.error.message})`)
      if (actRes.error) problems.push(`activities (${actRes.error.message})`)
      if (dinRes.error) problems.push(`meals (${dinRes.error.message})`)
      if (piRes.error) problems.push(`prices (${piRes.error.message})`)
      // A missing associates table only hides the "received by" selector.
      if (asRes.error && !isMissingTable(asRes.error)) problems.push(`associates (${asRes.error.message})`)

      if (cancelled) return
      setData({
        lessons: (lesRes.data ?? []) as Lesson[],
        equipmentRentals: (rentRes.data ?? []) as EquipmentRental[],
        payments: (payRes.data ?? []) as Payment[],
        bookingCharges: (chgRes.data ?? []) as BookingCharge[],
        activityBookings: (actRes.data ?? []) as ActivityBooking[],
        bookingParticipants: parts,
        diningEvents: (dinRes.data ?? []) as DiningEvent[],
        priceItems: (piRes.data ?? []) as PriceItem[],
      })
      setAssociates((asRes.data ?? []) as Associate[])
      // A half-loaded tab would show a balance that is simply wrong: say so.
      setError(problems.length ? `The balance could not be computed: ${problems.join(', ')}.` : null)
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
    // `visits` is intentionally absent: key/firstDay/lastDay carry what matters.
  }, [key, firstDay, lastDay, tick])

  // Cheap (a handful of rows): recomputed every render against the live visits.
  const balances = data ? visitBalances(visits, data) : []

  return { balances, associates, loading, error, refresh }
}
