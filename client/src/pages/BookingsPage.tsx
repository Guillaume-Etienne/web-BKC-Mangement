import { useState } from 'react'
import { mockBookings as initialBookings, mockClients, mockBookingRooms, mockRooms, mockAccommodations } from '../data/mock'
import type { Booking } from '../types/database'

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([...initialBookings])
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Partial<Booking>>({})

  const getClientName = (clientId: string) => {
    const client = mockClients.find(c => c.id === clientId)
    return client ? `${client.first_name} ${client.last_name}` : '?'
  }

  const getRoomName = (bookingId: string) => {
    const br = mockBookingRooms.find(b => b.booking_id === bookingId)
    if (!br) return '-'
    const room = mockRooms.find(r => r.id === br.room_id)
    const acc = mockAccommodations.find(a => a.id === room?.accommodation_id)
    return room ? `${acc?.name} - ${room.name}` : '-'
  }

  const statusLabel: Record<string, string> = {
    confirmed: 'Confirmé',
    provisional: 'Provisoire',
    cancelled: 'Annulé',
  }

  const statusColor: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-800',
    provisional: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-gray-100 text-gray-800',
  }

  const openForm = (booking?: Booking) => {
    if (booking) {
      setFormData({
        ...booking,
      })
      setSelectedBooking(booking)
    } else {
      setFormData({
        client_id: '',
        check_in: '',
        check_out: '',
        status: 'provisional',
        notes: '',
        num_lessons: 0,
        num_equipment_rentals: 0,
        arrival_time: null,
        departure_time: null,
        luggage_count: 0,
        boardbag_count: 0,
        taxi_arrival: false,
        taxi_departure: false,
        has_couple: false,
        children_count: 0,
        amount_paid: 0,
      })
      setSelectedBooking(null)
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setFormData({})
    setSelectedBooking(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedBooking) {
      // Édition
      setBookings(prev =>
        prev.map(b =>
          b.id === selectedBooking.id
            ? { ...b, ...formData }
            : b
        )
      )
    } else {
      // Création
      const newBooking: Booking = {
        id: `bk${Date.now()}`,
        client_id: formData.client_id || '',
        check_in: formData.check_in || '',
        check_out: formData.check_out || '',
        status: formData.status || 'provisional',
        notes: formData.notes || null,
        num_lessons: formData.num_lessons || 0,
        num_equipment_rentals: formData.num_equipment_rentals || 0,
        client: mockClients.find(c => c.id === formData.client_id),
        arrival_time: formData.arrival_time || null,
        departure_time: formData.departure_time || null,
        luggage_count: formData.luggage_count || 0,
        boardbag_count: formData.boardbag_count || 0,
        taxi_arrival: formData.taxi_arrival || false,
        taxi_departure: formData.taxi_departure || false,
        has_couple: formData.has_couple || false,
        children_count: formData.children_count || 0,
        amount_paid: formData.amount_paid || 0,
      }
      setBookings(prev => [...prev, newBooking])
    }
    closeForm()
  }

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr ?')) {
      setBookings(prev => prev.filter(b => b.id !== id))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Réservations</h1>
            <p className="text-gray-600 mt-2">Gérez toutes vos réservations</p>
          </div>
          <button
            onClick={() => openForm()}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          >
            + Nouvelle réservation
          </button>
        </div>

        {/* Bookings Table - Desktop */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Client</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Chambre</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Dates</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Cours</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Locations</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Statut</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">{getClientName(booking.client_id)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getRoomName(booking.id)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {booking.check_in} → {booking.check_out}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{booking.num_lessons}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{booking.num_equipment_rentals}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[booking.status]}`}>
                      {statusLabel[booking.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => openForm(booking)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(booking.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bookings Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-gray-800">{getClientName(booking.client_id)}</p>
                  <p className="text-sm text-gray-600">{getRoomName(booking.id)}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor[booking.status]}`}>
                  {statusLabel[booking.status]}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1 mb-3">
                <p>{booking.check_in} → {booking.check_out}</p>
                <p>👥 {booking.num_lessons} cours | 🏄 {booking.num_equipment_rentals} locations</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openForm(booking)}
                  className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
                >
                  ✏️ Éditer
                </button>
                <button
                  onClick={() => handleDelete(booking.id)}
                  className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded font-medium text-sm hover:bg-red-200"
                >
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-gray-800">
                  {selectedBooking ? 'Éditer réservation' : 'Nouvelle réservation'}
                </h2>
                <button
                  onClick={closeForm}
                  className="text-2xl text-gray-500 hover:text-gray-800 font-bold w-8 h-8 flex items-center justify-center"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 p-6 flex flex-col">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  <select
                    value={formData.client_id || ''}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un client</option>
                    {mockClients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                  <input
                    type="date"
                    value={formData.check_in || ''}
                    onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                  <input
                    type="date"
                    value={formData.check_out || ''}
                    onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cours</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.num_lessons || 0}
                      onChange={(e) => setFormData({ ...formData, num_lessons: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Locations</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.num_equipment_rentals || 0}
                      onChange={(e) => setFormData({ ...formData, num_equipment_rentals: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select
                    value={formData.status || 'provisional'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="confirmed">Confirmé</option>
                    <option value="provisional">Provisoire</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </div>

                {/* Section Logistique */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Logistique</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Heure arrivée</label>
                      <input
                        type="time"
                        value={formData.arrival_time || ''}
                        onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Heure départ</label>
                      <input
                        type="time"
                        value={formData.departure_time || ''}
                        onChange={(e) => setFormData({ ...formData, departure_time: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bagages</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.luggage_count || 0}
                        onChange={(e) => setFormData({ ...formData, luggage_count: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Boardbags</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.boardbag_count || 0}
                        onChange={(e) => setFormData({ ...formData, boardbag_count: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.taxi_arrival || false}
                        onChange={(e) => setFormData({ ...formData, taxi_arrival: e.target.checked })}
                        className="w-4 h-4 border border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Taxi arrivée</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.taxi_departure || false}
                        onChange={(e) => setFormData({ ...formData, taxi_departure: e.target.checked })}
                        className="w-4 h-4 border border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Taxi départ</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.has_couple || false}
                        onChange={(e) => setFormData({ ...formData, has_couple: e.target.checked })}
                        className="w-4 h-4 border border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">Couple</span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enfants</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.children_count || 0}
                        onChange={(e) => setFormData({ ...formData, children_count: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Montant payé (€)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.amount_paid || 0}
                      onChange={(e) => setFormData({ ...formData, amount_paid: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                <div className="flex gap-3 pt-4 border-t mt-auto sticky bottom-0 bg-white">
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
        )}
      </div>
    </div>
  )
}
