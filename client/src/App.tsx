import './index.css'
import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Navigation from './components/layout/Navigation'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import { computePendingActions } from './components/pending/pendingActions'
import type { PendingAction } from './components/pending/pendingActions'
import type { Booking, Payment } from './types/database'
import PlanningView from './components/planning/PlanningView'
import BookingsPage from './pages/BookingsPage'
import ClientsPage from './pages/ClientsPage'
import ManagementPage from './pages/ManagementPage'
import TaxiPage from './pages/TaxiPage'
import EquipmentPage from './pages/EquipmentPage'
import DocumentsPage from './pages/DocumentsPage'
import AccountingPage from './pages/AccountingPage'
import ForecastSharePage from './pages/ForecastSharePage'
import TaxiSharePage from './pages/TaxiSharePage'
import ClientSharePage from './pages/ClientSharePage'
import DriverSharePage from './pages/DriverSharePage'
import TaxiManagerSharePage from './pages/TaxiManagerSharePage'
import ActivityProviderSharePage from './pages/ActivityProviderSharePage'
import BookingFormPage from './pages/BookingFormPage'
import RestaurantSharePage from './pages/RestaurantSharePage'
import SubmissionsPage from './pages/SubmissionsPage'
import ActivitiesPage from './pages/ActivitiesPage'
import type { SharedLink } from './types/database'

type Page = 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting' | 'activities' | 'submissions'

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading…</div>
      </div>
    )
  }

  // Public share pages — no auth required
  if (sharedLink) {
    if (sharedLink.type === 'forecast') return <ForecastSharePage />
    if (sharedLink.type === 'taxi')     return <TaxiSharePage />
    if (sharedLink.type === 'client')   return <ClientSharePage bookingNumber={parseInt(sharedLink.params?.booking_number ?? '0')} />
    if (sharedLink.type === 'driver')            return <DriverSharePage driverId={sharedLink.params?.driver_id ?? ''} />
    if (sharedLink.type === 'taxi_manager')      return <TaxiManagerSharePage />
    if (sharedLink.type === 'activity_provider') return <ActivityProviderSharePage providerId={sharedLink.params?.provider_id ?? ''} />
    if (sharedLink.type === 'booking_form')      return <BookingFormPage />
    if (sharedLink.type === 'restaurant')        return <RestaurantSharePage />
  }

  // Loading session
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading…</div>
      </div>
    )
  }

  // Not authenticated
  if (session === null) {
    return <LoginPage />
  }

  // Authenticated
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage={currentPage} onNavigate={(p) => { setCurrentPage(p); refreshPendingActions() }} onLogout={() => supabase.auth.signOut()} urgentCount={pendingActions.filter(a => a.priority === 'urgent').length} submissionsCount={pendingActions.filter(a => a.id === 'pending-submissions').reduce((n, a) => n + (parseInt(a.message) || 0), 0)} />
      <main className="w-full">
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
      </main>
    </div>
  )
}

export default App
