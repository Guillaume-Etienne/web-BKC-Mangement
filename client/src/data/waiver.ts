import type { Lang } from '../types/database'

// Liability waiver shown (and accepted via checkbox) in the public booking form.
// FR is the authoritative source provided by the center. EN/ES are translations
// — have them reviewed before relying on them legally.
// Bump WAIVER_VERSION whenever the wording changes (stored on the booking).

export const WAIVER_VERSION = 'v1-2026'

interface WaiverText {
  title: string
  paragraphs: string[]
}

export const waiverText: Record<Lang, WaiverText> = {
  fr: {
    title: 'Exonération de responsabilité, renonciation aux droits légaux et acceptation du risque',
    paragraphs: [
      "BKC et les services proposés — L'équipe locale expliquera les conditions du spot, la météo et les règles de sécurité. Un endroit pour ranger votre équipement, verrouillé pendant les heures de fermeture du centre, mais sans garantie contre le vol. Une zone de rinçage et de séchage.",
      "Pour votre équipement personnel — La location de l'équipement se fait aux risques du client. Le client doit présenter sa carte IKO de Niveau 3 ou prouver son niveau de compétence en passant un test (exigence minimale : remonter au vent, transitions, récupération complète en eau profonde). Tout équipement perdu ou cassé doit être payé au coût de son remplacement. Tout comportement dangereux ou irresponsable entraînera une fin immédiate du contrat de location sans remboursement.",
      "Supervision et assistance — Le service de plage comprend l'assistance pour le lancement et l'atterrissage (toujours sur le sable) et la surveillance de la zone de navigation, chaque jour où il y a du vent. Dans le cadre de l'assistance, BKC n'assume aucune responsabilité en cas de détérioration, destruction de matériel ou perte d'équipement.",
      "Connaissance de la zone de navigation et règles de sécurité — La zone de navigation est définie par BKC. Avant tout départ pour la location, la pratique libre ou les leçons privées, le client doit connaître la zone de navigation (où lancer/atterrir le cerf-volant, et où naviguer) ainsi que la règle de priorité applicable à tous les utilisateurs du spot. Le client doit également connaître les systèmes de sécurité de l'équipement utilisé : système de libération de sécurité du chicken loop.",
      "EN SIGNANT CE DOCUMENT, VOUS RECONNAISSEZ AVOIR LU ET ACCEPTÉ LES TERMES ET CONDITIONS CI-DESSUS.",
      "En considération de la location, de l'achat d'équipement de kitesurf et/ou de l'utilisation des installations, de l'école au sol, des instructions, des locaux et de l'équipement de BKC dans la participation au sport de kitesurf, je comprends et accepte cette exonération de responsabilité, cette renonciation aux droits légaux et cette acceptation du risque.",
      "Je reconnais que le kitesurf est un sport d'action impliquant des déplacements dans trois dimensions, sujet à des incidents et même à des blessures. Par la présente, je libère et décharge BKC, ses dirigeants, agents, employés, instructeurs et propriétaires de l'équipement et du terrain (« parties libérées ») de toute responsabilité, réclamation ou cause d'action pour les blessures, l'incapacité ou la mort découlant de ma participation aux activités de kitesurf, y compris les pertes CAUSÉES PAR LA NÉGLIGENCE DES PARTIES LIBÉRÉES.",
      "J'ASSUME EXPRESSÉMENT ET VOLONTAIREMENT TOUS LES RISQUES DE DÉCÈS OU DE BLESSURE PERSONNELLE subis lors de la participation au kitesurf, qu'ils soient ou non causés par la négligence des parties libérées. Je conviens de NE PAS POURSUIVRE EN JUSTICE les parties libérées et de les INDEMNISER ET DÉGAGER DE TOUTE RESPONSABILITÉ de toutes réclamations, jugements et coûts (y compris honoraires d'avocats) liés à ma participation.",
      "Je conviens d'opérer l'équipement de manière raisonnable et sûre afin de ne mettre en danger ni les personnes ni les biens. Je représente que cette exonération restera en vigueur tant que je participerai à des activités liées aux parties libérées. Je représente avoir au moins 18 ans, ou, en tant que parent ou tuteur légal, je renonce et libère tous les droits légaux pour toute blessure que mon enfant mineur pourrait subir.",
      "J'AI LU CETTE EXONÉRATION DE RESPONSABILITÉ, RENONCIATION AUX DROITS LÉGAUX ET ACCEPTATION DU RISQUE, J'EN COMPRENDS PLEINEMENT LE CONTENU ET JE LE SIGNE DE MON PROPRE GRÉ.",
    ],
  },
  en: {
    title: 'Release of liability, waiver of legal rights and assumption of risk',
    paragraphs: [
      'BKC and the services offered — The local team will explain the spot conditions, the weather and the safety rules. There is a place to store your equipment, locked outside the center\'s opening hours, but with no guarantee against theft. A rinse and drying area is available.',
      'For your personal equipment — Equipment rental is at the client\'s own risk. The client must present an IKO Level 3 card or prove their skill level by passing a test (minimum requirement: upwind riding, transitions, full deep-water recovery). Any lost or broken equipment must be paid at its replacement cost. Any dangerous or irresponsible behavior will result in immediate termination of the rental contract without refund.',
      'Supervision and assistance — Beach service includes assistance with launching and landing (always on the sand) and monitoring of the riding area, on every windy day. Within this assistance, BKC assumes no responsibility for any deterioration, destruction or loss of equipment.',
      'Knowledge of the riding area and safety rules — The riding area is defined by BKC. Before any rental session, free riding or private lesson, the client must know the riding area (where to launch/land the kite and where to ride) and the right-of-way rules applicable to all spot users. The client must also know the safety systems of the equipment used: the chicken-loop quick-release system.',
      'BY SIGNING THIS DOCUMENT, YOU ACKNOWLEDGE THAT YOU HAVE READ AND ACCEPTED THE TERMS AND CONDITIONS ABOVE.',
      'In consideration of the rental, purchase of kitesurf equipment and/or use of the facilities, ground school, instruction, premises and equipment of BKC in participating in the sport of kitesurfing, I understand and accept this release of liability, waiver of legal rights and assumption of risk.',
      'I acknowledge that kitesurfing is an action sport involving movement in three dimensions and is subject to incidents and even injury. I hereby release and discharge BKC, its officers, agents, employees, instructors and owners of the equipment and land (the "released parties") from any liability, claim or cause of action for injury, disability or death arising from my participation in kitesurfing activities, including losses CAUSED BY THE NEGLIGENCE OF THE RELEASED PARTIES.',
      'I EXPRESSLY AND VOLUNTARILY ASSUME ALL RISK OF DEATH OR PERSONAL INJURY sustained while participating in kitesurfing, whether or not caused by the negligence of the released parties. I agree NOT TO SUE the released parties and to INDEMNIFY AND HOLD THEM HARMLESS from all claims, judgments and costs (including attorney fees) related to my participation.',
      'I agree to operate the equipment in a reasonable and safe manner so as not to endanger people or property. I represent that this release shall remain in effect for as long as I take part in activities associated with the released parties. I represent that I am at least 18 years old, or, as a parent or legal guardian, I waive and release all legal rights for any injury my minor child may sustain.',
      'I HAVE READ THIS RELEASE OF LIABILITY, WAIVER OF LEGAL RIGHTS AND ASSUMPTION OF RISK, I FULLY UNDERSTAND ITS CONTENTS AND I SIGN IT OF MY OWN FREE WILL.',
    ],
  },
  es: {
    title: 'Exención de responsabilidad, renuncia a derechos legales y aceptación del riesgo',
    paragraphs: [
      'BKC y los servicios ofrecidos — El equipo local explicará las condiciones del spot, la meteorología y las normas de seguridad. Hay un lugar para guardar tu equipo, cerrado fuera del horario del centro, pero sin garantía contra robo. Se dispone de una zona de enjuague y secado.',
      'Para tu equipo personal — El alquiler de equipo es por cuenta y riesgo del cliente. El cliente debe presentar su tarjeta IKO de Nivel 3 o demostrar su nivel mediante una prueba (requisito mínimo: navegar ceñida, transiciones, recuperación completa en aguas profundas). Todo equipo perdido o roto debe pagarse al coste de su reemplazo. Cualquier comportamiento peligroso o irresponsable supondrá la finalización inmediata del contrato de alquiler sin reembolso.',
      'Supervisión y asistencia — El servicio de playa incluye asistencia para el despegue y el aterrizaje (siempre en la arena) y la vigilancia de la zona de navegación, cada día con viento. Dentro de esta asistencia, BKC no asume ninguna responsabilidad por el deterioro, la destrucción o la pérdida del equipo.',
      'Conocimiento de la zona de navegación y normas de seguridad — La zona de navegación la define BKC. Antes de cualquier sesión de alquiler, práctica libre o clase privada, el cliente debe conocer la zona de navegación (dónde despegar/aterrizar la cometa y dónde navegar) y la regla de prioridad aplicable a todos los usuarios del spot. El cliente también debe conocer los sistemas de seguridad del equipo utilizado: el sistema de desenganche rápido del chicken loop.',
      'AL FIRMAR ESTE DOCUMENTO, RECONOCES QUE HAS LEÍDO Y ACEPTADO LOS TÉRMINOS Y CONDICIONES ANTERIORES.',
      'En consideración del alquiler, la compra de equipo de kitesurf y/o el uso de las instalaciones, la escuela en tierra, las instrucciones, los locales y el equipo de BKC al participar en el kitesurf, entiendo y acepto esta exención de responsabilidad, renuncia a derechos legales y aceptación del riesgo.',
      'Reconozco que el kitesurf es un deporte de acción que implica desplazamientos en tres dimensiones y está sujeto a incidentes e incluso lesiones. Por la presente libero y eximo a BKC, sus directivos, agentes, empleados, instructores y propietarios del equipo y del terreno (las «partes liberadas») de toda responsabilidad, reclamación o causa de acción por lesiones, incapacidad o muerte derivadas de mi participación en actividades de kitesurf, incluidas las pérdidas CAUSADAS POR LA NEGLIGENCIA DE LAS PARTES LIBERADAS.',
      'ASUMO EXPRESA Y VOLUNTARIAMENTE TODO RIESGO DE MUERTE O LESIÓN PERSONAL sufrido al participar en el kitesurf, sea o no causado por la negligencia de las partes liberadas. Acuerdo NO DEMANDAR a las partes liberadas e INDEMNIZARLAS Y EXIMIRLAS de toda reclamación, sentencia y coste (incluidos honorarios de abogados) relacionados con mi participación.',
      'Acuerdo manejar el equipo de manera razonable y segura para no poner en peligro a personas ni bienes. Declaro que esta exención permanecerá vigente mientras participe en actividades asociadas a las partes liberadas. Declaro tener al menos 18 años o, como padre/madre o tutor legal, renuncio y libero todos los derechos legales por cualquier lesión que mi hijo menor pueda sufrir.',
      'HE LEÍDO ESTA EXENCIÓN DE RESPONSABILIDAD, RENUNCIA A DERECHOS LEGALES Y ACEPTACIÓN DEL RIESGO, COMPRENDO PLENAMENTE SU CONTENIDO Y LA FIRMO POR MI PROPIA VOLUNTAD.',
    ],
  },
}
