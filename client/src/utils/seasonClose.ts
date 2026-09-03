/** "14 demandes sans suite — clôturer."
 *
 *  ENQUIRIES.md asked for this and it was never built: "Clôture de saison
 *  assumée. gui décide, pas un compteur." Without it the working list only ever
 *  grows — an enquiry from last February that never answered stays open, keeps
 *  its silence counter ticking, and keeps appearing in "Waiting on you" until
 *  the list is long enough that gui stops reading it. A to-do list that is never
 *  emptied stops being a to-do list.
 *
 *  Two ways to be "not going to happen", and they are different facts:
 *    • **the date has passed** — they said February, February is over, they did
 *      not come. Silence is irrelevant here: even a chatty exchange that ended
 *      three weeks ago is over if the month is gone.
 *    • **no date and a long silence** — nothing to expire, so the only evidence
 *      is that nobody has said anything for a very long time.
 *
 *  ⚠️ Never automatic, and never a background job. This module only *proposes* a
 *  list; the app shows the names and gui presses the button. An enquiry closed
 *  by a counter is a client written off by a machine.
 */
import type { Enquiry } from '../types/database'
import { fmtArrivalMonth, isSettled, silenceDays } from './enquiries'
import { toISOMonth } from './dates'

/** Long enough that nobody would call it "still in progress". Deliberately far
 *  above SILENCE_WARN_DAYS (7): that one says "chase them today", this one says
 *  "this never happened". */
export const STALE_SILENCE_DAYS = 60

export interface StaleEnquiry {
  enquiry: Enquiry
  /** Shown next to the name, so gui closes with his eyes open. */
  reason: string
}

/** Open enquiries that are, on the evidence, not going to happen.
 *
 *  Sorted oldest-silence first: if the list is long, what gui reads first is
 *  what has been dead longest. */
export function staleEnquiries(enquiries: Enquiry[], now: Date = new Date()): StaleEnquiry[] {
  const thisMonth = toISOMonth(now)
  const out: StaleEnquiry[] = []

  for (const e of enquiries) {
    if (isSettled(e.status)) continue
    const silence = silenceDays(e.last_contact_at, now)

    if (e.arrival_month && e.arrival_month < thisMonth) {
      // The month is spelled out, not left as 2026-01: gui has to read this line
      // and decide, and a badly typed month (January meaning next January) shows
      // up here as an obvious mistake rather than being closed in silence.
      out.push({ enquiry: e, reason: `was coming in ${fmtArrivalMonth(e.arrival_month)} — that month is over` })
      continue
    }
    // Only when there is no date to expire: someone who says "next December"
    // and then goes quiet is not stale, they are early.
    if (!e.arrival_month && silence >= STALE_SILENCE_DAYS) {
      out.push({ enquiry: e, reason: `no dates, and silent for ${silence} days` })
    }
  }

  return out.sort((a, b) =>
    silenceDays(b.enquiry.last_contact_at, now) - silenceDays(a.enquiry.last_contact_at, now)
    || a.enquiry.name.localeCompare(b.enquiry.name)
  )
}

/** What goes in `lost_reason`. Short, and honest about who decided: reading
 *  "lost" with no reason six months later tells nobody anything. */
export const SEASON_CLOSE_REASON = 'no answer — closed with the season'
