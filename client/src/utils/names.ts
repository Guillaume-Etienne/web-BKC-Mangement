/** Split a single free-text name into first/last, best-effort — used wherever a
 *  form only collects one "name" field but a client record wants both. */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) return { first: full.trim(), last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}
