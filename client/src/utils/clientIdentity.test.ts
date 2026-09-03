import { describe, it, expect } from 'vitest'
import { normEmail, findExistingClient, blanksToFill } from './clientIdentity'

const alice = { id: 'c1', email: 'Alice@Example.COM ' }
const bob = { id: 'c2', email: 'bob@example.com' }
const noMail = { id: 'c3', email: null }
const emptyMail = { id: 'c4', email: '  ' }
const clients = [alice, bob, noMail, emptyMail]

describe('normEmail', () => {
  it('trims and lower-cases', () => {
    expect(normEmail('  Alice@Example.COM ')).toBe('alice@example.com')
  })
  it('treats blank and missing as nothing to compare', () => {
    expect(normEmail('')).toBeNull()
    expect(normEmail('   ')).toBeNull()
    expect(normEmail(null)).toBeNull()
    expect(normEmail(undefined)).toBeNull()
  })
})

describe('findExistingClient', () => {
  it('returns null when nothing matches', () => {
    expect(findExistingClient(clients, { email: 'nobody@example.com' })).toBeNull()
    expect(findExistingClient(clients, {})).toBeNull()
  })

  it('matches on email regardless of case and surrounding spaces', () => {
    const m = findExistingClient(clients, { email: ' ALICE@example.com' })
    expect(m).toEqual({ client: alice, reason: 'email' })
  })

  it('never matches two clients who both have no email', () => {
    expect(findExistingClient(clients, { email: null })).toBeNull()
    expect(findExistingClient(clients, { email: '   ' })).toBeNull()
  })

  it('prefers the explicit link over the email — a person can book from another address', () => {
    const m = findExistingClient(clients, { linkedClientId: 'c2', email: 'alice@example.com' })
    expect(m).toEqual({ client: bob, reason: 'linked' })
  })

  it('falls back to the email when the linked client no longer exists', () => {
    const m = findExistingClient(clients, { linkedClientId: 'deleted', email: 'alice@example.com' })
    expect(m).toEqual({ client: alice, reason: 'email' })
  })

  it('never matches on a name — that is the whole point', () => {
    // Two guests called Julie must stay two rows: these paths run unattended.
    const julies = [{ id: 'j1', email: 'julie1@example.com' }, { id: 'j2', email: 'julie2@example.com' }]
    expect(findExistingClient(julies, { email: 'julie3@example.com' })).toBeNull()
  })
})

interface Contact { phone: string | null; email: string | null; nationality?: string | null }

describe('blanksToFill', () => {
  it('fills only what the existing row leaves empty', () => {
    const existing: Contact = { phone: null, email: 'kept@example.com', nationality: '' }
    const incoming: Partial<Contact> = { phone: '+33 6 00 00 00 00', email: 'new@example.com', nationality: 'France' }
    expect(blanksToFill(existing, incoming)).toEqual({
      phone: '+33 6 00 00 00 00',
      nationality: 'France',
    })
  })

  it('never proposes an empty value', () => {
    const existing: Contact = { phone: null, email: null }
    expect(blanksToFill(existing, { phone: '', email: null })).toEqual({})
  })

  it('returns an empty patch when the existing row is already complete', () => {
    const existing: Contact = { phone: '+1', email: 'a@b.c' }
    expect(blanksToFill(existing, { phone: '+2', email: 'x@y.z' })).toEqual({})
  })

  it('ignores keys the incoming object does not carry', () => {
    const existing: Contact = { phone: null, email: null }
    expect(blanksToFill(existing, { phone: '+1' })).toEqual({ phone: '+1' })
  })
})
