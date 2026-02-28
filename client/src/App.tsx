import './index.css'
import { useState } from 'react'
import Navigation from './components/layout/Navigation'
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
import { mockSharedLinks } from './data/mock'

type Page = 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting'

// Check for a share token in the URL query string
const urlParams = new URLSearchParams(window.location.search)
const shareToken = urlParams.get('share')
const sharedLink = shareToken
  ? mockSharedLinks.find(l => l.token === shareToken && l.is_active)
  : null

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  // Public share view — render without navigation
  if (sharedLink) {
    if (sharedLink.type === 'forecast') {
      return <ForecastSharePage />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="w-full">
        {currentPage === 'home' && <HomePage onNavigate={setCurrentPage} />}
        {currentPage === 'planning' && <PlanningView />}
        {currentPage === 'bookings' && <BookingsPage />}
        {currentPage === 'clients' && <ClientsPage onNavigate={setCurrentPage} />}
        {currentPage === 'management' && <ManagementPage />}
        {currentPage === 'equipment' && <EquipmentPage />}
        {currentPage === 'taxis' && <TaxiPage />}
        {currentPage === 'documents' && <DocumentsPage />}
        {currentPage === 'accounting' && <AccountingPage />}
      </main>
    </div>
  )
}

export default App
