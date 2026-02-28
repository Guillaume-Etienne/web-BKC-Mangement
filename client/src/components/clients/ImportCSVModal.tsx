import { useState, useRef } from 'react'
import type { Client, Booking } from '../../types/database'
import {
  parseGoogleFormsCSV,
  buildImportIdSet,
  type ImportRow,
  type ParseResult,
} from '../../utils/parseGoogleFormsCSV'

interface Props {
  existingClients: Client[]
  existingBookings: Booking[]
  nextBookingNumber: number
  onImport: (newClients: Client[], newBookings: Booking[]) => void
  onClose: () => void
}

type Step = 'pick' | 'review' | 'conflicts' | 'confirm'

const FIELD_LABELS: Partial<Record<keyof Client, string>> = {
  first_name: 'First name',
  last_name: 'Last name',
  passport_number: 'Passport number',
}

export default function ImportCSVModal({ existingClients, existingBookings, nextBookingNumber, onImport, onClose }: Props) {
  const [step, setStep] = useState<Step>('pick')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [showSkipped, setShowSkipped] = useState(false)
  const [conflictIndex, setConflictIndex] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Step 1 : file pick ────────────────────────────────────────────────────

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const importIds = buildImportIdSet(existingClients, existingBookings)
      const result = parseGoogleFormsCSV(text, existingClients, importIds)
      setParseResult(result)
      setRows(result.rows)
      setStep('review')
    }
    reader.readAsText(file, 'UTF-8')
  }

  // ── Step 2 → 3 navigation ────────────────────────────────────────────────

  const conflictRows = rows.filter(r => r.status === 'conflict')
  const newRows      = rows.filter(r => r.status === 'new')
  const skipRows     = rows.filter(r => r.status === 'skip')

  const proceedFromReview = () => {
    if (conflictRows.length > 0) {
      setConflictIndex(0)
      setStep('conflicts')
    } else {
      setStep('confirm')
    }
  }

  // ── Step 3 : resolve conflict ─────────────────────────────────────────────

  const resolveConflict = (resolution: 'keep' | 'replace') => {
    const conflictRow = conflictRows[conflictIndex]
    setRows(prev => prev.map(r =>
      r.import_id === conflictRow.import_id ? { ...r, resolution, status: 'new' } : r
    ))
    if (conflictIndex + 1 < conflictRows.length) {
      setConflictIndex(i => i + 1)
    } else {
      setStep('confirm')
    }
  }

  // ── Step 4 : confirm import ───────────────────────────────────────────────

  const handleImport = () => {
    const newClients: Client[] = []
    const newBookings: Booking[] = []
    let bookingNum = nextBookingNumber

    const resolvedRows = rows.filter(r => r.status === 'new')

    for (const row of resolvedRows) {
      // Clients
      for (const { client, isReferent } of row.clients) {
        // Check if existing client (conflict resolved to 'keep') — skip creating
        if (row.existingClientId && isReferent && row.resolution === 'keep') continue

        const finalClient: Client = {
          ...client,
          id: row.existingClientId && isReferent ? row.existingClientId : `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        }
        newClients.push(finalClient)
      }

      // Booking
      const referentId = row.existingClientId && row.resolution === 'keep'
        ? row.existingClientId
        : newClients.find(c => c.import_id === row.import_id && row.clients[0]?.client.first_name === c.first_name)?.id
          ?? `c_${row.import_id}`

      const b = row.booking.booking
      const booking: Booking = {
        ...b,
        id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        booking_number: bookingNum++,
        client_id: referentId,
        participants: row.clients.map((ic, i) => ({
          id: `p_${row.import_id}_${i}`,
          first_name: ic.client.first_name,
          last_name: ic.client.last_name,
          passport_number: ic.client.passport_number ?? '',
        })),
      }
      newBookings.push(booking)
    }

    onImport(newClients, newBookings)
    onClose()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const resolvedConflictRows = rows.filter(r => r.status === 'new' && r.existingClientId)
  const finalNewRows = rows.filter(r => r.status === 'new')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Import Google Forms CSV</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === 'pick'      && 'Select a CSV file exported from Google Sheets'}
              {step === 'review'    && `${parseResult?.totalDataRows} rows found — review before importing`}
              {step === 'conflicts' && `Conflict ${conflictIndex + 1} of ${conflictRows.length} — choose which data to keep`}
              {step === 'confirm'   && 'Ready to import'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Step 1 : Pick file ── */}
          {step === 'pick' && (
            <div className="flex flex-col items-center justify-center gap-6 py-10">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-3xl">📂</div>
              <div className="text-center">
                <p className="font-medium text-gray-700 mb-1">Supported formats</p>
                <p className="text-sm text-gray-500">French form · English form <span className="text-gray-400">(ES coming soon)</span></p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Choose CSV file
              </button>
            </div>
          )}

          {/* ── Step 2 : Review ── */}
          {step === 'review' && parseResult && (
            <div className="space-y-4">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold">
                  ✅ {newRows.length} new
                </span>
                {conflictRows.length > 0 && (
                  <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                    ⚠️ {conflictRows.length} conflict{conflictRows.length > 1 ? 's' : ''}
                  </span>
                )}
                {skipRows.length > 0 && (
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
                    ⏭ {skipRows.length} already imported
                  </span>
                )}
                <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                  🌐 {parseResult.formLanguage === 'fr' ? 'French form' : parseResult.formLanguage === 'en' ? 'English form' : 'Unknown form'}
                </span>
              </div>

              {/* Conflicts preview */}
              {conflictRows.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-800 mb-2">⚠️ Conflicts to resolve</p>
                  <ul className="space-y-1">
                    {conflictRows.map(r => (
                      <li key={r.import_id} className="text-sm text-amber-700">
                        {r.clients[0]?.client.first_name} {r.clients[0]?.client.last_name}
                        {' '}— {r.conflicts.map(c => FIELD_LABELS[c.field] ?? c.field).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* New rows table */}
              {newRows.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">New entries</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Group</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Travelers</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Arrival</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-600">Nights</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newRows.map(r => {
                          const ref = r.clients[0]?.client
                          const b = r.booking.booking
                          const nights = b.check_in && b.check_out
                            ? Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000)
                            : '?'
                          return (
                            <tr key={r.import_id} className="border-t">
                              <td className="px-3 py-2 font-medium text-gray-800">
                                {ref?.first_name} {ref?.last_name}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{r.clients.length} person{r.clients.length > 1 ? 's' : ''}</td>
                              <td className="px-3 py-2 text-gray-600">{b.check_in || '–'}</td>
                              <td className="px-3 py-2 text-center text-gray-600">{nights}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Skipped (collapsible) */}
              {skipRows.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowSkipped(s => !s)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    {showSkipped ? '▼' : '▶'} {skipRows.length} already imported row{skipRows.length > 1 ? 's' : ''} (skipped)
                  </button>
                  {showSkipped && (
                    <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {skipRows.map(r => (
                            <tr key={r.import_id} className="border-t first:border-t-0 bg-gray-50">
                              <td className="px-3 py-2 text-gray-400">{r.import_id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {newRows.length === 0 && conflictRows.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-2xl mb-2">✓</p>
                  <p>All rows already imported — nothing to do.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3 : Resolve conflicts ── */}
          {step === 'conflicts' && (() => {
            const conflictsToResolve = rows.filter(r => r.conflicts.length > 0)
            const row = conflictsToResolve[conflictIndex]
            if (!row) return null
            const existing = existingClients.find(c => c.id === row.existingClientId)
            const incoming = row.clients[0]?.client
            return (
              <div className="space-y-5">
                <p className="text-sm text-gray-500">
                  Conflict {conflictIndex + 1}/{conflictsToResolve.length} · The passport <strong>{incoming?.passport_number}</strong> already exists in the app with different data.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {/* Existing */}
                  <div className="rounded-lg border-2 border-gray-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Existing in app</p>
                    {row.conflicts.map(c => (
                      <div key={String(c.field)} className="mb-3">
                        <p className="text-xs text-gray-500">{FIELD_LABELS[c.field] ?? String(c.field)}</p>
                        <p className="font-medium text-gray-800">{c.existing ?? '–'}</p>
                      </div>
                    ))}
                    {existing && (
                      <div className="text-xs text-gray-400 mt-2 space-y-0.5">
                        {existing.email && <p>📧 {existing.email}</p>}
                        {existing.phone && <p>📞 {existing.phone}</p>}
                        {existing.nationality && <p>🌍 {existing.nationality}</p>}
                      </div>
                    )}
                  </div>
                  {/* Incoming */}
                  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-500 mb-3">Incoming from CSV</p>
                    {row.conflicts.map(c => (
                      <div key={String(c.field)} className="mb-3">
                        <p className="text-xs text-blue-500">{FIELD_LABELS[c.field] ?? String(c.field)}</p>
                        <p className="font-medium text-blue-900">{c.incoming ?? '–'}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => resolveConflict('keep')}
                    className="px-4 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:border-gray-400 hover:bg-gray-50"
                  >
                    Keep existing
                  </button>
                  <button
                    onClick={() => resolveConflict('replace')}
                    className="px-4 py-3 rounded-lg border-2 border-blue-300 text-blue-700 font-semibold hover:border-blue-400 hover:bg-blue-50"
                  >
                    Use CSV data
                  </button>
                </div>
              </div>
            )
          })()}

          {/* ── Step 4 : Confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-5">
                <p className="font-bold text-emerald-800 text-lg mb-3">Ready to import</p>
                <ul className="space-y-2 text-sm text-emerald-700">
                  <li>👤 <strong>{finalNewRows.reduce((s, r) => s + r.clients.length, 0)}</strong> client{finalNewRows.reduce((s, r) => s + r.clients.length, 0) > 1 ? 's' : ''} will be created</li>
                  <li>📋 <strong>{finalNewRows.length}</strong> booking{finalNewRows.length > 1 ? 's' : ''} will be created (status: Confirmed)</li>
                  {resolvedConflictRows.length > 0 && (
                    <li>🔀 <strong>{resolvedConflictRows.length}</strong> conflict{resolvedConflictRows.length > 1 ? 's' : ''} resolved</li>
                  )}
                  {skipRows.length > 0 && (
                    <li className="text-emerald-500">⏭ {skipRows.length} row{skipRows.length > 1 ? 's' : ''} skipped (already imported)</li>
                  )}
                </ul>
              </div>
              {finalNewRows.length === 0 && (
                <p className="text-center text-gray-400 py-4">Nothing to import.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">
            Cancel
          </button>
          <div className="flex gap-3">
            {step === 'review' && (newRows.length > 0 || conflictRows.length > 0) && (
              <button
                onClick={proceedFromReview}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                {conflictRows.length > 0 ? `Resolve ${conflictRows.length} conflict${conflictRows.length > 1 ? 's' : ''} →` : 'Continue →'}
              </button>
            )}
            {step === 'confirm' && finalNewRows.length > 0 && (
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
              >
                Import
              </button>
            )}
            {step === 'confirm' && finalNewRows.length === 0 && (
              <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300">
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
