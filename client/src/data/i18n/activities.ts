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
} satisfies Record<string, Tr>
