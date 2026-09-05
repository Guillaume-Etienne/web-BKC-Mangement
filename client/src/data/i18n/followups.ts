import type { Tr } from './types'

export const followupsI18n = {
  // computeFollowUps — wantsOfEnquiry
  fu_want_lessons:       { fr: '🪂 cours',       en: '🪂 lessons',       es: '🪂 clases' },
  fu_want_rental:        { fr: '🎿 location',    en: '🎿 rental',        es: '🎿 alquiler' },
  fu_want_accommodation: { fr: '🛏 hébergement', en: '🛏 accommodation', es: '🛏 alojamiento' },
  fu_party_size:         { fr: '{n} pax',        en: '{n} pax',          es: '{n} pax' },
  fu_not_qualified_yet:  { fr: 'pas encore qualifiée', en: 'not qualified yet', es: 'aún sin calificar' },

  // computeFollowUps — wantsOfBooking
  fu_lesson_one:    { fr: '🪂 {n} cours',        en: '🪂 {n} lesson',        es: '🪂 {n} clase' },
  fu_lesson_many:   { fr: '🪂 {n} cours',        en: '🪂 {n} lessons',       es: '🪂 {n} clases' },
  fu_wing:          { fr: '🪽 {n} wing',         en: '🪽 {n} wing',          es: '🪽 {n} wing' },
  fu_rental_one:    { fr: '🎿 {n} location',     en: '🎿 {n} rental',        es: '🎿 {n} alquiler' },
  fu_rental_many:   { fr: '🎿 {n} locations',    en: '🎿 {n} rentals',       es: '🎿 {n} alquileres' },
  fu_center_access: { fr: '🎟 {n} accès centre', en: '🎟 {n} center access', es: '🎟 {n} acceso al centro' },
  fu_stay_only:     { fr: 'séjour seul',         en: 'stay only',           es: 'solo estancia' },

  // computeFollowUps — clientName fallback
  fu_booking_ref: { fr: 'Réservation #{n}', en: 'Booking #{n}', es: 'Reserva #{n}' },

  // computeFollowUps — reason
  fu_reason_never_read: { fr: "jamais lue — personne n'a répondu", en: 'never read — nobody has answered them', es: 'nunca leída — nadie ha respondido' },
  fu_reason_no_news:    { fr: 'aucune nouvelle depuis {days} jours', en: 'no news for {days} days', es: 'sin noticias desde hace {days} días' },
  fu_reason_stay_over:  { fr: 'le séjour est terminé et la réservation est toujours provisoire', en: 'the stay is over and the booking is still provisional', es: 'la estancia terminó y la reserva sigue siendo provisional' },
  fu_reason_still_provisional: { fr: 'toujours provisoire · rien depuis {days} jours', en: 'still provisional · nothing for {days} days', es: 'todavía provisional · nada desde hace {days} días' },
} satisfies Record<string, Tr>
