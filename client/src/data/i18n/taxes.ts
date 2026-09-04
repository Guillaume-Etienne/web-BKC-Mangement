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
  status_done:            { fr: 'Terminé',         en: 'Done',           es: 'Completado' },

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
  msg_confirm_delete_trip: { fr: 'Supprimer ce trajet ?', en: 'Delete this trip?', es: '¿Eliminar este viaje?' },
  title_edit_taxi_trip: { fr: 'Modifier le trajet taxi', en: 'Edit taxi trip', es: 'Editar viaje de taxi' },
  label_client:  { fr: 'Client',  en: 'Client',  es: 'Cliente' },
  label_manager: { fr: 'Manager', en: 'Manager', es: 'Gerente' },
  label_centre:  { fr: 'Centre',  en: 'Centre',  es: 'Centro' },

  // TaxiFinanceTab
  title_financial_summary:  { fr: 'Résumé financier', en: 'Financial Summary', es: 'Resumen financiero' },
  section_manager_balance:  { fr: 'Solde du manager', en: 'Manager Balance', es: 'Saldo del gerente' },
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
