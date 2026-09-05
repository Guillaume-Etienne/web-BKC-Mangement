import { supabase } from '../lib/supabase'
import { classifyError } from './recoverableError'

/** Sending a crash back from a visitor's phone, so gui learns about it.
 *
 *  Guests on a shared link have no account, no console, and no support channel.
 *  Until now the only way a failure reached us was the visitor thinking to
 *  phone and reading a sentence off the screen — which is how we learned about
 *  the 2026-09-04 booking-form crash, and only because that client bothered.
 *  Everyone who just gave up left no trace anywhere.
 *
 *  Three rules, because this runs on a page that is already broken:
 *    - it never throws and never awaits — a reporter that can fail is another
 *      crash on top of the one being reported;
 *    - it says nothing to the visitor. They have a screen that tells them what
 *      to do; a "an error report was sent" notice would only add worry;
 *    - it is capped and deduplicated. A render loop can fire the same error
 *      hundreds of times a second, and this table is open to anonymous inserts.
 *
 *  ⚠️ Never send the share token. It is the credential to the page. The path
 *  and the KIND of link are enough to know where to look.
 *
 *  Requires the `client_errors` table (migration 2026-09-05). Without it the
 *  insert fails and is swallowed: we are blind, exactly as we were before. */

export type ErrorSource = 'boundary' | 'form-submit' | 'unhandled'

const MAX_PER_SESSION = 5
let sent = 0
const seen = new Set<string>()

/** The page, with the token taken out: "/?share=booking_form_" tells us it was
 *  a booking form without handing anyone the key to that particular one. */
function safePage(): string {
  try {
    const share = new URLSearchParams(window.location.search).get('share')
    const kind = share ? share.replace(/[0-9a-f]{8}-?[0-9a-f-]*$/i, '') : ''
    return `${window.location.pathname}${kind ? `?share=${kind}` : ''}`.slice(0, 200)
  } catch {
    return ''
  }
}

export function reportClientError(err: unknown, source: ErrorSource, recovered = false): void {
  try {
    const message = err instanceof Error ? err.message : String(err ?? '')
    if (!message) return

    const fingerprint = `${source}|${message}`
    if (seen.has(fingerprint) || sent >= MAX_PER_SESSION) return
    seen.add(fingerprint)
    sent++

    // Fire and forget on purpose: awaiting would hold up the error screen the
    // visitor is waiting for, and a rejection here has nowhere to go.
    void supabase.from('client_errors').insert([{
      kind: classifyError(err),
      source,
      message: message.slice(0, 500),
      page: safePage(),
      user_agent: (navigator.userAgent || '').slice(0, 400),
      app_lang: (navigator.language || '').slice(0, 8),
      recovered,
    }]).then(undefined, () => { /* blind is the old normal, not a new failure */ })
  } catch {
    /* reporting a crash must never be the crash */
  }
}

/** The whole other half of the problem: an error thrown inside a promise or an
 *  event handler never reaches a React error boundary. That is the class the
 *  form's Send button belonged to — an exception left it spinning on "Sending…"
 *  forever with nobody, on either end, any the wiser. Installed once, in main. */
export function installGlobalErrorReporting(): void {
  window.addEventListener('unhandledrejection', e => {
    reportClientError(e.reason, 'unhandled')
  })
  window.addEventListener('error', e => {
    // Ignore failures to load a resource (img, script): the event carries no
    // usable message and the boundary already covers the chunks that matter.
    if (e.error || e.message) reportClientError(e.error ?? e.message, 'unhandled')
  })
}
