import { useState } from 'react'
import { mockInstructors as initialInstructors, mockLessons, mockPriceItems as initialPriceItems } from '../data/mock'
import type { Instructor, PriceItem, PriceCategory } from '../types/database'

const specialtyOptions = ['Débutant', 'Intermédiaire', 'Avancé', 'Wave', 'Freestyle']
const specialtyValues = ['beginner', 'intermediate', 'advanced', 'wave', 'freestyle']

const priceCategoryLabels: Record<PriceCategory, string> = {
  'lesson': 'Cours',
  'activity': 'Activités',
  'rental': 'Locations',
  'taxi': 'Taxis',
}

export default function ManagementPage() {
  const [tab, setTab] = useState<'instructors' | 'pricing'>('instructors')
  const [instructors, setInstructors] = useState<Instructor[]>([...initialInstructors])
  const [priceItems, setPriceItems] = useState<PriceItem[]>([...initialPriceItems])
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  const [showInstructorForm, setShowInstructorForm] = useState(false)
  const [instructorFormData, setInstructorFormData] = useState<Partial<Instructor>>({})
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [priceFormData, setPriceFormData] = useState<Partial<PriceItem>>({})
  const [selectedPriceCategory, setSelectedPriceCategory] = useState<PriceCategory>('lesson')
  const [instructorDetailTab, setInstructorDetailTab] = useState<'info' | 'lessons'>('info')
  const [searchInstructor, setSearchInstructor] = useState('')

  const filteredInstructors = instructors.filter(i =>
    `${i.first_name} ${i.last_name}`.toLowerCase().includes(searchInstructor.toLowerCase()) ||
    (i.email?.toLowerCase().includes(searchInstructor.toLowerCase())) ||
    (i.phone?.includes(searchInstructor))
  )

  const getInstructorLessons = (instructorId: string) => {
    return mockLessons.filter(l => l.instructor_id === instructorId)
  }

  // Instructor handlers
  const openInstructorForm = (instructor?: Instructor) => {
    if (instructor) {
      setInstructorFormData(instructor)
      setSelectedInstructor(instructor)
    } else {
      setInstructorFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        specialties: [],
        rate_private: 50,
        rate_group: 35,
        rate_supervision: 25,
        notes: '',
      })
      setSelectedInstructor(null)
    }
    setShowInstructorForm(true)
  }

  const closeInstructorForm = () => {
    setShowInstructorForm(false)
    setInstructorFormData({})
  }

  const handleInstructorSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedInstructor) {
      setInstructors(prev =>
        prev.map(i =>
          i.id === selectedInstructor.id
            ? { ...i, ...instructorFormData }
            : i
        )
      )
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
    if (confirm('Êtes-vous sûr de vouloir supprimer ce moniteur ?')) {
      setInstructors(prev => prev.filter(i => i.id !== id))
      setSelectedInstructor(null)
    }
  }

  // Price handlers
  const openPriceForm = (priceItem?: PriceItem) => {
    if (priceItem) {
      setPriceFormData(priceItem)
      setSelectedPriceCategory(priceItem.category)
    } else {
      setPriceFormData({
        category: selectedPriceCategory,
        name: '',
        description: '',
        price: 0,
        unit: '',
      })
    }
    setShowPriceForm(true)
  }

  const closePriceForm = () => {
    setShowPriceForm(false)
    setPriceFormData({})
  }

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (priceFormData.id) {
      setPriceItems(prev =>
        prev.map(p =>
          p.id === priceFormData.id
            ? { ...p, ...priceFormData }
            : p
        )
      )
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
    if (confirm('Êtes-vous sûr de vouloir supprimer ce tarif ?')) {
      setPriceItems(prev => prev.filter(p => p.id !== id))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Gestion</h1>
          <p className="text-gray-600 mt-2">Gérez vos moniteurs et tarifs</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-8 mb-8 border-b">
          <button
            onClick={() => setTab('instructors')}
            className={`px-4 py-2 font-medium transition-colors ${
              tab === 'instructors'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📚 Moniteurs
          </button>
          <button
            onClick={() => setTab('pricing')}
            className={`px-4 py-2 font-medium transition-colors ${
              tab === 'pricing'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            💰 Tarifs
          </button>
        </div>

        {/* Instructors Tab */}
        {tab === 'instructors' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Liste des moniteurs */}
            <div className="xl:col-span-2">
              {/* Header with button */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Liste des moniteurs</h2>
                <button
                  onClick={() => openInstructorForm()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                >
                  + Nouveau moniteur
                </button>
              </div>

              {/* Search bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Rechercher par nom, email ou téléphone..."
                  value={searchInstructor}
                  onChange={(e) => setSearchInstructor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Nom</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Spécialités</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Privé €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Groupe €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Supervision €/h</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstructors.map((instructor) => (
                      <tr
                        key={instructor.id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedInstructor(instructor)
                          setInstructorDetailTab('info')
                        }}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
                          {instructor.first_name} {instructor.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {instructor.specialties.length > 0 ? instructor.specialties.join(', ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{instructor.rate_private}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{instructor.rate_group}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{instructor.rate_supervision}€</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{instructor.email || '-'}</td>
                        <td className="px-4 py-3 text-sm space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openInstructorForm(instructor)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteInstructor(instructor.id)}
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

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredInstructors.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="bg-white rounded-lg shadow p-4 cursor-pointer"
                    onClick={() => {
                      setSelectedInstructor(instructor)
                      setInstructorDetailTab('info')
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800">
                          {instructor.first_name} {instructor.last_name}
                        </p>
                        <p className="text-sm text-gray-600">{instructor.email || '-'}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      <p>💰 Privé: {instructor.rate_private}€/h</p>
                      <p>👥 Groupe: {instructor.rate_group}€/h</p>
                      <p>🎓 Supervision: {instructor.rate_supervision}€/h</p>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openInstructorForm(instructor)}
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
                      >
                        ✏️ Éditer
                      </button>
                      <button
                        onClick={() => handleDeleteInstructor(instructor.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded font-medium text-sm hover:bg-red-200"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            {selectedInstructor && (
              <div className="xl:col-span-1">
                <div className="bg-white rounded-lg shadow sticky top-24 max-h-[calc(100vh-150px)] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">
                        {selectedInstructor.first_name} {selectedInstructor.last_name}
                      </h2>
                      <p className="text-blue-100 text-sm mt-1">{selectedInstructor.phone || '-'}</p>
                    </div>
                    <button
                      onClick={() => setSelectedInstructor(null)}
                      className="text-2xl text-white hover:text-blue-100 font-bold w-8 h-8 flex items-center justify-center flex-shrink-0"
                      title="Fermer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="border-b flex">
                    <button
                      onClick={() => setInstructorDetailTab('info')}
                      className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${
                        instructorDetailTab === 'info'
                          ? 'border-b-2 border-blue-600 text-blue-600'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Infos
                    </button>
                    <button
                      onClick={() => setInstructorDetailTab('lessons')}
                      className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${
                        instructorDetailTab === 'lessons'
                          ? 'border-b-2 border-blue-600 text-blue-600'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Cours
                    </button>
                  </div>

                  {/* Info tab */}
                  {instructorDetailTab === 'info' && (
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Prénom</p>
                        <p className="text-gray-800">{selectedInstructor.first_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Nom</p>
                        <p className="text-gray-800">{selectedInstructor.last_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Email</p>
                        <p className="text-gray-800">{selectedInstructor.email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Téléphone</p>
                        <p className="text-gray-800">{selectedInstructor.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Spécialités</p>
                        <p className="text-gray-800">
                          {selectedInstructor.specialties.length > 0 ? selectedInstructor.specialties.join(', ') : '-'}
                        </p>
                      </div>
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-gray-600">Tarifs</p>
                        <div className="text-sm text-gray-800 space-y-1 mt-2">
                          <p>Privé: {selectedInstructor.rate_private}€/h</p>
                          <p>Groupe: {selectedInstructor.rate_group}€/h</p>
                          <p>Supervision: {selectedInstructor.rate_supervision}€/h</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Notes</p>
                        <p className="text-gray-800">{selectedInstructor.notes || '-'}</p>
                      </div>
                      <button
                        onClick={() => openInstructorForm(selectedInstructor)}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        ✏️ Éditer
                      </button>
                    </div>
                  )}

                  {/* Lessons tab */}
                  {instructorDetailTab === 'lessons' && (
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                      {getInstructorLessons(selectedInstructor.id).length === 0 ? (
                        <p className="text-gray-600 text-sm">Aucun cours</p>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {getInstructorLessons(selectedInstructor.id).map((lesson) => (
                            <div key={lesson.id} className="border rounded-lg p-3 text-sm">
                              <div className="font-medium text-gray-800 mb-2">
                                {lesson.date} à {lesson.start_time}
                              </div>
                              <div className="text-gray-600 space-y-1">
                                <p>Type: {lesson.type === 'private' ? 'Privé' : lesson.type === 'group' ? 'Groupe' : 'Supervision'}</p>
                                <p>Durée: {lesson.duration_hours}h</p>
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

        {/* Pricing Tab */}
        {tab === 'pricing' && (
          <div className="space-y-8">
            {(['lesson', 'activity', 'rental', 'taxi'] as const).map((category) => {
              const categoryPrices = priceItems.filter(p => p.category === category)
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">{priceCategoryLabels[category]}</h2>
                    <button
                      onClick={() => {
                        setSelectedPriceCategory(category)
                        openPriceForm()
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm"
                    >
                      + Ajouter
                    </button>
                  </div>

                  {categoryPrices.length === 0 ? (
                    <p className="text-gray-600 text-sm">Aucun tarif</p>
                  ) : (
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nom</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prix</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Unité</th>
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
                                <button
                                  onClick={() => openPriceForm(price)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeletePrice(price.id)}
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
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Instructor Form Modal */}
      {showInstructorForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedInstructor ? 'Éditer moniteur' : 'Nouveau moniteur'}
              </h2>
              <button
                onClick={closeInstructorForm}
                className="text-2xl text-gray-500 hover:text-gray-800 font-bold w-8 h-8 flex items-center justify-center"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handleInstructorSubmit} className="space-y-4 flex flex-col h-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                    <input
                      type="text"
                      value={instructorFormData.first_name || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={instructorFormData.last_name || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={instructorFormData.email || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, email: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      value={instructorFormData.phone || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, phone: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Spécialités</label>
                  <div className="space-y-2">
                    {specialtyOptions.map((label, idx) => (
                      <label key={idx} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={(instructorFormData.specialties || []).includes(specialtyValues[idx])}
                          onChange={(e) => {
                            const newSpecialties = instructorFormData.specialties || []
                            if (e.target.checked) {
                              setInstructorFormData({ ...instructorFormData, specialties: [...newSpecialties, specialtyValues[idx]] })
                            } else {
                              setInstructorFormData({ ...instructorFormData, specialties: newSpecialties.filter(s => s !== specialtyValues[idx]) })
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Privé €/h</label>
                    <input
                      type="number"
                      value={instructorFormData.rate_private || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_private: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Groupe €/h</label>
                    <input
                      type="number"
                      value={instructorFormData.rate_group || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_group: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supervision €/h</label>
                    <input
                      type="number"
                      value={instructorFormData.rate_supervision || ''}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, rate_supervision: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={instructorFormData.notes || ''}
                    onChange={(e) => setInstructorFormData({ ...instructorFormData, notes: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t mt-auto">
                  <button
                    type="button"
                    onClick={closeInstructorForm}
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

      {/* Price Form Modal */}
      {showPriceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">
                {priceFormData.id ? 'Éditer tarif' : 'Nouveau tarif'}
              </h2>
              <button
                onClick={closePriceForm}
                className="text-2xl text-gray-500 hover:text-gray-800 font-bold w-8 h-8 flex items-center justify-center"
                title="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handlePriceSubmit} className="space-y-4 flex flex-col h-full">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    value={priceFormData.name || ''}
                    onChange={(e) => setPriceFormData({ ...priceFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={priceFormData.description || ''}
                    onChange={(e) => setPriceFormData({ ...priceFormData, description: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix *</label>
                    <input
                      type="number"
                      value={priceFormData.price || ''}
                      onChange={(e) => setPriceFormData({ ...priceFormData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                    <input
                      type="text"
                      value={priceFormData.unit || ''}
                      onChange={(e) => setPriceFormData({ ...priceFormData, unit: e.target.value || null })}
                      placeholder="ex: / jour"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t mt-auto">
                  <button
                    type="button"
                    onClick={closePriceForm}
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
  )
}
