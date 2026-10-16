import type { TaxiTrip, TaxiTripStatus, TaxiTripType, TaxiDriver, BookingRef } from '../../types/database'
import { todayISO, addDaysISO, fromISODate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

// Filter bar shared by the List and Kanban views (state lives in TaxiPage, so switching
// view keeps the filters). The driver filter stays in the List: the Kanban already has
// one column per driver.

export type TaxiPeriod = 'today' | 'tomorrow' | 'week' | 'upcoming' | 'all' | 'day' | 'range'
export type TriState  = 'all' | 'only' | 'hide'

export interface TaxiFilters {
  period:  TaxiPeriod
  day:     string   // period === 'day'
  from:    string   // period === 'range'
  to:      string
  status:  'all' | TaxiTripStatus
  type:    'all' | TaxiTripType
  search:  string
  toHandle: boolean
  privateTaxi: TriState
  agency:  TriState
}

export const DEFAULT_TAXI_FILTERS: TaxiFilters = {
  period: 'upcoming', day: todayISO(), from: todayISO(), to: addDaysISO(todayISO(), 7),
  status: 'all', type: 'all', search: '', toHandle: false, privateTaxi: 'all', agency: 'all',
}

export const TRIP_TYPE_FILTER_LABELS: Record<TaxiTripType, string> = {
  'aero-to-center': '✈️ Airport → Bilene',
  'center-to-aero': '🏠 Bilene → Airport',
  'aero-to-spot':   '✈️ Airport → Spot',
  'spot-to-aero':   '🏄 Spot → Airport',
  'center-to-town': '🏠 Bilene → Town',
  'town-to-center': '🏢 Town → Bilene',
  'other':          '❓ Other',
}

/** Monday → Sunday of the week containing `iso`. */
function weekBounds(iso: string): [string, string] {
  const dow = (fromISODate(iso).getDay() + 6) % 7  // 0 = Monday
  const monday = addDaysISO(iso, -dow)
  return [monday, addDaysISO(monday, 6)]
}

function periodBounds(f: TaxiFilters): [string | null, string | null] {
  const today = todayISO()
  switch (f.period) {
    case 'today':    return [today, today]
    case 'tomorrow': { const t = addDaysISO(today, 1); return [t, t] }
    case 'week':     return weekBounds(today)
    case 'upcoming': return [today, null]
    case 'day':      return f.day ? [f.day, f.day] : [null, null]
    case 'range':    return [f.from || null, f.to || null]
    default:         return [null, null]
  }
}

/** A trip still needing action: upcoming and either no driver, details missing,
 *  or a 0 € price that no agency is paying for. */
export function tripNeedsHandling(t: TaxiTrip, today = todayISO()): boolean {
  if (t.date < today) return false
  return !t.taxi_driver_id || t.status === 'needs_details' || (t.price_eur === 0 && !t.agency_billing_line_id)
}

function triState(state: TriState, value: boolean): boolean {
  return state === 'all' || (state === 'only' ? value : !value)
}

export function applyTaxiFilters(trips: TaxiTrip[], f: TaxiFilters, drivers: TaxiDriver[], bookings: BookingRef[]): TaxiTrip[] {
  const [from, to] = periodBounds(f)
  const today = todayISO()
  const q = f.search.trim().toLowerCase()
  return trips.filter(t => {
    if (from && t.date < from) return false
    if (to   && t.date > to)   return false
    if (f.status !== 'all' && t.status !== f.status) return false
    if (f.type   !== 'all' && t.type   !== f.type)   return false
    if (f.toHandle && !tripNeedsHandling(t, today))  return false
    if (!triState(f.privateTaxi, t.margin_manager_mzn === 0)) return false
    if (!triState(f.agency, !!t.agency_billing_line_id))      return false
    if (q) {
      const b = t.booking_id ? bookings.find(b => b.id === t.booking_id) : undefined
      const driver = t.taxi_driver_id ? drivers.find(d => d.id === t.taxi_driver_id) : undefined
      const haystack = [
        b?.client ? `${b.client.first_name} ${b.client.last_name}` : '',
        b ? `#${String(b.booking_number).padStart(3, '0')} ${b.booking_number}` : '',
        driver?.name ?? '',
        t.notes ?? '',
      ].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

interface Props {
  filters:  TaxiFilters
  onChange: (f: TaxiFilters) => void
  shown:    number
  total:    number
}

const selectCls = 'text-sm border rounded px-3 py-1.5 bg-white dark:bg-gray-900'

export default function TaxiTripFilters({ filters: f, onChange, shown, total }: Props) {
  const { lang } = useLanguage()
  const t = i18n.taxis
  const set = (patch: Partial<TaxiFilters>) => onChange({ ...f, ...patch })

  const quick: { key: TaxiPeriod; label: string }[] = [
    { key: 'today',    label: t.btn_today[lang] },
    { key: 'tomorrow', label: t.period_tomorrow[lang] },
    { key: 'week',     label: t.period_week[lang] },
    { key: 'upcoming', label: t.label_upcoming[lang] },
    { key: 'all',      label: t.label_all[lang] },
    { key: 'day',      label: t.period_day[lang] },
    { key: 'range',    label: t.period_range[lang] },
  ]

  const isDefault = JSON.stringify({ ...f, day: '', from: '', to: '' }) === JSON.stringify({ ...DEFAULT_TAXI_FILTERS, day: '', from: '', to: '' })

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 mb-6 space-y-3">
      {/* Period */}
      <div className="flex flex-wrap gap-2 items-center">
        {quick.map(q => (
          <button key={q.key} type="button" onClick={() => set({ period: q.key })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${f.period === q.key
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {q.label}
          </button>
        ))}
        {f.period === 'day' && (
          <input type="date" value={f.day} onChange={e => set({ day: e.target.value })} className={selectCls} />
        )}
        {f.period === 'range' && (
          <span className="flex flex-wrap items-center gap-2">
            <input type="date" value={f.from} onChange={e => set({ from: e.target.value })} className={selectCls} />
            <span className="text-gray-500 dark:text-gray-400">→</span>
            <input type="date" value={f.to} min={f.from || undefined} onChange={e => set({ to: e.target.value })} className={selectCls} />
          </span>
        )}
      </div>

      {/* Other criteria */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="search" value={f.search} onChange={e => set({ search: e.target.value })}
          placeholder={t.placeholder_search_trip[lang]}
          className={`${selectCls} w-full sm:w-56`} />
        <select value={f.status} onChange={e => set({ status: e.target.value as TaxiFilters['status'] })} className={selectCls}>
          <option value="all">{t.filter_all_statuses[lang]}</option>
          <option value="confirmed">{t.status_confirmed_trip[lang]}</option>
          <option value="needs_details">{t.status_needs_details[lang]}</option>
          <option value="done">{t.status_done[lang]}</option>
        </select>
        <select value={f.type} onChange={e => set({ type: e.target.value as TaxiFilters['type'] })} className={selectCls}>
          <option value="all">{t.filter_all_types[lang]}</option>
          {Object.entries(TRIP_TYPE_FILTER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={f.privateTaxi} onChange={e => set({ privateTaxi: e.target.value as TriState })} className={selectCls}>
          <option value="all">🔒 {t.filter_private_all[lang]}</option>
          <option value="only">🔒 {t.filter_private_only[lang]}</option>
          <option value="hide">🔒 {t.filter_private_hide[lang]}</option>
        </select>
        <select value={f.agency} onChange={e => set({ agency: e.target.value as TriState })} className={selectCls}>
          <option value="all">🏢 {t.filter_agency_all[lang]}</option>
          <option value="only">🏢 {t.filter_agency_only[lang]}</option>
          <option value="hide">🏢 {t.filter_agency_hide[lang]}</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
          title={t.filter_to_handle_hint[lang]}>
          <input type="checkbox" checked={f.toHandle} onChange={e => set({ toHandle: e.target.checked })} />
          ⚠️ {t.filter_to_handle[lang]}
        </label>
        <span className="ml-auto flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {shown} / {total}
          {!isDefault && (
            <button type="button" onClick={() => onChange({ ...DEFAULT_TAXI_FILTERS, day: f.day, from: f.from, to: f.to })}
              className="text-blue-600 dark:text-blue-400 hover:underline">
              {t.btn_reset_filters[lang]}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
