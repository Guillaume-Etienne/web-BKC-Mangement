import { useState, useEffect } from 'react'
import { supabase, currentEnv, testConfigured, switchEnv } from '../../lib/supabase'

interface TableStat {
  table_name:  string
  row_count:   number
  total_size:  string
  table_size:  string
  index_size:  string
  total_bytes: number
}

interface DbStats {
  db_size: string
  tables:  TableStat[]
}

export default function DatabaseTab() {
  const [stats,   setStats]   = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_db_stats').then(({ data, error }) => {
      if (error) setError(error.message)
      else       setStats(data as DbStats)
      setLoading(false)
    })
  }, [])

  const totalRows = stats?.tables.reduce((s, t) => s + (t.row_count ?? 0), 0) ?? 0

  const supabaseDashboardUrl = currentEnv === 'test'
    ? 'https://supabase.com/dashboard'
    : 'https://supabase.com/dashboard/project/oslsbansxaajcpwhivmx'

  return (
    <div className="space-y-8">

      {/* ── Env Switch ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Active Database</h2>

        {currentEnv === 'test' && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm font-medium">
            ⚠️ You are connected to the <strong>TEST database</strong>. All changes are isolated from production.
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={() => currentEnv !== 'prod' && switchEnv('prod')}
            className={`flex-1 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
              currentEnv === 'prod'
                ? 'border-green-500 bg-green-50 text-green-800'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 cursor-pointer'
            }`}
          >
            <div className="text-2xl mb-1">🟢</div>
            <div>Production</div>
            {currentEnv === 'prod' && <div className="text-xs font-normal mt-1 text-green-600">Currently active</div>}
          </button>

          <div className="text-gray-400 font-bold text-xl">⇄</div>

          <button
            onClick={() => {
              if (!testConfigured) {
                alert('Test database credentials are not configured yet.\nAdd VITE_SUPABASE_TEST_URL and VITE_SUPABASE_TEST_KEY to client/.env.local')
                return
              }
              if (currentEnv !== 'test') switchEnv('test')
            }}
            className={`flex-1 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
              currentEnv === 'test'
                ? 'border-amber-500 bg-amber-50 text-amber-800'
                : testConfigured
                  ? 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 cursor-pointer'
                  : 'border-dashed border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="text-2xl mb-1">🧪</div>
            <div>Test</div>
            {currentEnv === 'test'
              ? <div className="text-xs font-normal mt-1 text-amber-600">Currently active</div>
              : !testConfigured
                ? <div className="text-xs font-normal mt-1 text-gray-400">Not configured</div>
                : null
            }
          </button>
        </div>

        {!testConfigured && (
          <p className="mt-3 text-xs text-gray-500">
            To enable the test database, add <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_TEST_URL</code> and <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_TEST_KEY</code> to <code className="bg-gray-100 px-1 rounded">client/.env.local</code>, then restart the dev server.
          </p>
        )}
      </div>

      {/* ── DB Overview ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Database Overview
            <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${
              currentEnv === 'prod' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {currentEnv === 'prod' ? 'Production' : 'Test'}
            </span>
          </h2>
          <a
            href={supabaseDashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Open Supabase Dashboard ↗
          </a>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading stats…</p>}
        {error   && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            Could not load stats: {error}
            <div className="mt-1 text-xs text-red-500">Run the <code>get_db_stats()</code> SQL function in your Supabase project first.</div>
          </div>
        )}

        {stats && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">{stats.db_size}</div>
                <div className="text-xs text-gray-500 mt-1">Total DB size</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">{stats.tables.length}</div>
                <div className="text-xs text-gray-500 mt-1">Tables</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">{totalRows.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">Total rows</div>
              </div>
            </div>

            {/* Per-table stats */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left py-2 pr-4 font-medium">Table</th>
                    <th className="text-right py-2 px-4 font-medium">Rows</th>
                    <th className="text-right py-2 px-4 font-medium">Table size</th>
                    <th className="text-right py-2 px-4 font-medium">Indexes</th>
                    <th className="text-right py-2 pl-4 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.tables.map(t => (
                    <tr key={t.table_name} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-700">{t.table_name}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-gray-700">
                        {(t.row_count ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-500">{t.table_size}</td>
                      <td className="py-2 px-4 text-right text-gray-500">{t.index_size}</td>
                      <td className="py-2 pl-4 text-right font-medium text-gray-700">{t.total_size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── API Requests note ──────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
        <strong>API request counts</strong> (daily / monthly) are available in the{' '}
        <a
          href={`${supabaseDashboardUrl}/reports`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Supabase Dashboard → Reports
        </a>
        . They are not accessible from the app (server-side tracking only).
      </div>

    </div>
  )
}
