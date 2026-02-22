import { useState } from 'react'
import { mockInstructors as initialInstructors, mockLessons, mockPriceItems as initialPriceItems, mockSharedLinks as initialSharedLinks } from '../data/mock'
import type { Instructor, PriceItem, PriceCategory, SharedLink, SharedLinkType } from '../types/database'

const specialtyOptions = ['Beginner', 'Intermediate', 'Advanced', 'Wave', 'Freestyle']
const specialtyValues = ['beginner', 'intermediate', 'advanced', 'wave', 'freestyle']

const priceCategoryLabels: Record<PriceCategory, string> = {
  'lesson': 'Lessons',
  'activity': 'Activities',
  'rental': 'Rentals',
  'taxi': 'Taxis',
}

const LINK_TYPE_LABELS: Record<SharedLinkType, { icon: string; label: string }> = {
  forecast: { icon: '📋', label: 'Forecast' },
}

function generateToken(type: SharedLinkType) {
  return `${type}_${Math.random().toString(36).slice(2, 12)}`
}

function getBaseUrl() {
  return `${window.location.protocol}//${window.location.host}`
}

export default function ManagementPage() {
  const [tab, setTab] = useState<'instructors' | 'pricing' | 'links'>('instructors')

  // Instructors
  const [instructors, setInstructors] = useState<Instructor[]>([...initialInstructors])
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  const [showInstructorForm, setShowInstructorForm] = useState(false)
  const [instructorFormData, setInstructorFormData] = useState<Partial<Instructor>>({})
  const [instructorDetailTab, setInstructorDetailTab] = useState<'info' | 'lessons'>('info')
  const [searchInstructor, setSearchInstructor] = useState('')

  // Pricing
  const [priceItems, setPriceItems] = useState<PriceItem[]>([...initialPriceItems])
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [priceFormData, setPriceFormData] = useState<Partial<PriceItem>>({})
  const [selectedPriceCategory, setSelectedPriceCategory] = useState<PriceCategory>('lesson')

  // Shared links
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([...initialSharedLinks])
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkFormData, setLinkFormData] = useState<{ label: string; type: SharedLinkType; expires_at: string }>({
    label: '', type: 'forecast', expires_at: '',
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredInstructors = instructors.filter(i =>
    `${i.first_name} ${i.last_name}`.toLowerCase().includes(searchInstructor.toLowerCase()) ||
    (i.email?.toLowerCase().includes(searchInstructor.toLowerCase())) ||
    (i.phone?.includes(searchInstructor))
  )

  const getInstructorLessons = (instructorId: string) => mockLessons.filter(l => l.instructor_id === instructorId)

  // ── Instructor handlers ───────────────────────────────────────────────────

  const openInstructorForm = (instructor?: Instructor) => {
    if (instructor) {
      setInstructorFormData(instructor)
      setSelectedInstructor(instructor)
    } else {
      setInstructorFormData({ first_name: '', last_name: '', email: '', phone: '', specialties: [], rate_private: 50, rate_group: 35, rate_supervision: 25, notes: '' })
      setSelectedInstructor(null)
    }
    setShowInstructorForm(true)
  }

  const closeInstructorForm = () => { setShowInstructorForm(false); setInstructorFormData({}) }

  const handleInstructorSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedInstructor) {
      setInstructors(prev => prev.map(i => i.id === selectedInstructor.id ? { ...i, ...instructorFormData } : i))
      setSelectedInstructor(prev => prev ? { ...prev, ...instructorFormData } : null)
    } else {
      const newInstructor: Instructor = {
        id: `i${Date.now()}`,
        first_name: instructorFormData.first_name || '',
        last_name: instructorFormData.last_name || '',
        email: instructorFormData.email || null,
        phone: instructorFormData.phone || null,
        specialties: instructorFormData.specialties || [],
        rate_private: instructorFormData.rate_private || 50,
        rate_group: instructorFormData.rate_group || 35,
        rate_supervision: instructorFormData.rate_supervision || 25,
        notes: instructorFormData.notes || null,
      }
      setInstructors(prev => [...prev, newInstructor])
    }
    closeInstructorForm()
  }

  const handleDeleteInstructor = (id: string) => {
    if (confirm('Delete this instructor?')) {
      setInstructors(prev => prev.filter(i => i.id !== id))
      setSelectedInstructor(null)
    }
  }

  // ── Price handlers ────────────────────────────────────────────────────────

  const openPriceForm = (priceItem?: PriceItem) => {
    if (priceItem) {
      setPriceFormData(priceItem)
      setSelectedPriceCategory(priceItem.category)
    } else {
      setPriceFormData({ category: selectedPriceCategory, name: '', description: '', price: 0, unit: '' })
    }
    setShowPriceForm(true)
  }

  const closePriceForm = () => { setShowPriceForm(false); setPriceFormData({}) }

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (priceFormData.id) {
      setPriceItems(prev => prev.map(p => p.id === priceFormData.id ? { ...p, ...priceFormData } : p))
    } else {
      const newPriceItem: PriceItem = {
        id: `p${Date.now()}`,
        category: priceFormData.category || selectedPriceCategory,
        name: priceFormData.name || '',
        description: priceFormData.description || null,
        price: priceFormData.price || 0,
        unit: priceFormData.unit || null,
      }
      setPriceItems(prev => [...prev, newPriceItem])
    }
    closePriceForm()
  }

  const handleDeletePrice = (id: string) => {
    if (confirm('Delete this price entry?')) setPriceItems(prev => prev.filter(p => p.id !== id))
  }

  // ── Shared link handlers ──────────────────────────────────────────────────

  const handleCreateLink = (e: React.FormEvent) => {
    e.preventDefault()
    const newLink: SharedLink = {
      id: `sl${Date.now()}`,
      token: generateToken(linkFormData.type),
      type: linkFormData.type,
      label: linkFormData.label || LINK_TYPE_LABELS[linkFormData.type].label,
      params: {},
      created_at: new Date().toISOString().slice(0, 10),
      expires_at: linkFormData.expires_at || null,
      is_active: true,
    }
    setSharedLinks(prev => [...prev, newLink])
    setShowLinkForm(false)
    setLinkFormData({ label: '', type: 'forecast', expires_at: '' })
  }

  const toggleLinkActive = (id: string) => {
    setSharedLinks(prev => prev.map(l => l.id === id ? { ...l, is_active: !l.is_active } : l))
  }

  const deleteLink = (id: string) => {
    if (confirm('Delete this link? Anyone using it will lose access.')) {
      setSharedLinks(prev => prev.filter(l => l.id !== id))
    }
  }

  const copyLink = (token: string, id: string) => {
    const url = `${getBaseUrl()}/?share=${token}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Management</h1>
          <p className="text-gray-600 mt-2">Manage instructors, pricing, and shared links</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-8 mb-8 border-b">
          {(['instructors', 'pricing', 'links'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 font-medium capitalize transition-colors ${
                tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'
              }`}>
              {t === 'instructors' ? '📚 Instructors' : t === 'pricing' ? '💰 Pricing' : '🔗 Shared Links'}
            </button>
          ))}
        </div>

        {/* ── Instructors Tab ────────────────────────────────────────────────── */}
        {tab === 'instructors' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Instructors</h2>
                <button onClick={() => openInstructorForm()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
                  + New instructor
                </button>
              </div>
              <div className="mb-6">
                <input type="text" placeholder="Search by name, email or phone…"
                  value={searchInstructor} onChange={(e) => setSearchInstructor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Specialties</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Private €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Group €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Supervision €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstructors.map((instructor) => (
                      <tr key={instructor.id} className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => { setSelectedInstructor(instructor); setInstructorDetailTab('info') }}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{instructor.first_name} {instructor.last_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{instructor.specialties.length > 0 ? instructor.specialties.join(', ') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{instructor.rate_private}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{instructor.rate_group}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{instructor.rate_supervision}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{instructor.email || '-'}</td>
                        <td className="px-4 py-3 text-sm space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openInstructorForm(instructor)} className="text-blue-600 hover:text-blue-800 font-medium">✏️</button>
                          <button onClick={() => handleDeleteInstructor(instructor.id)} className="text-red-600 hover:text-red-800 font-medium">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-4">
                {filteredInstructors.map((instructor) => (
                  <div key={instructor.id} className="bg-white rounded-lg shadow p-4 cursor-pointer"
                    onClick={() => { setSelectedInstructor(instructor); setInstructorDetailTab('info') }}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800">{instructor.first_name} {instructor.last_name}</p>
                        <p className="text-sm text-gray-600">{instructor.email || '-'}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      <p>💰 Private: {instructor.rate_private}€/h</p>
                      <p>👥 Group: {instructor.rate_group}€/h</p>
                      <p>🎓 Supervision: {instructor.rate_supervision}€/h</p>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openInstructorForm(instructor)}
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200">✏️ Edit</button>
                      <button onClick={() => handleDeleteInstructor(instructor.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded font-medium text-sm hover:bg-red-200">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            {selectedInstructor && (
              <div className="xl:col-span-1">
                <div className="bg-white rounded-lg shadow sticky top-24 max-h-[calc(100vh-150px)] overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">{selectedInstructor.first_name} {selectedInstructor.last_name}</h2>
                      <p className="text-blue-100 text-sm mt-1">{selectedInstructor.phone || '-'}</p>
                    </div>
                    <button onClick={() => setSelectedInstructor(null)}
                      className="text-2xl text-white hover:text-blue-100 font-bold w-8 h-8 flex items-center justify-center flex-shrink-0">✕</button>
                  </div>
                  <div className="border-b flex">
                    {(['info', 'lessons'] as const).map(t => (
                      <button key={t} onClick={() => setInstructorDetailTab(t)}
                        className={`flex-1 py-3 px-4 font-medium text-sm capitalize transition-colors ${
                          instructorDetailTab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'
                        }`}>
                        {t === 'info' ? 'Info' : 'Lessons'}
                      </button>
                    ))}
                  </div>
                  {instructorDetailTab === 'info' && (
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      <div><p className="text-sm font-medium text-gray-600">First name</p><p className="text-gray-800">{selectedInstructor.first_name}</p></div>
                      <div><p className="text-sm font-medium text-gray-600">Last name</p><p className="text-gray-800">{selectedInstructor.last_name}</p></div>
                      <div><p className="text-sm font-medium text-gray-600">Email</p><p className="text-gray-800">{selectedInstructor.email || '-'}</p></div>
                      <div><p className="text-sm font-medium text-gray-600">Phone</p><p className="text-gray-800">{selectedInstructor.phone || '-'}</p></div>
                      <div><p className="text-sm font-medium text-gray-600">Specialties</p><p className="text-gray-800">{selectedInstructor.specialties.length > 0 ? selectedInstructor.specialties.join(', ') : '-'}</p></div>
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-gray-600">Rates</p>
                        <div className="text-sm text-gray-800 space-y-1 mt-2">
                          <p>Private: {selectedInstructor.rate_private}€/h</p>
                          <p>Group: {selectedInstructor.rate_group}€/h</p>
                          <p>Supervision: {selectedInstructor.rate_supervision}€/h</p>
                        </div>
                      </div>
                      <div><p className="text-sm font-medium text-gray-600">Notes</p><p className="text-gray-800">{selectedInstructor.notes || '-'}</p></div>
                      <button onClick={() => openInstructorForm(selectedInstructor)}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">✏️ Edit</button>
                    </div>
                  )}
                  {instructorDetailTab === 'lessons' && (
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      {getInstructorLessons(selectedInstructor.id).length === 0 ? (
                        <p className="text-gray-600 text-sm">No lessons</p>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {getInstructorLessons(selectedInstructor.id).map((lesson) => (
                            <div key={lesson.id} className="border rounded-lg p-3 text-sm">
                              <div className="font-medium text-gray-800 mb-2">{lesson.date} at {lesson.start_time}</div>
                              <div className="text-gray-600 space-y-1">
                                <p>Type: {lesson.type === 'private' ? 'Private' : lesson.type === 'group' ? 'Group' : 'Supervision'}</p>
                                <p>Duration: {lesson.duration_hours}h</p>
                                {lesson.notes && <p>Notes: {lesson.notes}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Pricing Tab ───────────────────────────────────────────────────── */}
        {tab === 'pricing' && (
          <div className="space-y-8">
            {(['lesson', 'activity', 'rental', 'taxi'] as const).map((category) => {
              const categoryPrices = priceItems.filter(p => p.category === category)
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">{priceCategoryLabels[category]}</h2>
                    <button onClick={() => { setSelectedPriceCategory(category); openPriceForm() }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm">
                      + Add
                    </button>
                  </div>
                  {categoryPrices.length === 0 ? (
                    <p className="text-gray-600 text-sm">No price entries</p>
                  ) : (
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Price</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Unit</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryPrices.map((price) => (
                            <tr key={price.id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-800">{price.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{price.description || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-800 font-medium">{price.price}€</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{price.unit || '-'}</td>
                              <td className="px-4 py-3 text-sm space-x-2 whitespace-nowrap">
                                <button onClick={() => openPriceForm(price)} className="text-blue-600 hover:text-blue-800 font-medium">✏️</button>
                                <button onClick={() => handleDeletePrice(price.id)} className="text-red-600 hover:text-red-800 font-medium">🗑️</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Shared Links Tab ──────────────────────────────────────────────── */}
        {tab === 'links' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Shared Links</h2>
                <p className="text-sm text-gray-500 mt-1">Generate read-only public links to share with clients or providers.</p>
              </div>
              <button onClick={() => setShowLinkForm(v => !v)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
                + New link
              </button>
            </div>

            {/* Create form */}
            {showLinkForm && (
              <form onSubmit={handleCreateLink} className="bg-white rounded-lg shadow p-5 mb-6 max-w-lg space-y-4">
                <h3 className="font-bold text-gray-800">New shared link</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={linkFormData.type}
                    onChange={e => setLinkFormData(d => ({ ...d, type: e.target.value as SharedLinkType }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {(Object.entries(LINK_TYPE_LABELS) as [SharedLinkType, { icon: string; label: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
                  <input type="text" value={linkFormData.label}
                    onChange={e => setLinkFormData(d => ({ ...d, label: e.target.value }))}
                    placeholder={`e.g. Forecast – Week 9`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires on (optional)</label>
                  <input type="date" value={linkFormData.expires_at}
                    onChange={e => setLinkFormData(d => ({ ...d, expires_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowLinkForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm">Cancel</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">Generate</button>
                </div>
              </form>
            )}

            {/* Links list */}
            {sharedLinks.length === 0 ? (
              <p className="text-gray-500 text-sm">No shared links yet.</p>
            ) : (
              <div className="space-y-3">
                {sharedLinks.map(link => {
                  const typeInfo = LINK_TYPE_LABELS[link.type]
                  const url = `${getBaseUrl()}/?share=${link.token}`
                  return (
                    <div key={link.id} className={`bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${!link.is_active ? 'opacity-60' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{typeInfo.icon}</span>
                          <span className="font-semibold text-gray-800">{link.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                            {link.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 truncate font-mono">{url}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Created {link.created_at}
                          {link.expires_at && ` · Expires ${link.expires_at}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyLink(link.token, link.id)}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                            copiedId === link.id
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          {copiedId === link.id ? '✓ Copied!' : '📋 Copy'}
                        </button>
                        <button
                          onClick={() => toggleLinkActive(link.id)}
                          className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                        >
                          {link.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => deleteLink(link.id)}
                          className="px-3 py-1.5 rounded text-sm font-medium bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Instructor form modal ─────────────────────────────────────────── */}
      {showInstructorForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">{selectedInstructor ? 'Edit instructor' : 'New instructor'}</h2>
              <button onClick={closeInstructorForm} className="text-2xl text-gray-500 hover:text-gray-800 font-bold w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handleInstructorSubmit} className="space-y-4 flex flex-col h-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                    <input type="text" value={instructorFormData.first_name || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                    <input type="text" value={instructorFormData.last_name || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={instructorFormData.email || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, email: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={instructorFormData.phone || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, phone: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Specialties</label>
                  <div className="space-y-2">
                    {specialtyOptions.map((label, idx) => (
                      <label key={idx} className="flex items-center">
                        <input type="checkbox"
                          checked={(instructorFormData.specialties || []).includes(specialtyValues[idx])}
                          onChange={(e) => {
                            const cur = instructorFormData.specialties || []
                            setInstructorFormData({ ...instructorFormData, specialties: e.target.checked ? [...cur, specialtyValues[idx]] : cur.filter(s => s !== specialtyValues[idx]) })
                          }}
                          className="w-4 h-4 rounded" />
                        <span className="ml-2 text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Private €/h</label>
                    <input type="number" value={instructorFormData.rate_private || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_private: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group €/h</label>
                    <input type="number" value={instructorFormData.rate_group || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_group: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supervision €/h</label>
                    <input type="number" value={instructorFormData.rate_supervision || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_supervision: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={instructorFormData.notes || ''}
                    onChange={(e) => setInstructorFormData({ ...instructorFormData, notes: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
                </div>
                <div className="flex gap-3 pt-4 border-t mt-auto">
                  <button type="button" onClick={closeInstructorForm}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium">Cancel</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Price form modal ──────────────────────────────────────────────── */}
      {showPriceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">{priceFormData.id ? 'Edit price' : 'New price'}</h2>
              <button onClick={closePriceForm} className="text-2xl text-gray-500 hover:text-gray-800 font-bold w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handlePriceSubmit} className="space-y-4 flex flex-col h-full">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={priceFormData.name || ''}
                    onChange={(e) => setPriceFormData({ ...priceFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" value={priceFormData.description || ''}
                    onChange={(e) => setPriceFormData({ ...priceFormData, description: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                    <input type="number" value={priceFormData.price || ''}
                      onChange={(e) => setPriceFormData({ ...priceFormData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <input type="text" value={priceFormData.unit || ''}
                      onChange={(e) => setPriceFormData({ ...priceFormData, unit: e.target.value || null })}
                      placeholder="e.g. / day"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t mt-auto">
                  <button type="button" onClick={closePriceForm}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium">Cancel</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
