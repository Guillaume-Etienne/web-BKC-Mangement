import type { Tr } from './types'

export const accountingI18n = {
  // Page title & sections
  page_title:     { fr: 'Comptabilité', en: 'Accounting', es: 'Contabilidad' },
  section_revenue: { fr: 'Revenu',      en: 'Revenue',    es: 'Ingresos' },
  section_expenses: { fr: 'Dépenses',   en: 'Expenses',   es: 'Gastos' },
  section_cashflow: { fr: 'Trésorerie', en: 'Cash Flow',  es: 'Flujo de Caja' },

  // Revenue breakdown
  rev_accommodation: { fr: 'Hébergement', en: 'Accommodation', es: 'Alojamiento' },
  rev_lessons:    { fr: 'Cours',         en: 'Lessons',       es: 'Clases' },
  rev_equipment:  { fr: 'Équipement',    en: 'Equipment',     es: 'Equipamiento' },
  rev_taxi_margin: { fr: 'Marge taxi',   en: 'Taxi margin',   es: 'Margen taxi' },
  rev_activities: { fr: 'Activités',     en: 'Activities',    es: 'Actividades' },
  rev_events:     { fr: 'Événements',    en: 'Events',        es: 'Eventos' },
  rev_center_access: { fr: 'Accès centre', en: 'Center access', es: 'Acceso centro' },
  rev_agencies:   { fr: 'Agences',       en: 'Agencies',      es: 'Agencias' },

  // Billing & payment
  label_gross_billed: { fr: 'Facturé brut', en: 'Gross billed', es: 'Facturado bruto' },
  label_commission:   { fr: 'Commission',   en: 'Commission',   es: 'Comisión' },
  label_net:          { fr: 'Net',          en: 'Net',          es: 'Neto' },
  label_collected:    { fr: 'Collecté',     en: 'Collected',    es: 'Cobrado' },
  label_outstanding:  { fr: 'En attente',   en: 'Outstanding',  es: 'Pendiente' },
  label_paid:         { fr: 'Payé',         en: 'Paid',         es: 'Pagado' },
  label_due:          { fr: 'À recevoir',   en: 'Due',          es: 'Adeudado' },

  // Tabs
  tab_dashboard:  { fr: 'Tableau de bord', en: 'Dashboard',    es: 'Panel' },
  tab_bookings:   { fr: 'Réservations',    en: 'Bookings',     es: 'Reservas' },
  tab_houses:     { fr: 'Maisons',         en: 'Houses',       es: 'Casas' },
  tab_expenses:   { fr: 'Dépenses',        en: 'Expenses',     es: 'Gastos' },
  tab_cashflow:   { fr: 'Trésorerie',      en: 'Cash Flow',    es: 'Flujo de Caja' },
  tab_instructors: { fr: 'Moniteurs',      en: 'Instructors',  es: 'Instructores' },
  tab_agencies:   { fr: 'Agences',         en: 'Agencies',     es: 'Agencias' },
  tab_palmeiras:  { fr: 'Palmerias',       en: 'Palmeiras',    es: 'Palmeiras' },

  // Season/Period selection
  label_season:   { fr: 'Saison',          en: 'Season',       es: 'Temporada' },
  label_period:   { fr: 'Période',         en: 'Period',       es: 'Período' },
  btn_compare:    { fr: 'Comparer',        en: 'Compare',      es: 'Comparar' },

  // Hints & notes
  hint_billed:    { fr: 'Revenu généré',   en: 'Revenue generated', es: 'Ingresos generados' },
  hint_collected: { fr: 'Argent reçu',     en: 'Cash received',     es: 'Efectivo recibido' },
  hint_net_cash:  { fr: 'Trésorerie nette', en: 'Net cash',         es: 'Efectivo neto' },

  // Message hints
  hint_retained:  { fr: 'Retenu par l\'agence', en: 'Retained by the agency', es: 'Retenido por la agencia' },
  hint_center:    { fr: 'Ce qui arrive au centre', en: 'What reaches the centre', es: 'Lo que llega al centro' },
  hint_not_yet:   { fr: 'Net facturé, pas encore payé', en: 'Net billed, not yet paid', es: 'Facturado neto, aún no pagado' },
} satisfies Record<string, Tr>
