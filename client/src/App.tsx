import './index.css'
import { useState, useEffect } from 'react'
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
import ActivityProviderSharePage from './pages/ActivityProviderSharePage'
import ActivitiesPage from './pages/ActivitiesPage'
import type { SharedLink } from './types/database'

type Page = 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting' | 'activities'

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

  // Load minimal data for pending actions (runs once after login)
  useEffect(() => {
    if (!session) return
    Promise.all([
      supabase.from('bookings').select('*, client:clients(first_name, last_name)'),
      supabase.from('payments').select('id, booking_id, is_verified, is_discount'),
      supabase.from('taxi_trips').select('booking_id'),
    ]).then(([{ data: bookings }, { data: payments }, { data: taxis }]) => {
      const bkgs = (bookings ?? []) as Booking[]
      const pmts = (payments ?? []) as Payment[]
      const unlinked = (taxis ?? []).filter((t: { booking_id: string | null }) => !t.booking_id).length
      setPendingActions(computePendingActions({ bookings: bkgs, payments: pmts, taxiTripUnlinkedCount: unlinked }))
    })
  }, [session])

  useEffect(() => {
    if (!shareToken) return
    supabase
      .from('shared_links')
      .select('*')
      .eq('token', shareToken)
      .eq('is_active', true)
      .single()
      .then(({ data }) => setSharedLink(data ?? null))
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
    if (sharedLink.type === 'activity_provider') return <ActivityProviderSharePage providerId={sharedLink.params?.provider_id ?? ''} />
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
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} onLogout={() => supabase.auth.signOut()} urgentCount={pendingActions.filter(a => a.priority === 'urgent').length} />
      <main className="w-full">
        {currentPage === 'home'       && <HomePage onNavigate={setCurrentPage} pendingActions={pendingActions} />}
        {currentPage === 'planning'   && <PlanningView onOpenBooking={(id) => { setPendingEditBookingId(id); setCurrentPage('bookings') }} />}
        {currentPage === 'bookings'   && <BookingsPage initialEditBookingId={pendingEditBookingId} onEditOpened={() => setPendingEditBookingId(null)} />}
        {currentPage === 'clients'    && <ClientsPage onNavigate={setCurrentPage} />}
        {currentPage === 'management' && <ManagementPage />}
        {currentPage === 'equipment'  && <EquipmentPage />}
        {currentPage === 'taxis'      && <TaxiPage />}
        {currentPage === 'documents'  && <DocumentsPage />}
        {currentPage === 'accounting' && <AccountingPage />}
        {currentPage === 'activities' && <ActivitiesPage />}
      </main>
    </div>
  )
}

export default App
