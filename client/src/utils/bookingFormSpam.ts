/** The anti-spam trap, and the one rule that keeps it from eating real clients.
 *
 *  The public form has two tripwires: an off-screen field (`bkc_extra`) that a
 *  human never sees, and a minimum fill time. Until 2026-09-05 either one, on
 *  its own, answered the visitor with the 🎉 "thank you" screen while inserting
 *  nothing — a failure invisible on BOTH sides: the client believes they filed
 *  their trip, gui never receives it, and there is nothing anywhere to look at.
 *
 *  Two ways a real person trips them:
 *    - a password manager fills every field on the page, `bkc_extra` included;
 *    - since the draft landed, a returning visitor is restored straight onto
 *      step 5 and can press Send two seconds after the page mounts.
 *
 *  So the trap no longer decides alone. It drops the submission only when there
 *  is also nothing in the form a human would have typed; otherwise the
 *  submission is filed AND flagged, and gui sees the flag in Requests →
 *  Submissions. A junk row he deletes in one click costs nothing; a lost
 *  booking costs a client. */

export type SpamTrap = 'honeypot' | 'too_fast'

/** No human crosses a five-step wizard faster than this from a cold start.
 *  A visitor coming back to a saved draft can, which is exactly why tripping
 *  it is no longer enough to throw the answers away. */
export const MIN_FILL_MS = 3000

export interface TrapDecision {
  /** Which tripwire fired, or null. Recorded in the payload when the
   *  submission is filed anyway, so a flagged row can be told apart. */
  trap: SpamTrap | null
  /** Insert nothing and show the success screen — silent on purpose, so a bot
   *  learns nothing about what caught it. */
  drop: boolean
}

export function decideSubmission(
  honeypot: string,
  elapsedMs: number,
  looksHuman: boolean,
): TrapDecision {
  const trap: SpamTrap | null =
    honeypot.trim() ? 'honeypot'
    : elapsedMs < MIN_FILL_MS ? 'too_fast'
    : null
  return { trap, drop: trap !== null && !looksHuman }
}
