import type { TaxiTripType } from '../types/database'
import type { BookingOrder, OrderLine } from './bookingOrder'
import type { Lang } from './printBookingSummary'

// The "Your order" block of the booking confirmation, as HTML — ONE renderer for
// the PDF (printBookingSummary) and the email (emailBookingConfirmation), so the
// two documents a client may receive can never state two different figures.
// Tables and inline styles only: that is what email clients render.

const BLUE = '#4472C4'

interface Words {
  title: string
  house: (acc: string, room: string) => string
  night: string; nights: string; days: string; pers: string
  luggage: string; boardbags: string; timeTbc: string
  routes: Record<TaxiTripType, string>
  centerAccess: string
  noTransfer: string; empty: string
  includedVia: (agency: string) => string
  paidToOwner: string
  paidToProvider: (provider: string) => string
  handledBy: (place: string) => string
  total: string; discount: string; paid: string; remaining: string
  footnote: string
}

const W: Record<Lang, Words> = {
  fr: {
    title: 'Votre commande',
    house: (acc, room) => `Maison ${acc} · chambre ${room}`,
    night: 'nuit', nights: 'nuits', days: 'jours', pers: 'pers.',
    luggage: 'bagage(s)', boardbags: 'housse(s) de board', timeTbc: 'heure à confirmer',
    routes: {
      'aero-to-center': 'Transfert Aéroport → Bilene', 'center-to-aero': 'Transfert Bilene → Aéroport',
      'center-to-town': 'Transfert Bilene → Maputo', 'town-to-center': 'Transfert Maputo → Bilene', other: 'Transfert',
    },
    centerAccess: 'Accès au centre (matériel personnel)',
    noTransfer: 'Aucun transfert réservé', empty: 'Rien de commandé pour le moment.',
    includedVia: a => `Inclus via ${a}`,
    paidToOwner: 'Réglé directement au propriétaire',
    paidToProvider: p => `À régler directement à ${p}`,
    handledBy: p => `Géré par ${p}`,
    total: 'Total commandé', discount: 'Remise', paid: 'Déjà réglé', remaining: 'Reste à payer',
    footnote: 'Les cours, locations et repas pris sur place s’ajoutent à votre compte client.',
  },
  en: {
    title: 'Your order',
    house: (acc, room) => `House ${acc} · room ${room}`,
    night: 'night', nights: 'nights', days: 'days', pers: 'pers.',
    luggage: 'bag(s)', boardbags: 'boardbag(s)', timeTbc: 'time to be confirmed',
    routes: {
      'aero-to-center': 'Transfer Airport → Bilene', 'center-to-aero': 'Transfer Bilene → Airport',
      'center-to-town': 'Transfer Bilene → Maputo', 'town-to-center': 'Transfer Maputo → Bilene', other: 'Transfer',
    },
    centerAccess: 'Center access (own gear)',
    noTransfer: 'No transfer booked', empty: 'Nothing ordered yet.',
    includedVia: a => `Included via ${a}`,
    paidToOwner: 'Paid directly to the owner',
    paidToProvider: p => `Paid directly to ${p}`,
    handledBy: p => `Handled by ${p}`,
    total: 'Total ordered', discount: 'Discount', paid: 'Already paid', remaining: 'Remaining to pay',
    footnote: 'Lessons, rentals and meals taken on site are added to your client account.',
  },
  es: {
    title: 'Su pedido',
    house: (acc, room) => `Casa ${acc} · habitación ${room}`,
    night: 'noche', nights: 'noches', days: 'días', pers: 'pers.',
    luggage: 'maleta(s)', boardbags: 'funda(s) de tabla', timeTbc: 'hora por confirmar',
    routes: {
      'aero-to-center': 'Traslado Aeropuerto → Bilene', 'center-to-aero': 'Traslado Bilene → Aeropuerto',
      'center-to-town': 'Traslado Bilene → Maputo', 'town-to-center': 'Traslado Maputo → Bilene', other: 'Traslado',
    },
    centerAccess: 'Acceso al centro (material propio)',
    noTransfer: 'Ningún traslado reservado', empty: 'Nada pedido por ahora.',
    includedVia: a => `Incluido vía ${a}`,
    paidToOwner: 'Pagado directamente al propietario',
    paidToProvider: p => `A pagar directamente a ${p}`,
    handledBy: p => `Gestionado por ${p}`,
    total: 'Total pedido', discount: 'Descuento', paid: 'Ya pagado', remaining: 'Pendiente de pago',
    footnote: 'Las clases, alquileres y comidas en el centro se añaden a su cuenta de cliente.',
  },
}

const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function money(n: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR' }).format(n)
}

function day(iso: string, lang: Lang): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Icon, title and detail line of one order line. Exported for the tests. */
export function describeLine(line: OrderLine, lang: Lang): { icon: string; title: string; detail: string } {
  const w = W[lang]
  const it = line.item
  switch (it.kind) {
    case 'room': {
      const title = it.accommodationType === 'house' ? w.house(it.accommodationName, it.roomName)
        : it.accommodationType === 'bungalow' ? (/^bungalow/i.test(it.accommodationName) ? it.accommodationName : `Bungalow ${it.accommodationName}`)
        : `${it.accommodationName} · ${it.roomName}`
      return { icon: '🏠', title, detail: `${it.nights} ${it.nights === 1 ? w.night : w.nights} × ${money(it.nightlyRate, lang)}` }
    }
    case 'external_stay':
      return {
        icon: '🏠',
        title: [it.accommodationName, ...it.roomNames].join(' · '),
        detail: `${day(it.checkIn, lang)} → ${day(it.checkOut, lang)} · ${it.nights} ${it.nights === 1 ? w.night : w.nights}`,
      }
    case 'taxi':
      return {
        icon: '🚕',
        title: w.routes[it.tripType] ?? w.routes.other,
        detail: [
          day(it.date, lang),
          // 00:00 is the placeholder of a booking saved without a flight time
          it.time && it.time !== '00:00' ? it.time : w.timeTbc,
          `${it.persons} ${w.pers}`,
          it.luggage > 0 ? `${it.luggage} ${w.luggage}` : '',
          it.boardbags > 0 ? `${it.boardbags} ${w.boardbags}` : '',
        ].filter(Boolean).join(' · '),
      }
    case 'activity':
      return {
        icon: '🎟️',
        title: it.label,
        detail: [it.endDate && it.endDate !== it.date ? `${day(it.date, lang)} → ${day(it.endDate, lang)}` : day(it.date, lang), `${it.persons} ${w.pers}`].join(' · '),
      }
    case 'center_access':
      return {
        icon: '🏄', title: w.centerAccess,
        detail: [`${it.persons} ${w.pers}`, `${it.days} ${w.days}`, ...(line.settledBy.kind === 'us' ? [money(it.rate, lang)] : [])].join(' × '),
      }
    case 'extra':
      return { icon: '➕', title: it.label, detail: it.quantity !== 1 ? `${it.quantity} × ${money(it.unitPrice, lang)}` : '' }
    case 'agency_service':
      return { icon: '📦', title: it.label, detail: [it.hours ? `${it.hours} h` : '', it.travelerName ?? ''].filter(Boolean).join(' · ') }
  }
}

function settledText(line: OrderLine, lang: Lang): string {
  const w = W[lang], s = line.settledBy
  if (s.kind === 'us') return money(line.amount ?? 0, lang)
  const note = s.kind === 'agency' ? w.includedVia(s.name)
    : s.kind === 'owner' ? w.paidToOwner
    : s.kind === 'place' ? w.handledBy(s.name)
    : w.paidToProvider(s.name)
  return `<span style="font-weight:normal;font-style:italic;color:#0f766e;">${esc(note)}</span>`
}

/** `fs` / `small`: font sizes of the host document (px in the email, pt in the PDF). */
export function bookingOrderHtml(order: BookingOrder, lang: Lang, fs: string, small: string): string {
  const w = W[lang]
  const cell = 'padding:6px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;'
  const muted = `<tr><td colspan="2" style="${cell}color:#9ca3af;font-style:italic;font-size:${small};">`

  const rows = order.lines.map(l => {
    const d = describeLine(l, lang)
    return `
      <tr>
        <td style="${cell}">
          <div style="font-size:${fs};font-weight:bold;color:#1f2937;">${d.icon}&nbsp; ${esc(d.title)}</div>
          ${d.detail ? `<div style="font-size:${small};color:#6b7280;margin-top:2px;">${esc(d.detail)}</div>` : ''}
        </td>
        <td style="${cell}text-align:right;white-space:nowrap;font-size:${fs};font-weight:bold;">${settledText(l, lang)}</td>
      </tr>`
  })
  if (order.lines.length === 0) rows.push(`${muted}${w.empty}</td></tr>`)
  else if (!order.lines.some(l => l.item.kind === 'taxi')) rows.push(`${muted}🚕&nbsp; ${w.noTransfer}</td></tr>`)

  const sum = (label: string, value: string, strong = false) => `
      <tr>
        <td style="padding:4px 10px;font-size:${fs};text-align:right;color:${strong ? BLUE : '#6b7280'};${strong ? 'font-weight:bold;' : ''}">${label}</td>
        <td style="padding:4px 10px;font-size:${fs};text-align:right;white-space:nowrap;font-weight:bold;${strong ? `color:${BLUE};` : ''}">${value}</td>
      </tr>`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows.join('')}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px;">
      ${sum(w.total, money(order.total, lang))}
      ${order.discounts > 0 ? sum(w.discount, `− ${money(order.discounts, lang)}`) : ''}
      ${sum(w.paid, money(order.paid, lang))}
      ${sum(w.remaining, money(order.remaining, lang), true)}
    </table>
    <p style="margin:8px 10px 0;font-size:${small};color:#6b7280;font-style:italic;">${w.footnote}</p>`
}

export function bookingOrderTitle(lang: Lang): string {
  return W[lang].title
}
