import { useState } from 'react'
import { useTable } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { todayISO, addDaysISO } from '../../utils/dates'
import type { SharedLink } from '../../types/database'

interface Props {
  bookingNumber: number
  clientName: string
}

/** The client's public account page for one booking (shared link type `client`).
 *  No link yet → a button creates it; once it exists the same spot shows the URL
 *  with Open / Copy. Same token shape and 365-day expiry as DocumentsPage and
 *  Options → Shared Links, which find the link back by params.booking_number. */
export default function ClientShareLink({ bookingNumber, clientName }: Props) {
  const { data: links, refresh } = useTable<SharedLink>('shared_links')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const link = links.find(l => l.type === 'client' && parseInt(l.params?.booking_number ?? '') === bookingNumber)
  const url = link ? `${window.location.origin}/?share=${link.token}` : ''

  async function create() {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.from('shared_links').insert([{
      token: `client_${crypto.randomUUID()}`,
      type: 'client' as const,
      label: `Client Account – ${clientName || `#${bookingNumber}`}`,
      params: { booking_number: String(bookingNumber) },
      created_at: todayISO(),
      expires_at: addDaysISO(todayISO(), 365),
      is_active: true,
    }])
    setBusy(false)
    if (error) { alert(`Failed to create link: ${error.message}`); return }
    refresh()
  }

  async function reactivate() {
    if (!link || busy) return
    setBusy(true)
    const { error } = await supabase.from('shared_links').update({ is_active: true }).eq('id', link.id)
    setBusy(false)
    if (error) { alert(`Failed to reactivate link: ${error.message}`); return }
    refresh()
  }

  function copy() {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btn = 'text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap'

  if (!link) {
    return (
      <button type="button" onClick={create} disabled={busy} className={btn}
        title="Create the client's personal page (what they owe, their stay). Once created, this button becomes the link.">
        🔗 Create client link
      </button>
    )
  }

  if (!link.is_active) {
    return (
      <button type="button" onClick={reactivate} disabled={busy}
        className="text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 whitespace-nowrap"
        title="The client link is deactivated">
        ⚠ Reactivate client link
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">🔗 Client link</span>
      <input readOnly value={url} onClick={e => (e.target as HTMLInputElement).select()}
        className="min-w-0 flex-1 text-xs font-mono px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300" />
      <a href={url} target="_blank" rel="noopener noreferrer" className={btn} title="Open the client page">Open</a>
      <button type="button" onClick={copy} className={btn}>{copied ? '✓ Copied' : 'Copy'}</button>
    </div>
  )
}
