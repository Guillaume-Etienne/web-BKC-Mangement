import { useState, useEffect } from 'react'
import { supabase, currentEnv, testConfigured, switchEnv } from '../../lib/supabase'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

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
  const { lang } = useLanguage()
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
      <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{i18n.management.title_active_database[lang]}</h2>

        {currentEnv === 'test' && (
          <div className="mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-400 text-sm font-medium">
            {i18n.management.msg_test_db_warning[lang]}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={() => currentEnv !== 'prod' && switchEnv('prod')}
            className={`flex-1 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
              currentEnv === 'prod'
                ? 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-400'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer'
            }`}
          >
            <div className="text-2xl mb-1">🟢</div>
            <div>{i18n.management.label_production[lang]}</div>
            {currentEnv === 'prod' && <div className="text-xs font-normal mt-1 text-green-600 dark:text-green-400">{i18n.management.label_currently_active[lang]}</div>}
          </button>

          <div className="text-gray-400 dark:text-gray-400 font-bold text-xl">⇄</div>

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
                ? 'border-amber-500 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400'
                : testConfigured
                  ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer'
                  : 'border-dashed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="text-2xl mb-1">🧪</div>
            <div>{i18n.management.label_test[lang]}</div>
            {currentEnv === 'test'
              ? <div className="text-xs font-normal mt-1 text-amber-600 dark:text-amber-400">{i18n.management.label_currently_active[lang]}</div>
              : !testConfigured
                ? <div className="text-xs font-normal mt-1 text-gray-400 dark:text-gray-400">{i18n.management.label_not_configured[lang]}</div>
                : null
            }
          </button>
        </div>

        {!testConfigured && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            To enable the test database, add <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">VITE_SUPABASE_TEST_URL</code> and <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">VITE_SUPABASE_TEST_KEY</code> to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">client/.env.local</code>, then restart the dev server.
          </p>
        )}
      </div>

      {/* ── DB Overview ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {i18n.management.title_db_overview[lang]}
            <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${
              currentEnv === 'prod' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              {currentEnv === 'prod' ? i18n.management.label_production[lang] : i18n.management.label_test[lang]}
            </span>
          </h2>
          <a
            href={supabaseDashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {i18n.management.link_open_supabase[lang]}
          </a>
        </div>

        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.management.msg_loading_stats[lang]}</p>}
        {error   && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded">
            {i18n.management.msg_stats_load_failed[lang]} {error}
            <div className="mt-1 text-xs text-red-500 dark:text-red-400">Run the <code>get_db_stats()</code> SQL function in your Supabase project first.</div>
          </div>
        )}

        {stats && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.db_size}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{i18n.management.label_total_db_size[lang]}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.tables.length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{i18n.management.label_tables[lang]}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{totalRows.toLocaleString()}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{i18n.management.label_total_rows[lang]}</div>
              </div>
            </div>

            {/* Per-table stats */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <th className="text-left py-2 pr-4 font-medium">{i18n.management.col_table[lang]}</th>
                    <th className="text-right py-2 px-4 font-medium">{i18n.management.col_rows[lang]}</th>
                    <th className="text-right py-2 px-4 font-medium">{i18n.management.col_table_size[lang]}</th>
                    <th className="text-right py-2 px-4 font-medium">{i18n.management.col_indexes[lang]}</th>
                    <th className="text-right py-2 pl-4 font-medium">{i18n.management.col_total[lang]}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.tables.map(t => (
                    <tr key={t.table_name} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-700 dark:text-gray-300">{t.table_name}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {(t.row_count ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400">{t.table_size}</td>
                      <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400">{t.index_size}</td>
                      <td className="py-2 pl-4 text-right font-medium text-gray-700 dark:text-gray-300">{t.total_size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── API Requests note ──────────────────────────────────────────────── */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-400">
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
