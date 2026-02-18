import { useState } from 'react'
import { mockClients as initialClients, mockBookings } from '../data/mock'
import type { Client, Booking } from '../types/database'

interface ClientsPageProps {
  onNavigate: (page: 'home' | 'planning' | 'bookings' | 'clients') => void
}

const kiteLinelLabels: Record<string, string> = {
  'beginner': 'Débutant',
  'intermediate': 'Intermédiaire',
  'advanced': 'Avancé',
}

const bookingStatusLabel: Record<string, string> = {
  'confirmed': 'Confirmé',
  'provisional': 'Provisoire',
  'cancelled': 'Annulé',
}

const bookingStatusColor: Record<string, string> = {
  'confirmed': 'bg-emerald-100 text-emerald-800',
  'provisional': 'bg-amber-100 text-amber-800',
  'cancelled': 'bg-gray-100 text-gray-800',
}

export default function ClientsPage({ onNavigate }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([...initialClients])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [detailTab, setDetailTab] = useState<'info' | 'bookings'>('info')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Partial<Client>>({})

  const filteredClients = clients.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone?.includes(searchTerm))
  )

  const getClientBookings = (clientId: string): Booking[] => {
    return mockBookings.filter(b => b.client_id === clientId)
  }

  const openForm = (client?: Client) => {
    if (client) {
      setFormData(client)
      setSelectedClient(client)
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        nationality: '',
        passport_number: '',
        birth_date: '',
        kite_level: null,
        notes: '',
      })
      setSelectedClient(null)
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setFormData({})
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedClient) {
      // Édition
      setClients(prev =>
        prev.map(c =>
          c.id === selectedClient.id
            ? { ...c, ...formData }
            : c
        )
      )
      setSelectedClient(prev => prev ? { ...prev, ...formData } : null)
    } else {
      // Création
      const newClient: Client = {
        id: `c${Date.now()}`,
        first_name: formData.first_name || '',
        last_name: formData.last_name || '',
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
        nationality: formData.nationality || null,
        passport_number: formData.passport_number || null,
        birth_date: formData.birth_date || null,
        kite_level: formData.kite_level || null,
      }
      setClients(prev => [...prev, newClient])
    }
    closeForm()
  }

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      setClients(prev => prev.filter(c => c.id !== id))
      setSelectedClient(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Clients</h1>
            <p className="text-gray-600 mt-2">Gérez vos clients et leurs réservations</p>
          </div>
          <button
            onClick={() => openForm()}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          >
            + Nouveau client
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Liste des clients */}
          <div className="xl:col-span-2">
            {/* Search bar */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Rechercher par nom, email ou téléphone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nom complet</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nationalité</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Niveau</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tél</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Réservations</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const bookingCount = getClientBookings(client.id).length
                    return (
                      <tr
                        key={client.id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedClient(client)
                          setDetailTab('info')
                        }}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-800">
                          {client.first_name} {client.last_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{client.nationality || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {client.kite_level ? kiteLinelLabels[client.kite_level] : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{client.email || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{client.phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{bookingCount}</td>
                        <td className="px-6 py-4 text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openForm(client)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {filteredClients.map((client) => {
                const bookingCount = getClientBookings(client.id).length
                return (
                  <div
                    key={client.id}
                    className="bg-white rounded-lg shadow p-4 cursor-pointer"
                    onClick={() => {
                      setSelectedClient(client)
                      setDetailTab('info')
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-sm text-gray-600">{client.nationality || '-'}</p>
                      </div>
                      {client.kite_level && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-semibold">
                          {kiteLinelLabels[client.kite_level]}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      {client.email && <p>📧 {client.email}</p>}
                      {client.phone && <p>📞 {client.phone}</p>}
                      <p>📋 {bookingCount} réservation{bookingCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openForm(client)}
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
                      >
                        ✏️ Éditer
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded font-medium text-sm hover:bg-red-200"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Fiche détail */}
          {selectedClient && (
            <div className="xl:col-span-1">
              <div className="bg-white rounded-lg shadow sticky top-24 max-h-[calc(100vh-150px)] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold">
                      {selectedClient.first_name} {selectedClient.last_name}
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">{selectedClient.nationality || 'Nationalité inconnue'}</p>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-2xl text-white hover:text-blue-100 font-bold w-8 h-8 flex items-center justify-center flex-shrink-0"
                    title="Fermer"
                  >
                    ✕
                  </button>
                </div>

                {/* Tabs */}
                <div className="border-b flex">
                  <button
                    onClick={() => setDetailTab('info')}
                    className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${
                      detailTab === 'info'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Infos
                  </button>
                  <button
                    onClick={() => setDetailTab('bookings')}
                    className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${
                      detailTab === 'bookings'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Réservations
                  </button>
                </div>

                {/* Onglet Infos */}
                {detailTab === 'info' && (
                  <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Prénom</p>
                      <p className="text-gray-800">{selectedClient.first_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Nom</p>
                      <p className="text-gray-800">{selectedClient.last_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Email</p>
                      <p className="text-gray-800">{selectedClient.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Téléphone</p>
                      <p className="text-gray-800">{selectedClient.phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Nationalité</p>
                      <p className="text-gray-800">{selectedClient.nationality || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">N° passeport</p>
                      <p className="text-gray-800">{selectedClient.passport_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Date de naissance</p>
                      <p className="text-gray-800">{selectedClient.birth_date || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Niveau kitesurf</p>
                      <p className="text-gray-800">
                        {selectedClient.kite_level ? kiteLinelLabels[selectedClient.kite_level] : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Notes</p>
                      <p className="text-gray-800">{selectedClient.notes || '-'}</p>
                    </div>
                    <button
                      onClick={() => openForm(selectedClient)}
                      className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      ✏️ Éditer
                    </button>
                  </div>
                )}

                {/* Onglet Réservations */}
                {detailTab === 'bookings' && (
                  <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {getClientBookings(selectedClient.id).length === 0 ? (
                      <p className="text-gray-600 text-sm">Aucune réservation</p>
                    ) : (
                      <>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {getClientBookings(selectedClient.id).map((booking) => (
                            <div key={booking.id} className="border rounded-lg p-3 text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-gray-800">
                                  {booking.check_in} → {booking.check_out}
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${bookingStatusColor[booking.status]}`}>
                                  {bookingStatusLabel[booking.status]}
                                </span>
                              </div>
                              <div className="text-gray-600 space-y-1">
                                <p>👕 {booking.num_lessons} cours</p>
                                <p>🏄 {booking.num_equipment_rentals} locations</p>
                                {booking.arrival_time && <p>🕐 Arrivée: {booking.arrival_time}</p>}
                                {booking.departure_time && <p>🕑 Départ: {booking.departure_time}</p>}
                                {booking.luggage_count > 0 && <p>🧳 {booking.luggage_count} bagages</p>}
                                {booking.boardbag_count > 0 && <p>📦 {booking.boardbag_count} boardbags</p>}
                                {booking.taxi_arrival && <p>🚕 Taxi à l'arrivée</p>}
                                {booking.taxi_departure && <p>🚕 Taxi au départ</p>}
                                {booking.has_couple && <p>💑 Chambre double</p>}
                                {booking.children_count > 0 && <p>👶 {booking.children_count} enfant{booking.children_count > 1 ? 's' : ''}</p>}
                                {booking.amount_paid > 0 && <p>💰 Payé: {booking.amount_paid}€</p>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Totaux cumulés */}
                        <div className="border-t pt-3 mt-3">
                          <h4 className="font-semibold text-gray-800 text-sm mb-2">Totaux</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>👕 Cours : {getClientBookings(selectedClient.id).reduce((sum, b) => sum + b.num_lessons, 0)}</p>
                            <p>🏄 Locations : {getClientBookings(selectedClient.id).reduce((sum, b) => sum + b.num_equipment_rentals, 0)}</p>
                            <p>💰 Montant payé : {getClientBookings(selectedClient.id).reduce((sum, b) => sum + b.amount_paid, 0)}€</p>
                          </div>
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => onNavigate('bookings')}
                      className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                    >
                      + Nouvelle réservation
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-gray-800">
                  {selectedClient ? 'Éditer client' : 'Nouveau client'}
                </h2>
                <button
                  onClick={closeForm}
                  className="text-2xl text-gray-500 hover:text-gray-800 font-bold w-8 h-8 flex items-center justify-center"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handleSubmit} className="space-y-4 flex flex-col h-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                    <input
                      type="text"
                      value={formData.first_name || ''}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={formData.last_name || ''}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nationalité</label>
                    <input
                      type="text"
                      value={formData.nationality || ''}
                      onChange={(e) => setFormData({ ...formData, nationality: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N° passeport</label>
                    <input
                      type="text"
                      value={formData.passport_number || ''}
                      onChange={(e) => setFormData({ ...formData, passport_number: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
                    <input
                      type="date"
                      value={formData.birth_date || ''}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Niveau kitesurf</label>
                    <select
                      value={formData.kite_level || ''}
                      onChange={(e) => setFormData({ ...formData, kite_level: (e.target.value as any) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner</option>
                      <option value="beginner">Débutant</option>
                      <option value="intermediate">Intermédiaire</option>
                      <option value="advanced">Avancé</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t mt-auto">
                  <button
                    type="button"
                    onClick={closeForm}
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
          </div>
        )}
      </div>
    </div>
  )
}
