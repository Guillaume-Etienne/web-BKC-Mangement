import './index.css'
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Navigation from './components/layout/Navigation'
import ChunkBoundary from './components/layout/ChunkBoundary'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import { computePendingActions } from './components/pending/pendingActions'
import type { PendingAction, Page } from './components/pending/pendingActions'
import type { Booking, Payment } from './types/database'

// Everything past the first screen is fetched when it is actually opened.
// Before this, one bundle held the whole app: a guest opening a taxi or client
// share link downloaded the booking wizard, the accounting screens and the
// management tabs to read a single page — on a phone, on the beach. And the
// admin downloaded all eight share pages they will never open. Login, Home and
// the navigation stay eager: they are the first paint, so splitting them would
// only add a flash.
const PlanningView              = lazy(() => import('./components/planning/PlanningView'))
const BookingsPage              = lazy(() => import('./pages/BookingsPage'))
const ClientsPage               = lazy(() => import('./pages/ClientsPage'))
const ManagementPage            = lazy(() => import('./pages/ManagementPage'))
const TaxiPage                  = lazy(() => import('./pages/TaxiPage'))
const EquipmentPage             = lazy(() => import('./pages/EquipmentPage'))
const DocumentsPage             = lazy(() => import('./pages/DocumentsPage'))
const AccountingPage            = lazy(() => import('./pages/AccountingPage'))
const ActivitiesPage            = lazy(() => import('./pages/ActivitiesPage'))
const SubmissionsPage           = lazy(() => import('./pages/SubmissionsPage'))
const EnquiriesPage             = lazy(() => import('./pages/EnquiriesPage'))
const ForecastSharePage         = lazy(() => import('./pages/ForecastSharePage'))
const TaxiSharePage             = lazy(() => import('./pages/TaxiSharePage'))
const ClientSharePage           = lazy(() => import('./pages/ClientSharePage'))
const DriverSharePage           = lazy(() => import('./pages/DriverSharePage'))
const TaxiManagerSharePage      = lazy(() => import('./pages/TaxiManagerSharePage'))
const ActivityProviderSharePage = lazy(() => import('./pages/ActivityProviderSharePage'))
const BookingFormPage           = lazy(() => import('./pages/BookingFormPage'))
const EnquiryFormPage           = lazy(() => import('./pages/EnquiryFormPage'))
const RestaurantSharePage       = lazy(() => import('./pages/RestaurantSharePage'))
import type { SharedLink } from './types/database'

/** Shown while a page's chunk is on its way. Same look as the session check,
 *  so a slow connection reads as "still loading" rather than "broken". */
function PageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 dark:text-gray-400 text-lg">Loading…</div>
    </div>
  )
}

// Page lives in pendingActions.ts — one declaration for the whole app.

// ── Public share token from URL (sync, module scope) ──────────────────────
const shareToken = new URLSearchParams(window.location.search).get('share')

// ────────────────────────────────────────────────────────────────────────────

function App() {
  const [session,     setSession]     = useState<Session | null | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [pendingEditBookingId, setPendingEditBookingId] = useState<string | null>(null)
  // undefined = still checking, null = not found / no token
  const [sharedLink, setSharedLink]   = useState<SharedLink | null | undefined>(
    shareToken ? undefined : null
  )
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    // Listen for sign in / sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load pending actions — refreshed on login and on every page navigation
  const refreshPendingActions = useCallback(() => {
    if (!session) return
    Promise.all([
      supabase.from('bookings').select('*, client:clients(first_name, last_name)'),
      supabase.from('payments').select('id, booking_id, is_verified, is_discount'),
      supabase.from('taxi_trips').select('booking_id'),
      supabase.from('form_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(([{ data: bookings }, { data: payments }, { data: taxis }, { count: pendingSubs }]) => {
      const bkgs = (bookings ?? []) as Booking[]
      const pmts = (payments ?? []) as Payment[]
      const unlinked = (taxis ?? []).filter((t: { booking_id: string | null }) => !t.booking_id).length
      setPendingActions(computePendingActions({ bookings: bkgs, payments: pmts, taxiTripUnlinkedCount: unlinked, pendingFormSubmissionsCount: pendingSubs ?? 0 }))
    })
  }, [session])

  useEffect(() => { refreshPendingActions() }, [refreshPendingActions])

  useEffect(() => {
    if (!shareToken) return
    // anon has no SELECT on shared_links (token enumeration) — resolution goes
    // through the resolve_share_token() RPC, which needs the exact token.
    supabase
      .rpc('resolve_share_token', { p_token: shareToken })
      .maybeSingle()
      .then(({ data }) => setSharedLink((data as SharedLink | null) ?? null))
  }, [])

  // Still checking share token
  if (sharedLink === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-400 text-lg">Loading…</div>
      </div>
    )
  }

  // Public share pages — no auth required
  if (sharedLink) {
    const sharePage =
      sharedLink.type === 'forecast'          ? <ForecastSharePage /> :
      sharedLink.type === 'taxi'              ? <TaxiSharePage /> :
      sharedLink.type === 'client'            ? <ClientSharePage bookingNumber={parseInt(sharedLink.params?.booking_number ?? '0')} /> :
      sharedLink.type === 'driver'            ? <DriverSharePage driverId={sharedLink.params?.driver_id ?? ''} /> :
      sharedLink.type === 'taxi_manager'      ? <TaxiManagerSharePage /> :
      sharedLink.type === 'activity_provider' ? <ActivityProviderSharePage providerId={sharedLink.params?.provider_id ?? ''} /> :
      sharedLink.type === 'booking_form'      ? <BookingFormPage /> :
      sharedLink.type === 'enquiry_form'      ? <EnquiryFormPage /> :
      sharedLink.type === 'restaurant'        ? <RestaurantSharePage /> :
      null
    // An unknown type falls through to the normal app, exactly as before.
    if (sharePage) return (
      <ChunkBoundary>
        <Suspense fallback={<PageLoading />}>{sharePage}</Suspense>
      </ChunkBoundary>
    )
  }

  // Loading session
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-400 text-lg">Loading…</div>
      </div>
    )
  }

  // Not authenticated
  if (session === null) {
    return <LoginPage />
  }

  // Authenticated
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation currentPage={currentPage} onNavigate={(p) => { setCurrentPage(p); refreshPendingActions() }} onLogout={() => supabase.auth.signOut()} urgentCount={pendingActions.filter(a => a.priority === 'urgent').length} submissionsCount={pendingActions.filter(a => a.id === 'pending-submissions').reduce((n, a) => n + (parseInt(a.message) || 0), 0)} />
      <main className="w-full">
        <ChunkBoundary>
          <Suspense fallback={<PageLoading />}>
            {currentPage === 'home'       && <HomePage onNavigate={setCurrentPage} pendingActions={pendingActions} />}
            {currentPage === 'planning'   && <PlanningView onOpenBooking={(id) => { setPendingEditBookingId(id); setCurrentPage('bookings') }} />}
            {currentPage === 'bookings'   && <BookingsPage initialEditBookingId={pendingEditBookingId} onEditOpened={() => setPendingEditBookingId(null)} />}
            {currentPage === 'clients'    && <ClientsPage onNavigate={setCurrentPage} />}
            {currentPage === 'management' && <ManagementPage />}
            {currentPage === 'equipment'  && <EquipmentPage />}
            {currentPage === 'taxis'      && <TaxiPage />}
            {currentPage === 'documents'  && <DocumentsPage />}
            {currentPage === 'accounting' && <AccountingPage onOpenBooking={(id) => { setPendingEditBookingId(id); setCurrentPage('bookings') }} />}
            {currentPage === 'activities' && <ActivitiesPage />}
            {currentPage === 'submissions' && <SubmissionsPage />}
            {currentPage === 'enquiries'  && <EnquiriesPage />}
          </Suspense>
        </ChunkBoundary>
      </main>
    </div>
  )
}

export default App
