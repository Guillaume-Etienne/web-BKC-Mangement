import type { Booking } from '../types/database'
import type { TravelGuideSection } from '../data/travelGuide'
import type { Lang } from './printBookingSummary'

const LOGO_URL = `${window.location.origin}/docs/logo-mas.png`
const BLUE     = '#4472C4'
const TEAL     = '#0f766e'

type GuideKind = 'travel' | 'welcome'

const TITLES: Record<GuideKind, Record<Lang, string>> = {
  travel: {
    fr: 'Guide du Voyageur',
    en: "Traveller's Guide",
    es: 'Guía del Viajero',
  },
  welcome: {
    fr: "Guide d'Accueil",
    en: 'Welcome Guide',
    es: 'Guía de Bienvenida',
  },
}

const INTROS: Record<GuideKind, Record<Lang, string>> = {
  travel: {
    fr: 'Voici quelques informations utiles pour préparer votre séjour.',
    en: 'Here is some useful information to help you prepare for your stay.',
    es: 'Aquí encontrará información útil para preparar su estancia.',
  },
  welcome: {
    fr: 'Bienvenue à Bilene ! Voici tout ce qu\'il faut savoir sur la vie au centre.',
    en: 'Welcome to Bilene! Here is everything you need to know about life at the center.',
    es: '¡Bienvenido a Bilene! Aquí encontrará todo lo que necesita saber sobre la vida en el centro.',
  },
}

export function printTravelGuide(
  booking: Booking | null,
  lang: Lang,
  sections: TravelGuideSection[]
): void {
  printGuideDoc('travel', booking, lang, sections)
}

export function printWelcomeGuide(
  booking: Booking | null,
  lang: Lang,
  sections: TravelGuideSection[]
): void {
  printGuideDoc('welcome', booking, lang, sections)
}

function printGuideDoc(
  kind: GuideKind,
  booking: Booking | null,
  lang: Lang,
  sections: TravelGuideSection[]
): void {
  const title    = TITLES[kind][lang]
  const intro    = INTROS[kind][lang]
  const client   = booking?.client
  const subtitle = client
    ? `${client.first_name} ${client.last_name} — Booking #${String(booking!.booking_number).padStart(3, '0')}`
    : 'Preview'

  const sectionsHtml = sections.map(sec => `
    <div style="margin-bottom:22px;page-break-inside:avoid;">
      <div style="font-weight:bold;color:${TEAL};font-size:12pt;margin-bottom:5px;border-bottom:1pt solid #d1fae5;padding-bottom:3px;">
        ${sec.title[lang]}
      </div>
      <div style="font-size:10.5pt;color:#374151;line-height:1.75;">
        ${sec.content[lang]}
      </div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
    * { box-sizing: border-box; }
    body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 20px 30px; max-width: 210mm; }
    .toolbar { background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
    .toolbar span { font-size:10pt;color:#0369a1;flex:1; }
    .btn-print { background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:10pt;cursor:pointer;font-weight:bold; }
    .btn-close  { background:#e5e7eb;color:#374151;border:none;border-radius:6px;padding:8px 14px;font-size:10pt;cursor:pointer; }
  </style>
</head>
<body>

  <div class="no-print toolbar">
    <span>${title} — ${subtitle}</span>
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="btn-close"  onclick="window.close()">✕ Close</button>
  </div>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2.5pt solid ${BLUE};margin-bottom:20px;">
    <div>
      <div style="font-size:18pt;font-weight:bold;color:${BLUE};margin-bottom:3px;">${title}</div>
      <div style="font-size:10pt;color:#6b7280;">${subtitle}</div>
    </div>
    <img src="${LOGO_URL}" alt="BKC" style="height:55px;width:auto;" onerror="this.style.display='none'" />
  </div>

  <!-- Intro -->
  <p style="font-size:10.5pt;color:#6b7280;margin:0 0 22px;font-style:italic;">${intro}</p>

  <!-- Sections -->
  ${sectionsHtml}

  <!-- Footer -->
  <div style="margin-top:30px;padding-top:8px;border-top:0.5pt solid #e5e7eb;font-size:8.5pt;color:#9ca3af;font-style:italic;text-align:center;">
    Bilene Kite Center — contact@bilenekite.com
  </div>

  <script>
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
