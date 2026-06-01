import type { Booking, Payment } from '../../types/database'

export type ActionPriority = 'urgent' | 'week' | 'monitor'

export type Page = 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting' | 'activities' | 'submissions'

export interface PendingAction {
  id: string
  priority: ActionPriority
  message: string
  bookingRef?: string
  route: Page
  routeLabel: string
}

export interface PendingActionsData {
  bookings: Booking[]
  payments: Payment[]
  taxiTripUnlinkedCount: number
  pendingFormSubmissionsCount: number
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function parseDate(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

function bookingRef(b: Booking): string {
  return `#${String(b.booking_number).padStart(3, '0')}`
}

/** Returns booking label with client name if available */
function bookingLabel(b: Booking): string {
  const ref = bookingRef(b)
  const name = b.client ? ` — ${b.client.first_name} ${b.client.last_name}` : ''
  return ref + name
}

export function computePendingActions(data: PendingActionsData): PendingAction[] {
  const actions: PendingAction[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const j1 = addDays(today, 1)
  const j2 = addDays(today, 2)
  const j4 = addDays(today, 4)
  const j7 = addDays(today, 7)

  // Active bookings = not cancelled and not checked out
  const activeBookings = data.bookings.filter(b =>
    b.status !== 'cancelled' && parseDate(b.check_out) >= today
  )

  // ── 🔴 Unverified payments ──────────────────────────────────────────────────
  const unverifiedByBooking = new Map<string, number>()
  for (const p of data.payments) {
    if (!p.is_verified && !p.is_discount) {
      unverifiedByBooking.set(p.booking_id, (unverifiedByBooking.get(p.booking_id) ?? 0) + 1)
    }
  }
  for (const [bookingId, count] of unverifiedByBooking) {
    const b = data.bookings.find(b => b.id === bookingId)
    actions.push({
      id: `unverified-${bookingId}`,
      priority: 'urgent',
      message: `${count} unverified payment${count > 1 ? 's' : ''}`,
      bookingRef: b ? bookingLabel(b) : undefined,
      route: 'accounting',
      routeLabel: 'Accounting',
    })
  }

  // ── 🔴 Provisional booking + check_in <= J+2 ────────────────────────────────
  for (const b of activeBookings) {
    if (b.status === 'provisional') {
      const checkIn = parseDate(b.check_in)
      if (checkIn <= j2) {
        actions.push({
          id: `provisional-urgent-${b.id}`,
          priority: 'urgent',
          message: `Provisional booking — check-in in ${Math.round((checkIn.getTime() - today.getTime()) / 86400000)} day(s)`,
          bookingRef: bookingLabel(b),
          route: 'bookings',
          routeLabel: 'Bookings',
        })
      }
    }
  }

  // ── 🔴 Visa entry date <= J+4 ──────────────────────────────────────────────
  for (const b of activeBookings) {
    if (b.visa_entry_date) {
      const visaEntry = parseDate(b.visa_entry_date)
      if (visaEntry >= today && visaEntry <= j4) {
        const daysLeft = Math.round((visaEntry.getTime() - today.getTime()) / 86400000)
        actions.push({
          id: `visa-${b.id}`,
          priority: 'urgent',
          message: `Visa entry in ${daysLeft} day(s) — check visa letter`,
          bookingRef: bookingLabel(b),
          route: 'documents',
          routeLabel: 'Documents',
        })
      }
    }
  }

  // ── 🔴 No payments at all + check_in <= J+1 ────────────────────────────────
  const paidBookingIds = new Set(data.payments.filter(p => !p.is_discount).map(p => p.booking_id))
  for (const b of activeBookings) {
    if (!paidBookingIds.has(b.id)) {
      const checkIn = parseDate(b.check_in)
      if (checkIn <= j1) {
        actions.push({
          id: `no-payment-urgent-${b.id}`,
          priority: 'urgent',
          message: 'No payment recorded — check-in tomorrow or today',
          bookingRef: bookingLabel(b),
          route: 'accounting',
          routeLabel: 'Accounting',
        })
      }
    }
  }

  // ── 🟡 Provisional booking + check_in <= J+7 (not already flagged urgent) ──
  for (const b of activeBookings) {
    if (b.status === 'provisional') {
      const checkIn = parseDate(b.check_in)
      if (checkIn > j2 && checkIn <= j7) {
        actions.push({
          id: `provisional-week-${b.id}`,
          priority: 'week',
          message: `Provisional booking — check-in in ${Math.round((checkIn.getTime() - today.getTime()) / 86400000)} days`,
          bookingRef: bookingLabel(b),
          route: 'bookings',
          routeLabel: 'Bookings',
        })
      }
    }
  }

  // ── 🟡 No payments at all + check_in <= J+7 (not already flagged urgent) ───
  for (const b of activeBookings) {
    if (!paidBookingIds.has(b.id)) {
      const checkIn = parseDate(b.check_in)
      if (checkIn > j1 && checkIn <= j7) {
        actions.push({
          id: `no-payment-week-${b.id}`,
          priority: 'week',
          message: `No payment recorded — check-in in ${Math.round((checkIn.getTime() - today.getTime()) / 86400000)} days`,
          bookingRef: bookingLabel(b),
          route: 'accounting',
          routeLabel: 'Accounting',
        })
      }
    }
  }

  // ── 🟡 Visa entry J+5 to J+7 ──────────────────────────────────────────────
  for (const b of activeBookings) {
    if (b.visa_entry_date) {
      const visaEntry = parseDate(b.visa_entry_date)
      if (visaEntry > j4 && visaEntry <= j7) {
        const daysLeft = Math.round((visaEntry.getTime() - today.getTime()) / 86400000)
        actions.push({
          id: `visa-week-${b.id}`,
          priority: 'week',
          message: `Visa entry in ${daysLeft} days — prepare visa letter`,
          bookingRef: bookingLabel(b),
          route: 'documents',
          routeLabel: 'Documents',
        })
      }
    }
  }

  // ── 🟡 New public booking-form submissions to review ───────────────────────
  if (data.pendingFormSubmissionsCount > 0) {
    actions.push({
      id: 'pending-submissions',
      priority: 'week',
      message: `${data.pendingFormSubmissionsCount} new booking form${data.pendingFormSubmissionsCount > 1 ? 's' : ''} to review`,
      route: 'submissions',
      routeLabel: 'Submissions',
    })
  }

  // ── 🟢 Unlinked taxi trips ─────────────────────────────────────────────────
  if (data.taxiTripUnlinkedCount > 0) {
    actions.push({
      id: 'unlinked-taxis',
      priority: 'monitor',
      message: `${data.taxiTripUnlinkedCount} taxi trip${data.taxiTripUnlinkedCount > 1 ? 's' : ''} not linked to any booking`,
      route: 'taxis',
      routeLabel: 'Taxis',
    })
  }

  // Sort: urgent first, then week, then monitor
  const order: Record<ActionPriority, number> = { urgent: 0, week: 1, monitor: 2 }
  return actions.sort((a, b) => order[a.priority] - order[b.priority])
}
