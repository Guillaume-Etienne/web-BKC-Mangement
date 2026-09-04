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

  // Tabs (EquipmentPage: inventory / rentals / revenue — matches the real code's tabs)
  tab_inventory:   { fr: 'Inventaire',      en: 'Inventory',     es: 'Inventario' },
  tab_revenue:     { fr: 'CA',              en: 'Revenue',       es: 'Ingresos' },

  // Equipment categories (EquipmentCategory: kite | board | surfboard | foilboard)
  category_kite:   { fr: 'Kite',            en: 'Kite',          es: 'Kite' },
  category_board:  { fr: 'Planche',         en: 'Board',         es: 'Tabla' },
  category_surfboard: { fr: 'Surfboard',    en: 'Surfboard',     es: 'Tabla de surf' },
  category_foilboard: { fr: 'Foilboard',    en: 'Foilboard',     es: 'Tabla de foil' },
  label_all_categories: { fr: 'Toutes catégories', en: 'All categories', es: 'Todas las categorías' },

  // Equipment conditions (EquipmentCondition: new | good | fair | damaged | retired)
  condition_new:   { fr: 'Neuf',            en: 'New',           es: 'Nuevo' },
  condition_damaged: { fr: 'Endommagé',     en: 'Damaged',       es: 'Dañado' },
  condition_retired: { fr: 'Retiré',        en: 'Retired',       es: 'Retirado' },

  // Rental slots (RentalSlot: morning | afternoon | full_day)
  slot_morning:    { fr: 'Matin',           en: 'Morning',       es: 'Mañana' },
  slot_afternoon:  { fr: 'Aprem',           en: 'Afternoon',     es: 'Tarde' },
  slot_full_day:   { fr: 'Journée',         en: 'Full day',      es: 'Día completo' },

  // Buttons / modals
  btn_archive:     { fr: 'Archiver',        en: 'Archive',       es: 'Archivar' },
  modal_new_equipment: { fr: 'Ajouter un équipement', en: 'Add equipment', es: 'Añadir equipo' },
  modal_edit_equipment: { fr: "Modifier l'équipement", en: 'Edit equipment', es: 'Editar equipo' },
  label_uses:      { fr: 'Sorties',         en: 'Uses',          es: 'Usos' },
  label_use_hours: { fr: "Heures d'utilisation", en: 'Usage hours', es: 'Horas de uso' },
  label_brand:     { fr: 'Marque',          en: 'Brand',         es: 'Marca' },
  label_active:    { fr: 'Actif',           en: 'Active',        es: 'Activo' },
  label_condition: { fr: 'État',            en: 'Condition',     es: 'Estado' },
} satisfies Record<string, Tr>
