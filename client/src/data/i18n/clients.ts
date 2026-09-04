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

  // ClientTimeline — filter chips
  ct_filter_all:       { fr: 'Tout',          en: 'Everything',  es: 'Todo' },
  ct_filter_words:      { fr: 'Mots',          en: 'Words',       es: 'Palabras' },
  ct_filter_stays:      { fr: 'Séjours',       en: 'Stays',       es: 'Estancias' },
  ct_filter_money:      { fr: 'Argent',        en: 'Money',       es: 'Dinero' },
  ct_filter_documents:  { fr: 'Documents',     en: 'Documents',   es: 'Documentos' },

  // ClientTimeline — activity & note composer
  ct_last_activity:      { fr: 'Dernière activité', en: 'Last activity', es: 'Última actividad' },
  ct_today:              { fr: 'aujourd\'hui', en: 'today', es: 'hoy' },
  ct_day_ago:            { fr: 'il y a {count} jour',  en: '{count} day ago',  es: 'hace {count} día' },
  ct_days_ago:           { fr: 'il y a {count} jours', en: '{count} days ago', es: 'hace {count} días' },
  ct_notes_unavailable:  { fr: 'Notes pas encore disponibles', en: 'Notes not available yet', es: 'Notas aún no disponibles' },
  ct_note_placeholder:   { fr: 'Écrire une note sur cette personne…', en: 'Write a note about this person…', es: 'Escriba una nota sobre esta persona…' },
  ct_saving:             { fr: 'Enregistrement…', en: 'Saving…', es: 'Guardando…' },
  ct_save_note:          { fr: 'Enregistrer la note', en: 'Save note', es: 'Guardar nota' },
  ct_notes_migration_pre:  { fr: 'Les notes sur un client ne sont pas encore stockées — la migration', en: 'Notes on a client are not stored yet — the', es: 'Las notas de un cliente aún no se almacenan — la migración' },
  ct_notes_migration_post: { fr: 'n\'a pas été appliquée à cette base. Tout le reste ci-dessous s\'affiche correctement.', en: 'migration has not been applied to this database. Everything below still reads correctly.', es: 'no se ha aplicado a esta base. Todo lo demás abajo se muestra correctamente.' },

  // ClientTimeline — empty / loading states
  ct_loading_file:      { fr: 'Chargement du dossier…', en: 'Loading the file…', es: 'Cargando el expediente…' },
  ct_empty_none:        { fr: 'Rien d\'enregistré pour cette personne pour le moment.', en: 'Nothing recorded yet for this person.', es: 'Nada registrado aún para esta persona.' },
  ct_empty_filtered:    { fr: 'Rien de ce type dans ce dossier.', en: 'Nothing of that kind in this file.', es: 'Nada de ese tipo en este expediente.' },
} satisfies Record<string, Tr>
