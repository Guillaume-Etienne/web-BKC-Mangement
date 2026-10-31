import { useMemo, useRef, useState } from 'react'
import type { StatementInput } from '../../utils/palmeirasStatement'
import { EXPORT_FORMATS, EXPORT_LANGS, buildExportDocument, fmtMonthLabel, type ExportFormatId, type ExportLang } from '../../utils/palmeirasExports'
import { thisMonthISO } from '../../utils/dates'

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Printable sheets for the Palmeiras, in the layouts they work with. The
 *  preview IS the printed page (an iframe), so what gui sees is what leaves. */
export default function PalmeirasExports({ input }: { input: StatementInput }) {
  const [formatId, setFormatId] = useState<ExportFormatId>('grid')
  const [month, setMonth] = useState(thisMonthISO())
  const [showAmounts, setShowAmounts] = useState(false)
  // The sheet's language is the reader's, not the screen's: Portuguese first.
  const [lang, setLang] = useState<ExportLang>('pt')
  const frame = useRef<HTMLIFrameElement>(null)

  const format = EXPORT_FORMATS.find(f => f.id === formatId) ?? EXPORT_FORMATS[0]
  const html = useMemo(() => buildExportDocument(formatId, input, month, { showAmounts, lang }), [formatId, input, month, showAmounts, lang])
  const landscape = format.orientation === 'landscape'

  const navBtn = 'w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-lg'

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Sheets built from the same data as the shared statement: they never show our selling price. Pick a layout, then print it to PDF.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {EXPORT_FORMATS.map(f => (
          <button key={f.id} onClick={() => setFormatId(f.id)}
            className={`text-left rounded-xl border p-3 transition-colors ${formatId === f.id
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">{f.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.description}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(m => shiftMonth(m, -1))} className={navBtn} aria-label="Previous month">‹</button>
          <span className="px-4 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[150px] text-center">
            {fmtMonthLabel(month, lang)}
          </span>
          <button onClick={() => setMonth(m => shiftMonth(m, +1))} className={navBtn} aria-label="Next month">›</button>
        </div>
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1" role="group" aria-label="Sheet language">
          {EXPORT_LANGS.map(l => (
            <button key={l.id} onClick={() => setLang(l.id)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${lang === l.id
                ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {l.label}
            </button>
          ))}
        </div>
        {format.id !== 'grid' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={showAmounts} onChange={e => setShowAmounts(e.target.checked)} />
            Show what each stay means between us
          </label>
        )}
        <button onClick={() => frame.current?.contentWindow?.print()}
          className="ml-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold">
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* A4 proportions; the sheet scrolls inside rather than stretching the page */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-3 overflow-x-auto">
        <iframe ref={frame} title="Palmeiras export preview" srcDoc={html}
          className="bg-white shadow mx-auto block border-0"
          style={{ width: landscape ? 1123 : 794, height: landscape ? 560 : 1000, maxWidth: 'none' }} />
      </div>
    </div>
  )
}
