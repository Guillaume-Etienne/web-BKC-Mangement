import type { Tr } from './types'

export const clientsI18n = {
  page_title:     { fr: 'Clients',        en: 'Clients',      es: 'Clientes' },

  // Actions
  btn_new_client: { fr: 'Nouveau client', en: 'New client',   es: 'Nuevo cliente' },
  btn_view:       { fr: 'Voir',           en: 'View',         es: 'Ver' },
  btn_contact:    { fr: 'Contacter',      en: 'Contact',      es: 'Contactar' },

  // Details
  label_first_name: { fr: 'Prénom',       en: 'First name',   es: 'Nombre' },
  label_last_name:  { fr: 'Nom',          en: 'Last name',    es: 'Apellido' },
  label_contact:    { fr: 'Contact',      en: 'Contact',      es: 'Contacto' },
  label_address:    { fr: 'Adresse',      en: 'Address',      es: 'Dirección' },
  label_city:       { fr: 'Ville',        en: 'City',         es: 'Ciudad' },
  label_country:    { fr: 'Pays',         en: 'Country',      es: 'País' },
  label_origin:     { fr: 'Origine',      en: 'Origin',       es: 'Origen' },

  // Tabs
  tab_timeline:   { fr: 'Chronologie',    en: 'Timeline',     es: 'Cronología' },
  tab_bookings:   { fr: 'Réservations',   en: 'Bookings',     es: 'Reservas' },
  tab_notes:      { fr: 'Notes',          en: 'Notes',        es: 'Notas' },
  tab_documents:  { fr: 'Documents',      en: 'Documents',    es: 'Documentos' },

  // Sections
  section_personal: { fr: 'Informations personnelles', en: 'Personal info', es: 'Información personal' },
  section_contact:  { fr: 'Coordonnées', en: 'Contact info', es: 'Información de contacto' },
  section_history:  { fr: 'Historique', en: 'History', es: 'Historial' },

  // Messages
  msg_no_bookings: { fr: 'Aucune réservation', en: 'No bookings', es: 'Sin reservas' },
  msg_no_notes:    { fr: 'Aucune note',  en: 'No notes',     es: 'Sin notas' },
} satisfies Record<string, Tr>
