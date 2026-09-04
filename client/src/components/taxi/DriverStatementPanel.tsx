import { useState } from 'react'
import type { TaxiDriver, TaxiTrip, SharedLink } from '../../types/database'
import { todayISO, fmtDate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

const TRIP_TYPE_LABELS: Record<string, string> = {
  'aero-to-center':  'Airport → Center',
  'center-to-aero':  'Center → Airport',
  'aero-to-spot':    'Airport → Spot',
  'spot-to-aero':    'Spot → Airport',
  'center-to-town':  'Center → Town',
  'town-to-center':  'Town → Center',
  'other':           'Other',
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
  const { lang } = useLanguage()
  const STATUS_LABELS: Record<string, string> = {
    confirmed:     i18n.taxis.status_confirmed_trip[lang],
    needs_details: i18n.taxis.status_needs_details[lang],
    done:          i18n.taxis.status_done[lang],
  }
  if (trips.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-400 italic py-2">{i18n.taxis.msg_no_trips[lang]}</p>
  }
  const total = trips.reduce((s, t) => s + t.price_driver_mzn, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b text-gray-500 dark:text-gray-400 text-left">
            <th className="px-3 py-2 font-medium">{i18n.common.label_date[lang]}</th>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Route</th>
            <th className="px-3 py-2 font-medium text-center">Pax</th>
            <th className="px-3 py-2 font-medium text-center">Bags</th>
            <th className="px-3 py-2 font-medium text-center">Boards</th>
            {showStatus && <th className="px-3 py-2 font-medium">{i18n.common.label_status[lang]}</th>}
            <th className="px-3 py-2 font-medium text-right">Driver (MZN)</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(t.date)}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{t.start_time}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{TRIP_TYPE_LABELS[t.type] ?? t.type}</td>
              <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{t.nb_persons}</td>
              <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">{t.nb_luggage}</td>
              <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">{t.nb_boardbags}</td>
              {showStatus && (
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    t.status === 'done'          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    t.status === 'needs_details' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                                   'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>{STATUS_LABELS[t.status]}</span>
                </td>
              )}
              <td className="px-3 py-2 text-right font-semibold text-amber-800 dark:text-amber-400">
                {t.price_driver_mzn.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-700">
            <td colSpan={showStatus ? 7 : 6} className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
              {i18n.common.label_total[lang]}
            </td>
            <td className="px-3 py-2 text-right font-bold text-amber-900 dark:text-amber-400">
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
  const { lang } = useLanguage()
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
        <p className="text-sm text-gray-400 dark:text-gray-400 italic flex-1">{i18n.taxis.msg_no_share_link[lang]}</p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {generating ? i18n.taxis.msg_generating[lang] : i18n.taxis.btn_generate_link[lang]}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={shareUrl}
        className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 font-mono truncate"
        onClick={e => (e.target as HTMLInputElement).select()}
      />
      <button
        onClick={handleCopy}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          copied ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        {copied ? i18n.taxis.msg_copied[lang] : i18n.taxis.btn_copy_link[lang]}
      </button>
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
      >
        {i18n.taxis.btn_open_link[lang]}
      </a>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DriverStatementPanel({ driver, trips, driverLink, onGenerateLink, onEdit, onDelete }: Props) {
  const { lang } = useLanguage()
  const today    = todayISO()
  const past     = trips.filter(t => t.date <  today).sort((a, b) => b.date.localeCompare(a.date))
  const upcoming = trips.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  const earnedMzn   = past.reduce((s, t) => s + t.price_driver_mzn, 0)
  const upcomingMzn = upcoming.reduce((s, t) => s + t.price_driver_mzn, 0)
  const totalMzn    = earnedMzn + upcomingMzn

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold">{driver.name}</h3>
          <p className="text-blue-200 dark:text-blue-300 text-sm mt-0.5">
            {driver.vehicle ?? 'Vehicle not specified'}
            {driver.phone && ` · ${driver.phone}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors">
            ✏️ {i18n.common.btn_edit[lang]}
          </button>
          <button onClick={onDelete}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors">
            🗑️
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Shareable link */}
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{i18n.taxis.label_driver_share_link[lang]}</p>
          <ShareLinkSection driverLink={driverLink} onGenerateLink={onGenerateLink} />
        </div>

        {/* KPI summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">{i18n.taxis.label_completed[lang]}</p>
            <p className="text-2xl font-bold text-green-800 dark:text-green-400 mt-1">{earnedMzn.toLocaleString()}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{past.length} trip{past.length !== 1 ? 's' : ''} · MZN</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{i18n.taxis.label_upcoming[lang]}</p>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-400 mt-1">{upcomingMzn.toLocaleString()}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{upcoming.length} trip{upcoming.length !== 1 ? 's' : ''} · MZN</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{i18n.common.label_total[lang]}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{totalMzn.toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">{trips.length} trip{trips.length !== 1 ? 's' : ''} · MZN</p>
          </div>
        </div>

        {/* Upcoming trips */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{i18n.taxis.label_upcoming_trips[lang]} ({upcoming.length})</h4>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <TripTable trips={upcoming} showStatus />
          </div>
        </div>

        {/* Completed trips */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{i18n.taxis.label_completed_trips[lang]} ({past.length})</h4>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <TripTable trips={past} />
          </div>
        </div>

      </div>
    </div>
  )
}
