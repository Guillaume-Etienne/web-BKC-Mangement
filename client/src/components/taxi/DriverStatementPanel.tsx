import { useState } from 'react'
import type { TaxiDriver, TaxiTrip, SharedLink } from '../../types/database'

const TRIP_TYPE_LABELS: Record<string, string> = {
  'aero-to-center':  'Airport → Center',
  'center-to-aero':  'Center → Airport',
  'aero-to-spot':    'Airport → Spot',
  'spot-to-aero':    'Spot → Airport',
  'center-to-town':  'Center → Town',
  'town-to-center':  'Town → Center',
  'other':           'Other',
}

const STATUS_LABELS: Record<string, string> = {
  confirmed:     'Confirmed',
  needs_details: 'Details needed',
  done:          'Done',
}

interface Props {
  driver:         TaxiDriver
  trips:          TaxiTrip[]
  driverLink:     SharedLink | null
  onGenerateLink: () => Promise<void>
  onEdit:         () => void
  onDelete:       () => void
}

// ── Trip table ────────────────────────────────────────────────────────────────

function TripTable({ trips, showStatus }: { trips: TaxiTrip[]; showStatus?: boolean }) {
  if (trips.length === 0) {
    return <p className="text-sm text-gray-400 italic py-2">No trips.</p>
  }
  const total = trips.reduce((s, t) => s + t.price_driver_mzn, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b text-gray-500 text-left">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Route</th>
            <th className="px-3 py-2 font-medium text-center">Pax</th>
            <th className="px-3 py-2 font-medium text-center">Bags</th>
            <th className="px-3 py-2 font-medium text-center">Boards</th>
            {showStatus && <th className="px-3 py-2 font-medium">Status</th>}
            <th className="px-3 py-2 font-medium text-right">Driver (MZN)</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{t.date}</td>
              <td className="px-3 py-2 text-gray-500">{t.start_time}</td>
              <td className="px-3 py-2 text-gray-700">{TRIP_TYPE_LABELS[t.type] ?? t.type}</td>
              <td className="px-3 py-2 text-center text-gray-600">{t.nb_persons}</td>
              <td className="px-3 py-2 text-center text-gray-500">{t.nb_luggage}</td>
              <td className="px-3 py-2 text-center text-gray-500">{t.nb_boardbags}</td>
              {showStatus && (
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    t.status === 'done'          ? 'bg-green-100 text-green-700' :
                    t.status === 'needs_details' ? 'bg-red-100 text-red-700' :
                                                   'bg-gray-100 text-gray-600'
                  }`}>{STATUS_LABELS[t.status]}</span>
                </td>
              )}
              <td className="px-3 py-2 text-right font-semibold text-amber-800">
                {t.price_driver_mzn.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-300">
            <td colSpan={showStatus ? 7 : 6} className="px-3 py-2 text-right font-semibold text-gray-700">
              Total
            </td>
            <td className="px-3 py-2 text-right font-bold text-amber-900">
              {total.toLocaleString()} MZN
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Share link section ────────────────────────────────────────────────────────

function ShareLinkSection({ driverLink, onGenerateLink }: {
  driverLink:     SharedLink | null
  onGenerateLink: () => Promise<void>
}) {
  const [generating, setGenerating] = useState(false)
  const [copied,     setCopied]     = useState(false)

  const shareUrl = driverLink
    ? `${window.location.protocol}//${window.location.host}?share=${driverLink.token}`
    : null

  async function handleGenerate() {
    setGenerating(true)
    await onGenerateLink()
    setGenerating(false)
  }

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!shareUrl) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-400 italic flex-1">No shareable link yet</p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {generating ? 'Generating…' : 'Generate link'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={shareUrl}
        className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 font-mono truncate"
        onClick={e => (e.target as HTMLInputElement).select()}
      />
      <button
        onClick={handleCopy}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          copied ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
      >
        Open
      </a>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DriverStatementPanel({ driver, trips, driverLink, onGenerateLink, onEdit, onDelete }: Props) {
  const today    = new Date().toISOString().slice(0, 10)
  const past     = trips.filter(t => t.date <  today).sort((a, b) => b.date.localeCompare(a.date))
  const upcoming = trips.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  const earnedMzn   = past.reduce((s, t) => s + t.price_driver_mzn, 0)
  const upcomingMzn = upcoming.reduce((s, t) => s + t.price_driver_mzn, 0)
  const totalMzn    = earnedMzn + upcomingMzn

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold">{driver.name}</h3>
          <p className="text-blue-200 text-sm mt-0.5">
            {driver.vehicle ?? 'Vehicle not specified'}
            {driver.phone && ` · ${driver.phone}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors">
            ✏️ Edit
          </button>
          <button onClick={onDelete}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors">
            🗑️
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Shareable link */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Driver share link</p>
          <ShareLinkSection driverLink={driverLink} onGenerateLink={onGenerateLink} />
        </div>

        {/* KPI summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Completed</p>
            <p className="text-2xl font-bold text-green-800 mt-1">{earnedMzn.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-0.5">{past.length} trip{past.length !== 1 ? 's' : ''} · MZN</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Upcoming</p>
            <p className="text-2xl font-bold text-blue-800 mt-1">{upcomingMzn.toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-0.5">{upcoming.length} trip{upcoming.length !== 1 ? 's' : ''} · MZN</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{totalMzn.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{trips.length} trip{trips.length !== 1 ? 's' : ''} · MZN</p>
          </div>
        </div>

        {/* Upcoming trips */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Upcoming trips ({upcoming.length})</h4>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <TripTable trips={upcoming} showStatus />
          </div>
        </div>

        {/* Completed trips */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Completed trips ({past.length})</h4>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <TripTable trips={past} />
          </div>
        </div>

      </div>
    </div>
  )
}
