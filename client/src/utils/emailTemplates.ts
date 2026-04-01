/**
 * Email HTML templates — adapted from print utils.
 * Same content as PDF templates but without toolbar, print CSS, and auto-print script.
 * All CSS is inline or in <style> tag (email-safe).
 */

import type { Booking, BookingParticipant } from '../types/database'
import type { TravelGuideSection } from '../data/travelGuide'
import type { Lang } from './printBookingSummary'

const LOGO_URL = `${window.location.origin}/docs/logo-mas.png`
const BLUE     = '#4472C4'
const TEAL     = '#0f766e'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function nightCount(checkIn: string, checkOut: string): number {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
}

function fmtDateLang(iso: string | null, lang: Lang): string {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString(
    lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  )
}

function todayLong(lang: Lang): string {
  return new Date().toLocaleDateString(
    lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  )
}

function emailWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#f3f4f6; font-family: Arial, 'Helvetica Neue', sans-serif; }
    .container { max-width:620px; margin:24px auto; background:#fff; border-radius:8px; overflow:hidden; }
    .footer { background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 24px; font-size:11px; color:#9ca3af; text-align:center; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
    <div class="footer">
      Bilene Kite Center — Praia do Bilene, Gaza, Mozambique<br>
      contact@bilenekite.com &bull; whatsapp +33 6 51 79 05 40
    </div>
  </div>
</body>
</html>`
}

// ── Visa Letter ────────────────────────────────────────────────────────────────

function fmtVisa(iso: string | null): string {
  if (!iso) return '<span style="color:#dc2626;">___/___/______</span>'
  const [y, m, d] = iso.split('-')
  return `<strong style="text-decoration:underline;">${d}/${m}/${y}</strong>`
}

export function emailVisaLetter(booking: Booking, participants: BookingParticipant[]): string {
  const today = new Date()
  const todayFmt = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`

  const participantRows = participants.map((p, i) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">
        ${i + 1}&nbsp;&nbsp;<strong>${p.first_name.toUpperCase()} ${(p.last_name ?? '').toUpperCase()}</strong>
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#555;">
        Passport: <strong>${p.passport_number ?? '—'}</strong>
      </td>
    </tr>`).join('')

  const body = `
    <!-- Header -->
    <div style="padding:24px 28px 16px;border-bottom:2px solid ${BLUE};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="top">
            <p style="margin:0 0 4px;font-weight:bold;font-size:10px;">MOZAMBIQUE ACTION SPORT LDA.</p>
            <p style="margin:0 0 2px;font-size:14px;font-weight:bold;">COMPLEXO PALMEIRAS</p>
            <p style="margin:0 0 2px;font-size:10px;color:#555;font-style:italic;">PRAIA DO BILENE GAZA</p>
            <p style="margin:0 0 2px;font-size:10px;color:#555;">TEL FAX 28259019 / +258841388658</p>
            <p style="margin:0;font-size:10px;color:${BLUE};">EMAIL: palmeirasbilene@gmail.com</p>
          </td>
          <td align="right" valign="top">
            <img src="${LOGO_URL}" alt="Logo" width="120" style="display:block;" />
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;font-size:13px;line-height:1.7;color:#1a1a1a;">
      <p style="text-align:right;font-style:italic;margin:0 0 20px;">${todayFmt}</p>
      <p style="font-size:14px;margin:0 0 8px;">A quem possa interessar</p>
      <p style="font-size:14px;margin:0 0 20px;">Excelências:</p>

      <p style="margin:0 0 6px;">O resort acima mencionado, confirma os nomes dos cidadãos reservados conosco</p>
      <p style="margin:0 0 24px;">
        De &nbsp;${fmtVisa(booking.visa_entry_date)}&nbsp; a &nbsp;${fmtVisa(booking.visa_exit_date)}&nbsp; e eles entrarão no portão da fronteira.
      </p>

      <p style="margin:0 0 20px;">
        nº Reserva &nbsp;
        <span style="background:#d1d5db;padding:3px 14px;font-weight:bold;font-size:13px;">${booking.booking_number}</span>
      </p>

      ${participants.length > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <tbody>${participantRows}</tbody>
      </table>` : `<p style="color:#dc2626;font-style:italic;margin-bottom:24px;">⚠ No participants listed</p>`}

      <p style="margin:0 0 6px;">
        <strong>MOTIVO DA VIAGEM</strong>&nbsp;&nbsp;&nbsp;
        <strong style="color:${BLUE};">TURISMO</strong>
      </p>
      <p style="margin:0 0 28px;">
        <strong>HOSPEDAGEM:</strong>&nbsp;&nbsp;&nbsp;
        <strong style="color:${BLUE};">Complexo Palmeiras (Rua Marginal Bilene, 1200)</strong>
      </p>

      <p style="margin:0 0 4px;">Se suas excelências puderem gentilmente dar o visto aos nossos clientes,</p>
      <p style="margin:0 0 4px;">estaremos muito gratos</p>
      <p style="margin:0 0 4px;">Qualquer outra informação necessária, entre em contato conosco.</p>
      <p style="margin:0 0 24px;">Obrigado</p>

      <div style="text-align:center;font-style:italic;color:#555;font-size:11px;line-height:1.6;">
        <div>David Pereira &nbsp; Guatura Praia do Bilene</div>
        <div>${todayFmt}</div>
      </div>
    </div>`

  return emailWrapper(`Visa Letter — Reserva #${booking.booking_number}`, body)
}

// ── Booking Confirmation (Booking Summary) ─────────────────────────────────────

const T: Record<Lang, Record<string, string>> = {
  fr: {
    title: 'Confirmation de Réservation', bookingRef: 'Réservation n°',
    yourStay: 'Votre séjour', checkIn: 'Arrivée', checkOut: 'Départ',
    room: 'Hébergement', duration: 'Durée', nights: 'nuits',
    guests: 'Voyageurs', name: 'Nom', passport: 'Passeport',
    transport: 'Transport', arrivalTransfer: 'Navette arrivée', departureTransfer: 'Navette départ',
    at: 'à', luggage: 'bagage(s)', boardbag: 'sac(s) de board', noTransport: 'Aucun transfert prévu',
    payment: 'Paiement', amountPaid: 'Montant réglé', totalAmount: 'Total estimé du séjour',
    balanceDue: 'Solde restant à régler', travelGuide: 'Guide du voyageur',
    generatedOn: 'Document généré le', contact: 'Contact',
  },
  en: {
    title: 'Booking Confirmation', bookingRef: 'Booking #',
    yourStay: 'Your stay', checkIn: 'Check-in', checkOut: 'Check-out',
    room: 'Accommodation', duration: 'Duration', nights: 'nights',
    guests: 'Guests', name: 'Name', passport: 'Passport',
    transport: 'Transport', arrivalTransfer: 'Arrival transfer', departureTransfer: 'Departure transfer',
    at: 'at', luggage: 'luggage', boardbag: 'boardbag(s)', noTransport: 'No transfer planned',
    payment: 'Payment', amountPaid: 'Amount paid', totalAmount: 'Estimated total',
    balanceDue: 'Balance due', travelGuide: "Traveller's guide",
    generatedOn: 'Generated on', contact: 'Contact',
  },
  es: {
    title: 'Confirmación de Reserva', bookingRef: 'Reserva n°',
    yourStay: 'Su estancia', checkIn: 'Llegada', checkOut: 'Salida',
    room: 'Alojamiento', duration: 'Duración', nights: 'noches',
    guests: 'Viajeros', name: 'Nombre', passport: 'Pasaporte',
    transport: 'Transporte', arrivalTransfer: 'Traslado llegada', departureTransfer: 'Traslado salida',
    at: 'a las', luggage: 'maleta(s)', boardbag: 'funda(s) de tabla', noTransport: 'Sin traslado previsto',
    payment: 'Pago', amountPaid: 'Importe pagado', totalAmount: 'Total estimado',
    balanceDue: 'Saldo pendiente', travelGuide: 'Guía del viajero',
    generatedOn: 'Generado el', contact: 'Contacto',
  },
}

function sectionBlock(icon: string, title: string, content: string): string {
  return `
    <div style="margin-bottom:20px;">
      <div style="background:#f3f4f6;border-left:4px solid ${BLUE};padding:8px 12px;font-weight:bold;font-size:13px;color:${BLUE};margin-bottom:10px;">
        ${icon} ${title}
      </div>
      ${content}
    </div>`
}

function kvRow(key: string, val: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
      <tr>
        <td style="width:150px;font-size:12px;color:#6b7280;padding:3px 10px;">${key}</td>
        <td style="font-size:12px;font-weight:bold;padding:3px 10px;">${val}</td>
      </tr>
    </table>`
}

export function emailBookingConfirmation(
  booking: Booking,
  roomLabels: string[],
  lang: Lang,
  totalAmount: number | null,
  activeSections: TravelGuideSection[],
  participants: BookingParticipant[]
): string {
  const t = T[lang]
  const client = booking.client
  const clientName = client ? `${client.first_name} ${client.last_name}` : '—'
  const nights  = nightCount(booking.check_in, booking.check_out)
  const balance = totalAmount != null ? totalAmount - booking.amount_paid : null

  const stayContent = [
    kvRow(t.checkIn,  `${fmtDateLang(booking.check_in, lang)}${booking.arrival_time ? ` &nbsp;${t.at} ${booking.arrival_time}` : ''}`),
    kvRow(t.checkOut, `${fmtDateLang(booking.check_out, lang)}${booking.departure_time ? ` &nbsp;${t.at} ${booking.departure_time}` : ''}`),
    kvRow(t.duration, `${nights} ${t.nights}`),
    roomLabels.length > 0 ? kvRow(t.room, roomLabels.join(' · ')) : '',
  ].join('')

  const bParts = participants.filter(p => p.booking_id === booking.id)
  const guestsContent = bParts.length === 0 ? '' :
    sectionBlock('👥', t.guests, `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:${BLUE};color:#fff;">
            <th style="padding:6px 10px;text-align:left;width:28px;">#</th>
            <th style="padding:6px 10px;text-align:left;">${t.name}</th>
            <th style="padding:6px 10px;text-align:left;width:130px;">${t.passport}</th>
          </tr>
        </thead>
        <tbody>
          ${bParts.map((p, i) => `
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:5px 10px;color:#9ca3af;">${i + 1}</td>
              <td style="padding:5px 10px;">${p.first_name} ${p.last_name ?? ''}</td>
              <td style="padding:5px 10px;color:#6b7280;">${p.passport_number ?? ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>`)

  function transferBox(label: string, dateStr: string, time: string | null, lug: number, bags: number): string {
    const details = [
      time ? `${dateStr} &nbsp;${t.at} ${time}` : dateStr,
      lug  > 0 ? `${lug} ${t.luggage}` : '',
      bags > 0 ? `${bags} ${t.boardbag}` : '',
    ].filter(Boolean).join(' &nbsp;·&nbsp; ')
    return `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;margin:0 10px 8px;font-size:12px;">
        <div style="font-weight:bold;color:${TEAL};margin-bottom:4px;">${label}</div>
        <div style="color:#374151;">${details}</div>
      </div>`
  }

  const transportContent = (!booking.taxi_arrival && !booking.taxi_departure)
    ? `<p style="padding:0 10px;color:#9ca3af;font-style:italic;font-size:12px;">${t.noTransport}</p>`
    : [
        booking.taxi_arrival   ? transferBox(`→ ${t.arrivalTransfer}`,   fmtDateLang(booking.check_in,  lang), booking.arrival_time,   booking.luggage_count, booking.boardbag_count) : '',
        booking.taxi_departure ? transferBox(`← ${t.departureTransfer}`, fmtDateLang(booking.check_out, lang), booking.departure_time, 0, 0) : '',
      ].join('')

  const paymentRows = [
    totalAmount != null ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:2px;">
        <tr>
          <td style="padding:4px 10px;font-size:12px;color:#6b7280;">${t.totalAmount}</td>
          <td style="padding:4px 10px;font-size:12px;font-weight:bold;text-align:right;">&euro;${totalAmount.toFixed(2)}</td>
        </tr>
      </table>` : '',
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:2px;">
       <tr>
         <td style="padding:4px 10px;font-size:12px;color:#6b7280;">${t.amountPaid}</td>
         <td style="padding:4px 10px;font-size:12px;font-weight:bold;text-align:right;">&euro;${booking.amount_paid.toFixed(2)}</td>
       </tr>
     </table>`,
    balance != null && balance > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;margin-top:4px;border-radius:4px;">
        <tr>
          <td style="padding:7px 10px;font-size:13px;font-weight:bold;color:#92400e;">${t.balanceDue}</td>
          <td style="padding:7px 10px;font-size:13px;font-weight:bold;color:#92400e;text-align:right;">&euro;${balance.toFixed(2)}</td>
        </tr>
      </table>` : '',
  ].join('')

  const guideContent = activeSections.length === 0 ? '' :
    sectionBlock('🌍', t.travelGuide, activeSections.map(sec => `
      <div style="margin:0 10px 14px;">
        <div style="font-weight:bold;color:${TEAL};font-size:12px;margin-bottom:4px;">${sec.title[lang]}</div>
        <div style="font-size:12px;color:#374151;line-height:1.7;">${sec.content[lang]}</div>
      </div>`).join(''))

  const body = `
    <!-- Header -->
    <div style="padding:24px 28px 16px;border-bottom:3px solid ${BLUE};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="middle">
            <div style="font-size:18px;font-weight:bold;color:${BLUE};margin-bottom:3px;">${t.title}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${t.bookingRef}${String(booking.booking_number).padStart(3, '0')}</div>
            <div style="font-size:15px;font-weight:bold;">${clientName}</div>
          </td>
          <td align="right" valign="middle">
            <img src="${LOGO_URL}" alt="BKC" height="55" style="display:block;" />
          </td>
        </tr>
      </table>
    </div>

    <!-- Content -->
    <div style="padding:20px 28px;">
      ${sectionBlock('🏠', t.yourStay, stayContent)}
      ${guestsContent}
      ${sectionBlock('🚕', t.transport, transportContent)}
      ${sectionBlock('💰', t.payment, paymentRows)}
      ${guideContent}

      <div style="margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;font-style:italic;">
        ${t.generatedOn} ${todayLong(lang)}
      </div>
    </div>`

  return emailWrapper(`${t.title} — #${String(booking.booking_number).padStart(3, '0')}`, body)
}

// ── Travel Guide (standalone) ──────────────────────────────────────────────────

const GUIDE_T: Record<Lang, { title: string; intro: string }> = {
  fr: { title: 'Guide du Voyageur', intro: 'Voici quelques informations utiles pour préparer votre séjour.' },
  en: { title: "Traveller's Guide", intro: 'Here is some useful information to help you prepare for your stay.' },
  es: { title: 'Guía del Viajero',  intro: 'Aquí encontrará información útil para preparar su estancia.' },
}

export function emailTravelGuide(
  booking: Booking,
  lang: Lang,
  activeSections: TravelGuideSection[]
): string {
  const gt = GUIDE_T[lang]
  const client = booking.client
  const clientName = client ? `${client.first_name} ${client.last_name}` : '—'

  const sectionsHtml = activeSections.map(sec => `
    <div style="margin-bottom:20px;">
      <div style="font-weight:bold;color:${TEAL};font-size:14px;margin-bottom:6px;border-bottom:1px solid #d1fae5;padding-bottom:4px;">${sec.title[lang]}</div>
      <div style="font-size:13px;color:#374151;line-height:1.7;">${sec.content[lang]}</div>
    </div>`).join('')

  const body = `
    <!-- Header -->
    <div style="background:${BLUE};padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="middle">
            <div style="font-size:20px;font-weight:bold;color:#fff;margin-bottom:4px;">${gt.title}</div>
            <div style="font-size:13px;color:#dbeafe;">${clientName} — Booking #${String(booking.booking_number).padStart(3, '0')}</div>
          </td>
          <td align="right" valign="middle">
            <img src="${LOGO_URL}" alt="BKC" height="50" style="display:block;" />
          </td>
        </tr>
      </table>
    </div>

    <!-- Content -->
    <div style="padding:24px 28px;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">${gt.intro}</p>
      ${sectionsHtml}
    </div>`

  return emailWrapper(`${gt.title} — #${String(booking.booking_number).padStart(3, '0')}`, body)
}
