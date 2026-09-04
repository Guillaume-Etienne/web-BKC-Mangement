import type { Lang } from '../../types/database'
import { LANGS } from './types'
import { navigationI18n } from './navigation'
import { commonI18n } from './common'
import { accountingI18n } from './accounting'
import { bookingsI18n } from './bookings'
import { clientsI18n } from './clients'
import { managementI18n } from './management'
import { pagesI18n } from './pages'
import { taxesI18n } from './taxes'
import { activitiesI18n } from './activities'
import { equipmentI18n } from './equipment'
import { enquiriesI18n } from './enquiries'

// ─── Aggregated i18n object ──────────────────────────────────────────────────
export const i18n = {
  nav: navigationI18n,
  common: commonI18n,
  accounting: accountingI18n,
  bookings: bookingsI18n,
  clients: clientsI18n,
  management: managementI18n,
  pages: pagesI18n,
  taxis: taxesI18n,
  activities: activitiesI18n,
  equipment: equipmentI18n,
  enquiries: enquiriesI18n,
}

// ─── Type exports ────────────────────────────────────────────────────────────
export type AdminI18n = typeof i18n
export { LANGS }
export type { Lang }

// ─── Detect default language ─────────────────────────────────────────────────
export function detectAdminLang(): Lang {
  const n = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return n === 'fr' || n === 'es' ? (n as Lang) : 'en'
}
