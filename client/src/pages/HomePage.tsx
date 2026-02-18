interface HomePageProps {
  onNavigate: (page: 'home' | 'planning' | 'bookings') => void
}

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            🏄 Gestion du Kitesurf Center
          </h1>
          <p className="text-lg md:text-xl text-gray-600">
            Gérez vos hébergements, réservations et équipements en un seul endroit
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Planning Card */}
          <button
            onClick={() => onNavigate('planning')}
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all p-8 text-left"
          >
            <div className="text-5xl mb-4">📅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Planning des hébergements</h2>
            <p className="text-gray-600 mb-4">
              Visualisez les réservations en cours, les cours et les locations de matériel par jour.
            </p>
            <div className="inline-flex items-center text-blue-600 font-semibold group-hover:gap-2 transition-all">
              Consulter <span className="ml-1">→</span>
            </div>
          </button>

          {/* Bookings Card */}
          <button
            onClick={() => onNavigate('bookings')}
            className="group bg-white rounded-xl shadow-lg hover:shadow-xl transition-all p-8 text-left"
          >
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Gérer les réservations</h2>
            <p className="text-gray-600 mb-4">
              Créez, modifiez et supprimez les réservations de vos clients.
            </p>
            <div className="inline-flex items-center text-blue-600 font-semibold group-hover:gap-2 transition-all">
              Accéder <span className="ml-1">→</span>
            </div>
          </button>
        </div>

        {/* Stats Section */}
        <div className="mt-12 md:mt-16 grid md:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white rounded-lg shadow p-6 md:p-8">
            <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">6</div>
            <p className="text-gray-600">Réservations actives</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 md:p-8">
            <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">9</div>
            <p className="text-gray-600">Chambres disponibles</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 md:p-8">
            <div className="text-3xl md:text-4xl font-bold text-purple-600 mb-2">6</div>
            <p className="text-gray-600">Hébergements</p>
          </div>
        </div>
      </div>
    </div>
  )
}
