import { supabase } from '../lib/supabase'

// Deleting a parent row used to cascade silently through money and history: one
// "Delete this client?" took every booking with it, and their payments, lessons and
// agency invoices. The database now refuses those deletes (migration 2026-10-16d,
// ON DELETE RESTRICT); this module checks the same links BEFORE deleting, so the
// user reads what is in the way instead of a raw Postgres error — and so the app
// is protected even on a database that has not run the migration yet.

export type GuardedTable = 'clients' | 'bookings' | 'accommodations' | 'instructors' | 'agencies' | 'activity_providers'

interface Dep { table: string; column: string; label: string }

const DEPS: Record<GuardedTable, Dep[]> = {
  clients: [
    { table: 'bookings',       column: 'client_id', label: 'booking' },
  ],
  bookings: [
    { table: 'payments',             column: 'booking_id', label: 'payment' },
    { table: 'lessons',              column: 'booking_id', label: 'lesson' },
    { table: 'agency_billing_lines', column: 'booking_id', label: 'agency billing line' },
    { table: 'agency_invoices',      column: 'booking_id', label: 'agency invoice' },
  ],
  accommodations: [
    { table: 'external_accommodation_bookings', column: 'accommodation_id', label: 'external stay' },
    { table: 'house_rentals',                   column: 'accommodation_id', label: 'house rental' },
  ],
  instructors: [
    { table: 'instructor_debts',    column: 'instructor_id', label: 'debt' },
    { table: 'instructor_payments', column: 'instructor_id', label: 'payment' },
    { table: 'lessons',             column: 'instructor_id', label: 'lesson' },
  ],
  agencies: [
    { table: 'bookings', column: 'agency_id', label: 'booking' },
  ],
  activity_providers: [
    { table: 'activity_bookings', column: 'provider_id', label: 'booking' },
    { table: 'activity_payments', column: 'provider_id', label: 'payment' },
  ],
}

const plural = (n: number, label: string) => `${n} ${label}${n > 1 ? 's' : ''}`

async function countWhere(table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).in(column, ids)
  // A count we could not read is not a zero: refuse rather than delete blind.
  if (error) throw new Error(`could not check ${table} (${error.message})`)
  return count ?? 0
}

/** Null when the row can be deleted safely, otherwise what is in the way, in English. */
export async function whatBlocksDelete(table: GuardedTable, id: string): Promise<string | null> {
  try {
    const found: string[] = []
    for (const d of DEPS[table]) {
      const n = await countWhere(d.table, d.column, [id])
      if (n > 0) found.push(plural(n, d.label))
    }
    // An accommodation's rooms go with it — but not while a booking sits in one.
    if (table === 'accommodations') {
      const { data: rooms, error } = await supabase.from('rooms').select('id').eq('accommodation_id', id)
      if (error) throw new Error(`could not check rooms (${error.message})`)
      const n = await countWhere('booking_rooms', 'room_id', (rooms ?? []).map(r => r.id as string))
      if (n > 0) found.push(plural(n, 'booked room'))
    }
    return found.length ? `it still has ${found.join(', ')}` : null
  } catch (e) {
    return (e as Error).message
  }
}

/** Plain-English text for a delete the database refused (23503 = still referenced). */
export function deleteErrorMessage(err: { code?: string; message: string; details?: string }): string {
  if (err.code === '23503') {
    const t = /from table "([^"]+)"/.exec(err.details ?? err.message)?.[1]
    return `other records still point to it${t ? ` (${t.replace(/_/g, ' ')})` : ''}. Nothing was deleted.`
  }
  return err.message
}
