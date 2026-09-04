import type { Booking, Payment, Lang } from '../../types/database'
import { i18n } from '../../data/i18n'

export type ActionPriority = 'urgent' | 'week' | 'monitor'

/** The app's navigable pages — **the single declaration**. App.tsx, Navigation
 *  and HomePage import it. It used to be copied into each of them, so adding a
 *  page meant four edits and three type errors before the build went green. */
export type Page = 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting' | 'activities' | 'requests'

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
  /** Enquiries nobody has read yet — someone is waiting for an answer. */
  unqualifiedEnquiriesCount?: number
  /** Open enquiries with no exchange for SILENCE_WARN_DAYS or more. */
  silentEnquiriesCount?: number
  /** Enquiries whose Brevo push failed: a contact gui believes he has. */
  crmFailedCount?: number
  /** Raw email_logs rows — filtered to sent/delivered/opened inside computePendingActions,
   *  same "pass the table, filter here" convention as bookings/payments. */
  emailLogs?: { booking_id: string; type: string; status: string }[]
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

export function computePendingActions(data: PendingActionsData, lang: Lang = 'en'): PendingAction[] {
  const t = i18n.pages
  const routeLabelAccounting = i18n.nav.nav_accounting[lang]
  const routeLabelBookings   = i18n.nav.nav_bookings[lang]
  const routeLabelDocuments  = i18n.nav.nav_documents[lang]
  const routeLabelRequests   = i18n.nav.nav_requests[lang]
  const routeLabelTaxis      = i18n.nav.nav_taxis[lang]
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

  // Docs already sent (or delivered/opened) — a reminder should disappear once
  // this is true, not just once the deadline is reached.
  const sentTypes = new Set(
    (data.emailLogs ?? [])
      .filter(l => l.status === 'sent' || l.status === 'delivered' || l.status === 'opened')
      .map(l => `${l.booking_id}:${l.type}`)
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
      message: (count > 1 ? t.msg_unverified_payments[lang] : t.msg_unverified_payment[lang]).replace('{count}', String(count)),
      bookingRef: b ? bookingLabel(b) : undefined,
      route: 'accounting',
      routeLabel: routeLabelAccounting,
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
          message: t.msg_provisional_urgent[lang].replace('{days}', String(Math.round((checkIn.getTime() - today.getTime()) / 86400000))),
          bookingRef: bookingLabel(b),
          route: 'bookings',
          routeLabel: routeLabelBookings,
        })
      }
    }
  }

  // ── 🔴 Visa entry date <= J+4, visa letter not sent yet ────────────────────
  for (const b of activeBookings) {
    if (b.visa_entry_date && !sentTypes.has(`${b.id}:visa_letter`)) {
      const visaEntry = parseDate(b.visa_entry_date)
      if (visaEntry >= today && visaEntry <= j4) {
        const daysLeft = Math.round((visaEntry.getTime() - today.getTime()) / 86400000)
        actions.push({
          id: `visa-${b.id}`,
          priority: 'urgent',
          message: t.msg_visa_urgent[lang].replace('{days}', String(daysLeft)),
          bookingRef: bookingLabel(b),
          route: 'documents',
          routeLabel: routeLabelDocuments,
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
          message: t.msg_no_payment_urgent[lang],
          bookingRef: bookingLabel(b),
          route: 'accounting',
          routeLabel: routeLabelAccounting,
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
          message: t.msg_provisional_week[lang].replace('{days}', String(Math.round((checkIn.getTime() - today.getTime()) / 86400000))),
          bookingRef: bookingLabel(b),
          route: 'bookings',
          routeLabel: routeLabelBookings,
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
          message: t.msg_no_payment_week[lang].replace('{days}', String(Math.round((checkIn.getTime() - today.getTime()) / 86400000))),
          bookingRef: bookingLabel(b),
          route: 'accounting',
          routeLabel: routeLabelAccounting,
        })
      }
    }
  }

  // ── 🟡 Visa entry J+5 to J+7, visa letter not sent yet ─────────────────────
  for (const b of activeBookings) {
    if (b.visa_entry_date && !sentTypes.has(`${b.id}:visa_letter`)) {
      const visaEntry = parseDate(b.visa_entry_date)
      if (visaEntry > j4 && visaEntry <= j7) {
        const daysLeft = Math.round((visaEntry.getTime() - today.getTime()) / 86400000)
        actions.push({
          id: `visa-week-${b.id}`,
          priority: 'week',
          message: t.msg_visa_week[lang].replace('{days}', String(daysLeft)),
          bookingRef: bookingLabel(b),
          route: 'documents',
          routeLabel: routeLabelDocuments,
        })
      }
    }
  }

  // ── 🔴 Enquiries nobody has read ──────────────────────────────────────────
  // Urgent, above the booking forms below: a booking form is a dossier that
  // waits well, an unread enquiry is a person waiting for an answer.
  if ((data.unqualifiedEnquiriesCount ?? 0) > 0) {
    const n = data.unqualifiedEnquiriesCount!
    actions.push({
      id: 'unqualified-enquiries',
      priority: 'urgent',
      message: (n > 1 ? t.msg_new_enquiries[lang] : t.msg_new_enquiry[lang]).replace('{count}', String(n)),
      route: 'requests',
      routeLabel: routeLabelRequests,
    })
  }

  // ── 🟡 New public booking-form submissions to review ───────────────────────
  if (data.pendingFormSubmissionsCount > 0) {
    const n = data.pendingFormSubmissionsCount
    actions.push({
      id: 'pending-submissions',
      priority: 'week',
      message: (n > 1 ? t.msg_new_booking_forms[lang] : t.msg_new_booking_form[lang]).replace('{count}', String(n)),
      route: 'requests',
      routeLabel: routeLabelRequests,
    })
  }

  // ── 🟡 Enquiries gone quiet ───────────────────────────────────────────────
  if ((data.silentEnquiriesCount ?? 0) > 0) {
    const n = data.silentEnquiriesCount!
    actions.push({
      id: 'silent-enquiries',
      priority: 'week',
      message: (n > 1 ? t.msg_silent_enquiries[lang] : t.msg_silent_enquiry[lang]).replace('{count}', String(n)),
      route: 'requests',
      routeLabel: routeLabelRequests,
    })
  }

  // ── 🟢 Brevo pushes that failed ───────────────────────────────────────────
  // Nothing is blocked, which is exactly why it needs saying: these are
  // contacts gui believes are in his CRM and are not.
  if ((data.crmFailedCount ?? 0) > 0) {
    const n = data.crmFailedCount!
    actions.push({
      id: 'crm-failed',
      priority: 'monitor',
      message: (n > 1 ? t.msg_crm_failed_enquiries[lang] : t.msg_crm_failed_enquiry[lang]).replace('{count}', String(n)),
      route: 'requests',
      routeLabel: routeLabelRequests,
    })
  }

  // ── 🟡 Confirmed booking, confirmation email never sent ────────────────────
  for (const b of activeBookings) {
    if (b.status === 'confirmed' && !sentTypes.has(`${b.id}:booking_confirmation`)) {
      actions.push({
        id: `confirmation-missing-${b.id}`,
        priority: 'week',
        message: t.msg_confirmation_missing[lang],
        bookingRef: bookingLabel(b),
        route: 'documents',
        routeLabel: routeLabelDocuments,
      })
    }
  }

  // ── 🔴/🟡 Travel guide not sent, check-in approaching ───────────────────────
  for (const b of activeBookings) {
    if (!sentTypes.has(`${b.id}:travel_guide`)) {
      const checkIn = parseDate(b.check_in)
      if (checkIn <= j2) {
        actions.push({
          id: `travel-guide-urgent-${b.id}`,
          priority: 'urgent',
          message: t.msg_travel_guide_urgent[lang],
          bookingRef: bookingLabel(b),
          route: 'documents',
          routeLabel: routeLabelDocuments,
        })
      } else if (checkIn <= j7) {
        actions.push({
          id: `travel-guide-week-${b.id}`,
          priority: 'week',
          message: t.msg_travel_guide_week[lang],
          bookingRef: bookingLabel(b),
          route: 'documents',
          routeLabel: routeLabelDocuments,
        })
      }
    }
  }

  // ── 🔴 Welcome guide not sent, guest currently on-site ──────────────────────
  // Stays flagged for the whole stay, not just arrival day, so it isn't missed
  // if gui doesn't open the app the morning of.
  for (const b of activeBookings) {
    if (!sentTypes.has(`${b.id}:welcome_guide`)) {
      const checkIn = parseDate(b.check_in)
      const checkOut = parseDate(b.check_out)
      if (today >= checkIn && today < checkOut) {
        actions.push({
          id: `welcome-guide-${b.id}`,
          priority: 'urgent',
          message: t.msg_welcome_guide[lang],
          bookingRef: bookingLabel(b),
          route: 'documents',
          routeLabel: routeLabelDocuments,
        })
      }
    }
  }

  // ── 🟢 Unlinked taxi trips ─────────────────────────────────────────────────
  if (data.taxiTripUnlinkedCount > 0) {
    const n = data.taxiTripUnlinkedCount
    actions.push({
      id: 'unlinked-taxis',
      priority: 'monitor',
      message: (n > 1 ? t.msg_unlinked_taxi_trips[lang] : t.msg_unlinked_taxi_trip[lang]).replace('{count}', String(n)),
      route: 'taxis',
      routeLabel: routeLabelTaxis,
    })
  }

  // Sort: urgent first, then week, then monitor
  const order: Record<ActionPriority, number> = { urgent: 0, week: 1, monitor: 2 }
  return actions.sort((a, b) => order[a.priority] - order[b.priority])
}
