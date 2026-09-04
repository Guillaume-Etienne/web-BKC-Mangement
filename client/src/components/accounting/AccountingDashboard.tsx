import { useState, useMemo } from 'react'
import type { SharedAccountingData } from './types'
import CollectionsModal from './CollectionsModal'
import SeasonComparison from './SeasonComparison'
import { filterDataToSeason } from './seasonFilter'
import { todayISO, fmtDate } from '../../utils/dates'
import {
  computeSeasonTotals,
  computeBookingTotal, computeBookingPaid, computeBookingDiscounts,
  computeInstructorBalance, fmtEur, agencyMarker,
} from './utils'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

interface Props { data: SharedAccountingData; onOpenBooking?: (id: string) => void }

/** What the figures below cover. `all` is every row ever recorded — which is
 *  what this screen always showed, under a heading that said "season". */
type Scope =
  | { kind: 'all' }
  | { kind: 'season'; id: string }
  | { kind: 'compare' }

// ── Helpers ────────────────────────────────────────────────────────────────

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

export default function AccountingDashboard({ data, onOpenBooking }: Props) {
  const { lang } = useLanguage()
  const [showCollections, setShowCollections] = useState(false)

  // Seasons arrive sorted by start_date (see AccountingPage).
  const seasons = data.seasons
  const currentSeason = useMemo(() => {
    const today = todayISO()
    return seasons.find(s => today >= s.start_date && today <= s.end_date) ?? seasons[seasons.length - 1]
  }, [seasons])

  // Open on the season we are actually in — that is the number gui wants first.
  // With no season configured there is nothing to filter by, so: everything.
  const [scope, setScope] = useState<Scope>(() =>
    currentSeason ? { kind: 'season', id: currentSeason.id } : { kind: 'all' })

  const activeSeason = scope.kind === 'season' ? seasons.find(s => s.id === scope.id) : undefined

  // The whole screen reads this, not `data`: the headline totals, the "who still
  // owes us" list and the instructor balances all have to describe the same
  // period, or the page contradicts itself.
  const scoped = useMemo(
    () => (activeSeason ? filterDataToSeason(data, activeSeason) : data),
    [data, activeSeason],
  )

  const { bookings, payments, instructors, taxiTrips } = scoped

  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const activeIds = new Set(activeBookings.map(b => b.id))

  // Every headline figure comes from one pure, unit-tested function. The
  // conventions behind them — cancelled bookings excluded from revenue, taxi
  // counted as centre margin, instructor cost covering every lesson taught —
  // are documented on computeSeasonTotals rather than scattered here.
  const {
    accomRev, lessonsRev, rentalsRev, taxiRevGross, taxiCosts, taxiMargin,
    activitiesRev, eventsRev, centerAccessRev, agencyRev, agencyGross, agencyCommission, totalRevenue,
    billedNet, totalPaid, unverifiedPaid, totalDue,
    instructorCosts, activityCosts, houseRentalCosts, bungalowCosts, externalStayCosts, totalExpenses,
    palmeirasNet, netResult,
  } = computeSeasonTotals(scoped)

  const activeTrips     = taxiTrips.filter(t => t.booking_id === null || activeIds.has(t.booking_id))
  const standaloneTrips = activeTrips.filter(t => t.booking_id === null)

  // Per-booking detail, for the "who still owes us" list below
  const bookingFinances = activeBookings.map(b => {
    const total     = computeBookingTotal(b, scoped)
    const discounts = computeBookingDiscounts(b.id, payments)
    const paid      = computeBookingPaid(b.id, payments)
    return { ...b, total, discounts, paid, due: total - discounts - paid }
  })

  // ── Instructor balances ────────────────────────────────────────────────
  const instrBalances = instructors.map(i => ({
    ...i,
    balance: computeInstructorBalance(i.id, scoped),
  })).filter(i => Math.abs(i.balance) > 0.5)
    .sort((a, b) => b.balance - a.balance)

  // ── Unpaid bookings ────────────────────────────────────────────────────
  const unpaidBookings = bookingFinances
    .filter(b => b.due > 0.5)
    .sort((a, b) => b.due - a.due)
  const topUnpaid = unpaidBookings.slice(0, 6)

  // ── Booking counts ─────────────────────────────────────────────────────
  const confirmed   = bookings.filter(b => b.status === 'confirmed').length
  const provisional = bookings.filter(b => b.status === 'provisional').length
  const cancelled   = bookings.filter(b => b.status === 'cancelled').length

  const fmt = (n: number) => fmtEur(n)
  const sign = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`

  // The period picker sits above everything and is the only place the scope is
  // set — every figure on this screen is read through it.
  const periodBar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
        <button
          onClick={() => setScope({ kind: 'all' })}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            scope.kind === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {i18n.common.period_all_time[lang]}
        </button>
        {seasons.map(s => (
          <button
            key={s.id}
            onClick={() => setScope({ kind: 'season', id: s.id })}
            title={`${fmtDate(s.start_date)} → ${fmtDate(s.end_date)}`}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              scope.kind === 'season' && scope.id === s.id
                ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {s.label}
          </button>
        ))}
        {seasons.length > 1 && (
          <button
            onClick={() => setScope({ kind: 'compare' })}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              scope.kind === 'compare' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {i18n.accounting.dash_compare[lang]}
          </button>
        )}
      </div>
      {activeSeason && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {fmtDate(activeSeason.start_date)} → {fmtDate(activeSeason.end_date)}
        </span>
      )}
      {seasons.length === 0 && (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {i18n.accounting.dash_no_season[lang]}
        </span>
      )}
    </div>
  )

  if (scope.kind === 'compare') {
    return (
      <div className="space-y-6">
        {periodBar}
        <SeasonComparison data={data} seasons={seasons} />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {periodBar}

      {/* ── Row 1: main KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">{i18n.accounting.dash_total_revenue[lang]}</p>
          <p className="text-3xl font-bold text-emerald-800 dark:text-emerald-400">{fmt(totalRevenue)}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{i18n.accounting.dash_active_booking[lang].replace('{count}', String(activeBookings.length)).replace('{s}', activeBookings.length !== 1 ? 's' : '')}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">{i18n.accounting.dash_collected[lang]}</p>
          <p className="text-3xl font-bold text-blue-800 dark:text-blue-400">{fmt(totalPaid)}</p>
          <div className="mt-2 bg-blue-100 dark:bg-blue-900/30 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${billedNet > 0 ? Math.min(100, (totalPaid / billedNet) * 100) : 0}%` }} />
          </div>
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">{i18n.accounting.dash_of_billed[lang].replace('{pct}', String(billedNet > 0 ? Math.round((totalPaid / billedNet) * 100) : 0)).replace('{amount}', fmt(billedNet))}</p>
          {unverifiedPaid > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{i18n.accounting.dash_still_to_verify[lang].replace('{amount}', fmt(unverifiedPaid))}</p>
          )}
        </div>
        <div className={`border rounded-xl p-5 ${totalDue > 0 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-800'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${totalDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>{i18n.accounting.dash_outstanding[lang]}</p>
          <p className={`text-3xl font-bold ${totalDue > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>{fmt(totalDue)}</p>
          <p className={`text-xs mt-1 ${totalDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-400'}`}>{i18n.accounting.dash_booking_balance_due[lang].replace('{count}', String(unpaidBookings.length)).replace('{s}', unpaidBookings.length !== 1 ? 's' : '')}</p>
        </div>
      </div>

      {/* ── Row 2: cost / margin KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-1">{i18n.accounting.dash_instructor_costs[lang]}</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-400">−{fmt(instructorCosts)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-1">{i18n.accounting.dash_house_rentals[lang]}</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-400">−{fmt(houseRentalCosts)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-1">{i18n.accounting.dash_bungalow_owners[lang]}</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-400">−{fmt(bungalowCosts)}</p>
        </div>
        {/* gui (2026-07-04): the number that matters on the general dashboard is the MARGIN
            (what's left after paying drivers + manager); costs stay as the subtitle detail */}
        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-500 dark:text-purple-400 mb-1">{i18n.accounting.dash_taxi_margin[lang]}</p>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-400">{sign(taxiMargin)}</p>
          <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">{i18n.accounting.dash_taxi_detail[lang].replace('{gross}', fmt(taxiRevGross)).replace('{cost}', fmt(taxiCosts))}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-1">{i18n.accounting.dash_activity_providers[lang]}</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-400">−{fmt(activityCosts)}</p>
        </div>
        {/* Hidden until a stay exists: an always-zero card next to seven live ones
            teaches the eye to skip the row. */}
        {externalStayCosts > 0 && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-1">{i18n.accounting.dash_external_stays[lang]}</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-400">−{fmt(externalStayCosts)}</p>
          </div>
        )}
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-1">{i18n.accounting.dash_expenses[lang]}</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-400">−{fmt(totalExpenses)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${palmeirasNet >= 0 ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${palmeirasNet >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-500 dark:text-red-400'}`}>{i18n.accounting.dash_palmeiras_net[lang]}</p>
          <p className={`text-2xl font-bold ${palmeirasNet >= 0 ? 'text-teal-800 dark:text-teal-400' : 'text-red-800 dark:text-red-400'}`}>{sign(palmeirasNet)}</p>
          <p className={`text-xs mt-1 ${palmeirasNet >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-400 dark:text-red-300'}`}>{i18n.accounting.dash_palmeiras_detail[lang]}</p>
        </div>
      </div>

      {/* ── Net result banner ── */}
      <div className={`rounded-xl border-2 p-5 flex items-center justify-between ${netResult >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700' : 'bg-red-50 dark:bg-red-950/40 border-red-400 dark:border-red-700'}`}>
        <div>
          {/* Says what it actually covers. It read "(season)" while nothing filtered
              by season at all — a lifetime total under a seasonal heading. */}
          <p className={`text-sm font-semibold uppercase tracking-wide ${netResult >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {i18n.accounting.dash_net_result[lang].replace('{period}', activeSeason ? activeSeason.label : i18n.accounting.dash_all_time[lang])}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{i18n.accounting.dash_net_result_detail[lang]}</p>
        </div>
        <p className={`text-4xl font-bold ${netResult >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{sign(netResult)}</p>
      </div>

      {/* ── Two columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-4">{i18n.accounting.dash_revenue_breakdown[lang]}</h2>
          <div className="space-y-3">
            {[
              { key: 'Accommodation', label: i18n.accounting.rev_accommodation[lang], value: accomRev,      color: 'bg-blue-500' },
              { key: 'Lessons',       label: i18n.accounting.rev_lessons[lang],       value: lessonsRev,   color: 'bg-emerald-500' },
              { key: 'Equipment',     label: i18n.accounting.rev_equipment[lang],     value: rentalsRev,   color: 'bg-purple-500' },
              { key: 'Taxi margin',   label: i18n.accounting.rev_taxi_margin[lang],   value: taxiMargin,   color: 'bg-amber-500' },
              { key: 'Activities',    label: i18n.accounting.rev_activities[lang],    value: activitiesRev,color: 'bg-teal-500' },
              { key: 'Events',        label: i18n.accounting.rev_events[lang],        value: eventsRev,    color: 'bg-rose-400' },
              { key: 'Center access', label: i18n.accounting.rev_center_access[lang], value: centerAccessRev, color: 'bg-cyan-500' },
              // Partner agencies. Hidden until one is actually billed — every
              // other line here is a permanent part of the business, this one is
              // not. It must never be omitted once non-zero though: the services
              // it covers have been subtracted from the lines above, so without
              // it the rows no longer add up to the total underneath them.
              ...(agencyRev !== 0 ? [{ key: 'Agencies', label: i18n.accounting.rev_agencies[lang], value: agencyRev, color: 'bg-indigo-500' }] : []),
            ].map(c => (
              <div key={c.key} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{c.label}</p>
                  {c.key === 'Taxi margin' && standaloneTrips.length > 0 && (
                    <p className="text-xs text-amber-500 dark:text-amber-400">{i18n.accounting.dash_incl_unlinked[lang].replace('{count}', String(standaloneTrips.length))}</p>
                  )}
                  {c.key === 'Agencies' && (
                    <p className="text-xs text-indigo-500 dark:text-indigo-400">
                      {i18n.accounting.dash_commission_detail[lang].replace('{gross}', fmt(agencyGross)).replace('{commission}', fmt(agencyCommission))}
                    </p>
                  )}
                </div>
                <Bar value={c.value} max={totalRevenue} color={c.color} />
                <p className="w-24 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{fmt(c.value)}</p>
              </div>
            ))}
            <div className="pt-2 border-t flex justify-between text-sm font-bold text-gray-800 dark:text-gray-200">
              <span>{i18n.accounting.dash_total[lang]}</span>
              <span>{fmt(totalRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Bookings status */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-4">{i18n.accounting.dash_bookings_header[lang]}</h2>
          <div className="grid grid-cols-3 gap-3 text-center mb-6">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-lg py-3">
              <p className="text-2xl font-bold">{confirmed}</p>
              <p className="text-xs font-medium mt-0.5">{i18n.accounting.dash_confirmed[lang]}</p>
            </div>
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-lg py-3">
              <p className="text-2xl font-bold">{provisional}</p>
              <p className="text-xs font-medium mt-0.5">{i18n.accounting.dash_provisional[lang]}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg py-3">
              <p className="text-2xl font-bold">{cancelled}</p>
              <p className="text-xs font-medium mt-0.5">{i18n.accounting.dash_cancelled[lang]}</p>
            </div>
          </div>

          {/* Collection progress — click → who owes what (CollectionsModal) */}
          <button onClick={() => setShowCollections(true)} className="w-full space-y-2 text-left group">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {i18n.accounting.dash_collection_progress[lang]}
                <span className="ml-2 text-blue-500 dark:text-blue-400 group-hover:underline">{i18n.accounting.dash_who_owes[lang]}</span>
              </span>
              <span>{i18n.accounting.dash_of_billed_short[lang].replace('{paid}', fmt(totalPaid)).replace('{billed}', fmt(billedNet))}</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden group-hover:ring-2 group-hover:ring-blue-200">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${billedNet > 0 ? Math.min(100, (totalPaid / billedNet) * 100) : 0}%` }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* ── Instructor balances ── */}
      {instrBalances.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">{i18n.accounting.dash_instructor_balances[lang]}</h2>
          <p className="text-xs text-gray-400 dark:text-gray-400 mb-4">{i18n.accounting.dash_earned_minus[lang]}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {instrBalances.map(i => (
              <div key={i.id} className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
                i.balance > 0 ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900' : 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900'
              }`}>
                <div>
                  <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">{i.first_name} {i.last_name}</p>
                  <p className={`text-xs mt-0.5 ${i.balance > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                    {i.balance > 0 ? i18n.accounting.dash_to_pay[lang] : i18n.accounting.dash_credit[lang]}
                  </p>
                </div>
                <p className={`text-lg font-bold ${i.balance > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}`}>
                  {fmt(Math.abs(i.balance))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCollections && (
        <CollectionsModal
          rows={unpaidBookings}
          clients={scoped.clients}
          onClose={() => setShowCollections(false)}
          onOpenBooking={onOpenBooking}
        />
      )}

      {/* ── Unpaid bookings ── */}
      {topUnpaid.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">{i18n.accounting.dash_outstanding_payments[lang]}</h2>
          <p className="text-xs text-gray-400 dark:text-gray-400 mb-4">{i18n.accounting.dash_top_n_of[lang].replace('{n}', String(topUnpaid.length)).replace('{total}', String(unpaidBookings.length)).replace('{s}', unpaidBookings.length !== 1 ? 's' : '')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="pb-2 font-medium">{i18n.accounting.dash_guest_col[lang]}</th>
                  <th className="pb-2 font-medium">{i18n.accounting.dash_checkin_col[lang]}</th>
                  <th className="pb-2 font-medium">{i18n.common.label_status[lang]}</th>
                  <th className="pb-2 font-medium text-right">{i18n.common.label_total[lang]}</th>
                  <th className="pb-2 font-medium text-right">{i18n.accounting.dash_paid_col[lang]}</th>
                  <th className="pb-2 font-medium text-right">{i18n.accounting.dash_due_col[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {topUnpaid.map(b => {
                  const client = b.client
                  const statusColors = {
                    confirmed:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
                    provisional: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                    cancelled:   'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                  }
                  return (
                    <tr
                      key={b.id}
                      onClick={onOpenBooking ? () => onOpenBooking(b.id) : undefined}
                      className={`border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 ${onOpenBooking ? 'cursor-pointer' : ''}`}
                    >
                      <td className="py-2 font-medium text-gray-800 dark:text-gray-200">
                        {onOpenBooking && <span className="text-gray-300 dark:text-gray-500 mr-1">↗</span>}
                        {agencyMarker({ booking_id: b.id }, scoped) && (
                          <span className="mr-1 text-gray-500 dark:text-gray-400" title={i18n.accounting.dash_from_partner_agency[lang]}>
                            {agencyMarker({ booking_id: b.id }, scoped)}
                          </span>
                        )}
                        {client ? `${client.first_name} ${client.last_name}` : b.id}
                      </td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{fmtDate(b.check_in)}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[b.status]}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-700 dark:text-gray-300">{fmt(b.total)}</td>
                      <td className="py-2 text-right text-blue-700 dark:text-blue-400">{fmt(b.paid)}</td>
                      <td className="py-2 text-right font-bold text-amber-700 dark:text-amber-400">{fmt(b.due)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
