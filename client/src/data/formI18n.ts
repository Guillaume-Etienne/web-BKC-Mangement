import type { Lang } from '../types/database'

// All user-facing copy for the public booking form, in FR / EN / ES.
// Pattern identical to travelGuide.ts: each key holds the 3 translations.
// Access with tr.key[lang]. The admin chrome stays English (see SubmissionsPage).

type Tr = { fr: string; en: string; es: string }

export const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
]

export const tr = {
  // ── Header ──────────────────────────────────────────────────────────────
  brand:        { fr: 'Bilene Kite Center', en: 'Bilene Kite Center', es: 'Bilene Kite Center' },
  header_title: { fr: 'Préparons votre séjour 🪁', en: "Let's set up your trip 🪁", es: 'Preparemos tu viaje 🪁' },
  header_sub:   {
    fr: 'Quelques questions rapides et le vent fait le reste.',
    en: 'A few quick questions and the wind does the rest.',
    es: 'Unas preguntas rápidas y el viento hace el resto.',
  },

  // ── Step labels (shown in the progress bar) ───────────────────────────────
  step_group:     { fr: 'Groupe',     en: 'Group',     es: 'Grupo' },
  step_trip:      { fr: 'Voyage',     en: 'Trip',      es: 'Viaje' },
  step_logistics: { fr: 'Logistique', en: 'Logistics', es: 'Logística' },
  step_crew:      { fr: 'Équipage',   en: 'Crew',      es: 'Tripulación' },
  step_finish:    { fr: 'Final',      en: 'Finish',    es: 'Final' },

  // ── Step 1 : Group ────────────────────────────────────────────────────────
  s1_title: { fr: "Qui mène la danse ? 🏄", en: "Who's the captain? 🏄", es: '¿Quién lidera? 🏄' },
  s1_intro: {
    fr: "La personne de référence du groupe, c'est notre point de contact pour tout le séjour.",
    en: "The group's reference person — our main contact for the whole stay.",
    es: 'La persona de referencia del grupo: nuestro contacto principal durante toda la estancia.',
  },
  f_reference_name:   { fr: 'Nom complet', en: 'Full name', es: 'Nombre completo' },
  ph_reference_name:  { fr: 'Jean Dupont', en: 'Jane Doe', es: 'Juan Pérez' },
  f_email:            { fr: 'Email', en: 'Email', es: 'Correo electrónico' },
  ph_email:           { fr: 'vous@email.com', en: 'you@email.com', es: 'tu@email.com' },
  f_phone:            { fr: 'Téléphone (WhatsApp si possible)', en: 'Phone (WhatsApp if possible)', es: 'Teléfono (WhatsApp si es posible)' },
  ph_phone:           { fr: '+33 6 12 34 56 78', en: '+1 555 123 4567', es: '+34 612 34 56 78' },
  f_referral:         { fr: 'Comment nous avez-vous connu ?', en: 'How did you hear about us?', es: '¿Cómo nos conociste?' },
  ph_referral:        { fr: 'Instagram, un ami, Google…', en: 'Instagram, a friend, Google…', es: 'Instagram, un amigo, Google…' },

  // ── Step 2 : Trip ─────────────────────────────────────────────────────────
  s2_title: { fr: 'Votre voyage ✈️', en: 'Your trip ✈️', es: 'Tu viaje ✈️' },
  s2_intro: {
    fr: "Vos vols (pour la lettre d'hébergement et le visa) et, si besoin, vos transferts en taxi.",
    en: 'Your flights (for the accommodation / visa letter) and, if needed, your taxi transfers.',
    es: 'Tus vuelos (para la carta de alojamiento / visado) y, si los necesitas, tus traslados en taxi.',
  },
  f_nights:        { fr: 'Nombre de nuits à Bilene', en: 'Nights in Bilene', es: 'Noches en Bilene' },
  arrival_heading:   { fr: 'Arrivée', en: 'Arrival', es: 'Llegada' },
  departure_heading: { fr: 'Départ', en: 'Departure', es: 'Salida' },
  f_country_entry: { fr: "Vol d'arrivée — date (Maputo)", en: 'Arrival flight — date (Maputo)', es: 'Vuelo de llegada — fecha (Maputo)' },
  f_country_exit:  { fr: 'Vol retour — date', en: 'Return flight — date', es: 'Vuelo de regreso — fecha' },
  f_arrival_time:  { fr: "Vol d'arrivée — heure", en: 'Arrival flight — time', es: 'Vuelo de llegada — hora' },
  f_departure_time:{ fr: 'Vol retour — heure', en: 'Return flight — time', es: 'Vuelo de regreso — hora' },
  f_taxi_arrival:  { fr: 'Besoin d\'un transfert vers Bilene ?', en: 'Need a transfer to Bilene?', es: '¿Necesitas traslado a Bilene?' },
  f_taxi_departure:{ fr: 'Besoin d\'un transfert retour vers l\'aéroport ?', en: 'Need a transfer back to the airport?', es: '¿Necesitas traslado de vuelta al aeropuerto?' },
  f_transfer_pickup_date:  { fr: 'Prise en charge — date', en: 'Pickup — date', es: 'Recogida — fecha' },
  f_transfer_pickup_time:  { fr: 'Prise en charge — heure', en: 'Pickup — time', es: 'Recogida — hora' },
  f_transfer_drop_date:    { fr: 'Dépose à l\'aéroport — date', en: 'Airport drop-off — date', es: 'Llegada al aeropuerto — fecha' },
  f_transfer_drop_time:    { fr: 'Dépose à l\'aéroport — heure', en: 'Airport drop-off — time', es: 'Llegada al aeropuerto — hora' },
  transfer_hint: {
    fr: 'Si différent de votre vol (atterrissage tardif, départ anticipé…).',
    en: 'If different from your flight (late landing, early departure…).',
    es: 'Si es distinto de tu vuelo (aterrizaje tardío, salida anticipada…).',
  },

  // ── Step 3 : Logistics ────────────────────────────────────────────────────
  s3_title: { fr: 'Logistique 🧳', en: 'Logistics 🧳', es: 'Logística 🧳' },
  s3_intro: {
    fr: 'Pour préparer le transport et votre logement.',
    en: 'So we can plan the transfer and your accommodation.',
    es: 'Para preparar el transporte y tu alojamiento.',
  },
  f_luggage:   { fr: 'Bagages standards', en: 'Standard bags', es: 'Maletas estándar' },
  f_boardbags: { fr: 'Bagages de kitesurf', en: 'Kite bags', es: 'Bolsas de kite' },
  f_double_beds: { fr: 'Lits doubles', en: 'Double beds', es: 'Camas dobles' },
  f_single_beds: { fr: 'Lits simples', en: 'Single beds', es: 'Camas individuales' },
  beds_hint: {
    fr: 'Au cas où certains voyageurs souhaitent partager le même lit.',
    en: 'In case some travelers want to share the same bed.',
    es: 'Por si algunos viajeros quieren compartir la misma cama.',
  },
  f_insurance: {
    fr: 'Avez-vous (ou prévoyez-vous) une assurance voyage couvrant les accidents ?',
    en: 'Do you have (or plan to get) travel insurance covering accidents?',
    es: '¿Tienes (o prevés contratar) un seguro de viaje que cubra accidentes?',
  },

  // ── Step 4 : Crew ─────────────────────────────────────────────────────────
  s4_title: { fr: 'Votre équipage 🪂', en: 'Your crew 🪂', es: 'Tu tripulación 🪂' },
  s4_intro: {
    fr: 'Listez chaque voyageur tel qu\'il apparaît sur son passeport.',
    en: 'List each traveler exactly as it appears on their passport.',
    es: 'Indica cada viajero tal como aparece en su pasaporte.',
  },
  s4_passport_warning: {
    fr: '⚠️ TRÈS IMPORTANT : saisissez les noms et numéros de passeport sans aucune erreur. L\'immigration les vérifie scrupuleusement à l\'entrée.',
    en: '⚠️ VERY IMPORTANT: enter names and passport numbers without any mistake. Immigration checks them scrupulously on arrival.',
    es: '⚠️ MUY IMPORTANTE: introduce los nombres y números de pasaporte sin ningún error. Inmigración los verifica escrupulosamente a la llegada.',
  },
  traveler:        { fr: 'Voyageur', en: 'Traveler', es: 'Viajero' },
  f_first_name:    { fr: 'Prénom(s)', en: 'First name(s)', es: 'Nombre(s)' },
  f_last_name:     { fr: 'Nom de famille', en: 'Last name', es: 'Apellido(s)' },
  f_passport:      { fr: 'Numéro de passeport', en: 'Passport number', es: 'Número de pasaporte' },
  add_traveler:    { fr: '+ Ajouter un voyageur', en: '+ Add a traveler', es: '+ Añadir un viajero' },
  remove:          { fr: 'Retirer', en: 'Remove', es: 'Quitar' },

  // ── Step 4 : Kite activity (per traveler) ─────────────────────────────────
  kite_section:          { fr: 'Activité kite 🪁', en: 'Kite activity 🪁', es: 'Actividad kite 🪁' },
  kite_does_kite:        { fr: 'Pratique le kitesurf ?', en: 'Practices kitesurfing?', es: '¿Practica el kitesurf?' },
  kite_level_label:      { fr: 'Niveau', en: 'Level', es: 'Nivel' },
  kite_brings_gear:      { fr: 'Amène son propre matériel ?', en: 'Bringing own gear?', es: '¿Trae su propio material?' },
  kite_needs_storage:    { fr: 'Besoin d\'un espace de stockage ?', en: 'Needs storage space?', es: '¿Necesita espacio de almacenamiento?' },
  kite_interests:        { fr: 'Intéressé(e) par…', en: 'Interested in…', es: 'Interesado/a en…' },
  kite_lessons:          { fr: 'Cours de kite', en: 'Kite lessons', es: 'Clases de kite' },
  kite_rental:           { fr: 'Location de kite', en: 'Kite rental', es: 'Alquiler de kite' },
  wing_lessons:          { fr: 'Cours de wing', en: 'Wing lessons', es: 'Clases de wing' },
  kite_lvl_beg_total:    { fr: 'Débutant — première fois', en: 'Beginner — first time', es: 'Principiante — primera vez' },
  kite_lvl_bodydrag:     { fr: 'Débutant — bodydrag', en: 'Beginner — body drag', es: 'Principiante — body drag' },
  kite_lvl_waterstart:   { fr: 'Débutant — waterstart', en: 'Beginner — water start', es: 'Principiante — water start' },
  kite_lvl_intermediate: { fr: 'Intermédiaire', en: 'Intermediate', es: 'Intermedio/a' },
  kite_lvl_advanced:     { fr: 'Avancé(e)', en: 'Advanced', es: 'Avanzado/a' },

  // ── Step 5 : Finish ───────────────────────────────────────────────────────
  s5_title: { fr: 'Dernière ligne droite 🧾', en: 'Almost there 🧾', es: 'Casi listo 🧾' },
  emergency_heading: { fr: "Contact en cas d'urgence", en: 'Emergency contact', es: 'Contacto de emergencia' },
  emergency_intro: {
    fr: 'La personne à prévenir en cas de problème (qui ne voyage pas avec vous).',
    en: 'Someone to reach in case of a problem (not traveling with you).',
    es: 'Alguien a quien avisar en caso de problema (que no viaja contigo).',
  },
  f_ec_name:     { fr: 'Nom du contact', en: 'Contact name', es: 'Nombre del contacto' },
  f_ec_phone:    { fr: 'Téléphone du contact', en: 'Contact phone', es: 'Teléfono del contacto' },
  f_ec_email:    { fr: 'Email du contact', en: 'Contact email', es: 'Correo del contacto' },
  f_ec_relation: { fr: 'Lien de parenté', en: 'Relationship', es: 'Parentesco' },
  ph_ec_relation:{ fr: 'parent / conjoint / ami…', en: 'parent / spouse / friend…', es: 'familiar / pareja / amigo…' },
  waiver_heading: { fr: 'Décharge de responsabilité', en: 'Liability waiver', es: 'Exención de responsabilidad' },
  waiver_checkbox: {
    fr: "J'ai lu et j'accepte la décharge de responsabilité, la renonciation aux droits légaux et l'acceptation du risque ci-dessus.",
    en: 'I have read and accept the liability waiver, release of legal rights and assumption of risk above.',
    es: 'He leído y acepto la exención de responsabilidad, la renuncia a derechos legales y la aceptación del riesgo anteriores.',
  },
  waiver_show:  { fr: 'Lire le texte complet', en: 'Read the full text', es: 'Leer el texto completo' },
  waiver_hide:  { fr: 'Masquer', en: 'Hide', es: 'Ocultar' },

  // ── Navigation / actions ──────────────────────────────────────────────────
  back:        { fr: 'Retour', en: 'Back', es: 'Atrás' },
  next:        { fr: 'Suivant', en: 'Next', es: 'Siguiente' },
  submit:      { fr: 'Envoyer ma demande 🚀', en: 'Send my request 🚀', es: 'Enviar mi solicitud 🚀' },
  submitting:  { fr: 'Envoi…', en: 'Sending…', es: 'Enviando…' },
  yes:         { fr: 'Oui', en: 'Yes', es: 'Sí' },
  no:          { fr: 'Non', en: 'No', es: 'No' },

  // ── Success / errors ──────────────────────────────────────────────────────
  success_title: { fr: 'C\'est envoyé ! 🎉', en: 'All done! 🎉', es: '¡Enviado! 🎉' },
  success_msg: {
    fr: 'Merci ! Nous avons bien reçu votre demande et revenons vers vous très vite. Bon vent ! 🌊',
    en: 'Thank you! We received your request and will get back to you very soon. Fair winds! 🌊',
    es: '¡Gracias! Hemos recibido tu solicitud y te responderemos muy pronto. ¡Buen viento! 🌊',
  },
  error_msg: {
    fr: "Oups, l'envoi a échoué. Vérifiez votre connexion et réessayez.",
    en: 'Oops, sending failed. Check your connection and try again.',
    es: 'Ups, el envío falló. Revisa tu conexión e inténtalo de nuevo.',
  },
  required_hint: {
    fr: 'Merci de remplir les champs obligatoires de cette étape.',
    en: 'Please fill in the required fields on this step.',
    es: 'Completa los campos obligatorios de este paso.',
  },
} satisfies Record<string, Tr>

export type FormI18nKey = keyof typeof tr

// Convenience: detect a sensible default language from the browser.
export function detectLang(): Lang {
  const n = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return n === 'fr' || n === 'es' ? (n as Lang) : 'en'
}
