import type { PendingAction, Page } from '../components/pending/pendingActions'

const PRIORITY_STYLES: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  urgent:  { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    label: 'Urgent' },
  week:    { bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-400',  label: 'This week' },
  monitor: { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  label: 'Monitor' },
}

interface HomePageProps {
  onNavigate: (page: Page) => void
  pendingActions?: PendingAction[]
}

export default function HomePage({ onNavigate, pendingActions = [] }: HomePageProps) {
  const urgentCount = pendingActions.filter(a => a.priority === 'urgent').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            🏄 BKC-Management
          </h1>
          <p className="text-lg md:text-xl text-gray-600">
            Manage everything from here: reservations, planning, clients and more!
          </p>
        </div>

        {/* Pending actions */}
        {pendingActions.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-800">Pending actions</h2>
              {urgentCount > 0 && (
                <span className="bg-red-500 text-white text-sm font-bold rounded-full px-2 py-0.5">
                  {urgentCount} urgent
                </span>
              )}
            </div>
            <div className="space-y-2">
              {pendingActions.map(action => {
                const style = PRIORITY_STYLES[action.priority]
                return (
                  <div
                    key={action.id}
                    className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${style.bg} ${style.border}`}
                  >
                    <span className={`mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full ${style.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {style.label}
                        </span>
                        {action.bookingRef && (
                          <span className="text-sm font-semibold text-gray-700">{action.bookingRef}</span>
                        )}
                        <span className="text-sm text-gray-700">{action.message}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate(action.route)}
                      className="flex-shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      {action.routeLabel} →
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Planning Card */}
          <button
            onClick={() => onNavigate('planning')}
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all p-8 text-left"
          >
            <div className="text-5xl mb-4">📅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Planning</h2>
            <p className="text-gray-600 mb-4">
              Booking Plan
            </p>
            <div className="inline-flex items-center text-blue-600 font-semibold group-hover:gap-2 transition-all">
              Open <span className="ml-1">→</span>
            </div>
          </button>

          {/* Bookings Card */}
          <button
            onClick={() => onNavigate('bookings')}
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all p-8 text-left"
          >
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Bookings</h2>
            <p className="text-gray-600 mb-4">
              Manage bookings
            </p>
            <div className="inline-flex items-center text-blue-600 font-semibold group-hover:gap-2 transition-all">
              Open <span className="ml-1">→</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
