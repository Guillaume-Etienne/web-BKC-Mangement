import { describe, it, expect } from 'vitest'
import { loadCheck, readFailed, retryOnce } from './shareLoad'

const ok = <T>(data: T) => ({ data, error: null })
const ko = (code = '57014') => ({ data: null, error: { code, message: 'canceling statement due to statement timeout' } })

describe('loadCheck', () => {
  it('passes data through and stays clean when every read worked', () => {
    const c = loadCheck()
    expect(c.take(ok([1, 2]), [])).toEqual([1, 2])
    expect(c.failed).toBe(false)
  })

  it('falls back AND remembers a failed read (the #065 timeout)', () => {
    const c = loadCheck()
    expect(c.take(ko(), [])).toEqual([])
    expect(c.failed).toBe(true)
  })

  it('counts a network failure (no code) as a failure', () => {
    const c = loadCheck()
    c.take({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }, [])
    expect(c.failed).toBe(true)
  })

  it('does not count "no such row" (.single() on nothing) as a failure', () => {
    const c = loadCheck()
    expect(c.take(ko('PGRST116'), null)).toBeNull()
    expect(c.failed).toBe(false)
  })

  it('does not count a skipped read (null) as a failure', () => {
    const c = loadCheck()
    expect(c.take(null, [])).toEqual([])
    expect(c.failed).toBe(false)
  })

  it('treats empty data with no error as a valid empty answer', () => {
    const c = loadCheck()
    expect(c.take(ok(null), [])).toEqual([])
    expect(c.failed).toBe(false)
  })
})

describe('readFailed', () => {
  it('separates "not found" from "could not ask"', () => {
    expect(readFailed(ko('PGRST116'))).toBe(false)
    expect(readFailed(ko('57014'))).toBe(true)
    expect(readFailed(ok({ id: 1 }))).toBe(false)
  })
})

describe('retryOnce', () => {
  it('does not retry a load that went through', async () => {
    let calls = 0
    expect(await retryOnce(async () => { calls++; return true }, 0)).toBe(true)
    expect(calls).toBe(1)
  })

  it('retries once, and succeeds when the second try does', async () => {
    let calls = 0
    expect(await retryOnce(async () => ++calls === 2, 0)).toBe(true)
    expect(calls).toBe(2)
  })

  it('gives up after the second failure', async () => {
    let calls = 0
    expect(await retryOnce(async () => { calls++; return false }, 0)).toBe(false)
    expect(calls).toBe(2)
  })
})
