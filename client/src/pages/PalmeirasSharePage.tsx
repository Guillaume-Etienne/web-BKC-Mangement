// Read-only page for the Palmeiras, opened through a 'palmeiras' share link:
// the account between us (bungalows, commission, rent, card terminal,
// payments) and the balance. Everything comes from one RPC,
// palmeiras_statement() (2026-10-30b), which returns only what this page shows:
// the palmeiras_* tables, bookings and prices stay closed to anon. For a
// bungalow BKC collected, it gives the cost owed to them, never our price.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildStatement, type StatementInput } from '../utils/palmeirasStatement'
import PalmeirasStatementView from '../components/palmeiras/PalmeirasStatementView'

export default function PalmeirasSharePage() {
  const [input,   setInput]   = useState<StatementInput | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('palmeiras_statement').then(({ data, error }) => {
      if (error) console.error('PalmeirasSharePage:', error.message)
      setInput((data ?? null) as StatementInput | null)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Loading…</p>
    </div>
  }
  if (!input) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 text-center">
      <p className="text-gray-500 dark:text-gray-400">This page could not be loaded. Please reload it, or ask BKC for a new link.</p>
    </div>
  }

  const statement = buildStatement(input)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl text-white px-5 sm:px-6 py-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-teal-100 text-sm font-medium uppercase tracking-wide mb-1">Bilene Kite Center · Palmeiras</p>
            <h1 className="text-2xl font-bold">Account between us</h1>
            <p className="text-sm text-teal-100 mt-1">Bungalows, commission, rent and payments, month by month.</p>
          </div>
          <button onClick={() => window.print()}
            className="print:hidden px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium">
            🖨 Print
          </button>
        </div>
        <PalmeirasStatementView statement={statement} eurMznRate={input.eur_mzn_rate} />
      </div>
    </div>
  )
}
