export interface TravelGuideSection {
  id: string
  title: { fr: string; en: string; es: string }
  content: { fr: string; en: string; es: string }
  is_active: boolean
  order: number
}

export const defaultTravelGuideSections: TravelGuideSection[] = [
  {
    id: 'tg1',
    order: 1,
    is_active: true,
    title: {
      fr: 'Argent liquide',
      en: 'Cash',
      es: 'Dinero en efectivo',
    },
    content: {
      fr: 'Veuillez apporter du liquide en USD ou EUR. Les distributeurs automatiques sont rares à Bilene et ne fonctionnent pas toujours. Prévoyez suffisamment de cash pour toute la durée de votre séjour.',
      en: 'Please bring cash in USD or EUR. ATMs are rare in Bilene and not always working. Bring enough cash to cover your entire stay.',
      es: 'Por favor traiga efectivo en USD o EUR. Los cajeros automáticos son escasos en Bilene y no siempre funcionan. Traiga suficiente efectivo para cubrir toda su estancia.',
    },
  },
  {
    id: 'tg2',
    order: 2,
    is_active: true,
    title: {
      fr: 'Change à l\'aéroport',
      en: 'Airport currency exchange',
      es: 'Cambio de divisa en el aeropuerto',
    },
    content: {
      fr: 'Nous vous déconseillons de changer de l\'argent à l\'aéroport de Maputo — les taux sont défavorables. Changez de préférence dans une banque en ville avant de partir, ou apportez des USD/EUR.',
      en: 'We advise against exchanging money at Maputo airport — the rates are unfavourable. Exchange at a bank before departure, or bring USD/EUR cash directly.',
      es: 'Desaconsejamos cambiar dinero en el aeropuerto de Maputo — los tipos de cambio son desfavorables. Cambie en un banco antes de salir, o traiga efectivo en USD/EUR directamente.',
    },
  },
  {
    id: 'tg3',
    order: 3,
    is_active: true,
    title: {
      fr: 'Ce qu\'il faut apporter',
      en: 'What to bring',
      es: 'Qué traer',
    },
    content: {
      fr: 'Crème solaire haute protection (SPF 50+), lycra ou combinaison légère, lunettes de soleil avec cordon, chapeau, tongs, vêtements légers. L\'eau du robinet n\'est pas potable : prévoyez d\'acheter de l\'eau en bouteille sur place.',
      en: 'High SPF sunscreen (50+), rash guard or light wetsuit, sunglasses with strap, hat, flip flops, light clothing. Tap water is not drinkable — plan to buy bottled water on site.',
      es: 'Protector solar de alta SPF (50+), licra o neopreno ligero, gafas de sol con cordón, sombrero, chanclas, ropa ligera. El agua del grifo no es potable — planifique comprar agua embotellada en el lugar.',
    },
  },
  {
    id: 'tg4',
    order: 4,
    is_active: true,
    title: {
      fr: 'Santé',
      en: 'Health',
      es: 'Salud',
    },
    content: {
      fr: 'Une prophylaxie antipaludéenne est fortement recommandée — consultez votre médecin avant le départ. La vaccination contre la fièvre jaune est obligatoire pour entrer au Mozambique depuis certains pays. Emportez votre carnet de vaccination.',
      en: 'Malaria prophylaxis is strongly recommended — consult your doctor before departure. Yellow fever vaccination is mandatory to enter Mozambique from certain countries. Bring your vaccination record.',
      es: 'Se recomienda encarecidamente la profilaxis antipalúdica — consulte a su médico antes de partir. La vacunación contra la fiebre amarilla es obligatoria para entrar a Mozambique desde ciertos países. Lleve su certificado de vacunación.',
    },
  },
  {
    id: 'tg5',
    order: 5,
    is_active: true,
    title: {
      fr: 'Comment nous rejoindre',
      en: 'Getting here',
      es: 'Cómo llegar',
    },
    content: {
      fr: 'Vol jusqu\'à Maputo (MPM). Un taxi vous attendra à l\'aéroport pour vous conduire directement au centre — compter environ 2h de route. Merci de nous communiquer votre heure d\'atterrissage en avance.',
      en: 'Fly to Maputo (MPM). A taxi will be waiting at the airport to bring you directly to the center — approximately 2 hours drive. Please let us know your landing time in advance.',
      es: 'Vuele hasta Maputo (MPM). Un taxi le esperará en el aeropuerto para llevarle directamente al centro — aproximadamente 2 horas de trayecto. Por favor infórmenos de su hora de aterrizaje con antelación.',
    },
  },
  {
    id: 'tg6',
    order: 6,
    is_active: false,
    title: {
      fr: 'Visa',
      en: 'Visa',
      es: 'Visa',
    },
    content: {
      fr: 'Les ressortissants de l\'Union Européenne peuvent obtenir un visa à l\'arrivée (VOA) à l\'aéroport de Maputo. Nous vous fournissons une lettre d\'invitation officielle à présenter aux autorités frontalières.',
      en: 'EU citizens can obtain a visa on arrival (VOA) at Maputo airport. We provide you with an official invitation letter to present to border authorities.',
      es: 'Los ciudadanos de la UE pueden obtener un visado a la llegada (VOA) en el aeropuerto de Maputo. Le proporcionamos una carta de invitación oficial para presentar a las autoridades fronterizas.',
    },
  },
]
