import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAgencies, useAgencyRateItems } from '../../hooks/useAgencies'
import type { Agency, AgencyRateItem, AgencyRateCategory } from '../../types/database'

const CATEGORY_META: Record<AgencyRateCategory, { icon: string; label: string }> = {
  lesson:        { icon: '🪁', label: 'Lesson' },
  rental:        { icon: '🎿', label: 'Rental' },
  transfer:      { icon: '🚕', label: 'Transfer' },
  accommodation: { icon: '🏠', label: 'Accommodation' },
}

// ── Agency form (module scope) ────────────────────────────────────────────────
interface AgencyFormData {
  name: string
  commission_percent: number
  notes: string | null
  is_active: boolean
}
interface AgencyFormProps {
  initial: { name: string; commission_percent: string; notes: string; is_active: boolean }
  title: string
  onSave: (data: AgencyFormData) => Promise<void>
  onClose: () => void
}
function AgencyForm({ initial, title, onSave, onClose }: AgencyFormProps) {
  const [name,       setName]       = useState(initial.name)
  const [commission, setCommission] = useState(initial.commission_percent)
  const [notes,      setNotes]      = useState(initial.notes)
  const [active,     setActive]     = useState(initial.is_active)
  const [saving,     setSaving]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      name: name.trim(),
      commission_percent: parseFloat(commission) || 0,
      notes: notes.trim() || null,
      is_active: active,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{title}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xl font-bold">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={name} required
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Fun & Fly"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Commission (%) — retained by the agency</label>
            <input type="number" min="0" max="100" step="0.5" value={commission}
              onChange={e => setCommission(e.target.value)}
              placeholder="e.g. 20"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Billing details, contact, whatever's useful to remember"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
            Active
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Rate item add form (module scope) ─────────────────────────────────────────
interface RateItemAddFormProps {
  agencyId: string
  onAdd: (item: Omit<AgencyRateItem, 'id'>) => Promise<void>
}
function RateItemAddForm({ agencyId, onAdd }: RateItemAddFormProps) {
  const [category, setCategory] = useState<AgencyRateCategory>('lesson')
  const [label,     setLabel]   = useState('')
  const [hours,     setHours]   = useState('')
  const [price,     setPrice]   = useState('')
  const [saving,    setSaving]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onAdd({
      agency_id: agencyId,
      category,
      label: label.trim(),
      unit_hours: category === 'lesson' && hours !== '' ? parseFloat(hours) : null,
      price: parseFloat(price) || 0,
      is_active: true,
    })
    setSaving(false)
    setLabel('')
    setHours('')
    setPrice('')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-3">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Add rate item</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as AgencyRateCategory)}
            className="w-full text-sm border rounded px-2 py-1.5">
            {(Object.keys(CATEGORY_META) as AgencyRateCategory[]).map(c => (
              <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label</label>
          <input type="text" value={label} required placeholder="e.g. Pack cours Privé 10x 2h"
            onChange={e => setLabel(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {category === 'lesson' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Package hours</label>
            <input type="number" min="0" step="0.5" value={hours} placeholder="e.g. 20"
              onChange={e => setHours(e.target.value)}
              className="w-full text-sm border rounded px-2 py-1.5" />
          </div>
        )}
        <div className={category === 'lesson' ? '' : 'col-span-2'}>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Price (€)</label>
          <input type="number" min="0" step="1" value={price} required placeholder="e.g. 450"
            onChange={e => setPrice(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1.5" />
        </div>
      </div>
      <button type="submit" disabled={saving || label.trim() === ''}
        className="w-full px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm disabled:opacity-60">
        {saving ? 'Saving…' : '+ Add rate item'}
      </button>
    </form>
  )
}

// ── Rate items list (module scope) — deactivate, never delete: a rate already
// billed on an agency_billing_lines row must stay readable, same rule as the
// locked price_items rows in Options → Pricing. ─────────────────────────────
interface RateItemsListProps {
  items: AgencyRateItem[]
  onToggleActive: (item: AgencyRateItem) => void
}
function RateItemsList({ items, onToggleActive }: RateItemsListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-400 italic">No rate items yet.</p>
  }
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
            item.is_active
              ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-800 opacity-60'
          }`}>
          <div>
            <span className="mr-1.5">{CATEGORY_META[item.category].icon}</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{item.label}</span>
            {item.unit_hours != null && (
              <span className="ml-2 text-gray-500 dark:text-gray-400">({item.unit_hours}h)</span>
            )}
            <span className="ml-3 font-bold text-gray-800 dark:text-gray-200">{item.price}€</span>
          </div>
          <button onClick={() => onToggleActive(item)}
            className="text-xs px-2 py-1 rounded font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            {item.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AgenciesTab() {
  const { data: agenciesData,   refresh: refreshAgencies }   = useAgencies()
  const { data: rateItemsData,  refresh: refreshRateItems }  = useAgencyRateItems()

  const [agencies,  setAgencies]  = useState<Agency[]>([])
  const [rateItems, setRateItems] = useState<AgencyRateItem[]>([])

  useEffect(() => { setAgencies(agenciesData) },   [agenciesData])
  useEffect(() => { setRateItems(rateItemsData) }, [rateItemsData])

  const [selected, setSelected] = useState<Agency | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<Agency | null>(null)

  useEffect(() => {
    if (selected) {
      const updated = agencies.find(a => a.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [agencies]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleCreate(data: AgencyFormData) {
    const { error } = await supabase.from('agencies').insert([data])
    if (error) { alert('Error: ' + error.message); return }
    refreshAgencies()
    setShowForm(false)
  }

  async function handleEdit(data: AgencyFormData) {
    if (!editing) return
    const { error } = await supabase.from('agencies').update(data).eq('id', editing.id)
    if (error) { alert('Error: ' + error.message); return }
    refreshAgencies()
    setEditing(null)
  }

  async function handleDelete(agency: Agency) {
    if (!confirm(`Delete ${agency.name} and its rate card?`)) return
    const { error } = await supabase.from('agencies').delete().eq('id', agency.id)
    if (error) { alert('Error: ' + error.message); return }
    if (selected?.id === agency.id) setSelected(null)
    refreshAgencies()
    refreshRateItems()
  }

  async function handleAddRateItem(item: Omit<AgencyRateItem, 'id'>) {
    const { error } = await supabase.from('agency_rate_items').insert([item])
    if (error) { alert('Error: ' + error.message); return }
    refreshRateItems()
  }

  async function handleToggleActive(item: AgencyRateItem) {
    const { error } = await supabase.from('agency_rate_items')
      .update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) { alert('Error: ' + error.message); return }
    refreshRateItems()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function agencyRateItems(agencyId: string) {
    return rateItems.filter(r => r.agency_id === agencyId)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* ── Left: agency list ────────────────────────────────────────────── */}
      <div className="xl:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Agencies</h2>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
            + New
          </button>
        </div>

        {agencies.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-4xl mb-2">🤝</p>
            <p className="text-sm">No agencies yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agencies.map(agency => {
              const items = agencyRateItems(agency.id)
              const isSelected = selected?.id === agency.id
              return (
                <div key={agency.id}
                  onClick={() => setSelected(isSelected ? null : agency)}
                  className={`bg-white dark:bg-gray-900 rounded-lg border-2 p-3 cursor-pointer transition-all ${isSelected ? 'border-blue-500 dark:border-blue-600 shadow-md' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">🤝 {agency.name}</p>
                      <div className="mt-1 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{agency.commission_percent}% commission</span>
                        <span>{items.length} rate item{items.length === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agency.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        {agency.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditing(agency)}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded text-sm">✏️</button>
                        <button onClick={() => handleDelete(agency)}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded text-sm">🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Right: detail panel ──────────────────────────────────────────── */}
      <div className="xl:col-span-2">
        {!selected ? (
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-sm">Select an agency to view its rate card</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">🤝 {selected.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {selected.commission_percent}% commission retained on the total billed
                </p>
                {selected.notes && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">{selected.notes}</p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xl">✕</button>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">Rate card</h4>
              <RateItemsList items={agencyRateItems(selected.id)} onToggleActive={handleToggleActive} />
              <RateItemAddForm agencyId={selected.id} onAdd={handleAddRateItem} />
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showForm && (
        <AgencyForm
          initial={{ name: '', commission_percent: '', notes: '', is_active: true }}
          title="New agency"
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
      {editing && (
        <AgencyForm
          initial={{
            name: editing.name,
            commission_percent: String(editing.commission_percent),
            notes: editing.notes ?? '',
            is_active: editing.is_active,
          }}
          title={`Edit ${editing.name}`}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
