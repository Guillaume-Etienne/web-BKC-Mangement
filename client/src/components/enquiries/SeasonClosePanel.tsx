import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Enquiry } from '../../types/database'
import { staleEnquiries, SEASON_CLOSE_REASON } from '../../utils/seasonClose'
import { fmtArrivalMonth } from '../../utils/enquiries'

/** "14 enquiries with no news — close them."
 *
 *  The working list only ever grew: an enquiry from last February that never
 *  answered kept its silence counter running and kept showing up in "Waiting on
 *  you", until the list was long enough to stop being read. This empties it, on
 *  gui's word.
 *
 *  ⚠️ The names are shown BEFORE anything happens, and the button says how many.
 *  Closing fourteen files is not the kind of thing that should be one click away
 *  from a number — one of them might be somebody worth a phone call, and the
 *  only way to know is to read the list. */

interface Props {
  enquiries: Enquiry[]
  onClosed: () => void
}

export default function SeasonClosePanel({ enquiries, onClosed }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stale = staleEnquiries(enquiries)
  if (stale.length === 0) return null

  async function closeAll() {
    setBusy(true)
    setError(null)
    const ids = stale.map(s => s.enquiry.id)
    // One statement, not a loop: closing half a season and stopping midway
    // would leave gui with no idea which half.
    const { error: err } = await supabase.from('enquiries')
      .update({ status: 'lost', lost_reason: SEASON_CLOSE_REASON })
      .in('id', ids)
    setBusy(false)
    if (err) { setError(`Nothing was closed: ${err.message}`); return }
    setExpanded(false)
    onClosed()
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong>{stale.length} enquir{stale.length > 1 ? 'ies' : 'y'} with no future</strong>
          {' '}— the month they were coming has passed, or nobody has said anything in months.
        </p>
        <button onClick={() => setExpanded(e => !e)}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0">
          {expanded ? 'Never mind' : 'Review and close'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          <ul className="max-h-56 overflow-y-auto space-y-1 border-t border-gray-200 dark:border-gray-800 pt-2">
            {stale.map(({ enquiry, reason }) => (
              <li key={enquiry.id} className="text-sm flex items-baseline gap-2 flex-wrap">
                <span className="font-medium text-gray-800 dark:text-gray-200">{enquiry.name}</span>
                {enquiry.arrival_month && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{fmtArrivalMonth(enquiry.arrival_month)}</span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">{reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            They move to the archive marked <em>lost — {SEASON_CLOSE_REASON}</em>. Nothing is
            deleted, and any of them can be reopened one by one from the archive.
          </p>
          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          <button onClick={closeAll} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-white disabled:opacity-40">
            {busy ? 'Closing…' : stale.length === 1 ? 'Close this one' : `Close these ${stale.length}`}
          </button>
        </div>
      )}
    </div>
  )
}
