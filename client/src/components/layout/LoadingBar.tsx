import { useEffect, useState, useSyncExternalStore } from 'react'
import { subscribeLoading, isLoading } from '../../lib/loadingTracker'

/** Thin green bar along the bottom edge of the navigation while anything is
 *  still loading. Shown only after 150 ms so instant answers don't flicker. */
export default function LoadingBar() {
  const loading = useSyncExternalStore(subscribeLoading, isLoading)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!loading) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(t)
  }, [loading])

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-0 right-0 -bottom-px h-[3px] overflow-hidden transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="loading-bar-slide h-full w-1/3 bg-green-500" />
    </div>
  )
}
