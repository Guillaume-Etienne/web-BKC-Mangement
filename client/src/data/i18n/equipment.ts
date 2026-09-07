import type { Tr } from './types'

export const equipmentI18n = {
  // EquipmentPage main
  page_title:      { fr: 'Équipement',      en: 'Equipment',     es: 'Equipamiento' },
  section_boards:  { fr: 'Planches',        en: 'Boards',        es: 'Tablas' },
  section_rentals: { fr: 'Locations',       en: 'Rentals',       es: 'Alquileres' },

  // Equipment types
  type_board:      { fr: 'Planche',         en: 'Board',         es: 'Tabla' },
  type_foil:       { fr: 'Foil',            en: 'Foil',          es: 'Foil' },
  type_wing:       { fr: 'Wing',            en: 'Wing',          es: 'Wing' },

  // Conditions
  condition_excellent: { fr: 'Excellent',   en: 'Excellent',     es: 'Excelente' },
  condition_good:  { fr: 'Bon',             en: 'Good',          es: 'Bueno' },
  condition_fair:  { fr: 'Correct',         en: 'Fair',          es: 'Regular' },
  condition_repair: { fr: 'À réparer',      en: 'Needs repair',  es: 'Necesita reparación' },

  // Rental management
  btn_add_board:   { fr: 'Ajouter une planche', en: 'Add board', es: 'Añadir tabla' },
  btn_rent:        { fr: 'Louer',           en: 'Rent',          es: 'Alquilar' },
  btn_return:      { fr: 'Retour',          en: 'Return',        es: 'Devolver' },

  // Statuses
  status_available: { fr: 'Disponible',     en: 'Available',     es: 'Disponible' },
  status_rented:   { fr: 'Loué',            en: 'Rented',        es: 'Alquilado' },
  status_maintenance: { fr: 'Maintenance',  en: 'Maintenance',   es: 'Mantenimiento' },

  // Tabs (EquipmentPage: inventory / rentals / revenue / assets — matches the real code's tabs)
  tab_inventory:   { fr: 'Inventaire',      en: 'Inventory',     es: 'Inventario' },
  tab_revenue:     { fr: 'CA',              en: 'Revenue',       es: 'Ingresos' },
  tab_assets:      { fr: 'Achats & reventes', en: 'Purchases & Resales', es: 'Compras y reventas' },

  // Equipment categories (EquipmentCategory: kite | board | surfboard | foilboard | bar)
  category_kite:   { fr: 'Kite',            en: 'Kite',          es: 'Kite' },
  category_board:  { fr: 'Planche',         en: 'Board',         es: 'Tabla' },
  category_surfboard: { fr: 'Surfboard',    en: 'Surfboard',     es: 'Tabla de surf' },
  category_foilboard: { fr: 'Foilboard',    en: 'Foilboard',     es: 'Tabla de foil' },
  category_bar:    { fr: 'Barre',           en: 'Bar',           es: 'Barra' },
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

  // ── Purchase & resale (AssetsTab) ─────────────────────────────────────────
  section_purchase:     { fr: 'Achat',            en: 'Purchase',        es: 'Compra' },
  section_resale:       { fr: 'Revente',          en: 'Resale',          es: 'Reventa' },
  label_purchase_price: { fr: 'Prix d\'achat',    en: 'Purchase price',  es: 'Precio de compra' },
  label_purchase_date:  { fr: 'Date d\'achat',    en: 'Purchase date',   es: 'Fecha de compra' },
  label_shipping_cost:  { fr: 'Frais de port',    en: 'Shipping cost',   es: 'Gastos de envío' },
  label_supplier:       { fr: 'Fournisseur',      en: 'Supplier',        es: 'Proveedor' },
  label_purchase_comment: { fr: 'Commentaire d\'achat', en: 'Purchase comment', es: 'Comentario de compra' },
  label_sold_price:     { fr: 'Prix de revente',  en: 'Resale price',    es: 'Precio de reventa' },
  label_sold_date:      { fr: 'Date de revente',  en: 'Resale date',     es: 'Fecha de reventa' },
  label_sold_to:        { fr: 'Vendu à',          en: 'Sold to',         es: 'Vendido a' },
  label_sold_paid_date: { fr: 'Payé le',          en: 'Paid on',         es: 'Pagado el' },
  label_unpaid:         { fr: 'Pas encore payé',  en: 'Not paid yet',    es: 'Aún no pagado' },
  label_gain_loss:      { fr: 'Gain / Perte',     en: 'Gain / Loss',     es: 'Ganancia / Pérdida' },
  label_total_invested: { fr: 'Total investi',    en: 'Total invested',  es: 'Total invertido' },
  label_total_recovered:{ fr: 'Total récupéré',   en: 'Total recovered', es: 'Total recuperado' },
  label_net:             { fr: 'Net',             en: 'Net',             es: 'Neto' },
  label_sold_badge:      { fr: 'Vendu',           en: 'Sold',            es: 'Vendido' },
  label_in_fleet:        { fr: 'Dans le parc',    en: 'In fleet',        es: 'En la flota' },
  btn_create_expense:   { fr: 'Créer la dépense', en: 'Create expense',  es: 'Crear gasto' },
  btn_update_expense:   { fr: 'Mettre à jour la dépense', en: 'Update expense', es: 'Actualizar gasto' },
  msg_expense_linked:   { fr: 'Dépense liée : {amount}€ le {date}', en: 'Linked expense: {amount}€ on {date}', es: 'Gasto vinculado: {amount}€ el {date}' },
  msg_no_purchase_price: { fr: 'Prix d\'achat non renseigné', en: 'Purchase price not set', es: 'Precio de compra no indicado' },
  msg_no_asset_data:    { fr: 'Aucune pièce avec un prix d\'achat ou de revente enregistré.', en: 'No equipment with a purchase or resale price recorded.', es: 'Ningún equipo con precio de compra o reventa registrado.' },
} satisfies Record<string, Tr>
