import { useState } from 'react'
import { useTable } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import { taxiTripLabel } from '../../data/taxiTripTypes'
import { notifyError } from '../../lib/notify'
import type { TaxiDriver, TaxiTrip } from '../../types/database'

interface LogRow { id: string; trip_id: string; driver_id: string | null; changed_at: string; reviewed_at: string | null }

/** Trips the taxi manager staffed from his shared page. Attribution leaves the
 *  driver's price as it was (rates differ from one driver to the next, and some
 *  are typed by hand), so each one waits here until gui has looked at the price
 *  and says "checked". Journal: taxi_trip_driver_log (admin only). */
export default function ManagerAssignedBanner({ trips, drivers }: { trips: TaxiTrip[]; drivers: TaxiDriver[] }) {
  const { lang } = useLanguage()
  const { data: log, refresh } = useTable<LogRow>('taxi_trip_driver_log', { order: 'changed_at', ascending: false })
  const [busy, setBusy] = useState<string | null>(null)
  const t = i18n.taxis

  const pending = log.filter(l => !l.reviewed_at)
  if (pending.length === 0) return null

  async function markChecked(id: string) {
    setBusy(id)
    const { error } = await supabase.from('taxi_trip_driver_log').update({ reviewed_at: new Date().toISOString() }).eq('id', id)
    setBusy(null)
    if (error) { notifyError('Error: ' + error.message); return }
    refresh()
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm">
      <p className="font-semibold text-amber-900 dark:text-amber-300">👤 {pending.length} · {t.mgr_assigned_title[lang]}</p>
      <ul className="mt-2 space-y-1.5">
        {pending.map(l => {
          const trip   = trips.find(x => x.id === l.trip_id)
          const driver = drivers.find(d => d.id === (trip?.taxi_driver_id ?? l.driver_id))
          if (!trip) return null
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-amber-950 dark:text-amber-100">
                <b>{trip.date} {trip.start_time}</b> · {taxiTripLabel(trip.type, { icon: true })} · 🚗 {driver?.name ?? '—'}
              </span>
              <span className="text-xs text-amber-800 dark:text-amber-400">
                {t.mgr_assigned_price[lang]
                  .replace('{price}', String(trip.price_driver_mzn))
                  .replace('{usual}', driver ? String(driver.default_driver_mzn) : '—')}
              </span>
              <button type="button" onClick={() => markChecked(l.id)} disabled={busy === l.id}
                className="ml-auto rounded-md border border-amber-400 dark:border-amber-700 bg-white dark:bg-gray-900 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950 disabled:opacity-50">
                {t.mgr_assigned_ok[lang]}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
