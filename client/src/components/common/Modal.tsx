import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { pushModal, removeModal } from '../../lib/modalStack'

interface Props {
  /** Called whenever the browser closes the dialog (Esc, mobile back gesture) or,
   *  with `lightDismiss`, on a click outside the card. The parent unmounts the modal
   *  in response, exactly as for its own Cancel button. */
  onClose: () => void
  /** Also close on a click/tap outside the card. Off by default: most modals are
   *  forms, and a stray tap on the backdrop must not throw away what was typed. */
  lightDismiss?: boolean
  /** id of the card's heading, so screen readers announce its title. */
  labelledBy?: string
  /** Accessible name when the card has no heading to point at. */
  label?: string
  /** false: Esc and the back gesture do nothing (a blocking "Saving…" screen). */
  dismissible?: boolean
  /** Ask this before Esc / the back gesture close a long form, so a reflex Esc
   *  (meant for a date picker, say) does not wipe it. The form's own Cancel button
   *  is a deliberate click and is not affected. */
  confirmDismiss?: string
  /** Where the card sits in the screen, like the old overlay's flex classes
   *  (`items-center justify-center p-4`, `items-end sm:items-center`, …). */
  className?: string
  /** Backdrop dimming. */
  backdropClassName?: string
  children: ReactNode
}

/** A native modal <dialog>, opened with showModal() on mount.
 *
 *  The browser then gives us for free what the hand-made `fixed inset-0` overlays
 *  never had: Esc and the Android back gesture close it, focus stays inside and
 *  returns to the button that opened it, the page behind is inert, and it sits in
 *  the top layer above every z-index (so stacked modals just work). Focus also
 *  goes back to the opener when the parent unmounts the modal (Save, Cancel).
 *
 *  The <dialog> is a transparent full-screen shell, and the card inside it is the
 *  caller's own markup — so a hand-made overlay converts by swapping its outer div
 *  for <Modal>, without touching the card. A click that lands on the shell itself
 *  is therefore a click outside the card.
 *
 *  Initial focus: React's `autoFocus` fires while the dialog is still closed (hidden)
 *  and is lost, so mark the field with `data-autofocus` instead. */
export default function Modal({
  onClose, lightDismiss = false, labelledBy, label, dismissible = true, confirmDismiss,
  className = 'items-center justify-center p-4',
  backdropClassName = 'backdrop:bg-black/50', children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)
  const unmounted = useRef(false)

  // Layout effect: the cleanup must run while the element is still in the document.
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    unmounted.current = false
    if (!dialog.open) dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    // Lets <Notifications /> render inside the innermost modal (lib/modalStack).
    pushModal(dialog)
    return () => {
      removeModal(dialog)
      // Most modals close by the parent unmounting them (Save, Cancel, ✕) — and a
      // dialog merely removed from the page does NOT hand focus back to the button
      // that opened it; only close() does. The `close` event this queues is ignored
      // below: the parent is already done with it.
      unmounted.current = true
      dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-label={label}
      // `cancel` precedes an Esc / back-gesture close and can veto it.
      onCancel={e => {
        if (!dismissible || (confirmDismiss && !window.confirm(confirmDismiss))) e.preventDefault()
      }}
      // Ignore a stale close: after an unmount (see the cleanup above), and in
      // StrictMode, where the dev-only remount reopens the dialog before the close
      // event of the first cleanup arrives.
      onClose={() => { if (!unmounted.current && !ref.current?.open) onClose() }}
      // Light dismiss needs the press AND the release outside the card, so a text
      // selection dragged out of a field onto the backdrop does not close the form.
      onPointerDown={e => { pressedOutside.current = e.target === e.currentTarget }}
      onClick={e => {
        // React events bubble through the component tree: without this, a click inside
        // reaches whatever row the modal is rendered in (the planning cell, the
        // accounting line) and fires its own onClick.
        e.stopPropagation()
        if (lightDismiss && pressedOutside.current && e.target === e.currentTarget) onClose()
        pressedOutside.current = false
      }}
      // The browser's dialog styles are overridden here (Tailwind's preflight already
      // zeroes margin, padding and border): a fixed full-screen transparent shell with
      // no max size. `open:flex` scopes the display to the open state — a display set
      // unconditionally would show the dialog even when closed.
      className={`fixed inset-0 h-full w-full max-h-none max-w-none overflow-y-auto bg-transparent
        text-inherit open:flex ${backdropClassName} ${className}`}
    >
      {children}
    </dialog>
  )
}
