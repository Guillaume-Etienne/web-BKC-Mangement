import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  dismissNotification, getNotifications, subscribeNotifications, type AppNotification,
} from '../../lib/notify'
import { getTopModal, subscribeModals } from '../../lib/modalStack'

/** How long an info notification stays when nobody is looking at it. Errors stay. */
const INFO_MS = 8000

/** The notification stack (see lib/notify.ts), bottom of the screen.
 *
 *  Rendered into the innermost open modal when there is one: a modal makes the
 *  rest of the page inert and covers it, so a notification left in the page would
 *  be invisible and its ✕ unclickable — exactly when a Save inside the modal fails. */
export default function Notifications() {
  const items = useSyncExternalStore(subscribeNotifications, getNotifications)
  const host = useSyncExternalStore(subscribeModals, getTopModal)
  if (items.length === 0) return null

  const stack = (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed z-[100] bottom-4 inset-x-4 sm:left-auto sm:w-96 flex flex-col gap-2"
    >
      {items.map((n, i) => (
        <NotificationCard key={n.id} n={n} nextId={items[i + 1]?.id ?? items[i - 1]?.id} />
      ))}
    </div>
  )
  return createPortal(stack, host ?? document.body)
}

function NotificationCard({ n, nextId }: { n: AppNotification; nextId?: number }) {
  const [paused, setPaused] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Info fades on its own — but not while hovered or focused, or it would vanish
  // under the pointer of someone reading it.
  useEffect(() => {
    if (n.tone !== 'info' || paused) return
    const t = setTimeout(() => dismissNotification(n.id), INFO_MS)
    return () => clearTimeout(t)
  }, [n.tone, n.id, n.count, paused])

  function close() {
    // Closing the focused card would drop focus to <body>: hand it to the next card.
    if (document.activeElement === closeRef.current && nextId !== undefined) {
      document.querySelector<HTMLButtonElement>(`[data-notification-close="${nextId}"]`)?.focus()
    }
    dismissNotification(n.id)
  }

  const error = n.tone === 'error'
  return (
    <div
      role={error ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg text-sm ${
        error
          ? 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100'
      }`}
    >
      <span aria-hidden="true" className="shrink-0">{error ? '⚠️' : 'ℹ️'}</span>
      {/* Messages carry the database's own words and \n-separated lists. */}
      <p className="flex-1 min-w-0 whitespace-pre-line break-words max-h-60 overflow-y-auto">
        {n.message}
        {n.count > 1 && <span className="ml-1 text-xs font-semibold opacity-70">×{n.count}</span>}
      </p>
      <button
        ref={closeRef}
        type="button"
        data-notification-close={n.id}
        onClick={close}
        aria-label="Dismiss"
        className="shrink-0 -mr-1 px-1.5 rounded opacity-60 hover:opacity-100 font-bold"
      >✕</button>
    </div>
  )
}
