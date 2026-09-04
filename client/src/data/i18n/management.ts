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
  title_new_house:  { fr: 'Nouvelle maison', en: 'New house', es: 'Nueva casa' },
  title_edit_house: { fr: 'Modifier la maison', en: 'Edit house', es: 'Editar casa' },
  label_nightly_rates:  { fr: 'Tarifs par nuit', en: 'Nightly Rates', es: 'Tarifas por noche' },
  label_rental_periods: { fr: 'Périodes de location', en: 'Rental Periods', es: 'Períodos de alquiler' },
  msg_no_houses:    { fr: 'Aucune maison pour le moment', en: 'No houses yet', es: 'Aún no hay casas' },
  msg_select_house: { fr: 'Sélectionnez une maison pour voir les détails', en: 'Select a house to view details', es: 'Seleccione una casa para ver los detalles' },
  hint_active_bookable: { fr: 'Actif (disponible pour réservation)', en: 'Active (available for bookings)', es: 'Activo (disponible para reservas)' },
  title_new_accommodation:  { fr: 'Nouvel hébergement', en: 'New accommodation', es: 'Nuevo alojamiento' },
  msg_no_accommodations:    { fr: 'Aucun hébergement pour le moment', en: 'No accommodations yet', es: 'Aún no hay alojamientos' },
  msg_select_accommodation: { fr: 'Sélectionnez un hébergement pour voir les détails', en: 'Select an accommodation to view details', es: 'Seleccione un alojamiento para ver los detalles' },
  label_pricing:    { fr: 'Tarification', en: 'Pricing', es: 'Tarifas' },
  label_sell_rate:  { fr: 'Tarif de vente', en: 'Sell Rate', es: 'Tarifa de venta' },
  btn_add_period:   { fr: '+ Ajouter une période', en: '+ Add period', es: '+ Añadir período' },
  btn_save_rates:   { fr: 'Enregistrer les tarifs', en: 'Save rates', es: 'Guardar tarifas' },

  // Pricing
  label_billable_type: { fr: 'Type',      en: 'Type',         es: 'Tipo' },
  label_rate:     { fr: 'Tarif',          en: 'Rate',         es: 'Tarifa' },
  label_currency: { fr: 'Devise',         en: 'Currency',     es: 'Moneda' },

  // Sources (attribution)
  btn_add_source: { fr: 'Ajouter une source', en: 'Add source', es: 'Añadir fuente' },
  label_source_name: { fr: 'Nom de la source', en: 'Source name', es: 'Nombre de la fuente' },
  title_enquiry_sources: { fr: 'Sources des enquêtes', en: 'Enquiry sources', es: 'Fuentes de consultas' },
  btn_retire:   { fr: 'Retirer',  en: 'Retire',  es: 'Retirar' },
  btn_restore:  { fr: 'Restaurer', en: 'Restore', es: 'Restaurar' },
  label_retired: { fr: 'Retirée', en: 'Retired', es: 'Retirada' },
  label_retired_count: { fr: 'Retirées ({count}) — cachées du formulaire, gardées pour les statistiques passées', en: 'Retired ({count}) — hidden from the form, kept for past statistics', es: 'Retiradas ({count}) — ocultas del formulario, conservadas para estadísticas pasadas' },
  msg_no_sources: { fr: 'Aucune source pour le moment — le formulaire ne proposerait que « Autre ».', en: 'No source yet — the form would only offer "Other".', es: 'Aún no hay fuente — el formulario solo ofrecería "Otra".' },

  // Agencies
  btn_add_agency: { fr: 'Ajouter une agence', en: 'Add agency', es: 'Añadir agencia' },
  label_agency_name: { fr: 'Nom de l\'agence', en: 'Agency name', es: 'Nombre de la agencia' },
  label_commission_rate: { fr: 'Taux de commission', en: 'Commission rate', es: 'Tasa de comisión' },
  title_new_agency:  { fr: 'Nouvelle agence', en: 'New agency', es: 'Nueva agencia' },
  msg_no_agencies:   { fr: 'Aucune agence pour le moment', en: 'No agencies yet', es: 'Aún no hay agencias' },
  msg_select_agency: { fr: 'Sélectionnez une agence pour voir sa grille tarifaire', en: 'Select an agency to view its rate card', es: 'Seleccione una agencia para ver su tarifa' },
  label_rate_card:   { fr: 'Grille tarifaire', en: 'Rate card', es: 'Tarifa' },
  msg_no_rate_items: { fr: 'Aucune ligne tarifaire pour le moment.', en: 'No rate items yet.', es: 'Aún no hay líneas de tarifa.' },
  btn_add_rate_item: { fr: '+ Ajouter une ligne tarifaire', en: '+ Add rate item', es: '+ Añadir línea de tarifa' },
  btn_deactivate:    { fr: 'Désactiver', en: 'Deactivate', es: 'Desactivar' },
  btn_reactivate:    { fr: 'Réactiver', en: 'Reactivate', es: 'Reactivar' },
  label_commission_pct:       { fr: '{pct} % de commission', en: '{pct}% commission', es: '{pct}% de comisión' },
  label_commission_retained:  { fr: '{pct} % de commission retenue sur le total facturé', en: '{pct}% commission retained on the total billed', es: '{pct}% de comisión retenida sobre el total facturado' },
  label_rate_item_count:      { fr: '{count} ligne tarifaire', en: '{count} rate item', es: '{count} línea de tarifa' },
  label_rate_item_count_pl:   { fr: '{count} lignes tarifaires', en: '{count} rate items', es: '{count} líneas de tarifa' },

  // Seasons
  btn_add_season: { fr: 'Ajouter une saison', en: 'Add season', es: 'Añadir temporada' },
  label_season_name: { fr: 'Nom',          en: 'Name',         es: 'Nombre' },
  label_start_date: { fr: 'Date de début', en: 'Start date',   es: 'Fecha de inicio' },
  label_end_date:   { fr: 'Date de fin',   en: 'End date',     es: 'Fecha de fin' },
  label_season_opens:  { fr: 'Ouvre',  en: 'Opens',  es: 'Abre' },
  label_season_closes: { fr: 'Ferme',  en: 'Closes', es: 'Cierra' },
  desc_seasons: { fr: 'Les périodes que les écrans de comptabilité utilisent pour grouper. Une réservation compte dans la saison qui contient son {check_in}, un même séjour ne se scinde donc jamais entre deux.', en: 'The periods the accounting screens group by. A booking counts in the season containing its {check_in}, so a stay never splits across two.', es: 'Los períodos que las pantallas de contabilidad usan para agrupar. Una reserva cuenta en la temporada que contiene su {check_in}, por lo que una estancia nunca se divide entre dos.' },
  msg_no_seasons: { fr: 'Aucune saison pour le moment — les écrans de comptabilité ne pourront afficher que des totaux toutes périodes confondues.', en: 'No season yet — the accounting screens will only be able to show all-time totals.', es: 'Aún no hay temporada — las pantallas de contabilidad solo podrán mostrar totales de todo el tiempo.' },
  label_current: { fr: 'En cours', en: 'Current', es: 'Actual' },
  label_days_count: { fr: '{count} jours', en: '{count} days', es: '{count} días' },
  msg_bad_season_dates: { fr: 'La date de fermeture doit venir après la date d\'ouverture.', en: 'The closing date must come after the opening one.', es: 'La fecha de cierre debe ser posterior a la de apertura.' },
  msg_season_overlap: { fr: 'Chevauche « {label} » ({start} → {end}). Une réservation ne peut compter que dans une seule saison, des périodes qui se chevauchent rendent donc les chiffres ambigus.', en: 'Overlaps "{label}" ({start} → {end}). A booking can only be counted in one season, so overlapping ranges make the figures ambiguous.', es: 'Se superpone con "{label}" ({start} → {end}). Una reserva solo puede contarse en una temporada, por lo que rangos superpuestos hacen las cifras ambiguas.' },
  msg_confirm_delete_season: { fr: 'Supprimer la saison « {label} » ?\n\nRien d\'autre n\'est supprimé — réservations, paiements et dépenses restent. Seule la période comptable disparaît.', en: 'Delete the season "{label}"?\n\nNothing else is deleted — bookings, payments and expenses stay. Only the accounting period disappears.', es: '¿Eliminar la temporada "{label}"?\n\nNada más se elimina — reservas, pagos y gastos permanecen. Solo desaparece el período contable.' },
  msg_season_save_failed: { fr: 'La saison n\'a PAS été enregistrée.', en: 'The season was NOT saved.', es: 'La temporada NO se guardó.' },
  msg_season_delete_failed: { fr: 'Impossible de supprimer la saison.', en: 'Could not delete the season.', es: 'No se pudo eliminar la temporada.' },

  // Shared Links
  btn_create_link: { fr: 'Créer un lien',  en: 'Create link',  es: 'Crear enlace' },
  label_link_type: { fr: 'Type de lien',   en: 'Link type',    es: 'Tipo de enlace' },

  // Messages
  msg_saved:      { fr: 'Enregistré avec succès', en: 'Saved successfully', es: 'Guardado exitosamente' },
  msg_deleted:    { fr: 'Supprimé avec succès', en: 'Deleted successfully', es: 'Eliminado exitosamente' },
  msg_confirm_delete: { fr: 'Êtes-vous sûr de vouloir supprimer cet élément ?', en: 'Are you sure you want to delete this item?', es: '¿Estás seguro de que deseas eliminar este elemento?' },
} satisfies Record<string, Tr>
