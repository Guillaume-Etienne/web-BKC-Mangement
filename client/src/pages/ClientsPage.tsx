import { useState } from 'react'
import { mockClients as initialClients, mockBookings as initialBookings } from '../data/mock'
import type { Client, Booking } from '../types/database'
import ImportCSVModal from '../components/clients/ImportCSVModal'

interface ClientsPageProps {
  onNavigate: (page: 'home' | 'planning' | 'bookings' | 'clients') => void
}

const kiteLevelLabels: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const kiteLevelColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-blue-100 text-blue-800',
  advanced: 'bg-purple-100 text-purple-800',
}

const bookingStatusLabel: Record<string, string> = {
  confirmed: 'Confirmed',
  provisional: 'Provisional',
  cancelled: 'Cancelled',
}

const bookingStatusColor: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800',
  provisional: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export default function ClientsPage({ onNavigate }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([...initialClients])
  const [bookings, setBookings] = useState<Booking[]>([...initialBookings])
  const [showImport, setShowImport] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState<'' | 'beginner' | 'intermediate' | 'advanced'>('')
  const [filterNationality, setFilterNationality] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [detailTab, setDetailTab] = useState<'info' | 'bookings'>('info')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Partial<Client>>({})

  const nationalities = [...new Set(clients.map(c => c.nationality).filter(Boolean) as string[])].sort()

  const filteredClients = clients.filter(c => {
    const matchesSearch =
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone?.includes(searchTerm))
    const matchesLevel = !filterLevel || c.kite_level === filterLevel
    const matchesNationality = !filterNationality || c.nationality === filterNationality
    return matchesSearch && matchesLevel && matchesNationality
  })

  const getClientBookings = (clientId: string): Booking[] =>
    bookings.filter(b => b.client_id === clientId)

  const handleImport = (newClients: Client[], newBookings: Booking[]) => {
    setClients(prev => {
      const updated = [...prev]
      for (const nc of newClients) {
        const idx = updated.findIndex(c => c.id === nc.id)
        if (idx >= 0) updated[idx] = nc
        else updated.push(nc)
      }
      return updated
    })
    setBookings(prev => [...prev, ...newBookings])
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
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, ...formData } : c))
      setSelectedClient(prev => prev ? { ...prev, ...formData } : null)
    } else {
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
        import_id: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        emergency_contact_email: null,
        emergency_contact_relation: null,
      }
      setClients(prev => [...prev, newClient])
    }
    closeForm()
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this client?')) {
      setClients(prev => prev.filter(c => c.id !== id))
      setSelectedClient(null)
    }
  }

  const hasFilters = !!filterLevel || !!filterNationality
  const clearFilters = () => {
    setFilterLevel('')
    setFilterNationality('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Clients</h1>
            <p className="text-gray-500 mt-1">{clients.length} total · {filteredClients.length} shown</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowImport(true)}
              className="flex-1 md:flex-none px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition-colors border border-gray-300"
            >
              ⬆ Import CSV
            </button>
            <button
              onClick={() => openForm()}
              className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              + New client
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as typeof filterLevel)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select
            value={filterNationality}
            onChange={(e) => setFilterNationality(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All nationalities</option>
            {nationalities.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Client list */}
          <div className="xl:col-span-2">

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nationality</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Level</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Bookings</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No clients found</td>
                    </tr>
                  ) : filteredClients.map((client) => {
                    const bookingCount = getClientBookings(client.id).length
                    return (
                      <tr
                        key={client.id}
                        className={`border-b hover:bg-gray-50 cursor-pointer ${selectedClient?.id === client.id ? 'bg-blue-50' : ''}`}
                        onClick={() => { setSelectedClient(client); setDetailTab('info') }}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
                          {client.first_name} {client.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{client.nationality || '–'}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {client.kite_level ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${kiteLevelColors[client.kite_level]}`}>
                              {kiteLevelLabels[client.kite_level]}
                            </span>
                          ) : '–'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{client.email || '–'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{client.phone || '–'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{bookingCount}</td>
                        <td className="px-4 py-3 text-sm space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openForm(client)} className="text-blue-600 hover:text-blue-800">✏️</button>
                          <button onClick={() => handleDelete(client.id)} className="text-red-600 hover:text-red-800">🗑️</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {filteredClients.length === 0 && (
                <p className="text-center text-gray-400 py-8">No clients found</p>
              )}
              {filteredClients.map((client) => {
                const bookingCount = getClientBookings(client.id).length
                return (
                  <div
                    key={client.id}
                    className="bg-white rounded-lg shadow p-4 cursor-pointer"
                    onClick={() => { setSelectedClient(client); setDetailTab('info') }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800">{client.first_name} {client.last_name}</p>
                        <p className="text-sm text-gray-600">{client.nationality || '–'}</p>
                      </div>
                      {client.kite_level && (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${kiteLevelColors[client.kite_level]}`}>
                          {kiteLevelLabels[client.kite_level]}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      {client.email && <p>📧 {client.email}</p>}
                      {client.phone && <p>📞 {client.phone}</p>}
                      <p>📋 {bookingCount} booking{bookingCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openForm(client)} className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(client.id)} className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded font-medium text-sm hover:bg-red-200">
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Client detail */}
          {selectedClient && (
            <div className="xl:col-span-1">
              <div className="bg-white rounded-lg shadow sticky top-24 max-h-[calc(100vh-150px)] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold">{selectedClient.first_name} {selectedClient.last_name}</h2>
                    <p className="text-blue-100 text-sm mt-1">{selectedClient.nationality || 'Unknown nationality'}</p>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-2xl text-white hover:text-blue-100 font-bold w-8 h-8 flex items-center justify-center flex-shrink-0"
                  >✕</button>
                </div>

                {/* Tabs */}
                <div className="border-b flex">
                  {(['info', 'bookings'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={`flex-1 py-3 px-4 font-medium text-sm transition-colors capitalize ${
                        detailTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      {tab === 'info' ? 'Info' : 'Bookings'}
                    </button>
                  ))}
                </div>

                {/* Info tab */}
                {detailTab === 'info' && (
                  <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {[
                      { label: 'First name', value: selectedClient.first_name },
                      { label: 'Last name', value: selectedClient.last_name },
                      { label: 'Email', value: selectedClient.email },
                      { label: 'Phone', value: selectedClient.phone },
                      { label: 'Nationality', value: selectedClient.nationality },
                      { label: 'Passport number', value: selectedClient.passport_number },
                      { label: 'Date of birth', value: selectedClient.birth_date },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-sm font-medium text-gray-500">{label}</p>
                        <p className="text-gray-800">{value || '–'}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-sm font-medium text-gray-500">Kite level</p>
                      {selectedClient.kite_level ? (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${kiteLevelColors[selectedClient.kite_level]}`}>
                          {kiteLevelLabels[selectedClient.kite_level]}
                        </span>
                      ) : <p className="text-gray-800">–</p>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Notes</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{selectedClient.notes || '–'}</p>
                    </div>
                    <button
                      onClick={() => openForm(selectedClient)}
                      className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                )}

                {/* Bookings tab */}
                {detailTab === 'bookings' && (
                  <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {getClientBookings(selectedClient.id).length === 0 ? (
                      <p className="text-gray-400 text-sm">No bookings yet</p>
                    ) : (
                      <>
                        <div className="space-y-3">
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
                              <div className="text-gray-600 space-y-0.5">
                                <p>👕 {booking.num_lessons} lessons</p>
                                <p>🏄 {booking.num_equipment_rentals} rentals</p>
                                {booking.amount_paid > 0 && <p>💰 Paid: {booking.amount_paid}€</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="border-t pt-3">
                          <p className="font-semibold text-gray-700 text-sm mb-2">Totals</p>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>👕 Lessons: {getClientBookings(selectedClient.id).reduce((s, b) => s + b.num_lessons, 0)}</p>
                            <p>🏄 Rentals: {getClientBookings(selectedClient.id).reduce((s, b) => s + b.num_equipment_rentals, 0)}</p>
                            <p>💰 Amount paid: {getClientBookings(selectedClient.id).reduce((s, b) => s + b.amount_paid, 0)}€</p>
                          </div>
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => onNavigate('bookings')}
                      className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                    >
                      + New booking
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Import CSV Modal */}
        {showImport && (
          <ImportCSVModal
            existingClients={clients}
            existingBookings={bookings}
            nextBookingNumber={bookings.reduce((max, b) => Math.max(max, b.booking_number), 0) + 1}
            onImport={handleImport}
            onClose={() => setShowImport(false)}
          />
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-bold text-gray-800">
                  {selectedClient ? 'Edit client' : 'New client'}
                </h2>
                <button onClick={closeForm} className="text-2xl text-gray-500 hover:text-gray-800 font-bold w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                      <input type="text" value={formData.first_name || ''} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                      <input type="text" value={formData.last_name || ''} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                      <input type="text" value={formData.nationality || ''} onChange={(e) => setFormData({ ...formData, nationality: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passport number</label>
                      <input type="text" value={formData.passport_number || ''} onChange={(e) => setFormData({ ...formData, passport_number: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
                      <input type="date" value={formData.birth_date || ''} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kite level</label>
                      <select value={formData.kite_level || ''} onChange={(e) => setFormData({ ...formData, kite_level: (e.target.value as Client['kite_level']) || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select level</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
                  </div>
                  <div className="flex gap-3 pt-4 border-t">
                    <button type="button" onClick={closeForm} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium">Cancel</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
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
