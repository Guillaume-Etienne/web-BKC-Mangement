import type { Tr } from './types'

export const planningI18n = {
  // Slot names (LessonWeekView, ForecastView, EquipmentView)
  slot_morning:   { fr: 'Matin',       en: 'Morning',   es: 'Mañana' },
  slot_afternoon: { fr: 'Après-midi',  en: 'Afternoon', es: 'Tarde' },
  slot_evening:   { fr: 'Soir',        en: 'Evening',   es: 'Noche' },
  slot_full_day:  { fr: 'Journée complète', en: 'Full day', es: 'Día completo' },

  // Lesson types
  lesson_type_private:    { fr: 'Privé',       en: 'Private',   es: 'Privado' },
  lesson_type_group:      { fr: 'Groupe',      en: 'Group',     es: 'Grupo' },
  lesson_type_supervision:{ fr: 'Superv.',     en: 'Superv.',   es: 'Superv.' },

  // LessonWeekView
  msg_no_guests_checked_in: { fr: 'Aucun invité enregistré ce jour-là.', en: 'No guests checked in that day.', es: 'Ningún huésped registrado ese día.' },
  label_show_all_guests: { fr: 'Montrer tous les invités', en: 'Show all guests', es: 'Mostrar todos los huéspedes' },
  btn_add_lesson:   { fr: '+ Cours',    en: '+ Lesson',   es: '+ Clase' },
  btn_add_activity: { fr: '+ Activité', en: '+ Activity', es: '+ Actividad' },
  btn_add_rental:   { fr: '+ Location', en: '+ Rental',   es: '+ Alquiler' },
  btn_paste:        { fr: '📋 Coller',  en: '📋 Paste',   es: '📋 Pegar' },
  msg_lesson_copied: { fr: 'Cours copié :', en: 'Lesson copied:', es: 'Clase copiada:' },
  hint_click_paste:  { fr: '→ Cliquez sur « Coller » dans un créneau', en: '→ Click "Paste" in a slot', es: '→ Haga clic en "Pegar" en una franja' },
  msg_confirm_delete_lesson: { fr: 'Supprimer ce cours ?', en: 'Delete this lesson?', es: '¿Eliminar esta clase?' },
  msg_confirm_delete_rental: { fr: 'Supprimer cette location ?', en: 'Delete this rental?', es: '¿Eliminar este alquiler?' },
  title_edit_lesson: { fr: 'Modifier le cours', en: 'Edit lesson', es: 'Editar clase' },
  title_edit_rental: { fr: 'Modifier la location', en: 'Edit rental', es: 'Editar alquiler' },
  title_move:        { fr: 'Déplacer', en: 'Move', es: 'Mover' },
  legend_activity: { fr: 'Activité', en: 'Activity', es: 'Actividad' },
  legend_rental:   { fr: 'Location', en: 'Rental',   es: 'Alquiler' },
  legend_move_copy_hint: { fr: '· ↔ pour déplacer · ⎘ pour copier', en: '· ↔ to move · ⎘ to copy', es: '· ↔ para mover · ⎘ para copiar' },

  // ForecastView
  btn_tomorrow:    { fr: 'Demain', en: 'Tomorrow', es: 'Mañana' },
  label_start:     { fr: 'Début :', en: 'Start:', es: 'Inicio:' },
  btn_copy_day:    { fr: '⎘ Copier le jour', en: '⎘ Copy day', es: '⎘ Copiar día' },
  btn_paste_n_lessons: { fr: '📋 Coller ({count} cours)', en: '📋 Paste ({count} lessons)', es: '📋 Pegar ({count} clases)' },
  title_new_lesson: { fr: 'Nouveau cours', en: 'New lesson', es: 'Nueva clase' },
  msg_no_rentals_planned: { fr: 'Aucune location prévue', en: 'No rentals planned', es: 'Sin alquileres previstos' },
  section_rentals: { fr: 'Locations', en: 'Rentals', es: 'Alquileres' },

  // NowView (dining events)
  label_present_today: { fr: 'Présents aujourd\'hui :', en: 'Present today:', es: 'Presentes hoy:' },
  msg_no_event_selected: { fr: 'Aucun événement sélectionné', en: 'No event selected', es: 'Ningún evento seleccionado' },
  btn_new_event:   { fr: '+ Nouvel événement', en: '+ New Event', es: '+ Nuevo evento' },
  btn_duplicate:   { fr: '⧉ Dupliquer', en: '⧉ Duplicate', es: '⧉ Duplicar' },
  msg_confirm_delete_event: { fr: 'Supprimer cet événement ?', en: 'Delete this event?', es: '¿Eliminar este evento?' },
  label_person_attending:  { fr: 'personne présente',  en: 'person attending',  es: 'persona asistiendo' },
  label_people_attending:  { fr: 'personnes présentes', en: 'people attending', es: 'personas asistiendo' },
  label_of_total: { fr: '/ {count} au total', en: '/ {count} total', es: '/ {count} en total' },
  label_history_events: { fr: 'Historique ({count} événements)', en: 'History ({count} events)', es: 'Historial ({count} eventos)' },
  label_instructors: { fr: 'Moniteurs', en: 'Instructors', es: 'Instructores' },
  label_guests:      { fr: 'Invités',   en: 'Guests',      es: 'Invitados' },
} satisfies Record<string, Tr>
