import type { Tr } from './types'

export const bookingsI18n = {
  page_title:     { fr: 'Réservations',   en: 'Bookings',     es: 'Reservas' },

  // Booking statuses
  status_draft:       { fr: 'Brouillon',      en: 'Draft',        es: 'Borrador' },
  status_provisional: { fr: 'Provisoire',     en: 'Provisional',  es: 'Provisional' },
  status_confirmed:   { fr: 'Confirmée',      en: 'Confirmed',    es: 'Confirmada' },
  status_cancelled:   { fr: 'Annulée',        en: 'Cancelled',    es: 'Cancelada' },
  status_completed:   { fr: 'Complétée',      en: 'Completed',    es: 'Completada' },

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

  // Wizard steps
  step_client:     { fr: 'Client',      en: 'Client',     es: 'Cliente' },
  step_stay:       { fr: 'Séjour',      en: 'Stay',       es: 'Estancia' },
  step_guests:     { fr: 'Invités',     en: 'Guests',     es: 'Huéspedes' },
  step_transport:  { fr: 'Transport',   en: 'Transport',  es: 'Transporte' },
  step_kitecenter: { fr: 'Kite Center', en: 'KiteCenter', es: 'Kite Center' },
  step_payment:    { fr: 'Paiement',    en: 'Payment',    es: 'Pago' },

  // Wizard title & main save button
  title_new_booking:  { fr: 'Nouvelle réservation',    en: 'New booking',    es: 'Nueva reserva' },
  title_edit_booking: { fr: 'Modifier la réservation', en: 'Edit booking',   es: 'Editar reserva' },
  btn_save_booking:   { fr: 'Enregistrer la réservation', en: 'Save booking', es: 'Guardar reserva' },

  // List filters
  filter_all:        { fr: 'Toutes',       en: 'All',        es: 'Todas' },
  filter_complete:   { fr: 'Complètes',    en: 'Complete',   es: 'Completas' },
  filter_incomplete: { fr: 'Incomplètes',  en: 'Incomplete', es: 'Incompletas' },
  filter_upcoming:   { fr: 'À venir',      en: 'Upcoming',   es: 'Próximas' },
  filter_active:     { fr: 'En cours',     en: 'Active',     es: 'Activas' },

  // List table columns
  col_client: { fr: 'Client',  en: 'Client', es: 'Cliente' },
  col_stay:   { fr: 'Séjour',  en: 'Stay',   es: 'Estancia' },
  col_room:   { fr: 'Chambre', en: 'Room',   es: 'Habitación' },
  col_dates:  { fr: 'Dates',   en: 'Dates',  es: 'Fechas' },

  // List messages
  msg_loading_bookings: { fr: 'Chargement des réservations...', en: 'Loading bookings...', es: 'Cargando reservas...' },
  msg_error_loading:    { fr: 'Erreur au chargement des réservations', en: 'Error loading bookings', es: 'Error al cargar las reservas' },
  msg_no_match:         { fr: 'Aucune réservation ne correspond à ce filtre.', en: 'No bookings match this filter.', es: 'Ninguna reserva coincide con este filtro.' },
} satisfies Record<string, Tr>
