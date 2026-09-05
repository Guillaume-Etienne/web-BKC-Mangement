import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

/** What broke on somebody else's phone.
 *
 *  Everything else in this app is something gui typed in. This is the one panel
 *  fed by people he will never meet, on devices he will never hold — the guests
 *  and drivers who open a shared link. It exists because on 2026-09-04 a client
 *  could not file his trip and the only reason we ever found out was that he
 *  picked up the telephone.
 *
 *  Empty is the correct state. It is not a queue to work through. */

interface ClientError {
  id: string
  occurred_at: string
  kind: string
  source: string
  message: string
  page: string | null
  user_agent: string | null
  app_lang: string | null
  recovered: boolean
}

const KIND_LABEL: Record<string, { label: string; className: string }> = {
  'dom-mutated': { label: 'page translation', className: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  chunk:         { label: 'stale version',    className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  network:       { label: 'no connection',    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  storage:       { label: 'storage blocked',  className: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' },
  unknown:       { label: 'unknown',          className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

/** "Chrome 128 · Android" is what tells us anything; the other 180 characters
 *  of a user-agent string tell us nothing, and they hide the part that does. */
function shortUA(ua: string | null): string {
  if (!ua) return '—'
  const browser = ua.match(/(Firefox|Edg|OPR|SamsungBrowser|Chrome|Safari)\/(\d+)/)
  const os = /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : '?'
  const name = browser ? `${browser[1] === 'Edg' ? 'Edge' : browser[1] === 'OPR' ? 'Opera' : browser[1]} ${browser[2]}` : 'unknown browser'
  return `${name} · ${os}`
}

export default function ClientErrorsPanel() {
  const [rows, setRows] = useState<ClientError[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  function load() {
    setLoading(true)
    supabase.from('client_errors')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        // The migration may not have been run on this database yet — the app is
        // designed to work without it, so say so rather than showing an error.
        if (error) setMissing(true)
        else setRows((data ?? []) as ClientError[])
        setLoading(false)
      })
  }

  useEffect(load, [])

  async function clearAll() {
    // Not a filter that could match nothing: every row, deliberately.
    await supabase.from('client_errors').delete().gte('occurred_at', '1970-01-01')
    setConfirmClear(false)
    load()
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Visitor errors</h2>
        {rows.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={clearAll}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white">
                Delete {rows.length}
              </button>
              <button onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:underline">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Clear
            </button>
          )
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Crashes reported by people using the public and shared pages. Nothing here is the normal
        state — an empty list is the good one.
      </p>

      {loading ? (
        <p className="text-gray-400 dark:text-gray-400 text-sm py-6 text-center">Loading…</p>
      ) : missing ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          Not collecting yet — run <code className="font-mono text-xs">2026-09-05_client_errors.sql</code> on
          this database. Everything else keeps working without it.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          Nothing reported. 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const k = KIND_LABEL[r.kind] ?? KIND_LABEL.unknown
            return (
              <div key={r.id} className="border border-gray-100 dark:border-gray-800 rounded-lg px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${k.className}`}>{k.label}</span>
                  {r.recovered && (
                    <span title="The page repaired itself; the visitor saw nothing."
                      className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                      recovered
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {r.occurred_at.slice(0, 16).replace('T', ' ')} · {r.source}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{r.message}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 break-all">
                  {r.page || '—'} · {shortUA(r.user_agent)}{r.app_lang ? ` · ${r.app_lang}` : ''}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
