import type { Tr } from './types'

export const navigationI18n = {
  // Nav items
  nav_home:       { fr: 'Accueil',      en: 'Home',        es: 'Inicio' },
  nav_clients:    { fr: 'Clients',      en: 'Clients',     es: 'Clientes' },
  nav_planning:   { fr: 'Planning',     en: 'Planning',    es: 'Planificación' },
  nav_bookings:   { fr: 'Réservations', en: 'Bookings',    es: 'Reservas' },
  nav_accounting: { fr: 'Comptabilité', en: 'Accounting',  es: 'Contabilidad' },
  nav_documents:  { fr: 'Documents',    en: 'Documents',   es: 'Documentos' },
  nav_options:    { fr: 'Options',      en: 'Options',     es: 'Opciones' },
  nav_equipment:  { fr: 'Équipement',   en: 'Equipment',   es: 'Equipamiento' },
  nav_taxis:      { fr: 'Taxis',        en: 'Taxis',       es: 'Taxis' },
  nav_activities: { fr: 'Activités',    en: 'Activities',  es: 'Actividades' },
  nav_requests:   { fr: 'Demandes',     en: 'Requests',    es: 'Solicitudes' },

  // Theme toggle
  theme_light:    { fr: 'Thème clair',  en: 'Light theme', es: 'Tema claro' },
  theme_dark:     { fr: 'Thème sombre', en: 'Dark theme',  es: 'Tema oscuro' },

  // Logout
  btn_logout:     { fr: 'Déconnexion',  en: 'Sign out',    es: 'Cerrar sesión' },
  tooltip_logout: { fr: 'Se déconnecter', en: 'Sign out', es: 'Cerrar sesión' },
  tooltip_light_theme:  { fr: 'Passer en mode clair', en: 'Switch to light theme', es: 'Cambiar a tema claro' },
  tooltip_dark_theme:   { fr: 'Passer en mode sombre', en: 'Switch to dark theme', es: 'Cambiar a tema oscuro' },
} satisfies Record<string, Tr>
