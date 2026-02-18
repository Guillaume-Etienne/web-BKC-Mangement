import './index.css'
import { useState } from 'react'
import Navigation from './components/layout/Navigation'
import HomePage from './pages/HomePage'
import PlanningView from './components/planning/PlanningView'
import BookingsPage from './pages/BookingsPage'
import ClientsPage from './pages/ClientsPage'
import ManagementPage from './pages/ManagementPage'
import TaxiPage from './pages/TaxiPage'

type Page = 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="w-full">
        {currentPage === 'home' && <HomePage onNavigate={setCurrentPage} />}
        {currentPage === 'planning' && <PlanningView />}
        {currentPage === 'bookings' && <BookingsPage />}
        {currentPage === 'clients' && <ClientsPage onNavigate={setCurrentPage} />}
        {currentPage === 'management' && <ManagementPage />}
        {currentPage === 'taxis' && <TaxiPage />}
      </main>
    </div>
  )
}

export default App
