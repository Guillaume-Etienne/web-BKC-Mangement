import { useEffect } from 'react'
import { trackView } from '../lib/usageTracker'

/** Count the tab a page is showing, on arrival and each time it changes:
 *  `useTrackTab('taxis', tab)` → key `taxis#drivers`. The page itself is counted
 *  once in App; this is only the finer grain (Options → Database → Usage). */
export function useTrackTab(page: string, tab: string): void {
  // The database only accepts [a-z0-9_#-]: normalise instead of losing the count.
  useEffect(() => { trackView(`${page}#${tab.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`) }, [page, tab])
}
