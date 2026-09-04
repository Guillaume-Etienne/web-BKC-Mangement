import type { Tr } from './types'

export const activitiesI18n = {
  // ActivitiesPage main
  page_title:      { fr: 'Activités',       en: 'Activities',    es: 'Actividades' },
  section_providers: { fr: 'Prestataires',  en: 'Providers',     es: 'Proveedores' },
  section_bookings: { fr: 'Réservations',   en: 'Bookings',      es: 'Reservas' },

  // Activity types
  type_lesson:     { fr: 'Cours',           en: 'Lesson',        es: 'Clase' },
  type_rental:     { fr: 'Location',        en: 'Rental',        es: 'Alquiler' },
  type_event:      { fr: 'Événement',       en: 'Event',         es: 'Evento' },

  // Skill levels
  level_beginner:  { fr: 'Débutant',        en: 'Beginner',      es: 'Principiante' },
  level_intermediate: { fr: 'Intermédiaire', en: 'Intermediate', es: 'Intermedio' },
  level_advanced:  { fr: 'Avancé',          en: 'Advanced',      es: 'Avanzado' },

  // Kite disciplines
  kite_wave:       { fr: 'Vague',           en: 'Wave',          es: 'Ola' },
  kite_freestyle:  { fr: 'Freestyle',       en: 'Freestyle',     es: 'Freestyle' },
  kite_hydrofoil:  { fr: 'Hydrofoil',       en: 'Hydrofoil',     es: 'Hidrofoil' },

  // Wing
  wing_lessons:    { fr: 'Cours de wing',   en: 'Wing lessons',  es: 'Clases de wing' },

  // Management
  btn_add_provider: { fr: 'Ajouter un prestataire', en: 'Add provider', es: 'Añadir proveedor' },
  btn_add_activity: { fr: 'Ajouter une activité', en: 'Add activity', es: 'Añadir actividad' },

  // Statuses
  status_booked:   { fr: 'Réservé',         en: 'Booked',        es: 'Reservado' },
  status_cancelled: { fr: 'Annulé',         en: 'Cancelled',     es: 'Cancelado' },
  status_completed: { fr: 'Complété',       en: 'Completed',     es: 'Completado' },

  // Provider types (ActivityProviderType — matches ActivitiesPage TYPE_LABELS)
  type_activity_provider: { fr: 'Activité', en: 'Activity',      es: 'Actividad' },
  type_safari:     { fr: 'Safari',          en: 'Safari',        es: 'Safari' },

  // Payment flow (ActivityPaymentFlow)
  flow_we_pay:     { fr: 'Nous payons le prestataire', en: 'We pay provider', es: 'Pagamos al proveedor' },
  flow_provider_pays: { fr: 'Le prestataire nous paie', en: 'Provider pays us', es: 'El proveedor nos paga' },

  // Buttons / modals
  btn_add_booking: { fr: 'Ajouter une réservation', en: 'Add booking', es: 'Añadir reserva' },
  btn_add_payment: { fr: 'Ajouter un paiement', en: 'Add payment', es: 'Añadir pago' },
  modal_new_provider: { fr: 'Nouveau prestataire', en: 'New provider', es: 'Nuevo proveedor' },
  modal_edit_provider: { fr: 'Modifier le prestataire', en: 'Edit provider', es: 'Editar proveedor' },
  modal_new_booking: { fr: 'Nouvelle réservation', en: 'New booking', es: 'Nueva reserva' },
  modal_edit_booking: { fr: 'Modifier la réservation', en: 'Edit booking', es: 'Editar reserva' },
  tab_all_bookings: { fr: 'Toutes les réservations', en: 'All bookings', es: 'Todas las reservas' },
  direction_to_provider: { fr: 'Nous avons payé',  en: 'We paid them',  es: 'Nosotros pagamos' },
  direction_from_provider: { fr: 'Ils nous ont payés', en: 'They paid us', es: 'Ellos nos pagaron' },
  section_payments: { fr: 'Paiements',      en: 'Payments',      es: 'Pagos' },
} satisfies Record<string, Tr>
