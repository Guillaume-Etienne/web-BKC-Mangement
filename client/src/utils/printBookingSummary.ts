import type { Booking } from '../types/database'
import type { TravelGuideSection } from '../data/travelGuide'

const LOGO_URL = `${window.location.origin}/docs/logo-mas.png`
const BLUE = '#4472C4'
const TEAL = '#0f766e'

export type Lang = 'fr' | 'en' | 'es'

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
    generatedOn: 'Document generated on', contact: 'Contact',
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

export function printBookingSummary(
  booking: Booking,
  roomLabels: string[],
  lang: Lang,
  totalAmount: number | null,
  activeSections: TravelGuideSection[]
): void {
  const t = T[lang]
  const client = booking.client
  const clientName = client ? `${client.first_name} ${client.last_name}` : '—'
  const nights = nightCount(booking.check_in, booking.check_out)
  const balance = totalAmount != null ? totalAmount - booking.amount_paid : null

  // ── Stay section content ──
  const stayContent = [
    kvRow(t.checkIn, `${fmtDate(booking.check_in, lang)}${booking.arrival_time ? `&nbsp;&nbsp;${t.at} ${booking.arrival_time}` : ''}`),
    kvRow(t.checkOut, `${fmtDate(booking.check_out, lang)}${booking.departure_time ? `&nbsp;&nbsp;${t.at} ${booking.departure_time}` : ''}`),
    kvRow(t.duration, `${nights} ${t.nights}`),
    roomLabels.length > 0 ? kvRow(t.room, roomLabels.join(' &middot; ')) : '',
  ].join('')

  // ── Guests section ──
  const guestsContent = booking.participants.length === 0 ? '' :
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
          ${booking.participants.map((p, i) => `
            <tr style="border-bottom:0.5pt solid #e5e7eb;">
              <td style="padding:5px 10px;color:#9ca3af;">${i + 1}</td>
              <td style="padding:5px 10px;">${p.first_name} ${p.last_name}</td>
              <td style="padding:5px 10px;color:#6b7280;">${p.passport_number}</td>
            </tr>`).join('')}
        </tbody>
      </table>`)

  // ── Transport section ──
  function transferBox(label: string, dateStr: string, time: string | null, lug: number, bags: number): string {
    const details = [
      time ? `${dateStr} &nbsp;${t.at} ${time}` : dateStr,
      lug > 0 ? `${lug} ${t.luggage}` : '',
      bags > 0 ? `${bags} ${t.boardbag}` : '',
    ].filter(Boolean).join(' &nbsp;&bull;&nbsp; ')
    return `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;margin:0 10px 8px;font-size:10pt;">
        <div style="font-weight:bold;color:${TEAL};margin-bottom:4px;">${label}</div>
        <div style="color:#374151;">${details}</div>
      </div>`
  }
  const transportContent = (!booking.taxi_arrival && !booking.taxi_departure)
    ? `<p style="padding:0 10px;color:#9ca3af;font-style:italic;font-size:10pt;">${t.noTransport}</p>`
    : [
        booking.taxi_arrival  ? transferBox(`→ ${t.arrivalTransfer}`,   fmtDate(booking.check_in,  lang), booking.arrival_time,   booking.luggage_count, booking.boardbag_count) : '',
        booking.taxi_departure ? transferBox(`← ${t.departureTransfer}`, fmtDate(booking.check_out, lang), booking.departure_time, 0, 0) : '',
      ].join('')

  // ── Payment section ──
  const paymentRows = [
    totalAmount != null ? `
      <div style="display:flex;justify-content:space-between;padding:5px 10px;font-size:10pt;border-bottom:0.5pt solid #e5e7eb;">
        <span style="color:#6b7280;">${t.totalAmount}</span>
        <span style="font-weight:bold;">&euro;${totalAmount.toFixed(2)}</span>
      </div>` : '',
    `<div style="display:flex;justify-content:space-between;padding:5px 10px;font-size:10pt;border-bottom:0.5pt solid #e5e7eb;">
        <span style="color:#6b7280;">${t.amountPaid}</span>
        <span style="font-weight:bold;">&euro;${booking.amount_paid.toFixed(2)}</span>
     </div>`,
    balance != null && balance > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:7px 10px;font-size:10.5pt;background:#fef3c7;margin-top:4px;">
        <span style="font-weight:bold;color:#92400e;">${t.balanceDue}</span>
        <span style="font-weight:bold;color:#92400e;">&euro;${balance.toFixed(2)}</span>
      </div>` : '',
  ].join('')

  // ── Travel guide ──
  const guideContent = activeSections.length === 0 ? '' :
    section('🌍', t.travelGuide, activeSections.map(sec => `
      <div style="margin:0 10px 14px;">
        <div style="font-weight:bold;color:${TEAL};font-size:10pt;margin-bottom:4px;">${sec.title[lang]}</div>
        <div style="font-size:9.5pt;color:#374151;line-height:1.7;">${sec.content[lang]}</div>
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
  ${section('🚕', t.transport, transportContent)}
  ${section('💰', t.payment, paymentRows)}
  ${guideContent}

  <!-- ── Footer ──────────────────────────────────────────────────── -->
  <div style="margin-top:30px;padding-top:8px;border-top:0.5pt solid #e5e7eb;display:flex;justify-content:space-between;font-size:8.5pt;color:#9ca3af;font-style:italic;">
    <span>${t.contact}: palmeirasbilene@gmail.com &bull; +258 84 138 8658</span>
    <span>${t.generatedOn} ${todayLong(lang)}</span>
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=1060')
  if (!win) { alert('Please allow pop-ups to generate the PDF.'); return }
  win.document.write(html)
  win.document.close()
}
