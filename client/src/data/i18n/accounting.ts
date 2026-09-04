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
  rev_taxi_margin: { fr: 'Marge taxi',   en: 'Taxi margin',   es: 'Margen de taxi' },
  rev_activities: { fr: 'Activités',     en: 'Activities',    es: 'Actividades' },
  rev_events:     { fr: 'Événements',    en: 'Events',        es: 'Eventos' },
  rev_center_access: { fr: 'Accès centre', en: 'Center access', es: 'Acceso al centro' },
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
  tab_palmeiras:  { fr: 'Palmeiras',      en: 'Palmeiras',    es: 'Palmeiras' },

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

  // Additional tabs
  tab_unverified:  { fr: 'À vérifier',      en: 'To Verify',        es: 'Por verificar' },
  tab_events:      { fr: 'Événements',      en: 'Events',           es: 'Eventos' },

  // Status & action labels
  status_already_paid: { fr: 'Déjà payé',   en: 'Already paid',     es: 'Ya pagado' },
  status_collected:    { fr: 'Collecté',    en: 'Collected',        es: 'Cobrado' },
  status_verified:     { fr: 'Vérifié',     en: 'Verified',         es: 'Verificado' },

  // Actions
  btn_add_payment:     { fr: 'Ajouter un paiement', en: 'Add payment', es: 'Añadir pago' },
  btn_add_discount:    { fr: 'Ajouter une remise', en: 'Add discount', es: 'Añadir descuento' },
  btn_add_expense:     { fr: 'Ajouter une dépense', en: 'Add expense', es: 'Añadir gasto' },

  // Accommodation types
  label_bungalows:     { fr: 'Bungalows', en: 'Bungalows', es: 'Bungalows' },
  label_external:      { fr: 'Externes', en: 'External', es: 'Externos' },

  // Collection status
  status_here:         { fr: 'Actuellement ici', en: 'Currently here', es: 'Actualmente aquí' },
  status_departed:     { fr: 'Parti(e)',        en: 'Departed',        es: 'Partido/a' },
  status_upcoming:     { fr: 'À venir',         en: 'Upcoming',        es: 'Próximo' },
  hint_collect_before: { fr: 'Collecter avant départ', en: 'Collect before checkout', es: 'Cobrar antes de salida' },
  hint_to_chase:       { fr: 'À rattraper',    en: 'To chase',        es: 'Para perseguir' },
  hint_not_yet_due:    { fr: 'Pas encore dû',  en: 'Not yet due',     es: 'Aún no vencido' },

  // BookingFinances — payment method labels
  method_cash_eur:        { fr: 'Espèces EUR',        en: 'Cash EUR',        es: 'Efectivo EUR' },
  method_cash_mzn:        { fr: 'Espèces MZN',        en: 'Cash MZN',        es: 'Efectivo MZN' },
  method_transfer:        { fr: 'Virement',           en: 'Transfer',        es: 'Transferencia' },
  method_card_palmeiras:  { fr: 'Carte (Palmeiras)',  en: 'Card (Palmeiras)', es: 'Tarjeta (Palmeiras)' },

  // BookingFinances — forms (payment / discount / room price / rental / lesson price)
  bf_note_short:          { fr: 'Note',  en: 'Note', es: 'Nota' },
  bf_amount_eur:          { fr: 'Montant (€)', en: 'Amount (€)', es: 'Cantidad (€)' },
  bf_reason:              { fr: 'Motif', en: 'Reason', es: 'Motivo' },
  bf_method:              { fr: 'Méthode', en: 'Method', es: 'Método' },
  bf_deposit:             { fr: 'Acompte', en: 'Deposit', es: 'Depósito' },
  bf_verified:            { fr: 'Vérifié', en: 'Verified', es: 'Verificado' },
  bf_status_verified:     { fr: '✓ Vérifié', en: '✓ Verified', es: '✓ Verificado' },
  bf_status_to_verify:    { fr: '⚠ À vérifier', en: '⚠ To verify', es: '⚠ Por verificar' },
  bf_discount_badge:      { fr: 'Remise', en: 'Discount', es: 'Descuento' },
  bf_add_discount:        { fr: 'Ajouter une remise', en: 'Add discount', es: 'Añadir descuento' },
  bf_edit_discount:       { fr: 'Modifier la remise', en: 'Edit discount', es: 'Editar descuento' },
  bf_add_payment:         { fr: 'Ajouter un paiement', en: 'Add payment', es: 'Añadir pago' },
  bf_edit_payment:        { fr: 'Modifier le paiement', en: 'Edit payment', es: 'Editar pago' },
  bf_plus_discount:       { fr: '+ Remise', en: '+ Discount', es: '+ Descuento' },
  bf_plus_payment:        { fr: '+ Paiement', en: '+ Payment', es: '+ Pago' },
  bf_placeholder_discount_reason: { fr: 'ex. Remise fidélité', en: 'e.g. Loyalty discount', es: 'ej. Descuento por fidelidad' },
  bf_save_discount:       { fr: 'Enregistrer la remise', en: 'Save discount', es: 'Guardar descuento' },
  bf_save_payment:        { fr: 'Enregistrer le paiement', en: 'Save payment', es: 'Guardar pago' },
  bf_update:              { fr: 'Mettre à jour', en: 'Update', es: 'Actualizar' },
  bf_client_price_label:  { fr: 'Prix client (€/h)', en: 'Client price (€/h)', es: 'Precio cliente (€/h)' },
  bf_price_list:          { fr: 'Grille tarifaire : {rate}/h', en: 'Price list: {rate}/h', es: 'Tarifa: {rate}/h' },
  bf_back_to_price_list:  { fr: 'Revenir à la grille tarifaire', en: 'Back to price list', es: 'Volver a la tarifa' },

  // BookingFinances — booking detail panel
  bf_nights:              { fr: '{count} nuits', en: '{count} nights', es: '{count} noches' },
  bf_deposit_suggested:   { fr: 'Acompte suggéré : {amount}', en: 'Deposit suggested: {amount}', es: 'Depósito sugerido: {amount}' },
  bf_settled:             { fr: 'Soldé ✓', en: 'Settled ✓', es: 'Saldado ✓' },
  bf_price_breakdown:     { fr: 'Détail du prix', en: 'Price breakdown', es: 'Desglose del precio' },
  bf_equipment_rentals:   { fr: 'Locations de matériel', en: 'Equipment rentals', es: 'Alquileres de equipo' },
  bf_taxis:               { fr: 'Taxis', en: 'Taxis', es: 'Taxis' },
  bf_dining_events:       { fr: 'Événements repas', en: 'Dining events', es: 'Eventos de comida' },
  bf_billed_per_stay:     { fr: 'facturé pour le séjour ↓', en: 'billed per stay ↓', es: 'facturado por la estancia ↓' },
  bf_warn_base_rate:      { fr: '⚠ tarif de base', en: '⚠ base rate', es: '⚠ tarifa base' },
  bf_warn_no_price:       { fr: '⚠ aucun prix', en: '⚠ no price', es: '⚠ sin precio' },
  bf_flat_rate:           { fr: 'tarif forfaitaire', en: 'flat rate', es: 'tarifa fija' },
  bf_cost:                { fr: 'Coût', en: 'Cost', es: 'Costo' },
  bf_margin:              { fr: 'Marge', en: 'Margin', es: 'Margen' },
  bf_custom_price:        { fr: 'prix personnalisé', en: 'custom price', es: 'precio personalizado' },
  bf_no_price_configured: { fr: 'aucun prix configuré', en: 'no price configured', es: 'sin precio configurado' },
  bf_word_lesson:         { fr: 'cours', en: 'lesson', es: 'clase' },
  bf_word_rental:         { fr: 'location', en: 'rental', es: 'alquiler' },
  bf_word_dining:         { fr: 'repas', en: 'dining', es: 'comida' },
  bf_unnamed:             { fr: '(sans nom)', en: '(unnamed)', es: '(sin nombre)' },
  bf_person:              { fr: 'personne', en: 'person', es: 'persona' },
  bf_persons:             { fr: 'personnes', en: 'persons', es: 'personas' },
  bf_per_guest_breakdown: { fr: 'Détail par invité', en: 'Per-guest breakdown', es: 'Desglose por huésped' },
  bf_payments_header:     { fr: 'Paiements', en: 'Payments', es: 'Pagos' },
  bf_no_payments:         { fr: 'Aucun paiement enregistré pour le moment.', en: 'No payments recorded yet.', es: 'Aún no hay pagos registrados.' },
  bf_total_paid:          { fr: 'Total payé', en: 'Total paid', es: 'Total pagado' },

  // BookingFinances — main table & totals bar
  bf_balance:             { fr: 'Solde', en: 'Balance', es: 'Saldo' },
  bf_hide_cancelled:      { fr: 'Masquer les réservations annulées', en: 'Hide cancelled bookings', es: 'Ocultar reservas canceladas' },
  bf_show_cancelled:      { fr: 'Afficher les réservations annulées', en: 'Show cancelled bookings', es: 'Mostrar reservas canceladas' },
  bf_unlinked_taxi_trips: { fr: 'Trajets taxi non liés', en: 'Unlinked taxi trips', es: 'Viajes en taxi no vinculados' },
  bf_not_attached:        { fr: 'Non attaché à une réservation', en: 'Not attached to any booking', es: 'No adjunto a ninguna reserva' },
  bf_type:                { fr: 'Type', en: 'Type', es: 'Tipo' },
  bf_persons_col:         { fr: 'Personnes', en: 'Persons', es: 'Personas' },
} satisfies Record<string, Tr>
