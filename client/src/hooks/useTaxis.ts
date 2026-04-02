import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useTable } from './useSupabase'
import type { TaxiDriver, TaxiTrip } from '../types/database'

/**
 * Normalise un row brut Supabase vers TaxiTrip.
 * Handles old schema (price_client_mzn, margin_centre_mzn) gracefully:
 * maps to the new simplified model (price_eur, price_driver_mzn, margin_manager_mzn).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTrip(raw: any): TaxiTrip {
  const exchange_rate    = Number(raw.exchange_rate) || 65
  const margin_manager_mzn = raw.margin_manager_mzn ?? raw.taxi_manager_margin ?? 0
  const price_driver_mzn   = raw.price_driver_mzn   ?? raw.price_cost_to_driver ?? 0

  // price_eur: use directly if present, else derive from old price_client_mzn
  const price_eur = raw.price_eur != null
    ? Number(raw.price_eur)
    : Math.round((raw.price_client_mzn ?? raw.price_paid_by_client ?? 0) / exchange_rate)

  return {
    id:              raw.id,
    date:            raw.date,
    start_time:      raw.start_time,
    type:            raw.type,
    status:          raw.status ?? 'confirmed',
    taxi_driver_id:  raw.taxi_driver_id  ?? null,
    booking_id:      raw.booking_id      ?? null,
    nb_persons:      raw.nb_persons      ?? 1,
    nb_luggage:      raw.nb_luggage      ?? 0,
    nb_boardbags:    raw.nb_boardbags    ?? 0,
    notes:           raw.notes           ?? null,
    price_eur,
    price_driver_mzn,
    margin_manager_mzn,
    exchange_rate,
  }
}

export function useTaxiDrivers() {
  return useTable<TaxiDriver>('taxi_drivers', { order: 'name' })
}

export interface TaxiTripsState {
  data: TaxiTrip[]
  loading: boolean
  error: string | null
  /** true si la DB a encore les anciennes colonnes (migration SQL nécessaire) */
  schemaOutdated: boolean
  refresh: () => void
}

export function useTaxiTrips(): TaxiTripsState {
  const [data, setData]                   = useState<TaxiTrip[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [schemaOutdated, setSchemaOutdated] = useState(false)
  const [tick, setTick]                   = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const run = async () => {
      const { data: rows, error: err } = await supabase
        .from('taxi_trips')
        .select('*')
        .order('date', { ascending: false })

      if (cancelled) return

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawRows = (rows ?? []) as any[]

      // Detect old schema: presence of legacy column, absence of new ones
      const isOld = rawRows.length > 0
        && 'price_paid_by_client' in rawRows[0]
        && !('price_eur' in rawRows[0])
      setSchemaOutdated(isOld)
      setData(rawRows.map(normalizeTrip))
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [tick])

  return { data, loading, error, schemaOutdated, refresh }
}
