import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Enquiry, EnquiryNote } from '../../types/database'
import { fmtArrivalMonth } from '../../utils/enquiries'

/** Where this booking came from — the conversation, read back on the booking.
 *
 *  A won enquiry leaves the working list at once (gui, 2026-08-14) and nothing
 *  ever read `enquiries.booking_id` in the other direction, so everything said
 *  before the booking existed became unreachable the moment it converted. The
 *  link was already in the database; this only reads it.
 *
 *  Read-only on purpose. The notes stay on the enquiry rather than being copied
 *  onto the booking: two copies of the same sentence is how they start to
 *  disagree. A single place to write, later, is a separate job. */

interface Props { enquiry: Enquiry }

export default function EnquiryOriginPanel({ enquiry }: Props) {
  const [notes, setNotes] = useState<EnquiryNote[] | null>(null)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.from('enquiry_notes').select('*').eq('enquiry_id', enquiry.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        // Said out loud: an empty history that is actually a failed read would
        // read as "I never wrote anything down", which is the exact confusion
        // this panel exists to remove.
        if (error) { setNotesError(error.message); setNotes([]); return }
        setNotes(data ?? [])
      })
    return () => { cancelled = true }
  }, [enquiry.id])

  const wants = [
    enquiry.wants_lessons && 'lessons',
    enquiry.wants_rental && 'rental',
    enquiry.wants_accommodation && 'accommodation',
  ].filter(Boolean).join(' · ')

  const facts = [
    enquiry.party_size ? `${enquiry.party_size} people` : null,
    enquiry.arrival_month ? fmtArrivalMonth(enquiry.arrival_month) : null,
    wants || null,
    enquiry.budget_eur ? `€${enquiry.budget_eur} budget` : null,
  ].filter(Boolean).join(' · ')

  const noteCount = notes?.length ?? 0

  return (
    <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 p-3 space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-2 text-left">
        <span className="text-sm text-violet-900 dark:text-violet-300">
          <span className="font-semibold">📣 From the enquiry of {enquiry.name}</span>
          {facts && <span className="block text-xs text-violet-700 dark:text-violet-400 mt-0.5">{facts}</span>}
          <span className="block text-xs text-violet-600 dark:text-violet-500 mt-0.5">
            {enquiry.channel === 'form' ? 'Public form' : 'Added by hand'}
            {notes === null ? ' · loading notes…' : ` · ${noteCount} note${noteCount === 1 ? '' : 's'}`}
          </span>
        </span>
        <span className="text-violet-500 dark:text-violet-400 text-xs shrink-0 mt-0.5">{open ? '▲ hide' : '▼ read'}</span>
      </button>

      {open && (
        <div className="space-y-2 pt-1 border-t border-violet-200 dark:border-violet-900">
          {enquiry.message && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-violet-600 dark:text-violet-500 mt-2 mb-1">What they wrote</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{enquiry.message}</p>
            </div>
          )}
          {notesError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">The notes could not be loaded: {notesError}</p>
          )}
          {noteCount > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-violet-600 dark:text-violet-500 mt-2 mb-1">Notes</p>
              <ul className="space-y-1.5">
                {notes!.map(n => (
                  <li key={n.id} className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                    <span className="whitespace-pre-wrap">{n.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!enquiry.message && noteCount === 0 && !notesError && (
            <p className="text-xs text-violet-700 dark:text-violet-400 pt-2">
              Nothing was written down on this enquiry beyond the fields above.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
