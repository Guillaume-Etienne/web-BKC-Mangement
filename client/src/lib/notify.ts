/** App-wide notifications — the replacement for window.alert().
 *
 *  alert() froze the whole tab until clicked, looked like a browser error on a
 *  phone, and blocked the browser automation used to test the app. These
 *  notifications are drawn by <Notifications /> (bottom of the screen, above any
 *  open modal) and never block.
 *
 *  - notifyError: something failed or was NOT saved. It stays until dismissed —
 *    persist.ts relies on that: a rolled-back payment must not scroll past.
 *  - notifyInfo: validation hints, results, "allow pop-ups"… Fades after a few
 *    seconds, unless hovered or focused.
 *
 *  A plain module store (not a React context) so non-React helpers such as the
 *  print utilities can call it too. */

export type NotificationTone = 'error' | 'info'

export interface AppNotification {
  id: number
  tone: NotificationTone
  message: string
  /** The same message raised again while still on screen bumps this instead of
   *  stacking copies (a failing save clicked three times). */
  count: number
}

let items: AppNotification[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

function push(tone: NotificationTone, message: string) {
  const same = items.find(n => n.tone === tone && n.message === message)
  items = same
    ? items.map(n => (n === same ? { ...n, count: n.count + 1 } : n))
    : [...items, { id: nextId++, tone, message, count: 1 }]
  emit()
}

export function notifyError(message: string) { push('error', message) }
export function notifyInfo(message: string) { push('info', message) }

export function dismissNotification(id: number) {
  items = items.filter(n => n.id !== id)
  emit()
}

export function subscribeNotifications(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getNotifications() { return items }
