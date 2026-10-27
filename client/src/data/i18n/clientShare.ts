import type { Lang } from '../../types/database'
import type { Tr } from './types'

// Texts of the client's own share page (ClientSharePage). Separate from the admin
// `i18n` object on purpose: that page is public, has no LanguageProvider, and its
// language is the visitor's (browser language, switchable on the page).

const T = {
  // page chrome
  header_readonly:   { fr: 'Votre séjour — Lecture seule', en: 'Your stay — Read-only', es: 'Su estancia — Solo lectura' },
  loading:           { fr: 'Chargement…', en: 'Loading…', es: 'Cargando…' },
  not_found_title:   { fr: 'Réservation introuvable', en: 'Booking not found', es: 'Reserva no encontrada' },
  not_found_msg:     { fr: 'Ce lien est peut-être invalide ou expiré.', en: 'This link may be invalid or expired.', es: 'Este enlace puede no ser válido o haber caducado.' },
  booking:           { fr: 'Réservation', en: 'Booking', es: 'Reserva' },
  show_equipment:    { fr: 'Afficher le matériel', en: 'Show equipment', es: 'Mostrar el material' },
  language:          { fr: 'Langue', en: 'Language', es: 'Idioma' },
  night:             { fr: 'nuit', en: 'night', es: 'noche' },
  nights:            { fr: 'nuits', en: 'nights', es: 'noches' },
  person:            { fr: 'personne', en: 'person', es: 'persona' },
  persons:           { fr: 'personnes', en: 'persons', es: 'personas' },
  per_day:           { fr: 'jour', en: 'day', es: 'día' },

  // booking status
  status_confirmed:   { fr: 'Confirmée', en: 'Confirmed', es: 'Confirmada' },
  status_provisional: { fr: 'Provisoire', en: 'Provisional', es: 'Provisional' },
  status_cancelled:   { fr: 'Annulée', en: 'Cancelled', es: 'Cancelada' },

  // agency
  agency_arranged:    { fr: 'Votre voyage a été organisé par', en: 'Your trip was arranged through', es: 'Su viaje fue organizado por' },
  agency_not_charged: { fr: 'Ce qu’elle prend en charge ne vous est pas facturé ici.', en: 'What they cover is not charged to you here.', es: 'Lo que cubre no se le cobra aquí.' },
  agency_default:     { fr: 'l’agence', en: 'the agency', es: 'la agencia' },
  agency_note:        { fr: 'Les lignes affichées « — » ou « Dans le forfait » sont prises en charge par {agency}, qui a organisé votre voyage. Elles ne vous sont pas facturées et ne font pas partie du solde ci-dessus.', en: 'Lines shown as “—” or “In package” are covered by {agency}, who arranged your trip. They are not charged to you and are not part of the balance above.', es: 'Las líneas mostradas como «—» o «En el paquete» están cubiertas por {agency}, que organizó su viaje. No se le cobran y no forman parte del saldo anterior.' },
  in_package:         { fr: 'Dans le forfait', en: 'In package', es: 'En el paquete' },
  included:           { fr: 'Inclus', en: 'Included', es: 'Incluido' },

  // sections
  sec_accommodation:  { fr: 'Hébergement', en: 'Accommodation', es: 'Alojamiento' },
  sec_lessons:        { fr: 'Cours de kite', en: 'Kite lessons', es: 'Clases de kite' },
  sec_rentals:        { fr: 'Location de matériel', en: 'Equipment rentals', es: 'Alquiler de material' },
  sec_taxis:          { fr: 'Transferts en taxi', en: 'Taxi transfers', es: 'Traslados en taxi' },
  sec_dining:         { fr: 'Repas', en: 'Dining', es: 'Comidas' },
  sec_activities:     { fr: 'Activités', en: 'Activities', es: 'Actividades' },
  sec_center_access:  { fr: 'Accès au centre', en: 'Center access', es: 'Acceso al centro' },
  sec_extras:         { fr: 'Extras', en: 'Extras', es: 'Extras' },
  sec_per_guest:      { fr: 'Détail par voyageur', en: 'Per-guest breakdown', es: 'Desglose por viajero' },
  sec_payments:       { fr: 'Paiements', en: 'Payments', es: 'Pagos' },
  sec_balance:        { fr: 'Solde', en: 'Balance', es: 'Saldo' },

  // columns
  col_room:           { fr: 'Chambre', en: 'Room', es: 'Habitación' },
  col_nights:         { fr: 'Nuits', en: 'Nights', es: 'Noches' },
  col_per_night:      { fr: 'Par nuit', en: 'Per night', es: 'Por noche' },
  col_total:          { fr: 'Total', en: 'Total', es: 'Total' },
  col_date:           { fr: 'Date', en: 'Date', es: 'Fecha' },
  col_type:           { fr: 'Type', en: 'Type', es: 'Tipo' },
  col_guest:          { fr: 'Voyageur', en: 'Guest', es: 'Viajero' },
  col_guests:         { fr: 'Voyageurs', en: 'Guests', es: 'Viajeros' },
  col_duration:       { fr: 'Durée', en: 'Duration', es: 'Duración' },
  col_instructor:     { fr: 'Moniteur', en: 'Instructor', es: 'Monitor' },
  col_item:           { fr: 'Article', en: 'Item', es: 'Artículo' },
  col_price:          { fr: 'Prix', en: 'Price', es: 'Precio' },
  col_route:          { fr: 'Trajet', en: 'Route', es: 'Trayecto' },
  col_pax:            { fr: 'Pers.', en: 'Pax', es: 'Pers.' },
  col_event:          { fr: 'Repas', en: 'Event', es: 'Comida' },
  col_detail:         { fr: 'Détail', en: 'Detail', es: 'Detalle' },
  col_activity:       { fr: 'Activité', en: 'Activity', es: 'Actividad' },
  col_qty:            { fr: 'Qté', en: 'Qty', es: 'Cant.' },
  col_method:         { fr: 'Moyen', en: 'Method', es: 'Método' },
  col_note:           { fr: 'Note', en: 'Note', es: 'Nota' },
  col_amount:         { fr: 'Montant', en: 'Amount', es: 'Importe' },
  external:           { fr: 'Externe', en: 'External', es: 'Externo' },

  // subtotals
  sub_accommodation:  { fr: 'Sous-total hébergement', en: 'Subtotal accommodation', es: 'Subtotal alojamiento' },
  sub_lessons:        { fr: 'Sous-total cours', en: 'Subtotal lessons', es: 'Subtotal clases' },
  sub_rentals:        { fr: 'Sous-total locations', en: 'Subtotal rentals', es: 'Subtotal alquileres' },
  sub_taxis:          { fr: 'Sous-total taxis', en: 'Subtotal taxis', es: 'Subtotal taxis' },
  sub_dining:         { fr: 'Sous-total repas', en: 'Subtotal dining', es: 'Subtotal comidas' },
  sub_activities:     { fr: 'Sous-total activités', en: 'Subtotal activities', es: 'Subtotal actividades' },
  sub_center_access:  { fr: 'Sous-total accès au centre', en: 'Subtotal center access', es: 'Subtotal acceso al centro' },
  sub_extras:         { fr: 'Sous-total extras', en: 'Subtotal extras', es: 'Subtotal extras' },

  // lessons / rentals
  lesson_private:     { fr: 'Particulier', en: 'Private', es: 'Particular' },
  lesson_group:       { fr: 'Groupe', en: 'Group', es: 'Grupo' },
  lesson_supervision: { fr: 'Supervision', en: 'Supervision', es: 'Supervisión' },
  lesson_line:        { fr: 'Cours {type} {h}h', en: '{type} lesson {h}h', es: 'Clase {type} {h}h' },
  agency_package_line: { fr: '— forfait {agency}', en: '— {agency} package', es: '— paquete {agency}' },
  rent_kite:          { fr: 'Kite + barre', en: 'Kite + bar', es: 'Kite + barra' },
  rent_full:          { fr: 'Kite + barre + board', en: 'Kite + bar + board', es: 'Kite + barra + tabla' },
  rent_board:         { fr: 'Board', en: 'Board', es: 'Tabla' },
  rent_surfboard:     { fr: 'Planche de surf', en: 'Surfboard', es: 'Tabla de surf' },
  rent_foilboard:     { fr: 'Planche de foil', en: 'Foilboard', es: 'Tabla de foil' },
  rent_free:          { fr: 'Autre', en: 'Other', es: 'Otro' },
  rent_generic:       { fr: 'Location', en: 'Rental', es: 'Alquiler' },
  slot_morning:       { fr: 'Matin', en: 'Morning', es: 'Mañana' },
  slot_afternoon:     { fr: 'Après-midi', en: 'Afternoon', es: 'Tarde' },
  slot_full_day:      { fr: 'Journée', en: 'Full day', es: 'Día completo' },

  // taxi routes
  taxi_aero_to_center: { fr: 'Aéroport → Bilene', en: 'Airport → Bilene', es: 'Aeropuerto → Bilene' },
  taxi_center_to_aero: { fr: 'Bilene → Aéroport', en: 'Bilene → Airport', es: 'Bilene → Aeropuerto' },
  taxi_center_to_town: { fr: 'Bilene → Maputo', en: 'Bilene → Maputo', es: 'Bilene → Maputo' },
  taxi_town_to_center: { fr: 'Maputo → Bilene', en: 'Maputo → Bilene', es: 'Maputo → Bilene' },
  taxi_other:          { fr: 'Autre', en: 'Other', es: 'Otro' },

  // dining
  dining_default:     { fr: 'repas', en: 'dining', es: 'comida' },

  // payments
  pay_cash_eur:       { fr: 'Espèces (€)', en: 'Cash (€)', es: 'Efectivo (€)' },
  pay_cash_mzn:       { fr: 'Espèces (MZN)', en: 'Cash (MZN)', es: 'Efectivo (MZN)' },
  pay_transfer:       { fr: 'Virement', en: 'Transfer', es: 'Transferencia' },
  pay_card_palmeiras: { fr: 'Carte – Palmeiras', en: 'Card – Palmeiras', es: 'Tarjeta – Palmeiras' },
  discount:           { fr: 'Remise', en: 'Discount', es: 'Descuento' },
  deposit:            { fr: 'Acompte', en: 'Deposit', es: 'Depósito' },
  no_payments:        { fr: 'Aucun paiement enregistré pour le moment.', en: 'No payments recorded yet.', es: 'Aún no hay pagos registrados.' },
  total_discounts:    { fr: 'Total des remises', en: 'Total discounts', es: 'Total de descuentos' },
  total_paid:         { fr: 'Total payé', en: 'Total paid', es: 'Total pagado' },

  // balance
  total_charges:      { fr: 'Total à payer', en: 'Total charges', es: 'Total a pagar' },
  discounts:          { fr: 'Remises', en: 'Discounts', es: 'Descuentos' },
  balance:            { fr: 'Solde', en: 'Balance', es: 'Saldo' },
  due:                { fr: 'à payer', en: 'due', es: 'pendiente' },
  credit:             { fr: 'de crédit', en: 'credit', es: 'a favor' },
} satisfies Record<string, Tr>

export type ShareKey = keyof typeof T

export const shareT = (lang: Lang, key: ShareKey): string => T[key][lang]
