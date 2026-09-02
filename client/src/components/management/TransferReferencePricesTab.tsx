import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../hooks/useSupabase'
import type { TransferReferencePrice } from '../../types/database'

/** Purely informational reference prices (transfers, taxis, boat/air connections...),
 *  for answering client questions. Nothing here feeds any billing calculation.
 *
 *  Every cell autosaves on blur — no separate edit mode. While a row is being typed
 *  into, incoming realtime refetches skip that row (see the `editingRowId` guard
 *  below), matching the fix in 729b992 for the same class of bug on the taxi
 *  pricing form: a background refetch handing down a fresh object for the row
 *  being edited would otherwise silently wipe the keystrokes. */

const CURRENCIES = ['MZN', 'EUR', 'USD'] as const

type Section = { name: string; order: number; collapsible: boolean; rows: TransferReferencePrice[] }

function sortRows(rows: TransferReferencePrice[]) {
  return [...rows].sort((a, b) => a.section_order - b.section_order || a.row_order - b.row_order)
}

const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200'

export default function TransferReferencePricesTab() {
  const { data: rowsData, refresh } = useTable<TransferReferencePrice>('transfer_reference_prices')
  const [rows, setRows] = useState<TransferReferencePrice[]>([])
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [newSectionName, setNewSectionName] = useState('')

  useEffect(() => {
    setRows(prev => {
      if (!editingRowId) return sortRows(rowsData)
      const keepLocal = prev.find(r => r.id === editingRowId)
      return sortRows(rowsData.map(r => (r.id === editingRowId && keepLocal) ? keepLocal : r))
    })
  }, [rowsData]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateLocal(id: string, patch: Partial<TransferReferencePrice>) {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function saveField(row: TransferReferencePrice, patch: Partial<TransferReferencePrice>) {
    const { error } = await supabase.from('transfer_reference_prices')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', row.id)
    setEditingRowId(null)
    if (error) alert(`Not saved.\n\n${error.message}`)
  }

  async function deleteRow(row: TransferReferencePrice) {
    if (!confirm('Delete this row?')) return
    const { error } = await supabase.from('transfer_reference_prices').delete().eq('id', row.id)
    if (error) { alert(`Could not delete the row.\n\n${error.message}`); return }
    refresh()
  }

  async function addRow(section: Section) {
    const maxRowOrder = Math.max(-1, ...section.rows.map(r => r.row_order))
    const { error } = await supabase.from('transfer_reference_prices').insert([{
      section: section.name, section_order: section.order, collapsible: section.collapsible,
      row_order: maxRowOrder + 1,
      from_label: '', to_label: '', price: null, currency: null, detail: '', notes: '',
    }])
    if (error) { alert(`Could not add the row.\n\n${error.message}`); return }
    refresh()
  }

  async function renameSection(oldName: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    const { error } = await supabase.from('transfer_reference_prices')
      .update({ section: trimmed }).eq('section', oldName)
    if (error) { alert(`Could not rename the section.\n\n${error.message}`); return }
    refresh()
  }

  async function deleteSection(name: string) {
    if (!confirm(`Delete the whole "${name}" section and all its rows?`)) return
    const { error } = await supabase.from('transfer_reference_prices').delete().eq('section', name)
    if (error) { alert(`Could not delete the section.\n\n${error.message}`); return }
    refresh()
  }

  async function addSection() {
    const name = newSectionName.trim()
    if (!name) return
    const maxSectionOrder = Math.max(-1, ...rows.map(r => r.section_order))
    const { error } = await supabase.from('transfer_reference_prices').insert([{
      section: name, section_order: maxSectionOrder + 1, collapsible: true, row_order: 0,
      from_label: '', to_label: '', price: null, currency: null, detail: '', notes: '',
    }])
    if (error) { alert(`Could not add the section.\n\n${error.message}`); return }
    setNewSectionName('')
    refresh()
  }

  const sections: Section[] = []
  for (const r of rows) {
    let s = sections.find(x => x.name === r.section)
    if (!s) { s = { name: r.section, order: r.section_order, collapsible: r.collapsible, rows: [] }; sections.push(s) }
    s.rows.push(r)
  }
  sections.sort((a, b) => a.order - b.order)
  const primary = sections.find(s => !s.collapsible)
  const rest = sections.filter(s => s.collapsible)

  function SectionEditableTitle({ s }: { s: Section }) {
    const [value, setValue] = useState(s.name)
    useEffect(() => setValue(s.name), [s.name])
    return (
      <div className="flex items-center gap-3 mb-2">
        <input value={value} onChange={e => setValue(e.target.value)}
          onBlur={() => renameSection(s.name, value)}
          className="text-sm font-semibold text-gray-700 dark:text-gray-300 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-700 focus:border-blue-500 outline-none px-0.5" />
        {s.collapsible && (
          <button onClick={() => deleteSection(s.name)}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-400">
            Delete section
          </button>
        )}
      </div>
    )
  }

  function RowFields({ row }: { row: TransferReferencePrice }) {
    return (
      <tr className="border-b border-gray-100 dark:border-gray-800">
        <td className="px-2 py-1.5">
          <input className={inputCls} value={row.from_label ?? ''} placeholder="From"
            onFocus={() => setEditingRowId(row.id)}
            onChange={e => updateLocal(row.id, { from_label: e.target.value })}
            onBlur={e => saveField(row, { from_label: e.target.value.trim() || null })} />
        </td>
        <td className="px-2 py-1.5">
          <input className={inputCls} value={row.to_label ?? ''} placeholder="To"
            onFocus={() => setEditingRowId(row.id)}
            onChange={e => updateLocal(row.id, { to_label: e.target.value })}
            onBlur={e => saveField(row, { to_label: e.target.value.trim() || null })} />
        </td>
        <td className="px-2 py-1.5">
          <div className="flex gap-1">
            <input type="number" step="any" className={`${inputCls} w-24`} value={row.price ?? ''} placeholder="Price"
              onFocus={() => setEditingRowId(row.id)}
              onChange={e => updateLocal(row.id, { price: e.target.value === '' ? null : parseFloat(e.target.value) })}
              onBlur={e => saveField(row, { price: e.target.value === '' ? null : parseFloat(e.target.value) })} />
            <select className={`${inputCls} w-20`} value={row.currency ?? ''}
              onFocus={() => setEditingRowId(row.id)}
              onChange={e => {
                const v = (e.target.value || null) as TransferReferencePrice['currency']
                updateLocal(row.id, { currency: v })
                saveField(row, { currency: v })
              }}>
              <option value="">—</option>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </td>
        <td className="px-2 py-1.5">
          <input className={inputCls} value={row.detail ?? ''} placeholder="Distance / duration"
            onFocus={() => setEditingRowId(row.id)}
            onChange={e => updateLocal(row.id, { detail: e.target.value })}
            onBlur={e => saveField(row, { detail: e.target.value.trim() || null })} />
        </td>
        <td className="px-2 py-1.5">
          <input className={inputCls} value={row.notes ?? ''} placeholder="Notes"
            onFocus={() => setEditingRowId(row.id)}
            onChange={e => updateLocal(row.id, { notes: e.target.value })}
            onBlur={e => saveField(row, { notes: e.target.value.trim() || null })} />
        </td>
        <td className="px-2 py-1.5 text-right">
          <button onClick={() => deleteRow(row)} title="Delete row"
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-400">🗑️</button>
        </td>
      </tr>
    )
  }

  function SectionTable({ s }: { s: Section }) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">From</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">To</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Price</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Distance / duration</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map(row => <RowFields key={row.id} row={row} />)}
          </tbody>
        </table>
        <div className="p-2 border-t border-gray-200 dark:border-gray-800">
          <button onClick={() => addRow(s)}
            className="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
            + Add row
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">📋 Reference prices</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
          Informational only — for answering client questions about transfer and taxi prices.
          Not used by any pricing calculation elsewhere in the app. Every field here is editable.
        </p>
      </div>

      {primary && (
        <div>
          <SectionEditableTitle s={primary} />
          <SectionTable s={primary} />
        </div>
      )}

      {rest.map(s => (
        <details key={s.name} className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 select-none">
            {s.name}
          </summary>
          <div className="mt-3">
            <SectionEditableTitle s={s} />
            <SectionTable s={s} />
          </div>
        </details>
      ))}

      <div className="flex items-end gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">New section</label>
          <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
            placeholder="e.g. Ferry transfers"
            className="w-56 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </div>
        <button onClick={addSection}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
          + Add section
        </button>
      </div>
    </div>
  )
}
