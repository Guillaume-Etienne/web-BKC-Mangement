import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaxiDriver, TaxiTrip } from '../types/database'

interface Props { driverId: string }

type TripWithClient = TaxiTrip & {
  booking?: { client?: { first_name: string; last_name: string } | null } | null
}

const TRIP_TYPE_LABELS: Record<string, string> = {
  'aero-to-center':  'Airport → Center',
  'center-to-aero':  'Center → Airport',
  'aero-to-spot':    'Airport → Spot',
  'spot-to-aero':    'Spot → Airport',
  'center-to-town':  'Center → Town',
  'town-to-center':  'Town → Center',
  'other':           'Other',
}

function clientName(t: TripWithClient): string {
  const c = t.booking?.client
  return c ? `${c.first_name} ${c.last_name}` : '–'
}

function TripTable({ trips }: { trips: TripWithClient[] }) {
  if (trips.length === 0) {
    return <p className="text-sm text-gray-400 italic py-4 text-center">No trips.</p>
  }
  const total = trips.reduce((s, t) => s + t.price_driver_mzn, 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b text-gray-500 text-xs text-left">
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Time</th>
            <th className="px-4 py-2 font-medium">Route</th>
            <th className="px-4 py-2 font-medium">Client</th>
            <th className="px-4 py-2 font-medium text-center">Pax</th>
            <th className="px-4 py-2 font-medium text-center">Bags</th>
            <th className="px-4 py-2 font-medium text-center">Boards</th>
            <th className="px-4 py-2 font-medium">Notes</th>
            <th className="px-4 py-2 font-medium text-right">Driver (MZN)</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-700 whitespace-nowrap font-medium">{t.date}</td>
              <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{t.start_time}</td>
              <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{TRIP_TYPE_LABELS[t.type] ?? t.type}</td>
              <td className="px-4 py-2 text-gray-700 font-medium">{clientName(t)}</td>
              <td className="px-4 py-2 text-center text-gray-600">{t.nb_persons}</td>
              <td className="px-4 py-2 text-center text-gray-500">{t.nb_luggage}</td>
              <td className="px-4 py-2 text-center text-gray-500">{t.nb_boardbags}</td>
              <td className="px-4 py-2 text-gray-400 italic text-xs">{t.notes ?? ''}</td>
              <td className="px-4 py-2 text-right font-semibold text-amber-800 whitespace-nowrap">
                {t.price_driver_mzn.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
            <td colSpan={8} className="px-4 py-2 text-right text-gray-700 text-sm">Total</td>
            <td className="px-4 py-2 text-right text-amber-900">{total.toLocaleString()} MZN</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function DriverSharePage({ driverId }: Props) {
  const [driver,  setDriver]  = useState<TaxiDriver | null>(null)
  const [trips,   setTrips]   = useState<TripWithClient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [driverRes, tripsRes] = await Promise.all([
        supabase.from('taxi_drivers').select('*').eq('id', driverId).single(),
        supabase
          .from('taxi_trips')
          .select('*, booking:bookings(client:clients(first_name, last_name))')
          .eq('taxi_driver_id', driverId)
          .order('date', { ascending: false }),
      ])
      setDriver(driverRes.data ?? null)
      setTrips((tripsRes.data ?? []) as TripWithClient[])
      setLoading(false)
    }
    load()
  }, [driverId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Driver not found.</p>
      </div>
    )
  }

  const today    = new Date().toISOString().slice(0, 10)
  const past     = trips.filter(t => t.date <  today).sort((a, b) => b.date.localeCompare(a.date))
  const upcoming = trips.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  const earnedMzn   = past.reduce((s, t) => s + t.price_driver_mzn, 0)
  const upcomingMzn = upcoming.reduce((s, t) => s + t.price_driver_mzn, 0)
  const totalMzn    = earnedMzn + upcomingMzn

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white px-6 py-5">
          <p className="text-blue-200 text-sm font-medium uppercase tracking-wide mb-1">Driver Statement</p>
          <h1 className="text-2xl font-bold">{driver.name}</h1>
          {driver.vehicle && <p className="text-blue-200 text-sm mt-1">{driver.vehicle}</p>}
          {driver.phone   && <p className="text-blue-200 text-sm">{driver.phone}</p>}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Completed</p>
            <p className="text-2xl font-bold text-green-800 mt-1">{earnedMzn.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-0.5">{past.length} trip{past.length !== 1 ? 's' : ''} · MZN</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Upcoming</p>
            <p className="text-2xl font-bold text-blue-800 mt-1">{upcomingMzn.toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-0.5">{upcoming.length} trip{upcoming.length !== 1 ? 's' : ''} · MZN</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{totalMzn.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{trips.length} trip{trips.length !== 1 ? 's' : ''} · MZN</p>
          </div>
        </div>

        {/* Upcoming trips */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-blue-50">
            <h2 className="text-sm font-bold text-blue-800">Upcoming trips ({upcoming.length})</h2>
          </div>
          <TripTable trips={upcoming} />
        </div>

        {/* Past trips */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Completed trips ({past.length})</h2>
          </div>
          <TripTable trips={past} />
        </div>

        <p className="text-center text-xs text-gray-300">
          Kitesurf Center Management · Updated {new Date().toLocaleDateString('en-GB')}
        </p>

      </div>
    </div>
  )
}
