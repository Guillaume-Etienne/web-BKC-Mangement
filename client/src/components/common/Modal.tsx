import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  /** Called whenever the browser closes the dialog (Esc, mobile back gesture).
   *  The parent unmounts the modal in response, exactly as for its own Cancel button. */
  onClose: () => void
  /** id of the dialog's heading, so screen readers announce its title. */
  labelledBy?: string
  /** Size and layout of the card (width, max-height, flex…). */
  className?: string
  children: ReactNode
}

/** A native modal <dialog>, opened with showModal() on mount.
 *
 *  The browser then gives us for free what the hand-made `fixed inset-0` overlays
 *  never had: Esc and the Android back gesture close it, focus stays inside and
 *  returns to the button that opened it, the page behind is inert, and it sits in
 *  the top layer above every z-index (so stacked modals just work).
 *
 *  Click outside does NOT close it on purpose: these are forms, and a stray tap on
 *  the backdrop must not throw away what was typed. */
export default function Modal({ onClose, labelledBy, className = '', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    // The guard matters in StrictMode: the effect runs twice on an already-open dialog,
    // and showModal() on an open dialog throws.
    if (dialog && !dialog.open) dialog.showModal()
    // No close() in a cleanup: unmounting removes the element, which takes it out of
    // the top layer — and a close() here would fire onClose after the parent is done.
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // React events bubble through the component tree: without this, a click inside
      // reaches whatever row the modal is rendered in (the planning cell, the
      // accounting line) and fires its own onClick.
      onClick={e => e.stopPropagation()}
      // Tailwind's preflight sets margin:0 on every element, which un-centres a
      // dialog: m-auto puts back the browser's centring. `open:` scopes the flex
      // layout to the open state — a display set unconditionally would show the
      // dialog even when closed.
      className={`m-auto p-0 w-[calc(100%-2rem)] rounded-lg shadow-lg bg-white dark:bg-gray-900 text-inherit
        backdrop:bg-black/50 open:flex open:flex-col ${className}`}
    >
      {children}
    </dialog>
  )
}
