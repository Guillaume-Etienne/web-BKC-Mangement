import { useMemo, useState } from 'react'
import { useTable } from '../hooks/useSupabase'
import type { Enquiry, FormSubmission } from '../types/database'
import EnquiriesPage from './EnquiriesPage'
import SubmissionsPage from './SubmissionsPage'
import { isQualified, isSettled } from '../utils/enquiries'

/** Everything that arrives from outside and waits to be dealt with.
 *
 *  One nav entry, two tabs. gui's call (2026-08-15), and better than the merge
 *  I had originally recommended: folding the two screens into one would have
 *  put a forty-field dossier — passports, waiver, visa dates — inside a panel
 *  built to be cleared in twenty seconds. This keeps the single entry point,
 *  which was the actual problem, and leaves each object the screen it needs.
 *
 *  Both badges mean "something new arrived", never "there is work left": a
 *  badge that never reaches zero stops being read. The chasing lives in the
 *  Home pending actions and in the table's own "To chase" chip. */

type Tab = 'enquiries' | 'forms'

export default function RequestsPage() {
  const [tab, setTab] = useState<Tab>('enquiries')
  const { data: enquiries } = useTable<Enquiry>('enquiries')
  const { data: submissions } = useTable<FormSubmission>('form_submissions')

  const newEnquiries = useMemo(
    () => enquiries.filter(e => !isSettled(e.status) && !isQualified(e)).length,
    [enquiries])
  const newForms = useMemo(
    () => submissions.filter(s => s.status === 'pending').length,
    [submissions])

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: 'enquiries', label: 'Enquiries', icon: '📣', count: newEnquiries },
    { key: 'forms', label: 'Booking forms', icon: '📝', count: newForms },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 pt-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200">Requests</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Everything that came in from outside — a first message, or a full booking form.
        </p>

        <div className="flex gap-1 md:gap-2 mt-6 border-b border-gray-200 dark:border-gray-800">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`relative shrink-0 px-3 py-2 md:px-4 text-sm md:text-base font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
              <span className="mr-1">{t.icon}</span>{t.label}
              {t.count > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-white text-xs font-bold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Each page keeps its own header and layout — they are different jobs,
          and squeezing them into a shared chrome would have been the merge we
          decided against. */}
      <div className="-mt-4">
        {tab === 'enquiries' ? <EnquiriesPage /> : <SubmissionsPage />}
      </div>
    </div>
  )
}
