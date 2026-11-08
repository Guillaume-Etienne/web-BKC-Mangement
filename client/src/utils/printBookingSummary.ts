import type { Booking, BookingParticipant } from '../types/database'
import { guideTextHtml, type TravelGuideSection } from '../data/travelGuide'
import type { BookingOrder } from './bookingOrder'
import { bookingOrderHtml, bookingOrderTitle } from './bookingOrderHtml'

const LOGO_URL = `${window.location.origin}/docs/LOGO-bkc.png`
const BLUE = '#4472C4'
const TEAL = '#0f766e'

export type Lang = 'fr' | 'en' | 'es'

const T: Record<Lang, Record<string, string>> = {
  fr: {
    title: 'Confirmation de Réservation', bookingRef: 'Réservation n°',
    yourStay: 'Votre séjour', checkIn: 'Arrivée', checkOut: 'Départ',
    duration: 'Durée', nights: 'nuits',
    guests: 'Voyageurs', name: 'Nom', passport: 'Passeport',
    at: 'à',
    travelGuide: 'Guide du voyageur',
    generatedOn: 'Document généré le', contact: 'Contact',
  },
  en: {
    title: 'Booking Confirmation', bookingRef: 'Booking #',
    yourStay: 'Your stay', checkIn: 'Check-in', checkOut: 'Check-out',
    duration: 'Duration', nights: 'nights',
    guests: 'Guests', name: 'Name', passport: 'Passport',
    at: 'at',
    travelGuide: "Traveller's guide",
    generatedOn: 'Document generated on', contact: 'Contact',
  },
  es: {
    title: 'Confirmación de Reserva', bookingRef: 'Reserva n°',
    yourStay: 'Su estancia', checkIn: 'Llegada', checkOut: 'Salida',
    duration: 'Duración', nights: 'noches',
    guests: 'Viajeros', name: 'Nombre', passport: 'Pasaporte',
    at: 'a las',
    travelGuide: 'Guía del viajero',
    generatedOn: 'Documento generado el', contact: 'Contacto',
  },
}

function fmtDate(iso: string | null, lang: Lang): string {
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

function nightCount(checkIn: string, checkOut: string): number {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
}

function section(icon: string, title: string, content: string): string {
  return `
    <div style="margin-bottom:20px;">
      <div style="background:#f3f4f6;border-left:4px solid ${BLUE};padding:5px 10px;font-weight:bold;font-size:11pt;color:${BLUE};margin-bottom:10px;">
        ${icon}&nbsp; ${title}
      </div>
      ${content}
    </div>`
}

function kvRow(key: string, val: string): string {
  return `
    <div style="display:flex;padding:4px 10px;font-size:10pt;">
      <span style="width:160px;color:#6b7280;">${key}</span>
      <span style="flex:1;font-weight:bold;">${val}</span>
    </div>`
}

/** The client-facing confirmation.
 *
 *  Until 2026-11-08 it stated only what had been paid: the total then was a
 *  hand-typed estimate on prices that still moved, and a client reads a figure
 *  on a confirmation as a quote. It now lists what is ORDERED, each line at a
 *  firm price, with total / paid / remaining — and says that lessons, rentals
 *  and meals come on top (gui). Lines and figures: utils/bookingOrder.ts; the
 *  block is rendered by bookingOrderHtml, shared with the email. */
export function printBookingSummary(
  booking: Booking,
  /** buildBookingOrder(): what is ordered, its prices, paid (verified money
   *  only — never `booking.amount_paid`) and what remains. */
  order: BookingOrder,
  lang: Lang,
  activeSections: TravelGuideSection[],
  bookingParticipants: BookingParticipant[],
): void {
  const t = T[lang]
  const client = booking.client
  const clientName = client ? `${client.first_name} ${client.last_name}` : '—'
  const nights = nightCount(booking.check_in, booking.check_out)

  // ── Stay section content (rooms are in the order block, with type and price) ──
  const stayContent = [
    kvRow(t.checkIn, `${fmtDate(booking.check_in, lang)}${booking.arrival_time ? `&nbsp;&nbsp;${t.at} ${booking.arrival_time}` : ''}`),
    kvRow(t.checkOut, `${fmtDate(booking.check_out, lang)}${booking.departure_time ? `&nbsp;&nbsp;${t.at} ${booking.departure_time}` : ''}`),
    kvRow(t.duration, `${nights} ${t.nights}`),
  ].join('')

  // ── Guests section ──
  const bParts = bookingParticipants.filter(p => p.booking_id === booking.id)
  const guestsContent = bParts.length === 0 ? '' :
    section('👥', t.guests, `
      <table style="width:100%;border-collapse:collapse;font-size:10pt;">
        <thead>
          <tr style="background:${BLUE};color:#fff;">
            <th style="padding:5px 10px;text-align:left;width:30px;">#</th>
            <th style="padding:5px 10px;text-align:left;">${t.name}</th>
            <th style="padding:5px 10px;text-align:left;width:140px;">${t.passport}</th>
          </tr>
        </thead>
        <tbody>
          ${bParts.map((p, i) => `
            <tr style="border-bottom:0.5pt solid #e5e7eb;">
              <td style="padding:5px 10px;color:#9ca3af;">${i + 1}</td>
              <td style="padding:5px 10px;">${p.first_name} ${p.last_name ?? ''}</td>
              <td style="padding:5px 10px;color:#6b7280;">${p.passport_number ?? ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>`)

  // ── Travel guide ──
  const guideContent = activeSections.length === 0 ? '' :
    section('🌍', t.travelGuide, activeSections.map(sec => `
      <div style="margin:0 10px 14px;">
        <div style="font-weight:bold;color:${TEAL};font-size:10pt;margin-bottom:4px;">${sec.title[lang]}</div>
        <div style="font-size:9.5pt;color:#374151;line-height:1.7;">${guideTextHtml(sec.content[lang])}</div>
      </div>`).join(''))

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>${t.title} — #${String(booking.booking_number).padStart(3, '0')}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
    * { box-sizing: border-box; }
    body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 20px 30px; max-width: 210mm; }
    .toolbar { background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
    .toolbar span { font-size:10pt;color:#0369a1;flex:1; }
    .btn-print { background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:10pt;cursor:pointer;font-weight:bold; }
    .btn-close { background:#e5e7eb;color:#374151;border:none;border-radius:6px;padding:8px 14px;font-size:10pt;cursor:pointer; }
  </style>
</head>
<body>

  <div class="no-print toolbar">
    <span>${t.title} — #${String(booking.booking_number).padStart(3, '0')} &nbsp;&bull;&nbsp; ${clientName}</span>
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>

  <!-- ── Header ──────────────────────────────────────────────────── -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:2.5pt solid ${BLUE};margin-bottom:18px;">
    <div>
      <div style="font-size:18pt;font-weight:bold;color:${BLUE};margin-bottom:4px;">${t.title}</div>
      <div style="font-size:10.5pt;color:#6b7280;margin-bottom:3px;">${t.bookingRef}${String(booking.booking_number).padStart(3, '0')}</div>
      <div style="font-size:13pt;font-weight:bold;">${clientName}</div>
    </div>
    <img src="${LOGO_URL}" alt="Logo" style="height:65px;width:auto;" onerror="this.style.display='none'" />
  </div>

  ${section('🏠', t.yourStay, stayContent)}
  ${guestsContent}
  ${section('🧾', bookingOrderTitle(lang), bookingOrderHtml(order, lang, '10pt', '9pt'))}
  ${guideContent}

  <!-- ── Footer ──────────────────────────────────────────────────── -->
  <div style="margin-top:30px;padding-top:8px;border-top:0.5pt solid #e5e7eb;display:flex;justify-content:space-between;font-size:8.5pt;color:#9ca3af;font-style:italic;">
    <span>${t.contact}: contact@bilenekite.com &bull; whatsapp +33 6 51 79 05 40</span>
    <span>${t.generatedOn} ${todayLong(lang)}</span>
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=1060')
  if (!win) { alert('Please allow pop-ups to generate the PDF.'); return }
  win.document.write(html)
  win.document.close()
}
