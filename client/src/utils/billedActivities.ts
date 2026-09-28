import { supabase } from '../lib/supabase'
import type { ActivityBooking } from '../types/database'

// Activities billed straight onto a guest's bill — a boat trip, a sunset
// outing — without going through the Activities page. They are ordinary
// `activity_bookings` rows (payment_flow 'we_pay_provider'), so the bill, the
// accounting and the client share page already count them. Entry points: the
// Daily "+ Activity" form (several guests, several bookings at once) and the
// Activities section of a booking's bill in Accounting.

/** The provider an activity is filed under when the centre runs it itself.
 *  `activity_bookings.provider_id` is mandatory, so one is created on first use. */
export const IN_HOUSE_PROVIDER_NAME = 'BKC (in-house)'

/** Id of the in-house provider, created the first time it is needed. */
export async function ensureInHouseProvider(): Promise<string> {
  const { data, error } = await supabase
    .from('activity_providers').select('id').eq('name', IN_HOUSE_PROVIDER_NAME).limit(1)
  if (error) throw new Error(error.message)
  if (data && data.length > 0) return data[0].id as string
  const { data: created, error: insErr } = await supabase
    .from('activity_providers')
    .insert([{
      name: IN_HOUSE_PROVIDER_NAME,
      type: 'activity',
      notes: 'Activities run by the centre itself. Created automatically when one is billed from the Daily or a bill.',
    }])
    .select('id').single()
  if (insErr) throw new Error(insErr.message)
  return created.id as string
}

export type NewActivityBooking = Omit<ActivityBooking, 'created_at'>

export interface GuestPick { participantId: string; bookingId: string }

/** What the Daily form hands over: everything but the provider, resolved at save. */
export interface BillActivityRequest {
  date: string
  label: string
  pricePerPerson: number
  totalCost: number
  notes: string | null
  guests: GuestPick[]
}

const cents = (n: number) => Math.round(n * 100) / 100

/** One activity shared by guests from one or several bookings → one row per
 *  booking, billed `pricePerPerson × its guests`. The optional total cost (what
 *  the boat, the guide… cost us) is spread in proportion to headcount, the last
 *  row taking the rounding so the rows add up to exactly `totalCost`.
 *  Pure: ids are passed in so it can be tested. */
export function buildBilledActivities(input: {
  providerId: string
  date: string
  label: string
  pricePerPerson: number
  totalCost: number
  notes: string | null
  guests: GuestPick[]
  newId?: () => string
}): NewActivityBooking[] {
  const { providerId, date, label, pricePerPerson, totalCost, notes, guests } = input
  const newId = input.newId ?? (() => crypto.randomUUID())
  const byBooking = new Map<string, string[]>()
  for (const g of guests) {
    const ids = byBooking.get(g.bookingId) ?? []
    if (!ids.includes(g.participantId)) ids.push(g.participantId)
    byBooking.set(g.bookingId, ids)
  }
  const headcount = [...byBooking.values()].reduce((s, ids) => s + ids.length, 0)
  const rows: NewActivityBooking[] = []
  let costLeft = cents(totalCost)
  let i = 0
  for (const [bookingId, participantIds] of byBooking) {
    i++
    const isLast = i === byBooking.size
    const cost = isLast ? costLeft : cents(totalCost * participantIds.length / headcount)
    costLeft = cents(costLeft - cost)
    rows.push({
      id: newId(),
      provider_id: providerId,
      booking_id: bookingId,
      date,
      label,
      nb_persons: participantIds.length,
      participant_ids: participantIds,
      price_client: cents(pricePerPerson * participantIds.length),
      price_provider: cost,
      payment_flow: 'we_pay_provider',
      notes,
    })
  }
  return rows
}
