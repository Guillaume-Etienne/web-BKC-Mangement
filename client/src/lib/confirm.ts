/** App-wide confirmation — the replacement for window.confirm().
 *
 *    if (!await askConfirm(`Delete ${name}?`)) return
 *
 *  Drawn by <ConfirmHost /> as a native modal dialog: the page behind is inert,
 *  focus starts on Cancel (an Enter pressed by reflex keeps the data), Esc and
 *  the mobile back gesture answer "no". Unlike confirm(), it is asynchronous — the
 *  caller must await it.
 *
 *  Defaults fit the common case, a deletion: a red "Delete" button. Pass
 *  `confirmLabel` / `tone: 'neutral'` for anything else (export, discard…). */

export interface ConfirmOptions {
  /** Defaults to the localised "Delete". */
  confirmLabel?: string
  /** Defaults to the localised "Cancel". */
  cancelLabel?: string
  /** 'danger' (default): red confirm button. 'neutral': blue. */
  tone?: 'danger' | 'neutral'
}

export interface ConfirmRequest extends ConfirmOptions {
  id: number
  message: string
  resolve: (ok: boolean) => void
}

// A queue, not a single slot: a second question asked while one is on screen
// waits for its turn instead of silently replacing (and never answering) it.
let queue: ConfirmRequest[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

export function askConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise(resolve => {
    queue = [...queue, { ...options, id: nextId++, message, resolve }]
    emit()
  })
}

/** Answers the question on screen and moves on to the next one. */
export function answerConfirm(id: number, ok: boolean) {
  const req = queue.find(r => r.id === id)
  if (!req) return
  queue = queue.filter(r => r !== req)
  emit()
  req.resolve(ok)
}

export function subscribeConfirm(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getCurrentConfirm(): ConfirmRequest | null { return queue[0] ?? null }
