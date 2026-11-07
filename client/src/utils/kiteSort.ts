import type { Equipment } from '../types/database'

/** First number found in a size ("9m", "12.5", "9,5 m") — null when there is none. */
function sizeNumber(e: Pick<Equipment, 'size'>): number | null {
  const m = e.size?.match(/\d+(?:[.,]\d+)?/)
  return m ? parseFloat(m[0].replace(',', '.')) : null
}

/** Kites for the pickers: smallest size first, no-size ones last, then by name.
 *  Returns a new array. Only meant for kites (a board's size is a length, not a surface). */
export function sortKitesBySize<T extends Pick<Equipment, 'size' | 'name'>>(kites: T[]): T[] {
  return [...kites].sort((a, b) => {
    const sa = sizeNumber(a), sb = sizeNumber(b)
    if (sa !== sb) {
      if (sa === null) return 1
      if (sb === null) return -1
      return sa - sb
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })
}
