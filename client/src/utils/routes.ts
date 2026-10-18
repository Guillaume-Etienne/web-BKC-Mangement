import type { Page } from '../components/pending/pendingActions'

// One address per admin page (2026-10-18). Before, the page lived in React state
// only: the URL never changed, so a phone shortcut always landed on Home and the
// Android back button left the app instead of going back a page.
//
// The slug is the page id, except Home at the root. Vercel already rewrites every
// path to index.html (vercel.json), so a deep link needs nothing server-side.
// The manifest's `shortcuts` (public/manifest.webmanifest) point at these paths —
// renaming one here means renaming it there too.

const PAGES: readonly Page[] = [
  'home', 'planning', 'bookings', 'clients', 'management', 'taxis',
  'equipment', 'documents', 'accounting', 'activities', 'requests',
]

export function pathForPage(page: Page): string {
  return page === 'home' ? '/' : `/${page}`
}

/** The page a path opens, or Home for anything unknown (trailing slash and
 *  case are forgiven — a hand-typed shortcut should not land on a blank page). */
export function pageFromPath(pathname: string): Page {
  const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  return (PAGES as readonly string[]).includes(slug) ? (slug as Page) : 'home'
}
