import { useState, useEffect, useCallback, useId, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { cacheKey, getCached, setCached, readGeneration } from '../lib/tableCache'
import { useDataErrorReporter } from '../contexts/DataErrorsContext'

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
  // Rows already read this session are shown at once, then re-read in the
  // background — lib/tableCache.ts, which also drops them on any write.
  const key = cacheKey(table, options?.select ?? '*', options?.order, options?.ascending)
  const [data, setData]       = useState<T[]>(() => getCached<T>(key) ?? [])
  const [loading, setLoading] = useState(() => getCached<T>(key) === undefined)
  const [error, setError]     = useState<string | null>(null)
  const [tick, setTick]       = useState(0)
  // While rows are on screen, a re-read (background, or a realtime refresh)
  // must not flip `loading` back on: pages that swap their content for a
  // spinner on `loading` would blank out over a refresh nobody asked to see.
  const hasData = useRef(!loading)

  // Le `error` ci-dessus existe depuis toujours et *aucun* des 67 appels du
  // repo ne le lisait : une lecture refusée rendait `[]` et l'écran affichait
  // zéro. Plutôt que de corriger 67 sites, le hook signale lui-même sa panne au
  // bandeau de la page. Hors fournisseur (pages partagées), `report` ne fait
  // rien — voir contexts/DataErrorsContext.tsx.
  const { report } = useDataErrorReporter()
  const errorKey = useId()

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    if (!hasData.current) setLoading(true)
    setError(null)

    const run = async () => {
      const gen = readGeneration(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from(table).select(options?.select ?? '*')
      if (options?.order) {
        query = query.order(options.order, { ascending: options.ascending ?? true })
      }
      const { data: rows, error: err } = await query
      if (cancelled) return
      // A write to this table landed while we were reading: these rows predate
      // it. Read again rather than put them on screen or in the cache.
      if (!err && gen !== readGeneration(table)) { setTick(t => t + 1); return }
      if (err) { setError(err.message); report(errorKey, { table, message: err.message }) }
      else {
        setData((rows ?? []) as T[])
        setCached(key, rows ?? [])
        hasData.current = true
        report(errorKey, null)
      }
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [table, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Une page qu'on quitte ne doit pas laisser sa panne au bandeau de la
  // suivante : AccountingPage en défaut, puis Bookings, et le bandeau parlerait
  // encore de `room_rates` sur un écran qui ne la lit pas.
  useEffect(() => () => report(errorKey, null), [errorKey, report])

  // Realtime: re-fetch on any DB change for this table
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => { refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [table, refresh])

  return { data, loading, error, refresh }
}
