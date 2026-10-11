import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { fetchAccountingBundle } from '../data/fetchAccountingBundle.js'
import { filterDataToSeason } from '../../../client/src/components/accounting/seasonFilter.js'
import { computeSeasonTotals } from '../../../client/src/components/accounting/utils.js'
import { computeAssociateSummaries, totalDrawn } from '../../../client/src/components/accounting/associateUtils.js'
import { seasonWindowAt } from '../../../client/src/utils/seasonWindow.js'
import { toISODate } from '../../../client/src/utils/dates.js'
import { jsonResult, errorResult } from '../result.js'

export function registerAccountingTools(server: McpServer) {
  server.registerTool(
    'get_accounting_summary',
    {
      title: 'Get accounting summary for a season',
      description:
        'Revenue by category (accommodation, lessons, rentals, taxi, activities, dining, center ' +
        'access), amounts billed/paid/due, instructor costs, and net result — for one season. ' +
        'Also what each associate (co-owner) has taken out of the business: a share of the profit, ' +
        'never deducted from the net result. ' +
        'Defaults to the current season (same "which season is current" rule as the app). Same ' +
        'calculation code as the Accounting dashboard, so the numbers always match what the app shows.',
      inputSchema: {
        season_id: z.string().uuid().optional().describe('Defaults to the current season if omitted'),
      },
    },
    async ({ season_id }) => {
      const bundle = await fetchAccountingBundle()

      const season = season_id
        ? bundle.seasons.find(s => s.id === season_id)
        : undefined
      if (season_id && !season) return errorResult(`No season with id ${season_id}`)

      const range = season
        ? { start_date: season.start_date, end_date: season.end_date }
        : (() => {
            const w = seasonWindowAt(bundle.seasons, new Date(), 0)
            return { start_date: toISODate(w.start), end_date: toISODate(w.end) }
          })()

      const filtered = filterDataToSeason(bundle, range, bundle.seasons)
      const totals = computeSeasonTotals(filtered)
      const associates = computeAssociateSummaries(filtered)

      return jsonResult({
        season_label: season?.label ?? seasonWindowAt(bundle.seasons, new Date(), 0).label,
        range,
        totals,
        associates: {
          totalTaken: totalDrawn(associates),
          accounts: associates.map(s => ({
            name: s.associate.name, balance: s.balance,
            guestPaymentsReceived: s.received, transfersFromCentre: s.transfersOut,
            paidBackToCentre: s.transfersBack, expensesPaidOutOfPocket: s.expensesAdvanced,
          })),
        },
      })
    }
  )
}
