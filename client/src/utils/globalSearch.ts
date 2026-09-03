/** One search box for the whole app.
 *
 *  The complaint this answers, in gui's words: "devoir chercher l'info dans
 *  plusieurs pages". A person's name can be on a client record, on an enquiry
 *  that never became one, inside a note, or only on a booking — and knowing
 *  which screen to open first is exactly the thing you cannot know when you are
 *  looking for something.
 *
 *  Ranking rules, in order: a name that starts with what you typed, then a name
 *  that contains it, then a contact detail, then the body text (messages and
 *  notes). Body-text matches come last on purpose — they are the widest net and
 *  would otherwise bury the obvious answer.
 */
import { norm } from './enquiries'

export type SearchKind = 'client' | 'booking' | 'enquiry'

export interface SearchClient {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  passport_number?: string | null
  notes?: string | null
}

export interface SearchBooking {
  id: string
  booking_number: number
  client_id: string
  check_in: string
  check_out: string
  status: string
  notes?: string | null
}

export interface SearchEnquiry {
  id: string
  name: string
  email: string | null
  phone: string | null
  message: string | null
  status: string
  arrival_month: string | null
}

export interface SearchIndex {
  clients: SearchClient[]
  bookings: SearchBooking[]
  enquiries: SearchEnquiry[]
  /** enquiry id → its note bodies. */
  notesByEnquiry: Record<string, string[]>
  /** client id → the dated notes written on their file. */
  notesByClient?: Record<string, string[]>
}

export interface SearchHit {
  /** Unique across kinds, for React keys. */
  id: string
  kind: SearchKind
  /** The row to open. */
  targetId: string
  title: string
  subtitle: string | null
  /** Why this row is in the list, when the match was not on the title. */
  why: string | null
  score: number
}

export const EMPTY_INDEX: SearchIndex = {
  clients: [], bookings: [], enquiries: [], notesByEnquiry: {}, notesByClient: {},
}

// Higher wins. The gaps are wide so a later tie-break never crosses a tier.
const NAME_PREFIX = 100
const NAME_PART = 80
const NUMBER_HIT = 95
const CONTACT = 50
const BODY = 20

function nameScore(name: string, q: string): number {
  const n = norm(name)
  if (n.startsWith(q)) return NAME_PREFIX
  // Also a prefix when it starts a word: "rull" should find "Michel Rulliat".
  if (n.split(/\s+/).some(w => w.startsWith(q))) return NAME_PREFIX - 5
  if (n.includes(q)) return NAME_PART
  return 0
}

function contactScore(fields: (string | null | undefined)[], q: string): boolean {
  return fields.some(f => f && norm(f).includes(q))
}

/** A short window of the body text around the match, so the row shows the
 *  sentence that matched rather than making gui open it to find out. */
function excerpt(text: string, q: string, width = 70): string {
  const at = norm(text).indexOf(q)
  if (at < 0) return text.slice(0, width)
  const start = Math.max(0, at - width / 3)
  const raw = text.slice(start, start + width).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${raw}${start + width < text.length ? '…' : ''}`
}

function bodyHit(texts: (string | null | undefined)[], q: string): string | null {
  for (const t of texts) {
    if (t && norm(t).includes(q)) return excerpt(t, q)
  }
  return null
}

/**
 * Everything matching `query`, best first.
 *
 * A query shorter than two characters returns nothing: one letter matches half
 * the database and the palette would open onto noise.
 */
export function searchEverything(index: SearchIndex, query: string, limit = 20): SearchHit[] {
  const q = norm(query.trim())
  if (q.length < 2) return []

  const hits: SearchHit[] = []
  const clientById = new Map(index.clients.map(c => [c.id, c]))

  for (const c of index.clients) {
    const full = `${c.first_name} ${c.last_name}`.trim()
    let score = nameScore(full, q)
    let why: string | null = null
    if (!score && contactScore([c.email, c.phone, c.passport_number], q)) {
      score = CONTACT
      why = c.email && norm(c.email).includes(q) ? c.email : 'contact details'
    }
    if (!score) {
      // Both note homes: the old single block still on some rows, and the
      // dated feed it moves into. A note must stay findable across that move.
      const inNotes = bodyHit([c.notes, ...(index.notesByClient?.[c.id] ?? [])], q)
      if (inNotes) { score = BODY; why = inNotes }
    }
    if (score) {
      hits.push({
        id: `client:${c.id}`, kind: 'client', targetId: c.id,
        title: full || 'Unnamed client',
        subtitle: c.email ?? c.phone ?? null,
        why, score,
      })
    }
  }

  // "#23", "23" or "023" all mean booking 23 — the list shows #023 and people
  // type what they remember.
  const asNumber = q.replace(/^#/, '')
  const numeric = /^\d+$/.test(asNumber) ? parseInt(asNumber, 10) : null

  for (const b of index.bookings) {
    const client = clientById.get(b.client_id)
    const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : ''
    let score = 0
    let why: string | null = null
    if (numeric !== null && b.booking_number === numeric) score = NUMBER_HIT
    if (!score) score = nameScore(clientName, q) - 5   // the client row is the better answer
    if (!score || score < 0) {
      const inNotes = bodyHit([b.notes], q)
      if (inNotes) { score = BODY; why = inNotes }
    }
    if (score > 0) {
      hits.push({
        id: `booking:${b.id}`, kind: 'booking', targetId: b.id,
        title: `#${String(b.booking_number).padStart(3, '0')} · ${clientName || 'Unknown client'}`,
        subtitle: `${b.check_in} → ${b.check_out} · ${b.status}`,
        why, score,
      })
    }
  }

  for (const e of index.enquiries) {
    let score = nameScore(e.name, q)
    let why: string | null = null
    if (!score && contactScore([e.email, e.phone], q)) {
      score = CONTACT
      why = e.email && norm(e.email).includes(q) ? e.email : 'contact details'
    }
    if (!score) {
      const inBody = bodyHit([e.message, ...(index.notesByEnquiry[e.id] ?? [])], q)
      if (inBody) { score = BODY; why = inBody }
    }
    if (score) {
      hits.push({
        id: `enquiry:${e.id}`, kind: 'enquiry', targetId: e.id,
        title: e.name,
        subtitle: [e.status, e.arrival_month].filter(Boolean).join(' · ') || null,
        why, score,
      })
    }
  }

  return hits
    .sort((a, b) => (b.score - a.score) || a.title.localeCompare(b.title))
    .slice(0, limit)
}
