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
  tab_enquiries:   { fr: 'Enquêtes',        en: 'Enquiries',     es: 'Consultas' },
  tab_submissions: { fr: 'Soumissions',     en: 'Submissions',   es: 'Presentaciones' },
  tab_archive:     { fr: 'Archive',         en: 'Archive',       es: 'Archivo' },

  // DocumentsPage
  page_documents:  { fr: 'Documents',       en: 'Documents',     es: 'Documentos' },
  tab_overview:    { fr: 'Aperçu',          en: 'Overview',      es: 'Resumen' },
  tab_templates:   { fr: 'Modèles',         en: 'Templates',     es: 'Plantillas' },

  // HomePage follow-up statuses
  status_urgent:   { fr: 'Urgent',          en: 'Urgent',        es: 'Urgente' },
  status_normal:   { fr: 'Normal',          en: 'Normal',        es: 'Normal' },
  status_low:      { fr: 'Bas',             en: 'Low',           es: 'Bajo' },

  // Generic page messages
  msg_no_data:     { fr: 'Aucune donnée',   en: 'No data',       es: 'Sin datos' },
  msg_loading:     { fr: 'Chargement…',     en: 'Loading…',      es: 'Cargando…' },
  msg_error_load:  { fr: 'Erreur au chargement', en: 'Error loading', es: 'Error al cargar' },
} satisfies Record<string, Tr>
