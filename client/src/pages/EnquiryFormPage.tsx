import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { EnquirySource, Lang } from '../types/database'
import { etr, resolveLang } from '../data/enquiryI18n'
import { LANGS } from '../data/formI18n'

/** The light enquiry form — first contact, embedded in an iframe on the website.
 *
 *  Four fields and a send button, visible straight away: that is what makes it
 *  convert, and it is why the party size and the dates are not asked here. They
 *  live in the free paragraph, and gui pulls them out while reading (see the
 *  qualification screen). Design: .claude/docs/ENQUIRIES.md
 *
 *  Everything here runs as anon. The database only grants INSERT on seven
 *  columns of `enquiries`, and never SELECT — so this page can post and can
 *  never read anyone's enquiry back. */

/** Tells the parent page how tall we are and when a message went out.
 *
 *  Without the first one the iframe keeps a fixed height and grows its own
 *  scrollbar — the detail that gives an embed away at a glance. Without the
 *  second, the site's analytics never see a conversion, since the URL of the
 *  parent page never changes. */
function useIframeBridge(onHeight: () => number) {
  useEffect(() => {
    if (window.parent === window) return   // opened directly, nothing to talk to
    const post = () => window.parent.postMessage({ type: 'bkc:height', height: onHeight() }, '*')
    post()
    const ro = new ResizeObserver(post)
    ro.observe(document.body)
    return () => ro.disconnect()
  }, [onHeight])
}

export function notifyParentSubmitted() {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'bkc:enquiry-sent' }, '*')
  }
}

export default function EnquiryFormPage() {
  const [lang, setLang] = useState<Lang>(() => resolveLang(window.location.search, navigator.language))
  const [sources, setSources] = useState<EnquirySource[]>([])

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sourceId, setSourceId] = useState('')       // '' = not chosen, 'other' = the free line
  const [sourceOther, setSourceOther] = useState('')
  const [message, setMessage] = useState('')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Anti-spam, same pair as the booking form: a field humans never see, and a
  // minimum delay. Both fail into the success screen — a bot learns nothing.
  const [honeypot, setHoneypot] = useState('')
  const mountedAt = useRef(Date.now())

  useIframeBridge(useMemo(() => () => document.body.scrollHeight, []))

  useEffect(() => {
    supabase.from('enquiry_sources').select('id, label, sort_order, is_active').order('sort_order')
      .then(({ data }) => setSources((data ?? []) as EnquirySource[]))
    // A failure here is not worth an error screen: the list is a convenience,
    // and "Other" plus the free line still carry the answer.
  }, [])

  function reset() {
    setEmail(''); setName(''); setSourceId(''); setSourceOther(''); setMessage(''); setError(null)
  }

  async function send() {
    if (!name.trim()) { setError(etr.err_name[lang]); return }
    if (honeypot.trim() || Date.now() - mountedAt.current < 3000) { setDone(true); return }

    setSending(true)
    const { error: insErr } = await supabase.from('enquiries').insert([{
      name: name.trim(),
      email: email.trim() || null,
      language: lang,
      message: message.trim() || null,
      source_id: sourceId && sourceId !== 'other' ? sourceId : null,
      source_other: sourceOther.trim() || null,
    }])
    setSending(false)
    if (insErr) { setError(etr.err_send[lang]); return }
    setDone(true)
    notifyParentSubmitted()
  }

  const field = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-400'
  const label = 'block text-sm font-medium text-gray-700 mb-1'

  if (done) {
    return (
      <div className="min-h-[24rem] flex items-center justify-center p-6 bg-white">
        <div className="text-center space-y-2 max-w-sm">
          <div className="text-5xl">🌊</div>
          <h2 className="text-xl font-bold text-gray-800">{etr.ok_title[lang]}</h2>
          <p className="text-gray-600 text-sm">{etr.ok_body[lang]}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-5 sm:p-6">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{etr.title[lang]}</h1>
            <p className="text-sm text-gray-500">{etr.intro[lang]}</p>
          </div>
          {/* The escape hatch for the visitor the site and the browser both got
              wrong — three small flags, no menu. */}
          <div className="flex gap-1 shrink-0">
            {LANGS.map(l => (
              <button key={l.code} type="button" onClick={() => setLang(l.code)} title={l.label}
                className={`text-lg leading-none px-1 rounded ${lang === l.code ? '' : 'opacity-40 hover:opacity-80'}`}>
                {l.flag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>{etr.f_email[lang]}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={field} />
        </div>

        <div>
          <label className={label}>{etr.f_name[lang]} *</label>
          <input value={name} onChange={e => setName(e.target.value)} className={field} />
        </div>

        <div>
          <label className={label}>{etr.f_source[lang]}</label>
          <select value={sourceId} onChange={e => setSourceId(e.target.value)} className={field}>
            <option value="">{etr.opt_choose[lang]}</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>{s.label?.[lang] || s.label?.en || ''}</option>
            ))}
            {/* Always last, never removable: without it, someone who came through
                a friend is pushed into a box that doesn't fit, and the statistic
                looks clean while being wrong. */}
            <option value="other">{etr.opt_other[lang]}</option>
          </select>
          {sourceId === 'other' && (
            <input value={sourceOther} onChange={e => setSourceOther(e.target.value)}
              placeholder={etr.f_other[lang]} className={`${field} mt-2`} />
          )}
        </div>

        <div>
          <label className={label}>{etr.f_message[lang]}</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
            placeholder={etr.ph_message[lang]} className={field} />
        </div>

        {/* Honeypot — off-screen, never announced to screen readers */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={honeypot} onChange={e => setHoneypot(e.target.value)}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={send} disabled={sending}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm">
            {sending ? etr.sending[lang] : etr.send[lang]}
          </button>
          <button onClick={reset} type="button"
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm">
            {etr.clear[lang]}
          </button>
        </div>
      </div>
    </div>
  )
}
