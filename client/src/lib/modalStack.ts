/** The open modal <dialog>s, innermost last (kept by components/common/Modal).
 *
 *  Why anyone else needs it: while a modal is open, everything outside it is
 *  inert and drawn underneath it (top layer). A notification raised by a failing
 *  Save inside a modal would be hidden and unclickable — so <Notifications />
 *  renders into the innermost open modal instead of the page. */

let stack: HTMLDialogElement[] = []
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

export function pushModal(el: HTMLDialogElement) { stack = [...stack, el]; emit() }
export function removeModal(el: HTMLDialogElement) { stack = stack.filter(d => d !== el); emit() }

export function subscribeModals(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getTopModal(): HTMLDialogElement | null { return stack[stack.length - 1] ?? null }
