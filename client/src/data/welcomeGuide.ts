import type { TravelGuideSection } from './travelGuide'

// Welcome Guide — on-site info handed to clients on arrival ("you made it!").
// Answers the questions every guest asks: wifi, meals, water, power, schedule…
// Placeholders like [WiFi password] are meant to be filled in via the
// Templates editor (DocumentsPage) — content is stored in document_templates.
export const defaultWelcomeGuideSections: TravelGuideSection[] = [
  {
    id: 'wg1',
    order: 1,
    is_active: true,
    title: {
      fr: 'WiFi',
      en: 'WiFi',
      es: 'WiFi',
    },
    content: {
      fr: 'Réseau : [nom du réseau] — mot de passe : [mot de passe]. Le signal est meilleur près de [zone]. La connexion peut être lente ou coupée par moments : c\'est le Mozambique, profitez-en pour regarder le lagon plutôt que votre écran !',
      en: 'Network: [network name] — password: [password]. The signal is strongest near [area]. The connection can be slow or drop at times — this is Mozambique, take it as an invitation to look at the lagoon instead of your screen!',
      es: 'Red: [nombre de la red] — contraseña: [contraseña]. La señal es mejor cerca de [zona]. La conexión puede ser lenta o cortarse a ratos — esto es Mozambique, ¡aprovéchelo para mirar la laguna en vez de la pantalla!',
    },
  },
  {
    id: 'wg2',
    order: 2,
    is_active: true,
    title: {
      fr: 'Repas & restaurant',
      en: 'Meals & restaurant',
      es: 'Comidas y restaurante',
    },
    content: {
      fr: 'Petit-déjeuner servi de [heure] à [heure]. Pour le dîner, merci de vous inscrire avant [heure] auprès de [personne/endroit]. Le restaurant est ouvert de [heures]. Signalez-nous vos allergies ou régimes particuliers dès votre arrivée.',
      en: 'Breakfast is served from [time] to [time]. For dinner, please sign up before [time] with [person/place]. The restaurant is open [hours]. Let us know about any allergies or dietary requirements as soon as you arrive.',
      es: 'El desayuno se sirve de [hora] a [hora]. Para la cena, apúntese antes de las [hora] con [persona/lugar]. El restaurante abre de [horario]. Infórmenos de alergias o dietas especiales en cuanto llegue.',
    },
  },
  {
    id: 'wg3',
    order: 3,
    is_active: true,
    title: {
      fr: 'Eau potable',
      en: 'Drinking water',
      es: 'Agua potable',
    },
    content: {
      fr: 'L\'eau du robinet n\'est pas potable. De l\'eau en bouteille est disponible à [endroit] pour [prix]. L\'eau du robinet convient très bien pour la douche et le brossage de dents.',
      en: 'Tap water is not drinkable. Bottled water is available at [place] for [price]. Tap water is perfectly fine for showering and brushing your teeth.',
      es: 'El agua del grifo no es potable. Hay agua embotellada disponible en [lugar] por [precio]. El agua del grifo es perfectamente válida para ducharse y lavarse los dientes.',
    },
  },
  {
    id: 'wg4',
    order: 4,
    is_active: true,
    title: {
      fr: 'Électricité & coupures',
      en: 'Electricity & power cuts',
      es: 'Electricidad y cortes de luz',
    },
    content: {
      fr: 'Courant 220V, prises de type C/F/M (les prises européennes fonctionnent généralement, un adaptateur peut être utile). Des coupures de courant arrivent de temps en temps — elles durent rarement longtemps. Pensez à garder vos appareils chargés.',
      en: '220V power, plug types C/F/M (European plugs usually fit; an adapter can be handy). Power cuts happen from time to time — they rarely last long. Keep your devices charged just in case.',
      es: 'Corriente de 220V, enchufes tipo C/F/M (los enchufes europeos suelen funcionar; un adaptador puede ser útil). Hay cortes de luz de vez en cuando — rara vez duran mucho. Mantenga sus dispositivos cargados por si acaso.',
    },
  },
  {
    id: 'wg5',
    order: 5,
    is_active: true,
    title: {
      fr: 'Cours de kite & programme',
      en: 'Kite lessons & schedule',
      es: 'Clases de kite y horarios',
    },
    content: {
      fr: 'Le programme des cours dépend du vent : il est confirmé chaque matin vers [heure] à [endroit]. Soyez prêts [X] minutes avant votre session. Le vent se lève généralement en [matinée/après-midi].',
      en: 'The lesson schedule depends on the wind: it is confirmed every morning around [time] at [place]. Please be ready [X] minutes before your session. The wind usually picks up in the [morning/afternoon].',
      es: 'El horario de las clases depende del viento: se confirma cada mañana hacia las [hora] en [lugar]. Esté listo [X] minutos antes de su sesión. El viento suele levantarse por la [mañana/tarde].',
    },
  },
  {
    id: 'wg6',
    order: 6,
    is_active: true,
    title: {
      fr: 'Matériel & rangement',
      en: 'Equipment & storage',
      es: 'Material y almacenamiento',
    },
    content: {
      fr: 'Le matériel se range à [endroit] après chaque session — merci de rincer le matériel de location à l\'eau douce. Ne laissez jamais une aile gonflée sans surveillance sur la plage.',
      en: 'Equipment is stored at [place] after each session — please rinse rental gear with fresh water. Never leave an inflated kite unattended on the beach.',
      es: 'El material se guarda en [lugar] después de cada sesión — por favor enjuague el material de alquiler con agua dulce. Nunca deje una cometa inflada sin vigilancia en la playa.',
    },
  },
  {
    id: 'wg7',
    order: 7,
    is_active: true,
    title: {
      fr: 'Argent sur place',
      en: 'Money on site',
      es: 'Dinero en el centro',
    },
    content: {
      fr: 'Vous pouvez régler votre séjour en EUR, USD ou meticais (MZN) — pas de carte bancaire au centre. Le distributeur le plus proche est à [endroit], mais il n\'est pas toujours approvisionné. Votre note (bar, extras, taxis…) est réglée en fin de séjour.',
      en: 'You can settle your stay in EUR, USD or meticais (MZN) — no card payments at the center. The nearest ATM is at [place], but it is not always stocked. Your tab (bar, extras, taxis…) is settled at the end of your stay.',
      es: 'Puede pagar su estancia en EUR, USD o meticales (MZN) — no aceptamos tarjeta en el centro. El cajero más cercano está en [lugar], pero no siempre tiene efectivo. Su cuenta (bar, extras, taxis…) se liquida al final de la estancia.',
    },
  },
  {
    id: 'wg8',
    order: 8,
    is_active: true,
    title: {
      fr: 'Linge & ménage',
      en: 'Laundry & housekeeping',
      es: 'Lavandería y limpieza',
    },
    content: {
      fr: 'Service de linge disponible : déposez votre linge à [endroit] avant [heure], retour sous [délai] pour [prix]. Le ménage des chambres est fait [fréquence].',
      en: 'Laundry service available: drop your laundry at [place] before [time], returned within [timeframe] for [price]. Rooms are cleaned [frequency].',
      es: 'Servicio de lavandería disponible: deje su ropa en [lugar] antes de las [hora], se devuelve en [plazo] por [precio]. Las habitaciones se limpian [frecuencia].',
    },
  },
  {
    id: 'wg9',
    order: 9,
    is_active: true,
    title: {
      fr: 'Sécurité & bonnes habitudes',
      en: 'Safety & good habits',
      es: 'Seguridad y buenas costumbres',
    },
    content: {
      fr: 'Bilene est un endroit tranquille, mais restez prudents : ne laissez pas d\'objets de valeur sans surveillance, évitez de vous promener seuls la nuit avec des objets voyants, et fermez votre chambre en votre absence. Un coffre est disponible à [endroit].',
      en: 'Bilene is a quiet place, but stay sensible: don\'t leave valuables unattended, avoid walking alone at night with flashy items, and lock your room when you\'re out. A safe is available at [place].',
      es: 'Bilene es un lugar tranquilo, pero sea prudente: no deje objetos de valor sin vigilancia, evite pasear solo de noche con objetos llamativos y cierre su habitación al salir. Hay una caja fuerte disponible en [lugar].',
    },
  },
  {
    id: 'wg10',
    order: 10,
    is_active: true,
    title: {
      fr: 'Contacts utiles & urgences',
      en: 'Useful contacts & emergencies',
      es: 'Contactos útiles y emergencias',
    },
    content: {
      fr: 'Manager : [nom] — [téléphone] (WhatsApp OK). Urgences médicales : [clinique/hôpital + téléphone]. Pour toute question, passez nous voir à [endroit] — il n\'y a pas de question bête !',
      en: 'Manager: [name] — [phone] (WhatsApp OK). Medical emergencies: [clinic/hospital + phone]. For any question, come find us at [place] — there is no such thing as a silly question!',
      es: 'Manager: [nombre] — [teléfono] (WhatsApp OK). Emergencias médicas: [clínica/hospital + teléfono]. Para cualquier duda, venga a vernos a [lugar] — ¡no hay preguntas tontas!',
    },
  },
  {
    id: 'wg11',
    order: 11,
    is_active: true,
    title: {
      fr: 'Départ & check-out',
      en: 'Departure & check-out',
      es: 'Salida y check-out',
    },
    content: {
      fr: 'Check-out à [heure]. Merci de régler votre note la veille de votre départ. Si vous avez besoin d\'un taxi pour l\'aéroport, prévenez-nous au moins [délai] à l\'avance pour l\'organiser.',
      en: 'Check-out is at [time]. Please settle your tab the day before you leave. If you need a taxi to the airport, let us know at least [timeframe] in advance so we can arrange it.',
      es: 'El check-out es a las [hora]. Por favor liquide su cuenta el día antes de su salida. Si necesita un taxi al aeropuerto, avísenos con al menos [plazo] de antelación para organizarlo.',
    },
  },
]
