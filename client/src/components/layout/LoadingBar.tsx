import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { subscribeLoading, getLoadingProgress } from '../../lib/loadingTracker'

/** Green progress bar along the bottom edge of the navigation. It grows left →
 *  right as requests settle and only reaches the right edge once everything is
 *  loaded, then fades out. Shown only after 150 ms so instant answers don't flash. */
export default function LoadingBar() {
  const progress = useSyncExternalStore(subscribeLoading, getLoadingProgress)
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const shownRef = useRef(false)

  // Show after a short delay; on completion, fill, fade, then reset to 0.
  useEffect(() => {
    if (progress < 1) {
      // A new load starting while the bar fades out: bring it back, from the start.
      if (shownRef.current) { setVisible(true); setWidth(w => (w >= 100 ? 10 : w)); return }
      const t = setTimeout(() => { shownRef.current = true; setVisible(true) }, 150)
      return () => clearTimeout(t)
    }
    if (!shownRef.current) return
    setWidth(100)
    const fade = setTimeout(() => setVisible(false), 350)
    const reset = setTimeout(() => { shownRef.current = false; setWidth(0) }, 700)
    return () => { clearTimeout(fade); clearTimeout(reset) }
  }, [progress])

  // While loading: 10 % → 90 % with the settled share, never moving backwards
  // when a new request joins the burst. Only completion takes it to 100 %.
  useEffect(() => {
    if (progress < 1) setWidth(w => Math.max(w, 10 + 80 * progress))
  }, [progress])

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-0 right-0 -bottom-px h-[3px] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`h-full bg-green-500 ${width === 0 ? '' : 'transition-[width] duration-300 ease-out'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
