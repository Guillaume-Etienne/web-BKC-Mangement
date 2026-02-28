import type { Client, Booking, Participant } from '../types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportRowStatus = 'new' | 'skip' | 'conflict'

export interface ImportedClient {
  client: Client
  isReferent: boolean   // voyageur 1 du groupe
}

export interface ImportedBooking {
  booking: Omit<Booking, 'booking_number' | 'id'>
}

export interface ImportConflict {
  field: keyof Client
  existing: string | null
  incoming: string | null
}

export interface ImportRow {
  status: ImportRowStatus
  import_id: string                 // Google Forms timestamp (dedup key)
  clients: ImportedClient[]
  booking: ImportedBooking
  conflicts: ImportConflict[]       // populated when status === 'conflict'
  existingClientId?: string         // populated when status === 'conflict'
  resolution?: 'keep' | 'replace'  // set by user in conflict UI
}

export interface ParseResult {
  rows: ImportRow[]
  formLanguage: 'fr' | 'en' | 'unknown'
  totalDataRows: number
}

// ─── Column maps ──────────────────────────────────────────────────────────────

interface ColMap {
  timestamp: number
  referent: number
  numPeople: number
  numNights: number
  arrivalDate: number
  arrivalTime: number
  departureDate: number
  departureTime: number
  transport: number
  luggage: number
  boardbags: number
  doubleBeds: number
  singleBeds: number
  // Emergency contact
  emergencyName: number
  emergencyPhone: number
  emergencyEmail: number
  emergencyRelation: number
  // Travelers (base index of traveler 1, +3 per traveler)
  traveler1Start: number
}

const COL_FR: ColMap = {
  timestamp: 0, referent: 1, numPeople: 2, numNights: 3,
  arrivalDate: 4, arrivalTime: 5, departureDate: 6, departureTime: 7,
  transport: 8, luggage: 9, boardbags: 10, doubleBeds: 11, singleBeds: 12,
  traveler1Start: 13,
  emergencyName: 25, emergencyPhone: 26, emergencyEmail: 27, emergencyRelation: 28,
}

const COL_EN: ColMap = {
  timestamp: 0, referent: 1, numPeople: 2, numNights: 3,
  arrivalDate: 4, arrivalTime: 5, departureDate: 6, departureTime: 7,
  transport: 8, luggage: 9, boardbags: 10, doubleBeds: 11, singleBeds: 12,
  emergencyName: 14, emergencyPhone: 15, emergencyEmail: 16, emergencyRelation: 17,
  traveler1Start: 20,
}

// ─── CSV parser (handles quoted fields with commas/newlines) ──────────────────

// Full CSV parser that handles multi-line quoted fields
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++
      fields.push(current.trim())
      current = ''
      if (fields.length > 0 && fields.some(f => f !== '')) rows.push([...fields])
      fields.length = 0
    } else {
      current += ch
    }
  }
  if (current || fields.length) {
    fields.push(current.trim())
    if (fields.some(f => f !== '')) rows.push([...fields])
  }
  return rows
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIMESTAMP_RE = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/

function isDataRow(row: string[]): boolean {
  return TIMESTAMP_RE.test(row[0] ?? '')
}

// "DD/MM/YYYY" or "DD/MM/YYYY HH:MM:SS" → "YYYY-MM-DD"
function parseDate(raw: string): string | null {
  if (!raw) return null
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  const [, d, m, y] = match
  // sanity check year (Google Forms bug: some entries have year 0024 instead of 2024)
  const year = parseInt(y)
  const correctedYear = year < 100 ? year + 2000 : year > 2100 ? year - 2000 : year
  return `${correctedYear}-${m}-${d}`
}

// "HH:MM:SS" → "HH:MM"
function parseTime(raw: string): string | null {
  if (!raw) return null
  const match = raw.match(/(\d{2}:\d{2})/)
  return match ? match[1] : null
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function parseNights(raw: string): number {
  // Sometimes the field is "3, Du 7 au 10 novembre" — take first number
  const match = raw.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

function parseLuggage(raw: string): number {
  const match = raw.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

function transportYes(raw: string): boolean {
  const lower = raw.toLowerCase()
  return lower.includes('oui') || lower.includes('yes') || lower.includes('besoin') || lower.includes('need')
}

function detectLanguage(headerRow: string[]): 'fr' | 'en' | 'unknown' {
  const col13 = (headerRow[13] ?? '').toLowerCase()
  if (col13.includes('how did you know') || col13.includes('how did you hear')) return 'en'
  // FR: col 13 is "Prénoms du voyageur 1..."
  if (col13.includes('voyageur') || col13.includes('pr') || col13.includes('nom')) return 'fr'
  return 'unknown'
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseGoogleFormsCSV(
  csvText: string,
  existingClients: Client[],
  existingImportIds: Set<string>
): ParseResult {
  const allRows = parseCSV(csvText)

  // Find header row (first row)
  if (allRows.length === 0) return { rows: [], formLanguage: 'unknown', totalDataRows: 0 }

  const headerRow = allRows[0]
  const formLanguage = detectLanguage(headerRow)
  const cols: ColMap = formLanguage === 'en' ? COL_EN : COL_FR

  // Filter to data rows only
  const dataRows = allRows.filter(isDataRow)

  const passportIndex = new Map<string, Client>()
  for (const c of existingClients) {
    if (c.passport_number) passportIndex.set(c.passport_number.toUpperCase(), c)
  }

  const importRows: ImportRow[] = dataRows.map(row => {
    const get = (i: number) => (row[i] ?? '').trim()
    const import_id = get(cols.timestamp)

    // ── Skip already imported rows
    if (existingImportIds.has(import_id)) {
      return {
        status: 'skip' as const,
        import_id,
        clients: [],
        booking: buildBooking(row, cols, import_id, ''),
        conflicts: [],
      }
    }

    // ── Extract emergency contact
    const emergencyName     = get(cols.emergencyName)     || null
    const emergencyPhone    = get(cols.emergencyPhone)    || null
    const emergencyEmail    = get(cols.emergencyEmail)    || null
    const emergencyRelation = get(cols.emergencyRelation) || null

    // ── Extract travelers (up to 4)
    const importedClients: ImportedClient[] = []
    for (let t = 0; t < 4; t++) {
      const base = cols.traveler1Start + t * 3
      const firstName = get(base)
      const lastName  = get(base + 1)
      const passport  = get(base + 2)
      if (!firstName && !lastName) break

      const isReferent = t === 0
      const newClient: Client = {
        id: `import_${import_id}_t${t}`,
        first_name: firstName,
        last_name: lastName,
        passport_number: passport || null,
        email: null,
        phone: null,
        notes: null,
        nationality: null,
        birth_date: null,
        kite_level: null,
        import_id,
        emergency_contact_name:     isReferent ? emergencyName     : null,
        emergency_contact_phone:    isReferent ? emergencyPhone    : null,
        emergency_contact_email:    isReferent ? emergencyEmail    : null,
        emergency_contact_relation: isReferent ? emergencyRelation : null,
      }
      importedClients.push({ client: newClient, isReferent })
    }

    // ── Detect conflicts (check passport against existing clients)
    let status: ImportRowStatus = 'new'
    let existingClientId: string | undefined
    const conflicts: ImportConflict[] = []

    const referent = importedClients[0]?.client
    if (referent?.passport_number) {
      const existing = passportIndex.get(referent.passport_number.toUpperCase())
      if (existing) {
        existingClientId = existing.id
        const fieldsToCheck: (keyof Client)[] = ['first_name', 'last_name', 'passport_number']
        for (const field of fieldsToCheck) {
          const ev = (existing[field] as string | null) ?? null
          const iv = (referent[field] as string | null) ?? null
          if (ev && iv && ev.toLowerCase() !== iv.toLowerCase()) {
            conflicts.push({ field, existing: ev, incoming: iv })
          }
        }
        status = conflicts.length > 0 ? 'conflict' : 'new'
      }
    }

    return {
      status,
      import_id,
      clients: importedClients,
      booking: buildBooking(row, cols, import_id, importedClients[0]?.client.id ?? ''),
      conflicts,
      existingClientId,
    }
  })

  return { rows: importRows, formLanguage, totalDataRows: dataRows.length }
}

function buildBooking(
  row: string[],
  cols: ColMap,
  import_id: string,
  clientId: string
): ImportedBooking {
  const get = (i: number) => (row[i] ?? '').trim()

  const checkIn    = parseDate(get(cols.arrivalDate))
  const nights     = parseNights(get(cols.numNights))
  const checkOut   = checkIn && nights > 0 ? addDays(checkIn, nights) : null
  const numPeople  = parseInt(get(cols.numPeople)) || 1

  return {
    booking: {
      client_id: clientId,
      check_in:  checkIn  ?? '',
      check_out: checkOut ?? '',
      visa_entry_date:  null,
      visa_exit_date:   null,
      status: 'confirmed',
      notes: null,
      num_lessons:           0,
      num_equipment_rentals: 0,
      num_center_access:     numPeople,
      client: undefined,
      arrival_time:   parseTime(get(cols.arrivalTime)),
      departure_time: parseTime(get(cols.departureTime)),
      luggage_count:  parseLuggage(get(cols.luggage)),
      boardbag_count: parseLuggage(get(cols.boardbags)),
      taxi_arrival:   transportYes(get(cols.transport)),
      taxi_departure: transportYes(get(cols.transport)),
      couples_count:  0,
      children_count: 0,
      participants:   [] as Participant[],
      amount_paid:    0,
      import_id,
      emergency_contact_name:  get(cols.emergencyName)  || null,
      emergency_contact_phone: get(cols.emergencyPhone) || null,
      emergency_contact_email: get(cols.emergencyEmail) || null,
    },
  }
}

// ─── Helper used by ClientsPage to build the Set of known import_ids ─────────

export function buildImportIdSet(clients: Client[], bookings: { import_id: string | null }[]): Set<string> {
  const ids = new Set<string>()
  for (const c of clients)  if (c.import_id)  ids.add(c.import_id)
  for (const b of bookings) if (b.import_id)  ids.add(b.import_id)
  return ids
}
