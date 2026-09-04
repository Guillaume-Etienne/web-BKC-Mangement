import type { Tr } from './types'

export const equipmentI18n = {
  // EquipmentPage main
  page_title:      { fr: 'Équipement',      en: 'Equipment',     es: 'Equipamiento' },
  section_kites:   { fr: 'Cerfs-volants',   en: 'Kites',         es: 'Cometas' },
  section_boards:  { fr: 'Planches',        en: 'Boards',        es: 'Tablas' },
  section_rentals: { fr: 'Locations',       en: 'Rentals',       es: 'Alquileres' },

  // Equipment types
  type_kite:       { fr: 'Cerf-volant',     en: 'Kite',          es: 'Cometa' },
  type_board:      { fr: 'Planche',         en: 'Board',         es: 'Tabla' },
  type_foil:       { fr: 'Foil',            en: 'Foil',          es: 'Foil' },
  type_wing:       { fr: 'Wing',            en: 'Wing',          es: 'Wing' },

  // Conditions
  condition_excellent: { fr: 'Excellent',   en: 'Excellent',     es: 'Excelente' },
  condition_good:  { fr: 'Bon',             en: 'Good',          es: 'Bueno' },
  condition_fair:  { fr: 'Correct',         en: 'Fair',          es: 'Regular' },
  condition_repair: { fr: 'À réparer',      en: 'Needs repair',  es: 'Necesita reparación' },

  // Rental management
  btn_add_kite:    { fr: 'Ajouter un cerf-volant', en: 'Add kite', es: 'Añadir cometa' },
  btn_add_board:   { fr: 'Ajouter une planche', en: 'Add board', es: 'Añadir tabla' },
  btn_rent:        { fr: 'Louer',           en: 'Rent',          es: 'Alquilar' },
  btn_return:      { fr: 'Retour',          en: 'Return',        es: 'Devolver' },

  // Statuses
  status_available: { fr: 'Disponible',     en: 'Available',     es: 'Disponible' },
  status_rented:   { fr: 'Loué',            en: 'Rented',        es: 'Alquilado' },
  status_maintenance: { fr: 'Maintenance',  en: 'Maintenance',   es: 'Mantenimiento' },
} satisfies Record<string, Tr>
