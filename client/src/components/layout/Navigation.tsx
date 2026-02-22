import { useState } from 'react'

interface NavigationProps {
  currentPage: 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment'
  onNavigate: (page: 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment') => void
}

export default function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'clients', label: 'Clients', icon: '👥' },
    { id: 'planning', label: 'Planning', icon: '📅' },
    { id: 'bookings', label: 'Bookings', icon: '📋' },
    { id: 'management', label: 'Management', icon: '⚙️' },
    { id: 'equipment', label: 'Equipment', icon: '🎿' },
    { id: 'taxis', label: 'Taxis', icon: '🚕' },
  ] as const

  const handleNavigate = (page: 'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment') => {
    onNavigate(page)
    setMobileMenuOpen(false)
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <button
              onClick={() => handleNavigate('home')}
              className="text-xl font-bold text-blue-600 hover:text-blue-700"
            >
              🏄 Kitesurf Center
            </button>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
