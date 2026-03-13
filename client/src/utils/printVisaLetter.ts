import type { Booking, BookingParticipant } from '../types/database'

const LOGO_URL  = `${window.location.origin}/docs/logo-mas.png`
const SIGN_URL  = `${window.location.origin}/docs/signature-mas.png`
const BLUE      = '#4472C4'

function todayFmt(): string {
  const d = new Date()
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function fmtVisa(iso: string | null): string {
  if (!iso) return '<span style="color:#dc2626;">___/___/______</span>'
  const [y, m, d] = iso.split('-')
  return `<strong style="text-decoration:underline;">${d}/${m}/${y}</strong>`
}

function participantRow(index: number, p: BookingParticipant): string {
  const passport = p.passport_number ?? '—'
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:0.5pt solid #eee;">
      <span>${index + 1}&nbsp;&nbsp;<strong>${p.first_name.toUpperCase()} ${(p.last_name ?? '').toUpperCase()}</strong></span>
      <span style="color:#555;">Passport no &nbsp; <strong>${passport}</strong></span>
    </div>`
}

export function printVisaLetter(booking: Booking, participants: BookingParticipant[]): void {
  const slots = participants

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Visa Letter — Reserva #${booking.booking_number}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
    * { box-sizing: border-box; }
    body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      margin: 0;
      padding: 20px 30px;
      max-width: 210mm;
    }
    .toolbar {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 10px 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .toolbar span { font-size: 10pt; color: #0369a1; flex: 1; }
    .btn-print {
      background: #2563eb; color: #fff; border: none; border-radius: 6px;
      padding: 8px 18px; font-size: 10pt; cursor: pointer; font-weight: bold;
    }
    .btn-close {
      background: #e5e7eb; color: #374151; border: none; border-radius: 6px;
      padding: 8px 14px; font-size: 10pt; cursor: pointer;
    }
    p { margin: 0 0 6px; }
  </style>
</head>
<body>

  <!-- Toolbar (hidden on print) -->
  <div class="no-print toolbar">
    <span>📄 Visa Letter — Booking #${String(booking.booking_number).padStart(3, '0')}</span>
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>

  <!-- ── Header ──────────────────────────────────────────────────── -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;">
    <div>
      <p style="font-weight:bold;font-size:10pt;margin-bottom:6px;">MOZAMBIQUE ACTION SPORT LDA.</p>
      <p style="font-size:15pt;margin-bottom:3px;">COMPLEXO PALMEIRAS</p>
      <p style="font-style:italic;font-size:9pt;color:#555;margin-bottom:2px;">PRAIA DO BILENE GAZA</p>
      <p style="font-size:9pt;color:#555;margin-bottom:2px;">TEL FAX 28259019 / +258841388658</p>
      <p style="font-size:9pt;color:${BLUE};margin:0;">EMAIL:&nbsp;&nbsp;palmeirasbilene@gmail.com</p>
    </div>
    <img src="${LOGO_URL}" alt="Logo" style="width:160px;height:auto;" onerror="this.style.display='none'" />
  </div>

  <!-- ── Date ──────────────────────────────────────────────────────── -->
  <p style="text-align:right;font-style:italic;margin-bottom:28px;">${todayFmt()}</p>

  <!-- ── Greeting ──────────────────────────────────────────────────── -->
  <p style="font-size:13pt;margin-bottom:12px;">A quem possa interessar</p>
  <p style="font-size:13pt;margin-bottom:22px;">Excelências:</p>

  <!-- ── Body ──────────────────────────────────────────────────────── -->
  <p style="margin-bottom:4px;">O resort acima mencionado, confirma os nomes dos cidadãos reservados conosco</p>
  <p style="margin-bottom:22px;">
    De &nbsp;${fmtVisa(booking.visa_entry_date)}&nbsp; a &nbsp;${fmtVisa(booking.visa_exit_date)}&nbsp; e eles entrarão no portão da fronteira.
  </p>

  <!-- ── Booking number ─────────────────────────────────────────────── -->
  <p style="margin-bottom:20px;">
    nº Reserva &nbsp;
    <span style="background:#d1d5db;padding:3px 14px;font-weight:bold;font-size:12pt;">${booking.booking_number}</span>
  </p>

  <!-- ── Participants ───────────────────────────────────────────────── -->
  <div style="margin-bottom:24px;">
    ${slots.map((p, i) => participantRow(i, p)).join('')}
    ${slots.length === 0 ? '<p style="color:#dc2626;font-style:italic;">⚠ No participants listed</p>' : ''}
  </div>

  <!-- ── Travel info ────────────────────────────────────────────────── -->
  <div style="margin-bottom:32px;">
    <p style="margin-bottom:6px;">
      <strong>MOTIVO DA VIAGEM</strong>&nbsp;&nbsp;&nbsp;&nbsp;
      <strong style="color:${BLUE};">TURISMO</strong>
    </p>
    <p>
      <strong>HOSPEDAGEM:</strong>&nbsp;&nbsp;&nbsp;&nbsp;
      <strong style="color:${BLUE};">Complexo Palmeiras (Rua Marginal Bilene, 1200)</strong>
    </p>
  </div>

  <!-- ── Closing ────────────────────────────────────────────────────── -->
  <p style="line-height:1.8;margin-bottom:24px;">
    Se suas excelências puderem gentilmente dar o visto aos nossos clientes,<br>
    estaremos muito gratos<br>
    Qualquer outra informação necessária, entre em contato conosco.<br>
    Obrigado
  </p>

  <!-- ── Signature ──────────────────────────────────────────────────── -->
  <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
    <img src="${SIGN_URL}" alt="Signature" style="width:130px;height:auto;" onerror="this.style.display='none'" />
    <div style="font-style:italic;color:#555;font-size:9pt;text-align:center;line-height:1.6;">
      <span>David Pereira &nbsp; Guatura Praia do Bilene</span><br>
      <span>${todayFmt()}</span>
    </div>
  </div>

  <script>
    // Auto-print once images are loaded (or after timeout)
    let done = false
    function tryPrint() { if (done) return; done = true; window.print() }
    const imgs = document.querySelectorAll('img')
    if (imgs.length === 0) { setTimeout(tryPrint, 300) } else {
      let loaded = 0
      imgs.forEach(img => {
        const onLoad = () => { loaded++; if (loaded >= imgs.length) tryPrint() }
        if (img.complete) onLoad(); else { img.addEventListener('load', onLoad); img.addEventListener('error', onLoad) }
      })
      setTimeout(tryPrint, 2500)
    }
  </script>

</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=1060')
  if (!win) { alert('Please allow pop-ups to generate the PDF.'); return }
  win.document.write(html)
  win.document.close()
}
