import { useState } from 'react'
import TaxiKanbanView from '../components/taxi/TaxiKanbanView'
import TaxiListView from '../components/taxi/TaxiListView'
import { mockTaxiDrivers as initialDrivers, mockTaxiTrips as initialTrips } from '../data/mock'
import type { TaxiDriver, TaxiTrip } from '../types/database'

export default function TaxiPage() {
  const [trips, setTrips] = useState<TaxiTrip[]>([...initialTrips])
  const [drivers, setDrivers] = useState<TaxiDriver[]>([...initialDrivers])
  const [tab, setTab] = useState<'planning' | 'drivers'>('planning')
  const [planningView, setPlanningView] = useState<'kanban' | 'list'>('list')
  const [selectedDriver, setSelectedDriver] = useState<TaxiDriver | null>(null)
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [driverFormData, setDriverFormData] = useState<Partial<TaxiDriver>>({})

  // Driver CRUD
  function openDriverForm(driver?: TaxiDriver) {
    if (driver) {
      setDriverFormData(driver)
      setSelectedDriver(driver)
    } else {
      setDriverFormData({
        name: '',
        phone: '',
        email: '',
        vehicle: '',
        notes: '',
        margin_percent: 30,
      })
      setSelectedDriver(null)
    }
    setShowDriverForm(true)
  }

  function closeDriverForm() {
    setShowDriverForm(false)
    setDriverFormData({})
  }

  function submitDriver(e: React.FormEvent) {
    e.preventDefault()
    if (selectedDriver) {
      setDrivers(prev => prev.map(d => d.id === selectedDriver.id ? { ...d, ...driverFormData } : d))
      setSelectedDriver(null)
    } else {
      const newDriver: TaxiDriver = {
        id: `td${Date.now()}`,
        name: driverFormData.name || '',
        phone: driverFormData.phone || null,
        email: driverFormData.email || null,
        vehicle: driverFormData.vehicle || null,
        notes: driverFormData.notes || null,
        margin_percent: driverFormData.margin_percent || 30,
      }
      setDrivers(prev => [...prev, newDriver])
    }
    closeDriverForm()
  }

  function deleteDriver(id: string) {
    if (confirm('Supprimer ce chauffeur ?')) {
      setDrivers(prev => prev.filter(d => d.id !== id))
      setSelectedDriver(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">🚕 Gestion des Taxis</h1>
          <p className="text-gray-600 mt-2">Planifiez les trajets et gérez les chauffeurs</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-8 mb-8 border-b">
          <button
            onClick={() => setTab('planning')}
            className={`px-4 py-2 font-medium transition-colors ${
              tab === 'planning'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📅 Planning Trajets
          </button>
          <button
            onClick={() => setTab('drivers')}
            className={`px-4 py-2 font-medium transition-colors ${
              tab === 'drivers'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            👤 Chauffeurs
          </button>
        </div>

        {/* Planning Tab */}
        {tab === 'planning' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">Trajets Taxis</h2>
              <div className="flex gap-2 bg-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setPlanningView('list')}
                  className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                    planningView === 'list'
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  📋 Liste
                </button>
                <button
                  onClick={() => setPlanningView('kanban')}
                  className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                    planningView === 'kanban'
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  🗂️ Kanban
                </button>
              </div>
            </div>

            {planningView === 'list' ? (
              <TaxiListView
                trips={trips}
                drivers={drivers}
                onTripsChange={setTrips}
              />
            ) : (
              <TaxiKanbanView
                trips={trips}
                drivers={drivers}
                onTripsChange={setTrips}
              />
            )}
          </>
        )}

        {/* Drivers Tab */}
        {tab === 'drivers' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Liste des chauffeurs</h2>
              <button
                onClick={() => openDriverForm()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
              >
                + Nouveau chauffeur
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drivers.map(driver => (
                <div key={driver.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                    <h3 className="font-bold text-lg">{driver.name}</h3>
                    <p className="text-sm text-blue-100">{driver.vehicle || 'Véhicule non spécifié'}</p>
                  </div>

                  <div className="p-4 space-y-3">
                    {driver.phone && <p className="text-sm text-gray-700">📞 {driver.phone}</p>}
                    {driver.email && <p className="text-sm text-gray-700">📧 {driver.email}</p>}
                    {driver.notes && <p className="text-sm text-gray-600 italic">💬 {driver.notes}</p>}

                    <div className="bg-amber-50 p-3 rounded border border-amber-200">
                      <p className="text-sm font-semibold text-amber-900">
                        Marge: <span className="text-lg">{driver.margin_percent}%</span>
                      </p>
                    </div>

                    <div className="pt-3 border-t flex gap-2">
                      <button
                        onClick={() => openDriverForm(driver)}
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium text-sm"
                      >
                        ✏️ Éditer
                      </button>
                      <button
                        onClick={() => deleteDriver(driver.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium text-sm"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Driver Form Modal */}
      {showDriverForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedDriver ? 'Éditer chauffeur' : 'Nouveau chauffeur'}
              </h2>
              <button
                onClick={closeDriverForm}
                className="text-2xl text-gray-500 hover:text-gray-800 font-bold"
                title="Fermer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitDriver} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={driverFormData.name || ''}
                  onChange={e => setDriverFormData({ ...driverFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={driverFormData.phone || ''}
                  onChange={e => setDriverFormData({ ...driverFormData, phone: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={driverFormData.email || ''}
                  onChange={e => setDriverFormData({ ...driverFormData, email: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Véhicule</label>
                <input
                  type="text"
                  placeholder="ex: Toyota Corolla blanc"
                  value={driverFormData.vehicle || ''}
                  onChange={e => setDriverFormData({ ...driverFormData, vehicle: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marge (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={driverFormData.margin_percent || 30}
                  onChange={e => setDriverFormData({ ...driverFormData, margin_percent: parseFloat(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Pourcentage du prix du trajet payé au chauffeur</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={driverFormData.notes || ''}
                  onChange={e => setDriverFormData({ ...driverFormData, notes: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeDriverForm}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
