import type { Tr } from './types'

export const enquiriesI18n = {
  // EnquiryPanel — header
  ep_new_enquiry:     { fr: 'Nouvelle enquête', en: 'New enquiry', es: 'Nueva consulta' },
  ep_from_website:    { fr: 'depuis le site',   en: 'from the website', es: 'desde el sitio web' },
  ep_added_by_hand:   { fr: 'ajoutée manuellement', en: 'added by hand', es: 'añadida manualmente' },

  // EnquiryPanel — left column
  ep_label_name:            { fr: 'Nom *', en: 'Name *', es: 'Nombre *' },
  ep_label_what_they_wrote: { fr: 'Ce qu\'ils ont écrit', en: 'What they wrote', es: 'Lo que escribieron' },
  ep_label_message_context: { fr: 'Message / contexte', en: 'Message / context', es: 'Mensaje / contexto' },
  ep_placeholder_message:   { fr: 'Muller, 4 personnes, février, veut des cours…', en: 'Muller, 4 people, February, wants lessons…', es: 'Muller, 4 personas, febrero, quiere clases…' },
  ep_label_heard_via:       { fr: 'A entendu parler de nous via', en: 'Heard about us via', es: 'Se enteró de nosotros por' },
  ep_unnamed:               { fr: '(sans nom)', en: '(unnamed)', es: '(sin nombre)' },
  ep_label_or_words:        { fr: '…ou, dans leurs mots', en: '…or, in their words', es: '…o, en sus palabras' },
  ep_placeholder_source_other: { fr: 'un ami venu en 2024', en: 'a friend who came in 2024', es: 'un amigo que vino en 2024' },

  // EnquiryPanel — right column
  ep_label_how_many:     { fr: 'Combien', en: 'How many', es: 'Cuántos' },
  ep_label_when:         { fr: 'Quand', en: 'When', es: 'Cuándo' },
  ep_label_interested_in: { fr: 'Intéressé(s) par', en: 'Interested in', es: 'Interesado en' },
  ep_check_lessons:      { fr: '🪁 Cours', en: '🪁 Lessons', es: '🪁 Clases' },
  ep_check_rental:       { fr: '🎿 Location', en: '🎿 Rental', es: '🎿 Alquiler' },
  ep_check_accommodation: { fr: '🛏 Hébergement', en: '🛏 Accommodation', es: '🛏 Alojamiento' },
  ep_label_budget:       { fr: 'Budget — groupe entier, € (optionnel)', en: 'Budget — whole party, € (optional)', es: 'Presupuesto — grupo completo, € (opcional)' },

  // EnquiryPanel — status
  ep_status_new:      { fr: 'Nouvelle',       en: 'New',        es: 'Nueva' },
  ep_status_talking:  { fr: 'En discussion',  en: 'Talking',    es: 'En conversación' },
  ep_status_waiting:  { fr: 'À leur tour',    en: 'Their turn', es: 'Su turno' },
  ep_status_won:      { fr: 'Gagnée',         en: 'Won',        es: 'Ganada' },
  ep_status_lost:     { fr: 'Perdue',         en: 'Lost',       es: 'Perdida' },
  ep_label_lost_reason:      { fr: 'Pourquoi perdue — un mot', en: 'Why lost — one word', es: 'Por qué perdida — una palabra' },
  ep_placeholder_lost_reason: { fr: 'complet · budget · pas de réponse', en: 'full · budget · no reply', es: 'completo · presupuesto · sin respuesta' },
  ep_msg_won: { fr: 'Une enquête gagnée quitte aussitôt la liste de travail — retrouvez-la dans l\'archive, avec sa couleur.', en: 'Won leaves the working list right away — find it again in the archive, in its colour.', es: 'Una consulta ganada sale de inmediato de la lista de trabajo — encuéntrela de nuevo en el archivo, con su color.' },

  // EnquiryPanel — actions
  ep_saving:       { fr: 'Enregistrement…', en: 'Saving…', es: 'Guardando…' },
  ep_btn_create:   { fr: 'Créer l\'enquête', en: 'Create enquiry', es: 'Crear consulta' },

  // EnquiryPanel — Brevo sync status
  ep_brevo_error:          { fr: '⚠ Non ajoutée à Brevo — {error}', en: '⚠ Not added to Brevo — {error}', es: '⚠ No añadida a Brevo — {error}' },
  ep_brevo_synced:         { fr: '✅ Dans Brevo depuis le {date}', en: '✅ In Brevo since {date}', es: '✅ En Brevo desde el {date}' },
  ep_brevo_not_configured: { fr: 'Synchronisation Brevo non configurée', en: 'Brevo sync not configured', es: 'Sincronización con Brevo no configurada' },

  // EnquiryPanel — bridge to full booking form
  ep_section_full_form:  { fr: 'Formulaire de réservation complet', en: 'Full booking form', es: 'Formulario de reserva completo' },
  ep_btn_copy:           { fr: 'Copier', en: 'Copy', es: 'Copiar' },
  ep_btn_refresh:        { fr: 'Rafraîchir', en: 'Refresh', es: 'Actualizar' },
  ep_refresh_tooltip:    { fr: 'Même lien, instantané nom/email/téléphone/langue rafraîchi depuis cette enquête', en: 'Same link, fresh name/email/phone/language snapshot from this enquiry', es: 'Mismo enlace, instantánea de nombre/correo/teléfono/idioma actualizada desde esta consulta' },
  ep_form_filled:        { fr: '✅ Rempli — la soumission est revenue attachée à cette enquête.', en: '✅ Filled in — the submission came back attached to this enquiry.', es: '✅ Completado — la presentación volvió adjunta a esta consulta.' },
  ep_form_not_filled:    { fr: 'Envoyé mais pas encore rempli. Cela mérite une relance à part.', en: 'Sent but not filled in yet. That is worth a nudge on its own.', es: 'Enviado pero aún no completado. Eso merece un recordatorio aparte.' },
  ep_btn_create_link:    { fr: 'Créer un lien personnalisé', en: 'Create a personalised link', es: 'Crear un enlace personalizado' },
  ep_create_link_desc:   { fr: 'Un lien qui porte cette enquête, pour que ce qui revient soit attaché par construction plutôt que rapproché après coup sur un nom qui a pu changer.', en: 'A link that carries this enquiry, so what comes back is attached by construction rather than matched afterwards on a name that may have changed.', es: 'Un enlace que lleva esta consulta, para que lo que vuelva quede adjunto por construcción en lugar de emparejado después con un nombre que pudo cambiar.' },

  // EnquiryPanel — notes thread
  ep_last_exchange:    { fr: 'dernier échange le {date}', en: 'last exchange {date}', es: 'último intercambio {date}' },
  ep_arriving:         { fr: ' · arrivée {month}', en: ' · arriving {month}', es: ' · llegada {month}' },
  ep_note_placeholder: { fr: 'Appelé, ils attendent les vols…', en: "Called, they're waiting on flights…", es: 'Llamado, están esperando vuelos…' },
  ep_no_notes:         { fr: 'Aucune note pour le moment.', en: 'No note yet.', es: 'Aún no hay notas.' },
} satisfies Record<string, Tr>
