import type { AgencyHoursPool } from '../accounting/utils'

/** "6.5 h / 14 h" with a bar — the agency's lesson packages read as one pool.
 *  Same component on the accounting panel and on the guest's page, so the two
 *  can never show different counts. */
export default function AgencyHoursGauge({ pool, agencyName }: { pool: AgencyHoursPool; agencyName: string }) {
  const pct = Math.min(100, (pool.used / pool.included) * 100)
  const full = pool.used >= pool.included
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          🏄 {agencyName} package — {pool.included} h of lessons included
        </span>
        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
          <span className="font-semibold">{pool.used} h</span> done ·{' '}
          <span className={`font-semibold ${full ? 'text-gray-500 dark:text-gray-400' : 'text-green-600 dark:text-green-400'}`}>{pool.left} h</span> left
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${full ? 'bg-gray-400 dark:bg-gray-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
      </div>
      {pool.extra > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          + {pool.extra} h not covered by the package ({pool.extraLessons} lesson{pool.extraLessons > 1 ? 's' : ''}), billed separately.
        </p>
      )}
    </div>
  )
}
