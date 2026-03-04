import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface QueryState<T> {
  data: T[]
  loading: boolean
  error: string | null
  refresh: () => void
}

/** Generic hook: SELECT * FROM table */
export function useTable<T>(
  table: string,
  options?: { order?: string; ascending?: boolean; select?: string }
): QueryState<T> {
  const [data, setData]       = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tick, setTick]       = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const run = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from(table).select(options?.select ?? '*')
      if (options?.order) {
        query = query.order(options.order, { ascending: options.ascending ?? true })
      }
      const { data: rows, error: err } = await query
      if (cancelled) return
      if (err) setError(err.message)
      else setData((rows ?? []) as T[])
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [table, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refresh }
}
