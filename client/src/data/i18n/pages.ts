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
} satisfies Record<string, Tr>
