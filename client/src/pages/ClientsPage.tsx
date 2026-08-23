import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTable } from '../hooks/useSupabase'
import { useClients } from '../hooks/useClients'
import { useBookings, useBookingParticipants } from '../hooks/useBookings'
import { useLessons } from '../hooks/useLessons'
import type { Client, Booking, KiteLevel, Season } from '../types/database'
import { fmtDate } from '../utils/dates'
import { clientParticipantIds, cumulativeHoursBefore } from '../components/accounting/utils'

interface ClientsPageProps {
  onNavigate: (page: 'home' | 'planning' | 'bookings' | 'clients') => void
}

const kiteLevelLabels: Record<KiteLevel, string> = {
  'beg-total':      'Beg-Total',
  'beg-bodydrag':   'Beg-BodyDrag',
  'beg-waterstart': 'Beg-WaterStart',
  intermediate:     'Intermediate',
  advanced:         'Advanced',
}

const kiteLevelColors: Record<KiteLevel, string> = {
  'beg-total':      'bg-lime-100 dark:bg-lime-900/30 text-lime-800 dark:text-lime-400',
  'beg-bodydrag':   'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
  'beg-waterstart': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
  intermediate:     'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  advanced:         'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400',
}

const bookingStatusLabel: Record<string, string> = {
  confirmed: 'Confirmed',
  provisional: 'Provisional',
  cancelled: 'Cancelled',
}

const bookingStatusColor: Record<string, string> = {
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
  provisional: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
  cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
}

const kiteLevelShort: Record<KiteLevel, string> = {
  'beg-total':      'Beg1',
  'beg-bodydrag':   'Beg2',
  'beg-waterstart': 'Beg3',
  intermediate:     'Int',
  advanced:         'Adv',
}

const MOBILE_VIEW_KEY = 'clients_mobile_view'

export default function ClientsPage({ onNavigate }: ClientsPageProps) {
  const { data: clients, loading, error, refresh: refreshClients } = useClients()
  const { data: bookings } = useBookings()
  const { data: bookingParticipants } = useBookingParticipants()
  const { data: lessons } = useLessons()
  const { data: seasons } = useTable<Season>('seasons', { order: 'start_date', ascending: false })

  /** Lifetime hours, private and group separately — never reset per stay or
   *  season (decision gui, 2026-08-16), the same rule the tiered pricing uses
   *  to pick a client's rate. Shown here so that rule stays visible rather than
   *  living only in a calculation nobody sees. */
  function lifetimeHours(clientId: string) {
    const ids = clientParticipantIds(clientId, bookingParticipants)
    return {
      private: cumulativeHoursBefore(ids, 'private', lessons),
      group: cumulativeHoursBefore(ids, 'group', lessons),
    }
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState<'' | KiteLevel>('')
  const [filterNationality, setFilterNationality] = useState('')
  const [filterSeasonId, setFilterSeasonId] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'cards'>(() => {
    const stored = localStorage.getItem(MOBILE_VIEW_KEY)
    if (stored === 'list' || stored === 'cards') return stored
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'cards'
  })
  const setMobileViewPersisted = (mode: 'list' | 'cards') => {
    setMobileView(mode)
    localStorage.setItem(MOBILE_VIEW_KEY, mode)
  }
  const [detailTab, setDetailTab] = useState<'info' | 'bookings'>('info')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Partial<Client>>({})
  const [saving, setSaving] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const nationalities = [...new Set(clients.map(c => c.nationality).filter(Boolean) as string[])].sort()

  const filterSeason = seasons.find(s => s.id === filterSeasonId)
  // A booking belongs to the season containing its check_in — same attribution
  // rule as filterDataToSeason (components/accounting/seasonFilter.ts).
  const clientHasBookingInSeason = (clientId: string, season: Season) =>
    bookings.some(b => b.client_id === clientId && b.check_in >= season.start_date && b.check_in <= season.end_date)

  const filteredClients = clients.filter(c => {
    const matchesSearch =
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone?.includes(searchTerm))
    const matchesLevel = !filterLevel || c.kite_level === filterLevel
    const matchesNationality = !filterNationality || c.nationality === filterNationality
    const matchesSeason = !filterSeason || clientHasBookingInSeason(c.id, filterSeason)
    return matchesSearch && matchesLevel && matchesNationality && matchesSeason
  })

  const getClientBookings = (clientId: string): Booking[] =>
    bookings.filter(b => b.client_id === clientId)

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
    setMutationError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setFormData({})
    setMutationError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMutationError(null)

    if (selectedClient) {
      // Update
      const { error: err } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', selectedClient.id)
      if (err) { setMutationError(err.message); setSaving(false); return }
      setSelectedClient(prev => prev ? { ...prev, ...formData } : null)
    } else {
      // Insert
      const newClient = {
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
      const { error: err } = await supabase.from('clients').insert(newClient)
      if (err) { setMutationError(err.message); setSaving(false); return }
    }

    await refreshClients()
    setSaving(false)
    closeForm()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client?')) return
    const { error: err } = await supabase.from('clients').delete().eq('id', id)
    if (err) { alert('Delete error: ' + err.message); return }
    setSelectedClient(null)
    refreshClients()
  }

  const hasFilters = !!filterLevel || !!filterNationality || !!filterSeasonId
  const clearFilters = () => {
    setFilterLevel('')
    setFilterNationality('')
    setFilterSeasonId('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading clients...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-6 max-w-md">
          <p className="text-red-700 dark:text-red-400 font-semibold">Error loading clients</p>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200">Clients</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{clients.length} total · {filteredClients.length} shown</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => openForm()}
              className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              + New client
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as typeof filterLevel)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
          >
            <option value="">All levels</option>
            <option value="beg-total">Beg-Total</option>
            <option value="beg-bodydrag">Beg-BodyDrag</option>
            <option value="beg-waterstart">Beg-WaterStart</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select
            value={filterNationality}
            onChange={(e) => setFilterNationality(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
          >
            <option value="">All nationalities</option>
            {nationalities.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={filterSeasonId}
            onChange={(e) => setFilterSeasonId(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
          >
            <option value="">All seasons</option>
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className={`grid grid-cols-1 gap-6 ${selectedClient ? 'xl:grid-cols-3' : ''}`}>

          {/* Client list */}
          <div className={selectedClient ? 'xl:col-span-2' : ''}>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-100 dark:bg-gray-800 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Nationality</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Level</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Bookings</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-400">No clients found</td>
                    </tr>
                  ) : filteredClients.map((client) => {
                    const bookingCount = getClientBookings(client.id).length
                    return (
                      <tr
                        key={client.id}
                        className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${selectedClient?.id === client.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                        onClick={() => { setSelectedClient(client); setDetailTab('info') }}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {client.first_name} {client.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{client.nationality || '–'}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {client.kite_level ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${kiteLevelColors[client.kite_level]}`}>
                              {kiteLevelLabels[client.kite_level]}
                            </span>
                          ) : '–'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{client.email || '–'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{client.phone || '–'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-center">{bookingCount}</td>
                        <td className="px-4 py-3 text-sm space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openForm(client)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400">✏️</button>
                          <button onClick={() => handleDelete(client.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-400">🗑️</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: view toggle */}
            <div className="md:hidden flex justify-end mb-3">
              <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setMobileViewPersisted('list')}
                  className={`px-3 py-1.5 text-sm font-medium ${mobileView === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400'}`}
                >
                  ☰ List
                </button>
                <button
                  onClick={() => setMobileViewPersisted('cards')}
                  className={`px-3 py-1.5 text-sm font-medium ${mobileView === 'cards' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400'}`}
                >
                  ▦ Cards
                </button>
              </div>
            </div>

            {/* Mobile List (compact, one row per client) */}
            {mobileView === 'list' && (
              <div className="md:hidden bg-white dark:bg-gray-900 rounded-lg shadow divide-y divide-gray-100 dark:divide-gray-800">
                {filteredClients.length === 0 && (
                  <p className="text-center text-gray-400 dark:text-gray-400 py-8">No clients found</p>
                )}
                {filteredClients.map((client) => {
                  const bookingCount = getClientBookings(client.id).length
                  return (
                    <button
                      key={client.id}
                      onClick={() => { setSelectedClient(client); setDetailTab('info') }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 ${selectedClient?.id === client.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                    >
                      <p className="flex-1 min-w-0 truncate text-sm">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{client.first_name} {client.last_name}</span>
                        {client.nationality && <span className="text-gray-400 dark:text-gray-400"> · {client.nationality}</span>}
                      </p>
                      {client.kite_level && (
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${kiteLevelColors[client.kite_level]}`}>
                          {kiteLevelShort[client.kite_level]}
                        </span>
                      )}
                      <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">📋 {bookingCount}</span>
                      <span className="flex-shrink-0 text-gray-300 dark:text-gray-500">›</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Mobile Cards */}
            {mobileView === 'cards' && (
              <div className="md:hidden space-y-4">
                {filteredClients.length === 0 && (
                  <p className="text-center text-gray-400 dark:text-gray-400 py-8">No clients found</p>
                )}
                {filteredClients.map((client) => {
                  const bookingCount = getClientBookings(client.id).length
                  return (
                    <div
                      key={client.id}
                      className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 cursor-pointer"
                      onClick={() => { setSelectedClient(client); setDetailTab('info') }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-200">{client.first_name} {client.last_name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{client.nationality || '–'}</p>
                        </div>
                        {client.kite_level && (
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${kiteLevelColors[client.kite_level]}`}>
                            {kiteLevelLabels[client.kite_level]}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                        {client.email && <p>📧 {client.email}</p>}
                        {client.phone && <p>📞 {client.phone}</p>}
                        <p>📋 {bookingCount} booking{bookingCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openForm(client)} className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium text-sm hover:bg-blue-200 dark:hover:bg-blue-800">
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDelete(client.id)} className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded font-medium text-sm hover:bg-red-200 dark:hover:bg-red-800">
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Client detail */}
          {selectedClient && (
            <div className="xl:col-span-1">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow sticky top-24 max-h-[calc(100vh-150px)] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold">{selectedClient.first_name} {selectedClient.last_name}</h2>
                    <p className="text-blue-100 dark:text-blue-300 text-sm mt-1">{selectedClient.nationality || 'Unknown nationality'}</p>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-2xl text-white hover:text-blue-100 dark:hover:text-blue-300 font-bold w-8 h-8 flex items-center justify-center flex-shrink-0"
                  >✕</button>
                </div>

                {/* Tabs */}
                <div className="border-b flex">
                  {(['info', 'bookings'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={`flex-1 py-3 px-4 font-medium text-sm transition-colors capitalize ${
                        detailTab === tab ? 'border-b-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
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
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
                        <p className="text-gray-800 dark:text-gray-200">{value || '–'}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Kite level</p>
                      {selectedClient.kite_level ? (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${kiteLevelColors[selectedClient.kite_level]}`}>
                          {kiteLevelLabels[selectedClient.kite_level]}
                        </span>
                      ) : <p className="text-gray-800 dark:text-gray-200">–</p>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Lifetime kite hours</p>
                      <p className="text-gray-800 dark:text-gray-200">
                        🪁 Private: {lifetimeHours(selectedClient.id).private}h · Group: {lifetimeHours(selectedClient.id).group}h
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                        Counts every stay, never reset — this is what volume pricing tiers key off (Options → Pricing).
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</p>
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedClient.notes || '–'}</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => openForm(selectedClient)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(selectedClient.id)}
                        className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 font-medium"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}

                {/* Bookings tab */}
                {detailTab === 'bookings' && (
                  <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {getClientBookings(selectedClient.id).length === 0 ? (
                      <p className="text-gray-400 dark:text-gray-400 text-sm">No bookings yet</p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {getClientBookings(selectedClient.id).map((booking) => (
                            <div key={booking.id} className="border rounded-lg p-3 text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-gray-800 dark:text-gray-200">
                                  {fmtDate(booking.check_in)} → {fmtDate(booking.check_out)}
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${bookingStatusColor[booking.status]}`}>
                                  {bookingStatusLabel[booking.status]}
                                </span>
                              </div>
                              <div className="text-gray-600 dark:text-gray-400 space-y-0.5">
                                <p>👕 {booking.num_lessons} lessons</p>
                                <p>🏄 {booking.num_equipment_rentals} rentals</p>
                                {booking.amount_paid > 0 && <p>💰 Paid: {booking.amount_paid}€</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="border-t pt-3">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-2">Totals</p>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
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

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                  {selectedClient ? 'Edit client' : 'New client'}
                </h2>
                <button onClick={closeForm} className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First name *</label>
                      <input type="text" value={formData.first_name || ''} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last name *</label>
                      <input type="text" value={formData.last_name || ''} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <input type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                      <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nationality</label>
                      <input type="text" value={formData.nationality || ''} onChange={(e) => setFormData({ ...formData, nationality: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Passport number</label>
                      <input type="text" value={formData.passport_number || ''} onChange={(e) => setFormData({ ...formData, passport_number: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of birth</label>
                      <input type="date" value={formData.birth_date || ''} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kite level</label>
                      <select value={formData.kite_level || ''} onChange={(e) => setFormData({ ...formData, kite_level: (e.target.value as Client['kite_level']) || null })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select level</option>
                        <option value="beg-total">Beg-Total</option>
                        <option value="beg-bodydrag">Beg-BodyDrag</option>
                        <option value="beg-waterstart">Beg-WaterStart</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
                  </div>
                  {mutationError && (
                    <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded px-3 py-2">{mutationError}</p>
                  )}
                  <div className="flex gap-3 pt-4 border-t">
                    <button type="button" onClick={closeForm} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium">Cancel</button>
                    <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save'}
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
