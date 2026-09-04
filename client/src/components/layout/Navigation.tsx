import { useState } from 'react'
import { currentEnv } from '../../lib/supabase'
import { useTheme } from '../../hooks/useTheme'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import type { Page } from '../pending/pendingActions'

interface NavigationProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  urgentCount?: number
  submissionsCount?: number
}

export default function Navigation({ currentPage, onNavigate, onLogout, urgentCount = 0, submissionsCount = 0 }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { lang } = useLanguage()

  const navItems = [
    { id: 'home',       label: i18n.nav.nav_home[lang],       icon: '🏠' },
    { id: 'clients',    label: i18n.nav.nav_clients[lang],    icon: '👥' },
    { id: 'planning',   label: i18n.nav.nav_planning[lang],   icon: '📅' },
    { id: 'bookings',   label: i18n.nav.nav_bookings[lang],   icon: '📋' },
    { id: 'accounting', label: i18n.nav.nav_accounting[lang], icon: '💰' },
    { id: 'documents',  label: i18n.nav.nav_documents[lang],  icon: '📄' },
    { id: 'management', label: i18n.nav.nav_options[lang],    icon: '⚙️' },
    { id: 'equipment',  label: i18n.nav.nav_equipment[lang],  icon: '🎿' },
    { id: 'taxis',      label: i18n.nav.nav_taxis[lang],      icon: '🚕' },
    { id: 'activities', label: i18n.nav.nav_activities[lang], icon: '🏕️' },
    // One entry for everything that arrives from outside; the two objects keep
    // their own screens as tabs inside it (RequestsPage).
    { id: 'requests',   label: i18n.nav.nav_requests[lang],   icon: '📥' },
  ] as const

  const handleNavigate = (page: Page) => {
    setMobileMenuOpen(false)
    onNavigate(page)
  }

  return (
    <>
      {/* Backdrop — closes mobile menu on outside tap */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <nav className={`sticky top-0 z-50 border-b ${currentEnv === 'test' ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <button
                onClick={() => handleNavigate('home')}
                className={`text-xl font-bold hover:text-blue-700 dark:hover:text-blue-400 ${currentEnv === 'test' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}
                style={{ touchAction: 'manipulation' }}
              >
                {currentEnv === 'test' && '🏄 '}BKC
              </button>
            </div>

            {/* Desktop menu */}
            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  style={{ touchAction: 'manipulation' }}
                  className={`relative px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                  {item.id === 'home' && urgentCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {urgentCount}
                    </span>
                  )}
                  {item.id === 'requests' && submissionsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {submissionsCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="hidden md:block p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title={theme === 'dark' ? i18n.nav.tooltip_light_theme[lang] : i18n.nav.tooltip_dark_theme[lang]}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="hidden md:block px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title={i18n.nav.tooltip_logout[lang]}
            >
              ⏻ {i18n.nav.btn_logout[lang]}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="md:hidden p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ touchAction: 'manipulation' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
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
                  style={{ touchAction: 'manipulation' }}
                  className={`w-full text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              ))}
              <div className="border-t dark:border-gray-800 pt-2 mt-2">
                <button
                  onClick={toggleTheme}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full text-left px-4 py-2 rounded-lg font-medium text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {theme === 'dark' ? `☀️ ${i18n.nav.theme_light[lang]}` : `🌙 ${i18n.nav.theme_dark[lang]}`}
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); onLogout() }}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full text-left px-4 py-2 rounded-lg font-medium text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  ⏻ {i18n.nav.btn_logout[lang]}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
