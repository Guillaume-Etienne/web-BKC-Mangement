/** Split a single free-text name into first/last, best-effort — used wherever a
 *  form only collects one "name" field but a client record wants both. */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) return { first: full.trim(), last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/** First given name only. Passports list every middle name in `first_name`; shared
 *  pages show just the first one ("Kajsa Lisa Kristina" → "Kajsa", "Jean-Pierre"
 *  stays whole). Display only — the full value stays in the database. */
export function displayFirstName(first: string | null | undefined): string {
  return (first ?? '').trim().split(/\s+/)[0] ?? ''
}
