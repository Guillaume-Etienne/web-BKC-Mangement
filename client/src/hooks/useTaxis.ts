import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useTable } from './useSupabase'
import type { TaxiDriver, TaxiTrip } from '../types/database'

export function useTaxiDrivers() {
  return useTable<TaxiDriver>('taxi_drivers', { order: 'name' })
}

export interface TaxiTripsState {
  data: TaxiTrip[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useTaxiTrips(): TaxiTripsState {
  const [data, setData]       = useState<TaxiTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tick, setTick]       = useState(0)

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

      setData((rows ?? []) as TaxiTrip[])
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [tick])

  return { data, loading, error, refresh }
}
