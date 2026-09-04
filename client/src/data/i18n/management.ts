import type { Tr } from './types'

export const managementI18n = {
  page_title:     { fr: 'Options',        en: 'Options',      es: 'Opciones' },

  // Sections
  section_general: { fr: 'Général',       en: 'General',      es: 'General' },
  section_language: { fr: 'Langue',       en: 'Language',     es: 'Idioma' },
  section_accommodations: { fr: 'Hébergements', en: 'Accommodations', es: 'Alojamientos' },
  section_pricing: { fr: 'Tarification',  en: 'Pricing',      es: 'Tarifas' },
  section_sources: { fr: 'Sources',       en: 'Sources',      es: 'Fuentes' },
  section_agencies: { fr: 'Agences',      en: 'Agencies',     es: 'Agencias' },
  section_seasons: { fr: 'Saisons',       en: 'Seasons',      es: 'Temporadas' },
  section_shared_links: { fr: 'Liens partagés', en: 'Shared Links', es: 'Enlaces compartidos' },
  section_database: { fr: 'Base de données', en: 'Database',   es: 'Base de datos' },

  // Language selection
  label_language: { fr: 'Langue',         en: 'Language',     es: 'Idioma' },
  lang_french:    { fr: 'Français',       en: 'French',       es: 'Francés' },
  lang_english:   { fr: 'Anglais',        en: 'English',      es: 'Inglés' },
  lang_spanish:   { fr: 'Espagnol',       en: 'Spanish',      es: 'Español' },

  // Tabs
  tab_info:       { fr: 'Informations',   en: 'Info',         es: 'Información' },
  tab_houses:     { fr: 'Maisons',        en: 'Houses',       es: 'Casas' },
  tab_pricing:    { fr: 'Tarification',   en: 'Pricing',      es: 'Tarifas' },
  tab_sources:    { fr: 'Sources',        en: 'Sources',      es: 'Fuentes' },
  tab_agencies:   { fr: 'Agences',        en: 'Agencies',     es: 'Agencias' },
  tab_seasons:    { fr: 'Saisons',        en: 'Seasons',      es: 'Temporadas' },
  tab_shared_links: { fr: 'Liens partagés', en: 'Shared Links', es: 'Enlaces compartidos' },
  tab_database:   { fr: 'Base de données', en: 'Database',    es: 'Base de datos' },

  // Accommodation management
  btn_add_house:  { fr: 'Ajouter une maison', en: 'Add house', es: 'Añadir casa' },
  btn_add_room:   { fr: 'Ajouter une chambre', en: 'Add room', es: 'Añadir habitación' },
  label_house_name: { fr: 'Nom de la maison', en: 'House name', es: 'Nombre de la casa' },
  label_rooms:    { fr: 'Chambres',       en: 'Rooms',        es: 'Habitaciones' },

  // Pricing
  label_billable_type: { fr: 'Type',      en: 'Type',         es: 'Tipo' },
  label_rate:     { fr: 'Tarif',          en: 'Rate',         es: 'Tarifa' },
  label_currency: { fr: 'Devise',         en: 'Currency',     es: 'Moneda' },

  // Sources (attribution)
  btn_add_source: { fr: 'Ajouter une source', en: 'Add source', es: 'Añadir fuente' },
  label_source_name: { fr: 'Nom de la source', en: 'Source name', es: 'Nombre de la fuente' },

  // Agencies
  btn_add_agency: { fr: 'Ajouter une agence', en: 'Add agency', es: 'Añadir agencia' },
  label_agency_name: { fr: 'Nom de l\'agence', en: 'Agency name', es: 'Nombre de la agencia' },
  label_commission_rate: { fr: 'Taux de commission', en: 'Commission rate', es: 'Tasa de comisión' },

  // Seasons
  btn_add_season: { fr: 'Ajouter une saison', en: 'Add season', es: 'Añadir temporada' },
  label_season_name: { fr: 'Nom',          en: 'Name',         es: 'Nombre' },
  label_start_date: { fr: 'Date de début', en: 'Start date',   es: 'Fecha de inicio' },
  label_end_date:   { fr: 'Date de fin',   en: 'End date',     es: 'Fecha de fin' },

  // Shared Links
  btn_create_link: { fr: 'Créer un lien',  en: 'Create link',  es: 'Crear enlace' },
  label_link_type: { fr: 'Type de lien',   en: 'Link type',    es: 'Tipo de enlace' },

  // Messages
  msg_saved:      { fr: 'Enregistré avec succès', en: 'Saved successfully', es: 'Guardado exitosamente' },
  msg_deleted:    { fr: 'Supprimé avec succès', en: 'Deleted successfully', es: 'Eliminado exitosamente' },
  msg_confirm_delete: { fr: 'Êtes-vous sûr de vouloir supprimer cet élément ?', en: 'Are you sure you want to delete this item?', es: '¿Estás seguro de que deseas eliminar este elemento?' },
} satisfies Record<string, Tr>
