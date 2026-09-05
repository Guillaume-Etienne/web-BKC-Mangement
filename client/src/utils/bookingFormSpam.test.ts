import { describe, it, expect } from 'vitest'
import { decideSubmission, MIN_FILL_MS } from './bookingFormSpam'

describe('decideSubmission', () => {
  it('lets a normal submission through untouched', () => {
    expect(decideSubmission('', 60_000, true)).toEqual({ trap: null, drop: false })
  })

  it('drops an empty form that filled the honeypot — that is a bot', () => {
    expect(decideSubmission('http://spam.example', 60_000, false))
      .toEqual({ trap: 'honeypot', drop: true })
  })

  it('drops an empty form sent instantly', () => {
    expect(decideSubmission('', 800, false)).toEqual({ trap: 'too_fast', drop: true })
  })

  // The whole point of the change: a password manager filled the off-screen
  // field of a form a human spent twenty minutes on. It gets filed and flagged.
  it('keeps a human-looking form whose honeypot was autofilled', () => {
    expect(decideSubmission('Jane Doe', 900_000, true))
      .toEqual({ trap: 'honeypot', drop: false })
  })

  // The regression the draft introduced: restored onto step 5, Send pressed
  // two seconds after mount.
  it('keeps a restored draft sent within seconds of mounting', () => {
    expect(decideSubmission('', 2_000, true)).toEqual({ trap: 'too_fast', drop: false })
  })

  it('reports the honeypot first when both tripwires fire', () => {
    expect(decideSubmission('x', 10, false).trap).toBe('honeypot')
  })

  it('treats whitespace in the honeypot as empty', () => {
    expect(decideSubmission('   ', 60_000, true)).toEqual({ trap: null, drop: false })
  })

  it('is inclusive at the boundary', () => {
    expect(decideSubmission('', MIN_FILL_MS, false).trap).toBe(null)
    expect(decideSubmission('', MIN_FILL_MS - 1, false).trap).toBe('too_fast')
  })
})
