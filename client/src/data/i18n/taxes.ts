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
  label_no_vehicle: { fr: 'Aucun véhicule', en: 'No vehicle',    es: 'Sin vehículo' },
  modal_new_driver: { fr: 'Nouveau chauffeur', en: 'New driver', es: 'Nuevo conductor' },
  modal_edit_driver: { fr: 'Modifier le chauffeur', en: 'Edit driver', es: 'Editar conductor' },
  section_trips:   { fr: 'Trajets taxi',    en: 'Taxi trips',    es: 'Viajes de taxi' },
  view_list:       { fr: 'Liste',           en: 'List',          es: 'Lista' },
  view_kanban:     { fr: 'Kanban',          en: 'Kanban',        es: 'Kanban' },

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

  // Trip statuses (TaxiTripStatus: confirmed | needs_details | done — distinct
  // from the status_* keys above, which belong to an older/unused status set)
  status_confirmed_trip:  { fr: 'Confirmé',        en: 'Confirmed',      es: 'Confirmado' },
  status_needs_details:   { fr: 'Détails requis',  en: 'Needs details',  es: 'Faltan detalles' },
  status_done:            { fr: 'Payé',            en: 'Paid',           es: 'Pagado' },

  // DriverStatementPanel — KPI cards
  label_completed: { fr: 'Terminés',   en: 'Completed', es: 'Completados' },
  label_upcoming:  { fr: 'À venir',    en: 'Upcoming',  es: 'Próximos' },
  label_driver_share_link: { fr: 'Lien du chauffeur', en: 'Driver share link', es: 'Enlace del conductor' },
  msg_no_share_link: { fr: 'Aucun lien pour le moment', en: 'No shareable link yet', es: 'Aún no hay enlace' },
  btn_generate_link: { fr: 'Générer le lien', en: 'Generate link', es: 'Generar enlace' },
  msg_generating:    { fr: 'Génération…',     en: 'Generating…',   es: 'Generando…' },
  btn_copy_link:     { fr: 'Copier',           en: 'Copy',          es: 'Copiar' },
  msg_copied:        { fr: '✓ Copié',          en: '✓ Copied',      es: '✓ Copiado' },
  btn_open_link:     { fr: 'Ouvrir',           en: 'Open',          es: 'Abrir' },
  label_upcoming_trips:  { fr: 'Trajets à venir',  en: 'Upcoming trips',  es: 'Viajes próximos' },
  label_completed_trips: { fr: 'Trajets terminés', en: 'Completed trips', es: 'Viajes completados' },
  msg_no_trips: { fr: 'Aucun trajet.', en: 'No trips.', es: 'Sin viajes.' },

  // TaxiListView / TaxiKanbanView — controls
  label_sort:       { fr: 'Trier :',   en: 'Sort:',   es: 'Ordenar:' },
  label_filter:     { fr: 'Filtrer :', en: 'Filter:', es: 'Filtrar:' },
  label_all:        { fr: 'Tous',      en: 'All',     es: 'Todos' },
  label_unassigned: { fr: 'Non assigné', en: 'Unassigned', es: 'Sin asignar' },
  btn_add_trip:     { fr: 'Ajouter un trajet', en: 'Add trip', es: 'Añadir viaje' },
  btn_today:        { fr: 'Aujourd\'hui', en: 'Today', es: 'Hoy' },
  // TaxiTripFilters
  period_tomorrow:  { fr: 'Demain',        en: 'Tomorrow',   es: 'Mañana' },
  period_week:      { fr: 'Cette semaine', en: 'This week',  es: 'Esta semana' },
  period_day:       { fr: 'Un jour…',      en: 'Pick a day…', es: 'Un día…' },
  period_range:     { fr: 'Période…',      en: 'Range…',     es: 'Periodo…' },
  placeholder_search_trip: { fr: 'Client, n° résa, chauffeur, notes…', en: 'Client, booking #, driver, notes…', es: 'Cliente, n.º reserva, conductor, notas…' },
  filter_all_statuses: { fr: 'Tous les statuts', en: 'All statuses', es: 'Todos los estados' },
  filter_all_types:    { fr: 'Tous les trajets', en: 'All routes',   es: 'Todos los trayectos' },
  filter_private_all:  { fr: 'Privés inclus',    en: 'Private: included', es: 'Privados incluidos' },
  filter_private_only: { fr: 'Privés seulement', en: 'Private only',      es: 'Solo privados' },
  filter_private_hide: { fr: 'Sans les privés',  en: 'Hide private',      es: 'Sin privados' },
  filter_agency_all:   { fr: 'Agence incluse',   en: 'Agency: included',  es: 'Agencia incluida' },
  filter_agency_only:  { fr: 'Agence seulement', en: 'Agency-billed only', es: 'Solo agencia' },
  filter_agency_hide:  { fr: 'Sans agence',      en: 'Hide agency-billed', es: 'Sin agencia' },
  filter_to_handle:    { fr: 'À traiter',        en: 'To handle',         es: 'Por gestionar' },
  filter_to_handle_hint: { fr: 'À venir et : sans chauffeur, détails requis, ou 0 € sans agence', en: 'Upcoming and: no driver, needs details, or 0 € not billed to an agency', es: 'Próximos y: sin conductor, faltan detalles, o 0 € sin agencia' },
  btn_reset_filters:   { fr: 'Réinitialiser',    en: 'Reset filters',     es: 'Restablecer' },
  msg_confirm_delete_trip: { fr: 'Supprimer ce trajet ?', en: 'Delete this trip?', es: '¿Eliminar este viaje?' },
  title_edit_taxi_trip: { fr: 'Modifier le trajet taxi', en: 'Edit taxi trip', es: 'Editar viaje de taxi' },
  label_client:  { fr: 'Client',  en: 'Client',  es: 'Cliente' },
  label_manager: { fr: 'Manager', en: 'Manager', es: 'Gerente' },
  label_centre:  { fr: 'Centre',  en: 'Centre',  es: 'Centro' },

  // TaxiFinanceTab
  title_financial_summary:  { fr: 'Résumé financier', en: 'Financial Summary', es: 'Resumen financiero' },
  section_manager_balance:  { fr: 'Solde du manager', en: 'Manager Balance', es: 'Saldo del gerente' },
  section_drivers_paid:     { fr: 'Chauffeurs — payé à ce jour', en: 'Drivers — paid to date', es: 'Conductores — pagado hasta hoy' },
  label_drv_paid:           { fr: 'Payé', en: 'Paid', es: 'Pagado' },
  label_drv_to_pay:         { fr: 'À payer (course passée)', en: 'To pay (past trip)', es: 'Por pagar (viaje pasado)' },
  label_drv_trips:          { fr: 'Courses payées', en: 'Paid trips', es: 'Viajes pagados' },
  msg_drv_unpaid_hint:      { fr: 'Marque une course « Payé » dans la liste dès que le chauffeur est réglé.', en: 'Mark a trip “Paid” in the list once the driver is paid.', es: 'Marca un viaje «Pagado» en la lista cuando se pague al conductor.' },
  section_advanced:         { fr: 'Avancé pour les clients — taxis payés', en: 'Advanced for clients — paid taxis', es: 'Adelantado por clientes — taxis pagados' },
  label_adv_booking:        { fr: 'Résa', en: 'Booking', es: 'Reserva' },
  label_adv_out:            { fr: 'Sorti (chauffeur)', en: 'Paid out (driver)', es: 'Pagado (conductor)' },
  label_adv_billed:         { fr: 'Facturé au client', en: 'Billed to client', es: 'Facturado al cliente' },
  label_adv_gap:            { fr: 'Écart', en: 'Gap', es: 'Diferencia' },
  msg_adv_hint:             { fr: 'Ce que le client doit encore sur sa résa : Compta → Réservations (reste à payer) ou le tableau de bord (recouvrement).', en: 'What the client still owes on the booking: Accounting → Bookings (remaining to pay) or the dashboard (collections).', es: 'Lo que el cliente aún debe: Contabilidad → Reservas (resto por pagar) o el panel (cobros).' },
  msg_adv_empty:            { fr: 'Aucun taxi payé rattaché à une résa pour le moment.', en: 'No paid taxi linked to a booking yet.', es: 'Aún no hay taxis pagados vinculados a una reserva.' },
  label_total_earned:       { fr: 'Total gagné',       en: 'Total earned',    es: 'Total ganado' },
  label_total_paid:         { fr: 'Total payé (avances)', en: 'Total paid (advances)', es: 'Total pagado (anticipos)' },
  label_balance_owe:        { fr: '🟠 On doit au manager',      en: '🟠 We owe the manager',          es: '🟠 Debemos al gerente' },
  label_balance_credit:     { fr: '🟢 Manager trop payé (crédit)', en: '🟢 Manager overpaid (credit)', es: '🟢 Gerente pagado de más (crédito)' },
  label_balanced:           { fr: '⚪ Équilibré',      en: '⚪ Balanced',      es: '⚪ Equilibrado' },
  btn_add_payment:          { fr: 'Ajouter un paiement', en: 'Add Payment', es: 'Añadir pago' },
  section_payment_history:  { fr: 'Historique des paiements', en: 'Payment History', es: 'Historial de pagos' },
  msg_no_payments:          { fr: 'Aucun paiement enregistré', en: 'No payments recorded', es: 'Sin pagos registrados' },
  msg_confirm_delete_payment: { fr: 'Supprimer ce paiement ?', en: 'Delete this payment?', es: '¿Eliminar este pago?' },
} satisfies Record<string, Tr>
