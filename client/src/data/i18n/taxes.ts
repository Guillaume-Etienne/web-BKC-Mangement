import type { Tr } from './types'

export const taxesI18n = {
  // TaxiPage main
  page_title:      { fr: 'Taxis',           en: 'Taxis',         es: 'Taxis' },
  section_planning: { fr: 'Planning',       en: 'Planning',      es: 'Planificación' },
  section_finance: { fr: 'Finances',        en: 'Finance',       es: 'Finanzas' },
  section_drivers: { fr: 'Chauffeurs',      en: 'Drivers',       es: 'Conductores' },

  // Trip statuses
  status_scheduled: { fr: 'Programmé',      en: 'Scheduled',     es: 'Programado' },
  status_completed: { fr: 'Complété',       en: 'Completed',     es: 'Completado' },
  status_cancelled: { fr: 'Annulé',         en: 'Cancelled',     es: 'Cancelado' },

  // Driver management
  btn_add_driver:  { fr: 'Ajouter un chauffeur', en: 'Add driver', es: 'Añadir conductor' },
  label_driver:    { fr: 'Chauffeur',       en: 'Driver',        es: 'Conductor' },
  label_balance:   { fr: 'Solde',           en: 'Balance',       es: 'Saldo' },
  label_trips:     { fr: 'Trajets',         en: 'Trips',         es: 'Viajes' },

  // Trip details
  label_pickup:    { fr: 'Prise en charge', en: 'Pickup',        es: 'Recogida' },
  label_dropoff:   { fr: 'Dépose',          en: 'Drop-off',      es: 'Entrega' },
  label_distance:  { fr: 'Distance',        en: 'Distance',      es: 'Distancia' },
  label_rate:      { fr: 'Tarif',           en: 'Rate',          es: 'Tarifa' },

  // Trip types
  type_arrival:    { fr: 'Arrivée',         en: 'Arrival',       es: 'Llegada' },
  type_departure:  { fr: 'Départ',          en: 'Departure',     es: 'Salida' },
  type_private:    { fr: 'Privé',           en: 'Private',       es: 'Privado' },
  type_shared:     { fr: 'Partagé',         en: 'Shared',        es: 'Compartido' },

  // Finance terms
  label_gross:     { fr: 'Brut',            en: 'Gross',         es: 'Bruto' },
  label_commission: { fr: 'Commission',     en: 'Commission',    es: 'Comisión' },
  label_net:       { fr: 'Net',             en: 'Net',           es: 'Neto' },
} satisfies Record<string, Tr>
