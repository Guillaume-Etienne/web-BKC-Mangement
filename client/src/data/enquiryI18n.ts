import type { Lang } from '../types/database'

/** Copy for the light enquiry form, in FR / EN / ES.
 *
 *  Kept apart from formI18n.ts on purpose: that one belongs to the full booking
 *  form, which asks for passports and visa dates. This one is the first contact
 *  — four fields, visible straight away on the website. The two will drift, and
 *  sharing a file would make every edit to one a risk for the other. */

type Tr = { fr: string; en: string; es: string }

export const etr = {
  title: {
    fr: 'Parlez-nous de votre projet 🪁',
    en: 'Tell us about your trip 🪁',
    es: 'Cuéntanos tu proyecto 🪁',
  } as Tr,
  intro: {
    fr: 'Quelques mots suffisent — on vous répond vite.',
    en: 'A few words are enough — we answer fast.',
    es: 'Con unas palabras basta — respondemos rápido.',
  } as Tr,

  f_email:   { fr: 'Votre email', en: 'Your email', es: 'Tu email' } as Tr,
  f_name:    { fr: 'On vous appelle comment ?', en: 'What should we call you?', es: '¿Cómo te llamamos?' } as Tr,
  f_source:  { fr: 'Comment nous avez-vous trouvés ?', en: 'How did you hear about us?', es: '¿Cómo nos has conocido?' } as Tr,
  f_other:   { fr: 'Autre — précisez', en: 'Other — tell us', es: 'Otro — cuéntanos' } as Tr,
  f_message: { fr: 'À votre plume !', en: 'Over to you!', es: '¡Te escuchamos!' } as Tr,

  ph_message: {
    fr: 'Vos dates, combien vous êtes, ce qui vous ferait plaisir…',
    en: 'Your dates, how many you are, what you fancy doing…',
    es: 'Tus fechas, cuántos sois, qué te apetece hacer…',
  } as Tr,
  opt_choose: { fr: 'Choisissez…', en: 'Pick one…', es: 'Elige…' } as Tr,
  opt_other:  { fr: 'Autre', en: 'Other', es: 'Otro' } as Tr,

  send:    { fr: 'Envoyer', en: 'Send', es: 'Enviar' } as Tr,
  clear:   { fr: 'Effacer', en: 'Clear', es: 'Borrar' } as Tr,
  sending: { fr: 'Envoi…', en: 'Sending…', es: 'Enviando…' } as Tr,

  err_name: {
    fr: 'Dites-nous au moins comment vous appeler.',
    en: 'Tell us at least what to call you.',
    es: 'Dinos al menos cómo llamarte.',
  } as Tr,
  err_send: {
    fr: "L'envoi a échoué. Réessayez, ou écrivez-nous à contact@bilenekite.com.",
    en: 'Sending failed. Try again, or write to us at contact@bilenekite.com.',
    es: 'El envío ha fallado. Inténtalo de nuevo o escríbenos a contact@bilenekite.com.',
  } as Tr,

  ok_title: { fr: 'Message bien reçu !', en: 'Got your message!', es: '¡Mensaje recibido!' } as Tr,
  ok_body: {
    fr: 'On vous répond très vite. Bon vent ! 🌊',
    en: 'We will get back to you very soon. Fair winds! 🌊',
    es: 'Te responderemos muy pronto. ¡Buen viento! 🌊',
  } as Tr,
}

/** Which language to show.
 *
 *  The site knows which page it is serving, so `?lang=` wins: a French speaker
 *  reading the Spanish page should get the Spanish form, and only the site can
 *  know that. The browser is the fallback for a direct visit, and the switcher
 *  is there for the visitor the first two got wrong. */
export function resolveLang(search: string, browser: string): Lang {
  const asked = new URLSearchParams(search).get('lang')?.slice(0, 2).toLowerCase()
  if (asked === 'fr' || asked === 'es' || asked === 'en') return asked
  const nav = (browser || 'en').slice(0, 2).toLowerCase()
  return nav === 'fr' || nav === 'es' ? (nav as Lang) : 'en'
}
