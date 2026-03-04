import './index.css'
import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Navigation from './components/layout/Navigation'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
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
import { mockSharedLinks } from './data/mock'

type Page = 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting'

// ── Public share links (token in URL) ─────────────────────────────────────
const urlParams  = new URLSearchParams(window.location.search)
const shareToken = urlParams.get('share')
const sharedLink = shareToken
  ? mockSharedLinks.find(l => l.token === shareToken && l.is_active)
  : null

// ────────────────────────────────────────────────────────────────────────────

function App() {
  const [session,     setSession]     = useState<Session | null | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState<Page>('home')

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    // Listen for sign in / sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Public share pages — no auth required
  if (sharedLink) {
    if (sharedLink.type === 'forecast') return <ForecastSharePage />
    if (sharedLink.type === 'taxi')     return <TaxiSharePage />
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
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} onLogout={() => supabase.auth.signOut()} />
      <main className="w-full">
        {currentPage === 'home'       && <HomePage onNavigate={setCurrentPage} />}
        {currentPage === 'planning'   && <PlanningView />}
        {currentPage === 'bookings'   && <BookingsPage />}
        {currentPage === 'clients'    && <ClientsPage onNavigate={setCurrentPage} />}
        {currentPage === 'management' && <ManagementPage />}
        {currentPage === 'equipment'  && <EquipmentPage />}
        {currentPage === 'taxis'      && <TaxiPage />}
        {currentPage === 'documents'  && <DocumentsPage />}
        {currentPage === 'accounting' && <AccountingPage />}
      </main>
    </div>
  )
}

export default App
