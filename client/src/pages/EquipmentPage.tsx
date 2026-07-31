import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEquipment, useEquipmentRentals } from '../hooks/useEquipment'
import { useLessons } from '../hooks/useLessons'
import type { Equipment, EquipmentRental, EquipmentCategory, EquipmentCondition, Lesson, RentalSlot } from '../types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// No duration is recorded on a rental (just a slot) — hours are an estimate.
const RENTAL_SLOT_HOURS: Record<RentalSlot, number> = { morning: 3, afternoon: 3, full_day: 6 }

function lessonsFor(eq: Equipment, lessons: Lesson[]): Lesson[] {
  const field = eq.category === 'kite' ? 'kite_id' : 'board_id'
  return lessons.filter(l => l[field] === eq.id)
}

function getUseCount(eq: Equipment, rentals: EquipmentRental[], lessons: Lesson[]): number {
  return rentals.filter(r => r.equipment_id === eq.id).length + lessonsFor(eq, lessons).length
}

function getUseHours(eq: Equipment, rentals: EquipmentRental[], lessons: Lesson[]): number {
  const rentalHours = rentals.filter(r => r.equipment_id === eq.id).reduce((sum, r) => sum + RENTAL_SLOT_HOURS[r.slot], 0)
  const lessonHours = lessonsFor(eq, lessons).reduce((sum, l) => sum + l.duration_hours, 0)
  return rentalHours + lessonHours
}

function getRecentUsage(eq: Equipment, rentals: EquipmentRental[], lessons: Lesson[]): Array<{ date: string; type: 'rental' | 'lesson'; hours: number }> {
  const rentalEvents = rentals
    .filter(r => r.equipment_id === eq.id)
    .map(r => ({ date: r.date, type: 'rental' as const, hours: RENTAL_SLOT_HOURS[r.slot] }))
  const lessonEvents = lessonsFor(eq, lessons)
    .map(l => ({ date: l.date, type: 'lesson' as const, hours: l.duration_hours }))
  return [...rentalEvents, ...lessonEvents]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getConditionColor(condition: EquipmentCondition): string {
  switch (condition) {
    case 'new':     return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
    case 'good':    return 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    case 'fair':    return 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    case 'damaged': return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    case 'retired': return 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
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
  const { data: lessons } = useLessons()

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">🎿 Matériel</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          📦 Inventaire
        </button>
        <button
          onClick={() => setActiveTab('rentals')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'rentals'
              ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
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
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
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

            <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Nom</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Catégorie</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Taille</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">État</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Sorties</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">≈ Heures</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actif</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {inventoryItems.map(eq => (
                    <tr
                      key={eq.id}
                      onClick={() => setSelectedEquipment(eq)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{eq.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{getCategoryLabel(eq.category)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{eq.size || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getConditionColor(eq.condition)}`}>
                          {getConditionLabel(eq.condition)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{getUseCount(eq, rentals, lessons)}</td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{getUseHours(eq, rentals, lessons)}h</td>
                      <td className="px-4 py-3 text-center">
                        {eq.is_active ? <span className="text-green-600 dark:text-green-400 font-semibold">✓</span> : <span className="text-gray-400 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); openEditModal(eq) }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-xs mr-2"
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
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white px-4 py-4">
                  <h3 className="font-bold text-lg">{selectedEquipment.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-blue-100">{getCategoryLabel(selectedEquipment.category)}</span>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getConditionColor(selectedEquipment.condition)}`}>
                      {getConditionLabel(selectedEquipment.condition)}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{getUseCount(selectedEquipment, rentals, lessons)}</p>
                      <p className="text-xs text-blue-700 dark:text-blue-400">Sorties</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">≈{getUseHours(selectedEquipment, rentals, lessons)}h</p>
                      <p className="text-xs text-blue-700 dark:text-blue-400">Heures d'utilisation</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {selectedEquipment.brand && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-500">Marque</p>
                        <p className="text-gray-900 dark:text-gray-100">{selectedEquipment.brand}</p>
                      </div>
                    )}
                    {selectedEquipment.size && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-500">Taille</p>
                        <p className="text-gray-900 dark:text-gray-100">{selectedEquipment.size}</p>
                      </div>
                    )}
                    {selectedEquipment.year && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-500">Année</p>
                        <p className="text-gray-900 dark:text-gray-100">{selectedEquipment.year}</p>
                      </div>
                    )}
                    {selectedEquipment.notes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-500">Notes</p>
                        <p className="text-gray-900 dark:text-gray-100">{selectedEquipment.notes}</p>
                      </div>
                    )}
                  </div>

                  {getRecentUsage(selectedEquipment, rentals, lessons).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-2">5 dernières sorties</p>
                      <div className="space-y-1.5">
                        {getRecentUsage(selectedEquipment, rentals, lessons).map((usage, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5 rounded">
                            <span className="text-gray-600 dark:text-gray-400">
                              {usage.type === 'rental' ? '📦' : '🏄'} {formatDate(usage.date)}
                            </span>
                            <span className="text-gray-500 dark:text-gray-500">{usage.type === 'rental' ? 'Location' : 'Cours'} · ≈{usage.hours}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t dark:border-gray-800">
                    <button
                      onClick={() => openEditModal(selectedEquipment)}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => archiveEquipment(selectedEquipment)}
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium text-sm"
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
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
              >←</button>
              <span className="font-semibold text-gray-800 dark:text-gray-200 min-w-40">
                {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
              >→</button>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={rentalCategoryFilter}
                onChange={e => setRentalCategoryFilter(e.target.value as EquipmentCategory | 'all')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
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
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">CA Locations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalRevenue}€</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Locations Matin</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{morningRentals}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Locations Aprem</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{afternoonRentals}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Locations Journée</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fullDayRentals}</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Créneau</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Équipement</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Booking</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Prix</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Notes</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {rentalItems.map(rental => (
                  <tr key={rental.id}>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        defaultValue={rental.date}
                        onBlur={e => updateRentalField(rental.id, 'date', e.target.value)}
                        className="w-32 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        defaultValue={rental.slot}
                        onChange={e => updateRentalField(rental.id, 'slot', e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
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
                        className="text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
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
                        className="w-20 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        defaultValue={rental.price}
                        onBlur={e => updateRentalField(rental.id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-16 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-center"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        defaultValue={rental.notes || ''}
                        onBlur={e => updateRentalField(rental.id, 'notes', e.target.value || null)}
                        className="w-32 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
                        placeholder="Notes"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteRental(rental.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
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
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">
                {editModal.equipment ? 'Modifier l\'équipement' : 'Ajouter un équipement'}
              </h3>
              <button
                onClick={() => setEditModal({ open: false, equipment: null, formData: {} })}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 font-bold"
              >✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nom *</label>
                <input
                  type="text"
                  value={editModal.formData.name || ''}
                  onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, name: e.target.value } }))}
                  className="w-full text-sm border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catégorie *</label>
                  <select
                    value={editModal.formData.category || 'kite'}
                    onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, category: e.target.value as EquipmentCategory } }))}
                    className="w-full text-sm border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5"
                  >
                    <option value="kite">Kite</option>
                    <option value="board">Planche</option>
                    <option value="surfboard">Surfboard</option>
                    <option value="foilboard">Foilboard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">État *</label>
                  <select
                    value={editModal.formData.condition || 'new'}
                    onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, condition: e.target.value as EquipmentCondition } }))}
                    className="w-full text-sm border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5"
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
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Marque</label>
                  <input
                    type="text"
                    value={editModal.formData.brand || ''}
                    onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, brand: e.target.value || null } }))}
                    className="w-full text-sm border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Taille</label>
                  <input
                    type="text"
                    value={editModal.formData.size || ''}
                    onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, size: e.target.value || null } }))}
                    className="w-full text-sm border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Année</label>
                <input
                  type="number"
                  value={editModal.formData.year || ''}
                  onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, year: e.target.value ? parseInt(e.target.value) : null } }))}
                  className="w-full text-sm border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={editModal.formData.notes || ''}
                  onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, notes: e.target.value || null } }))}
                  className="w-full text-sm border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editModal.formData.is_active ?? true}
                  onChange={e => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, is_active: e.target.checked } }))}
                  id="is_active"
                  className="rounded dark:bg-gray-800 dark:border-gray-600"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-600 dark:text-gray-400">Actif</label>
              </div>
              <div className="flex gap-2 pt-2 border-t dark:border-gray-800">
                <button
                  onClick={() => setEditModal({ open: false, equipment: null, formData: {} })}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium text-sm"
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
