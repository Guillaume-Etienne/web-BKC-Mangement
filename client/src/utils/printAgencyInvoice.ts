import type { AgencyInvoiceDoc } from '../components/accounting/utils'

/** The invoice Fun & Fly expects, reproduced from the template gui has been
 *  filling by hand (`temp/Factu BKC 2025 FFLY Famille Brunet.xlsx`).
 *
 *  In French (gui's call): the agency is French, and the template is French.
 *
 *  Nothing is sent from here. It opens a printable page — same pattern as the
 *  visa letter — and gui reviews it before it goes out, which was his condition
 *  from the start of the agency work. */

const LOGO_URL = `${window.location.origin}/docs/logo-mas.png`
const BLUE = '#4472C4'

/** Issuer: the legal entity, exactly as on the template and the visa letter —
 *  an invoice is a legal document, so it carries Moçambique Action Sport, not
 *  the BKC commercial brand. Hardcoded (gui's call). */
const ISSUER = {
  name: 'Mocambique Action Sport, LDA',
  lines: ['Distrito Urbano 1', 'Bairro da COOP, Rue E, Casa N 12'],
  city: 'MAPUTO CIDADE',
  country: 'MOZAMBIQUE',
}

/** Our bank details, as printed on the template. Hardcoded (gui's call). */
const BANK = {
  iban: 'DE63 1001 1001 2626 1066 46',
  swift: 'NTSBDEB1XXX',
}

/** Billing addresses keyed by the agency's `short_code` — a stable column in the
 *  database, never the agency NAME. Matching agencies by name in the source is
 *  the mistake this project has already paid for repeatedly, and it is why
 *  `agencies.short_code` exists at all.
 *
 *  An agency absent from this map prints its name and no address, rather than
 *  someone else's: a wrong address on an invoice is worse than a missing one. */
const AGENCY_ADDRESSES: Record<string, string[]> = {
  FF: [
    'AQUAPHYLE / FUN&FLY',
    '2  Rue  Louise  WEISS',
    'Apt  61',
    '31200 TOULOUSE',
    'TVA  :  FR06834554339',
    'RCS: 834 554 339',
  ],
}

function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Amounts as the template shows them: a plain number, thin space for thousands,
 *  no currency symbol — the column header already says "TOTAL TTC (€)". */
function fmtAmount(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function printAgencyInvoice(doc: AgencyInvoiceDoc, shortCode: string | null): void {
  const known = shortCode ? AGENCY_ADDRESSES[shortCode] : undefined
  const addressLines: string[] = known ?? [doc.agencyName]

  const ref = doc.invoice.agency_ref?.trim()
  // The template prints the agency's own reference inside the DESIGNATION header.
  // Without it the header still makes sense, so a missing ref never blocks the
  // document — it is just not invented.
  const designation = ref
    ? `DESIGNATION  : ref F&Fly : ${escapeHtml(ref)}`
    : 'DESIGNATION'

  const rows = doc.lines.map(l => `
    <tr>
      <td style="padding:5px 8px;border-bottom:0.5pt solid #d1d5db;">${escapeHtml(l.label)}</td>
      <td style="padding:5px 8px;border-bottom:0.5pt solid #d1d5db;text-align:right;white-space:nowrap;">${fmtAmount(l.amount)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Facture ${escapeHtml(doc.invoice.invoice_number)} — ${escapeHtml(doc.agencyName)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
    * { box-sizing: border-box; }
    body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt; color: #1a1a1a; margin: 0; padding: 20px 30px; max-width: 210mm;
    }
    .toolbar {
      background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;
      padding: 10px 16px; margin-bottom: 24px; display: flex; align-items: center;
      gap: 10px; flex-wrap: wrap;
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
    p { margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>

  <div class="no-print toolbar">
    <span>🧾 Facture ${escapeHtml(doc.invoice.invoice_number)} — ${escapeHtml(doc.agencyName)}${
      doc.bookingNumber ? ` · réservation #${String(doc.bookingNumber).padStart(3, '0')}` : ''
    }${ref ? '' : ' · ⚠️ aucune référence agence saisie'}</span>
    <button class="btn-print" onclick="window.print()">🖨️ Imprimer / PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Fermer</button>
  </div>

  <!-- ── Issuer + logo ─────────────────────────────────────────────── -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:26px;">
    <div>
      <p style="font-weight:bold;font-size:10pt;margin-bottom:6px;">${ISSUER.name}</p>
      ${ISSUER.lines.map(l => `<p style="font-size:10pt;color:#333;">${l}</p>`).join('')}
      <p style="font-size:10pt;color:#555;">${ISSUER.city}</p>
      <p style="font-size:10pt;color:#555;">${ISSUER.country}</p>
    </div>
    <img src="${LOGO_URL}" alt="" style="width:170px;height:auto;" onerror="this.style.display='none'" />
  </div>

  <!-- ── Recipient ─────────────────────────────────────────────────── -->
  <div style="margin:0 0 26px auto;width:60%;text-align:left;">
    ${addressLines.map((l, i) => `<p style="font-size:10.5pt;${i === 0 ? 'font-weight:bold;' : 'color:#333;'}">${escapeHtml(l)}</p>`).join('')}
  </div>

  <!-- ── Invoice number + date ─────────────────────────────────────── -->
  <div style="display:flex;gap:30px;align-items:baseline;margin-bottom:4px;">
    <div>
      <p style="font-size:9pt;color:#666;margin:0;">INVOICE N°</p>
      <p style="font-size:13pt;font-weight:bold;margin:0;">${escapeHtml(doc.invoice.invoice_number)}</p>
    </div>
    <div>
      <p style="font-size:9pt;color:#666;margin:0;">DATE :</p>
      <p style="font-size:13pt;margin:0;">${fmtDateFr(doc.invoice.issued_on)}</p>
    </div>
  </div>

  <!-- ── Lines ─────────────────────────────────────────────────────── -->
  <table style="margin-top:14px;">
    <thead>
      <tr style="border-bottom:1.5pt solid ${BLUE};">
        <th style="text-align:left;padding:6px 8px;font-size:10pt;color:${BLUE};">${designation}</th>
        <th style="text-align:right;padding:6px 8px;font-size:10pt;color:${BLUE};white-space:nowrap;">TOTAL TTC (€)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- ── Totals + bank details ─────────────────────────────────────── -->
  <div style="display:flex;justify-content:space-between;gap:40px;margin-top:26px;">
    <div>
      <p style="font-weight:bold;font-size:10pt;margin-bottom:6px;">Coordonnées bancaires</p>
      <p style="font-size:10pt;"><span style="display:inline-block;width:52px;color:#666;">IBAN</span>${BANK.iban}</p>
      <p style="font-size:10pt;"><span style="display:inline-block;width:52px;color:#666;">SWIFT</span>${BANK.swift}</p>
    </div>
    <div style="min-width:250px;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;">
        <span style="color:#333;">TOTAL TTC</span>
        <strong>${fmtAmount(doc.gross)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;color:#555;">
        <span>dont commission ${fmtAmount(doc.commissionPercent)}%</span>
        <span>${fmtAmount(doc.commission)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1pt solid #333;font-size:12pt;">
        <strong>Total à payer</strong>
        <strong>${fmtAmount(doc.net)}</strong>
      </div>
    </div>
  </div>

  <script>
    // Wait for the logo before printing, or the first page comes out without it.
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
  if (!win) { alert('Autorisez les pop-ups pour générer la facture.'); return }
  win.document.write(html)
  win.document.close()
}
