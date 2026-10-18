import { describe, it, expect, beforeEach } from 'vitest'
import {
  cacheKey, getCached, setCached, invalidateTable, clearTableCache,
  writtenTable, invalidateForRequest, readGeneration,
} from './tableCache'

const REST = 'https://x.supabase.co/rest/v1'

describe('tableCache', () => {
  beforeEach(() => clearTableCache())

  it('keeps rows per query', () => {
    const k = cacheKey('payments', '*', 'date', false)
    setCached(k, [{ id: 1 }])
    expect(getCached(k)).toEqual([{ id: 1 }])
    expect(getCached(cacheKey('payments', '*', 'date', true))).toBeUndefined()
  })

  it('drops a table, and the queries that embed it', () => {
    const bookings = cacheKey('bookings', '*, client:clients(first_name, last_name)')
    const clients  = cacheKey('clients', '*')
    const payments = cacheKey('payments', '*')
    for (const k of [bookings, clients, payments]) setCached(k, [])
    invalidateTable('clients')
    expect(getCached(clients)).toBeUndefined()
    expect(getCached(bookings)).toBeUndefined()   // client names live in it
    expect(getCached(payments)).toEqual([])
  })

  it('reads the written table off a request', () => {
    expect(writtenTable(`${REST}/payments?id=eq.1`, 'PATCH')).toBe('payments')
    expect(writtenTable(`${REST}/booking_charges`, 'POST')).toBe('booking_charges')
    expect(writtenTable(`${REST}/payments?id=eq.1`, 'DELETE')).toBe('payments')
    expect(writtenTable(`${REST}/payments?select=*`, 'GET')).toBeNull()
    expect(writtenTable(`${REST}/payments?select=*`, undefined)).toBeNull()
    expect(writtenTable(`${REST}/rpc/get_db_stats`, 'POST')).toBe('*')
    expect(writtenTable('https://x.supabase.co/functions/v1/send-email', 'POST')).toBe('*')
    expect(writtenTable('https://x.supabase.co/auth/v1/token', 'POST')).toBeNull()
  })

  it('a write drops the cache; a read does not', () => {
    const k = cacheKey('payments', '*')
    setCached(k, [{ id: 1 }])
    invalidateForRequest(`${REST}/payments?select=*`, 'GET')
    expect(getCached(k)).toEqual([{ id: 1 }])
    invalidateForRequest(`${REST}/payments`, 'POST')
    expect(getCached(k)).toBeUndefined()
  })

  it('an RPC or a function drops everything', () => {
    setCached(cacheKey('payments', '*'), [])
    setCached(cacheKey('lessons', '*'), [])
    invalidateForRequest('https://x.supabase.co/functions/v1/send-email', 'POST')
    expect(getCached(cacheKey('payments', '*'))).toBeUndefined()
    expect(getCached(cacheKey('lessons', '*'))).toBeUndefined()
  })

  it('tells a read that a write landed while it was in flight', () => {
    const before = readGeneration('payments')
    invalidateForRequest(`${REST}/lessons`, 'POST')
    expect(readGeneration('payments')).toBe(before)        // another table: still valid
    invalidateForRequest(`${REST}/payments`, 'POST')
    expect(readGeneration('payments')).not.toBe(before)    // its table: stale
    const mid = readGeneration('payments')
    invalidateForRequest(`${REST}/rpc/anything`, 'POST')
    expect(readGeneration('payments')).not.toBe(mid)       // an RPC may have written it
  })
})
