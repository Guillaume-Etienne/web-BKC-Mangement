import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEquipment, useEquipmentRentals } from '../hooks/useEquipment'
import type { Equipment, EquipmentRental, EquipmentCategory, EquipmentCondition } from '../types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUseCount(equipmentId: string, rentals: EquipmentRental[]): number {
  // Lessons not yet migrated — counting rentals only for now
  return rentals.filter(r => r.equipment_id === equipmentId).length
}

function getRecentUsage(equipmentId: string, rentals: EquipmentRental[]): Array<{ date: string; type: 'rental' }> {
  return rentals
    .filter(r => r.equipment_id === equipmentId)
    .map(r => ({ date: r.date, type: 'rental' as const }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getConditionColor(condition: EquipmentCondition): string {
  switch (condition) {
    case 'new':     return 'bg-green-100 text-green-800'
    case 'good':    return 'bg-green-50 text-green-700'
    case 'fair':    return 'bg-yellow-50 text-yellow-700'
    case 'damaged': return 'bg-red-50 text-red-700'
    case 'retired': return 'bg-gray-50 text-gray-700'
  }
}

function getConditionLabel(condition: EquipmentCondition): string {
  const labels: Record<EquipmentCondition, string> = {
    new: 'Neuf', good: 'Bon', fair: 'Correct', damaged: 'Endommagé', retired: 'Retiré'
  }
  return labels[condition]
}

function getCategoryLabel(category: EquipmentCategory): string {
  const labels: Record<EquipmentCategory, string> = {
    kite: 'Kite', board: 'Planche', surfboard: 'Surfboard', foilboard: 'Foilboard'
  }
  return labels[category]
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditModalState {
  open: boolean
  equipment: Equipment | null
  formData: Partial<Equipment>
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const { data: equipment, refresh: refreshEquipment } = useEquipment()
  const { data: rentals, refresh: refreshRentals } = useEquipmentRentals()

  const [activeTab, setActiveTab]           = useState<'inventory' | 'rentals'>('inventory')
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'all'>('all')
  const [editModal, setEditModal]           = useState<EditModalState>({ open: false, equipment: null, formData: {} })
  const [saving, setSaving]                 = useState(false)
  const [currentMonth, setCurrentMonth]     = useState(new Date())
  const [rentalCategoryFilter, setRentalCategoryFilter] = useState<EquipmentCategory | 'all'>('all')

  // ── Inventory handlers ─────────────────────────────────────────────────────

  const inventoryItems = equipment.filter(
    eq => categoryFilter === 'all' || eq.category === categoryFilter
  )

  function openEditModal(eq: Equipment | null = null) {
    if (eq) {
      setEditModal({ open: true, equipment: eq, formData: { ...eq } })
    } else {
      setEditModal({
        open: true,
        equipment: null,
        formData: {
          name: '', category: 'kite', brand: null, size: null,
          year: new Date().getFullYear(), condition: 'new', notes: null, is_active: true,
        },
      })
    }
  }

  async function saveEquipment() {
    if (!editModal.formData.name) { alert('Le nom est requis'); return }
    setSaving(true)
    if (editModal.equipment) {
      const { id, ...fields } = { ...editModal.equipment, ...editModal.formData }
      const { error } = await supabase.from('equipment').update(fields).eq('id', id)
      if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
      if (selectedEquipment?.id === id) setSelectedEquipment({ ...selectedEquipment, ...editModal.formData } as Equipment)
    } else {
      const { error } = await supabase.from('equipment').insert([editModal.formData])
      if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    refreshEquipment()
    setEditModal({ open: false, equipment: null, formData: {} })
  }

  async function archiveEquipment(eq: Equipment) {
    const { error } = await supabase.from('equipment').update({ is_active: false }).eq('id', eq.id)
    if (error) { alert('Erreur : ' + error.message); return }
    refreshEquipment()
    setSelectedEquipment(null)
  }

  // ── Rentals handlers ───────────────────────────────────────────────────────

  const rentalItems = rentals.filter(r => {
    if (rentalCategoryFilter === 'all') return true
    const eq = equipment.find(e => e.id === r.equipment_id)
    return eq?.category === rentalCategoryFilter
  }).sort((a, b) => a.date.localeCompare(b.date))

  async function addRental() {
    const firstActive = equipment.find(e => e.is_active)
    if (!firstActive) return
    const { error } = await supabase.from('equipment_rentals').insert([{
      equipment_id: firstActive.id,
      booking_id:   null,
      client_id:    null,
      date:         new Date().toISOString().slice(0, 10),
      slot:         'morning',
      price:        25,
      notes:        null,
    }])
    if (error) { alert('Erreur : ' + error.message); return }
    refreshRentals()
  }

  async function updateRentalField(id: string, field: string, value: unknown) {
    const { error } = await supabase.from('equipment_rentals').update({ [field]: value }).eq('id', id)
    if (error) alert('Erreur : ' + error.message)
    // No refresh — defaultValue inputs retain user-entered value; selects update via onChange
  }

  async function deleteRental(id: string) {
    const { error } = await supabase.from('equipment_rentals').delete().eq('id', id)
    if (error) { alert('Erreur : ' + error.message); return }
    refreshRentals()
  }

  const totalRevenue       = rentalItems.reduce((sum, r) => sum + r.price, 0)
  const morningRentals     = rentalItems.filter(r => r.slot === 'morning').length
  const afternoonRentals   = rentalItems.filter(r => r.slot === 'afternoon').length
  const fullDayRentals     = rentalItems.filter(r => r.slot === 'full_day').length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">🎿 Matériel</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          📦 Inventaire
        </button>
        <button
          onClick={() => setActiveTab('rentals')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'rentals'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          📋 Locations
        </button>
      </div>

      {/* ─── INVENTORY TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <div className="grid xl:grid-cols-3 gap-6">
          {/* Left: Table */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value as EquipmentCategory | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Toutes catégories</option>
                <option value="kite">Kites</option>
                <option value="board">Planches</option>
                <option value="surfboard">Surfboards</option>
                <option value="foilboard">Foilboards</option>
              </select>
              <button
                onClick={() => openEditModal()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
              >
                + Ajouter
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Nom</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Catégorie</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Taille</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">État</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Util.</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Actif</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inventoryItems.map(eq => (
                    <tr
                      key={eq.id}
                      onClick={() => setSelectedEquipment(eq)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{eq.name}</td>
                      <td className="px-4 py-3 text-gray-600">{getCategoryLabel(eq.category)}</td>
                      <td className="px-4 py-3 text-gray-600">{eq.size || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getConditionColor(eq.condition)}`}>
                          {getConditionLabel(eq.condition)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{getUseCount(eq.id, rentals)}</td>
                      <td className="px-4 py-3 text-center">
                        {eq.is_active ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); openEditModal(eq) }}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-2"
                        >
                          Éditer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Detail Panel */}
          {selectedEquipment && (
            <div className="xl:col-span-1">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-4">
                  <h3 className="font-bold text-lg">{selectedEquipment.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-blue-100">{getCategoryLabel(selectedEquipment.category)}</span>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getConditionColor(selectedEquipment.condition)}`}>
                      {getConditionLabel(selectedEquipment.condition)}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-2xl font-bold text-blue-900">{getUseCount(selectedEquipment.id, rentals)}</p>
                    <p className="text-xs text-blue-700">Locations</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    {selectedEquipment.brand && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Marque</p>
                        <p className="text-gray-900">{selectedEquipment.brand}</p>
                      </div>
                    )}
                    {selectedEquipment.size && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Taille</p>
                        <p className="text-gray-900">{selectedEquipment.size}</p>
                      </div>
                    )}
                    {selectedEquipment.year && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Année</p>
                        <p className="text-gray-900">{selectedEquipment.year}</p>
                      </div>
                    )}
                    {selectedEquipment.notes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Notes</p>
                        <p className="text-gray-900">{selectedEquipment.notes}</p>
                      </div>
                    )}
                  </div>

                  {getRecentUsage(selectedEquipment.id, rentals).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">5 dernières locations</p>
                      <div className="space-y-1.5">
                        {getRecentUsage(selectedEquipment.id, rentals).map((usage, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1.5 rounded">
                            <span className="text-gray-600">📦 {formatDate(usage.date)}</span>
                            <span className="text-gray-500">Location</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => openEditModal(selectedEquipment)}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => archiveEquipment(selectedEquipment)}
                      className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-sm"
                    >
                      Archiver
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── RENTALS TAB ───────────────────────────────────────────────────────── */}
      {activeTab === 'rentals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >←</button>
              <span className="font-semibold text-gray-800 min-w-40">
                {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >→</button>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={rentalCategoryFilter}
                onChange={e => setRentalCategoryFilter(e.target.value as EquipmentCategory | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Toutes catégories</option>
                <option value="kite">Kites</option>
                <option value="board">Planches</option>
                <option value="surfboard">Surfboards</option>
                <option value="foilboard">Foilboards</option>
              </select>
              <button
                onClick={addRental}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
              >
                + Ajouter
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">CA Locations</p>
              <p className="text-2xl font-bold text-gray-900">{totalRevenue}€</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Locations Matin</p>
              <p className="text-2xl font-bold text-gray-900">{morningRentals}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Locations Aprem</p>
              <p className="text-2xl font-bold text-gray-900">{afternoonRentals}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Locations Journée</p>
              <p className="text-2xl font-bold text-gray-900">{fullDayRentals}</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Créneau</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Équipement</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Booking</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Prix</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rentalItems.map(rental => (
                  <tr key={rental.id}>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        defaultValue={rental.date}
                        onBlur={e => updateRentalField(rental.id, 'date', e.target.value)}
                        className="w-32 text-sm border border-gray-300 rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        defaultValue={rental.slot}
                        onChange={e => updateRentalField(rental.id, 'slot', e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="morning">Matin</option>
                        <option value="afternoon">Aprem</option>
                        <option value="full_day">Journée</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        defaultValue={rental.equipment_id ?? ''}
                        onChange={e => updateRentalField(rental.id, 'equipment_id', e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        {equipment.filter(e => e.is_active).map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        defaultValue={rental.booking_id || ''}
                        onBlur={e => updateRentalField(rental.id, 'booking_id', e.target.value || null)}
                        className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        defaultValue={rental.price}
                        onBlur={e => updateRentalField(rental.id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        defaultValue={rental.notes || ''}
                        onBlur={e => updateRentalField(rental.id, 'notes', e.target.value || null)}
                        className="w-32 text-sm border border-gray-300 rounded px-2 py-1"
                        placeholder="Notes"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteRental(rental.id)}
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
        </div>
      )}

      {/* ─── EDIT MODAL ───────────────────────────────────────────────────────── */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-gray-800">
                {editModal.equipment ? 'Modifier l\'équipement' : 'Ajouter un équipement'}
              </h3>
              <button
                onClick={() => setEditModal({ open: false, equipment: null, formData: {} })}
                className="text-gray-500 hover:text-gray-800 font-bold"
              >✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                <input
                  type="text"
                  value={editModal.formData.name || ''}
                  onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, name: e.target.value } }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie *</label>
                  <select
                    value={editModal.formData.category || 'kite'}
                    onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, category: e.target.value as EquipmentCategory } }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  >
                    <option value="kite">Kite</option>
                    <option value="board">Planche</option>
                    <option value="surfboard">Surfboard</option>
                    <option value="foilboard">Foilboard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">État *</label>
                  <select
                    value={editModal.formData.condition || 'new'}
                    onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, condition: e.target.value as EquipmentCondition } }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  >
                    <option value="new">Neuf</option>
                    <option value="good">Bon</option>
                    <option value="fair">Correct</option>
                    <option value="damaged">Endommagé</option>
                    <option value="retired">Retiré</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Marque</label>
                  <input
                    type="text"
                    value={editModal.formData.brand || ''}
                    onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, brand: e.target.value || null } }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Taille</label>
                  <input
                    type="text"
                    value={editModal.formData.size || ''}
                    onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, size: e.target.value || null } }))}
                    className="w-full text-sm border rounded px-2 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Année</label>
                <input
                  type="number"
                  value={editModal.formData.year || ''}
                  onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, year: e.target.value ? parseInt(e.target.value) : null } }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={editModal.formData.notes || ''}
                  onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, notes: e.target.value || null } }))}
                  className="w-full text-sm border rounded px-2 py-1.5"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editModal.formData.is_active ?? true}
                  onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, is_active: e.target.checked } }))}
                  id="is_active"
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-600">Actif</label>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={() => setEditModal({ open: false, equipment: null, formData: {} })}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={saveEquipment}
                  disabled={saving}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm disabled:opacity-60"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
