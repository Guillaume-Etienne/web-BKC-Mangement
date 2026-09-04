import type { Tr } from './types'

export const bookingsI18n = {
  page_title:     { fr: 'Réservations',   en: 'Bookings',     es: 'Reservas' },

  // Booking statuses
  status_draft:   { fr: 'Brouillon',      en: 'Draft',        es: 'Borrador' },
  status_confirmed: { fr: 'Confirmée',    en: 'Confirmed',    es: 'Confirmada' },
  status_cancelled: { fr: 'Annulée',      en: 'Cancelled',    es: 'Cancelada' },
  status_completed: { fr: 'Complétée',    en: 'Completed',    es: 'Completada' },

  // Booking details
  label_reference: { fr: 'Référence',     en: 'Reference',    es: 'Referencia' },
  label_guest:    { fr: 'Client',         en: 'Guest',        es: 'Huésped' },
  label_arrival:  { fr: 'Arrivée',        en: 'Arrival',      es: 'Llegada' },
  label_departure: { fr: 'Départ',        en: 'Departure',    es: 'Partida' },
  label_accommodation: { fr: 'Hébergement', en: 'Accommodation', es: 'Alojamiento' },
  label_guests_count: { fr: 'Nombre de clients', en: 'Number of guests', es: 'Número de huéspedes' },

  // Wizard
  btn_new_booking: { fr: 'Nouvelle réservation', en: 'New booking', es: 'Nueva reserva' },
  btn_edit_booking: { fr: 'Modifier', en: 'Edit', es: 'Editar' },
  btn_cancel_booking: { fr: 'Annuler', en: 'Cancel', es: 'Cancelar' },

  // Tabs
  tab_overview:   { fr: 'Aperçu',         en: 'Overview',     es: 'Resumen' },
  tab_finances:   { fr: 'Finances',       en: 'Finances',     es: 'Finanzas' },
  tab_activities: { fr: 'Activités',      en: 'Activities',   es: 'Actividades' },
  tab_accommodations: { fr: 'Hébergements', en: 'Accommodations', es: 'Alojamientos' },

  // Status labels
  label_total_billed: { fr: 'Total facturé', en: 'Total billed', es: 'Total facturado' },
  label_total_collected: { fr: 'Total collecté', en: 'Total collected', es: 'Total cobrado' },
  label_total_outstanding: { fr: 'Total en attente', en: 'Total outstanding', es: 'Total pendiente' },
} satisfies Record<string, Tr>
