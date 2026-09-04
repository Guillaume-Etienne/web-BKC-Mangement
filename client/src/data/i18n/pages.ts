import type { Tr } from './types'

export const pagesI18n = {
  // HomePage
  page_home:       { fr: 'Accueil',         en: 'Home',          es: 'Inicio' },
  section_pending: { fr: 'En attente',      en: 'Pending',       es: 'Pendiente' },
  section_follow:  { fr: 'Suivis',          en: 'Follow-ups',    es: 'Seguimientos' },

  // PlanningView
  page_planning:   { fr: 'Planning',        en: 'Planning',      es: 'Planificación' },
  btn_drag_note:   { fr: 'Glisser pour déplacer', en: 'Drag to move', es: 'Arrastra para mover' },

  // RequestsPage (Enquiries)
  page_requests:   { fr: 'Demandes',        en: 'Requests',      es: 'Solicitudes' },
  desc_requests:   { fr: 'Tout ce qui arrive de l\'extérieur — un premier message, ou un formulaire de réservation complet.', en: 'Everything that came in from outside — a first message, or a full booking form.', es: 'Todo lo que llega desde fuera — un primer mensaje, o un formulario de reserva completo.' },
  tab_enquiries:   { fr: 'Enquêtes',        en: 'Enquiries',     es: 'Consultas' },
  tab_submissions: { fr: 'Soumissions',     en: 'Submissions',   es: 'Presentaciones' },
  tab_booking_forms: { fr: 'Formulaires de réservation', en: 'Booking forms', es: 'Formularios de reserva' },
  tab_archive:     { fr: 'Archive',         en: 'Archive',       es: 'Archivo' },

  // DocumentsPage
  page_documents:  { fr: 'Documents',       en: 'Documents',     es: 'Documentos' },
  tab_overview:    { fr: 'Aperçu',          en: 'Overview',      es: 'Resumen' },
  tab_visa_letter: { fr: 'Lettre de visa',  en: 'Visa Letter',   es: 'Carta de visado' },
  tab_booking_summary: { fr: 'Résumé de réservation', en: 'Booking Summary', es: 'Resumen de reserva' },
  tab_travel_guide: { fr: 'Guide de voyage', en: 'Travel Guide', es: 'Guía de viaje' },
  tab_welcome_guide: { fr: 'Guide de bienvenue', en: 'Welcome Guide', es: 'Guía de bienvenida' },
  tab_templates:   { fr: 'Modèles',         en: 'Templates',     es: 'Plantillas' },

  // DocumentsPage — Overview grid: one column per document type
  doc_type_confirmation:   { fr: 'Confirmation',    en: 'Confirmation',    es: 'Confirmación' },
  doc_type_visa_letter:    { fr: 'Lettre de visa',  en: 'Visa Letter',     es: 'Carta de visado' },
  doc_type_travel_guide:   { fr: 'Guide de voyage', en: 'Travel Guide',    es: 'Guía de viaje' },
  doc_type_welcome_guide:  { fr: 'Guide de bienvenue', en: 'Welcome Guide', es: 'Guía de bienvenida' },
  doc_type_client_account: { fr: 'Compte client',   en: 'Client Account',  es: 'Cuenta de cliente' },
  doc_type_update_form:    { fr: 'Formulaire de mise à jour', en: 'Update Form', es: 'Formulario de actualización' },

  // DocumentsPage — email send status badges
  email_status_pending:   { fr: 'En attente',  en: 'Pending',     es: 'Pendiente' },
  email_status_sent:      { fr: 'Envoyé',      en: 'Sent',        es: 'Enviado' },
  email_status_delivered: { fr: 'Distribué ✓', en: 'Delivered ✓', es: 'Entregado ✓' },
  email_status_opened:    { fr: 'Ouvert ✓✓',   en: 'Opened ✓✓',   es: 'Abierto ✓✓' },
  email_status_failed:    { fr: 'Échoué ✗',    en: 'Failed ✗',    es: 'Fallido ✗' },
  email_status_never_sent: { fr: 'Jamais envoyé', en: 'Never sent', es: 'Nunca enviado' },

  // DocumentsPage — buttons / section titles
  btn_generate_pdf:     { fr: 'Générer le PDF', en: 'Generate PDF', es: 'Generar PDF' },
  title_select_booking: { fr: 'Sélectionner la réservation', en: 'Select booking', es: 'Seleccionar reserva' },

  // HomePage follow-up statuses
  status_urgent:   { fr: 'Urgent',          en: 'Urgent',        es: 'Urgente' },
  status_normal:   { fr: 'Normal',          en: 'Normal',        es: 'Normal' },
  status_low:      { fr: 'Bas',             en: 'Low',           es: 'Bajo' },

  // HomePage pending-action priority chips (urgent | week | monitor)
  priority_monitor: { fr: 'À surveiller',   en: 'Monitor',       es: 'Vigilar' },

  // Generic page messages
  msg_no_data:     { fr: 'Aucune donnée',   en: 'No data',       es: 'Sin datos' },
  msg_loading:     { fr: 'Chargement…',     en: 'Loading…',      es: 'Cargando…' },
  msg_error_load:  { fr: 'Erreur au chargement', en: 'Error loading', es: 'Error al cargar' },

  // pendingActions.ts — HomePage alert messages. `{count}` / `{days}` are
  // replaced at runtime; singular/plural are separate keys because "enquiry"
  // → "enquiries" (and its FR/ES equivalents) isn't a trailing-s suffix.
  msg_unverified_payment:    { fr: '{count} paiement non vérifié',   en: '{count} unverified payment',   es: '{count} pago no verificado' },
  msg_unverified_payments:   { fr: '{count} paiements non vérifiés', en: '{count} unverified payments',  es: '{count} pagos no verificados' },
  msg_provisional_urgent:    { fr: 'Réservation provisoire — arrivée dans {days} jour(s)', en: 'Provisional booking — check-in in {days} day(s)', es: 'Reserva provisional — llegada en {days} día(s)' },
  msg_provisional_week:      { fr: 'Réservation provisoire — arrivée dans {days} jours',   en: 'Provisional booking — check-in in {days} days',   es: 'Reserva provisional — llegada en {days} días' },
  msg_visa_urgent:           { fr: 'Entrée visa dans {days} jour(s) — vérifier la lettre de visa', en: 'Visa entry in {days} day(s) — check visa letter', es: 'Entrada de visado en {days} día(s) — revisar la carta de visado' },
  msg_visa_week:             { fr: 'Entrée visa dans {days} jours — préparer la lettre de visa',   en: 'Visa entry in {days} days — prepare visa letter', es: 'Entrada de visado en {days} días — preparar la carta de visado' },
  msg_no_payment_urgent:     { fr: "Aucun paiement enregistré — arrivée demain ou aujourd'hui", en: 'No payment recorded — check-in tomorrow or today', es: 'Sin pago registrado — llegada mañana o hoy' },
  msg_no_payment_week:       { fr: 'Aucun paiement enregistré — arrivée dans {days} jours',     en: 'No payment recorded — check-in in {days} days',    es: 'Sin pago registrado — llegada en {days} días' },
  msg_new_enquiry:           { fr: '{count} nouvelle enquête à lire',   en: '{count} new enquiry to read',    es: '{count} nueva consulta para leer' },
  msg_new_enquiries:         { fr: '{count} nouvelles enquêtes à lire', en: '{count} new enquiries to read',  es: '{count} nuevas consultas para leer' },
  msg_new_booking_form:      { fr: '{count} nouveau formulaire de réservation à examiner',   en: '{count} new booking form to review',   es: '{count} nuevo formulario de reserva para revisar' },
  msg_new_booking_forms:     { fr: '{count} nouveaux formulaires de réservation à examiner', en: '{count} new booking forms to review',  es: '{count} nuevos formularios de reserva para revisar' },
  msg_silent_enquiry:        { fr: '{count} enquête en attente de votre réponse depuis une semaine ou plus',   en: '{count} enquiry waiting on you for a week or more',   es: '{count} consulta esperando su respuesta desde hace una semana o más' },
  msg_silent_enquiries:      { fr: '{count} enquêtes en attente de votre réponse depuis une semaine ou plus',  en: '{count} enquiries waiting on you for a week or more', es: '{count} consultas esperando su respuesta desde hace una semana o más' },
  msg_crm_failed_enquiry:    { fr: '{count} enquête non ajoutée à Brevo',   en: '{count} enquiry not added to Brevo',   es: '{count} consulta no añadida a Brevo' },
  msg_crm_failed_enquiries:  { fr: '{count} enquêtes non ajoutées à Brevo', en: '{count} enquiries not added to Brevo', es: '{count} consultas no añadidas a Brevo' },
  msg_confirmation_missing:  { fr: 'Réservation confirmée — email de confirmation non envoyé', en: 'Booking confirmed — confirmation email not sent', es: 'Reserva confirmada — email de confirmación no enviado' },
  msg_travel_guide_urgent:   { fr: 'Guide de voyage non envoyé — arrivée très proche',       en: 'Travel guide not sent — check-in very soon',       es: 'Guía de viaje no enviada — llegada muy próxima' },
  msg_travel_guide_week:     { fr: 'Guide de voyage non envoyé — arrivée sous une semaine',  en: 'Travel guide not sent — check-in within a week',   es: 'Guía de viaje no enviada — llegada dentro de una semana' },
  msg_welcome_guide:         { fr: 'Guide de bienvenue non envoyé — client sur place',       en: 'Welcome guide not sent — guest is on-site',        es: 'Guía de bienvenida no enviada — huésped en el lugar' },
  msg_unlinked_taxi_trip:    { fr: '{count} trajet taxi non lié à une réservation',    en: '{count} taxi trip not linked to any booking',   es: '{count} viaje en taxi no vinculado a ninguna reserva' },
  msg_unlinked_taxi_trips:   { fr: '{count} trajets taxi non liés à une réservation',  en: '{count} taxi trips not linked to any booking',  es: '{count} viajes en taxi no vinculados a ninguna reserva' },
} satisfies Record<string, Tr>
