import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Enquiry, EnquiryNote, EnquirySource, EnquiryStatus } from '../../types/database'
import { STATUS_META, STATUS_ORDER, fmtArrivalMonth } from '../../utils/enquiries'
import MonthInput from '../common/MonthInput'
import { todayISO, addDaysISO } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import type { Lang } from '../../types/database'

/** Read the message, fill four fields, close. Twenty seconds.
 *
 *  This is the screen the whole pipeline hangs on. The public form only asks
 *  for a name, an email, a source and a free paragraph — so the party size, the
 *  dates and what they want are in the prose or nowhere. If qualifying meant
 *  opening a record, hunting for an Edit button and scrolling, it would not get
 *  done and the table would stay empty.
 *
 *  Same screen creates one by hand (WhatsApp, Instagram): no message, one
 *  required field. */

interface Props {
  enquiry: Enquiry | null          // null = creating a new one
  sources: EnquirySource[]
  onSaved: () => void
  onClose: () => void
  onDeleted?: () => void
}

interface FormState {
  name: string; email: string; phone: string
  message: string
  source_id: string; source_other: string
  party_size: string; arrival_month: string; budget_eur: string
  wants_lessons: boolean; wants_rental: boolean; wants_accommodation: boolean
  status: EnquiryStatus; lost_reason: string
}

function toForm(e: Enquiry | null): FormState {
  return {
    name: e?.name ?? '', email: e?.email ?? '', phone: e?.phone ?? '',
    message: e?.message ?? '',
    source_id: e?.source_id ?? '', source_other: e?.source_other ?? '',
    party_size: e?.party_size != null ? String(e.party_size) : '',
    arrival_month: e?.arrival_month ?? '',
    budget_eur: e?.budget_eur != null ? String(e.budget_eur) : '',
    wants_lessons: e?.wants_lessons ?? false,
    wants_rental: e?.wants_rental ?? false,
    wants_accommodation: e?.wants_accommodation ?? false,
    status: e?.status ?? 'new',
    lost_reason: e?.lost_reason ?? '',
  }
}

const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

/** STATUS_META's pill/dot colours stay shared (EnquiriesPage, utils/enquiries.ts);
 *  only the label shown here is translated, kept local to this panel. */
function statusLabel(s: EnquiryStatus, lang: Lang): string {
  return {
    new:     i18n.enquiries.ep_status_new[lang],
    talking: i18n.enquiries.ep_status_talking[lang],
    waiting: i18n.enquiries.ep_status_waiting[lang],
    won:     i18n.enquiries.ep_status_won[lang],
    lost:    i18n.enquiries.ep_status_lost[lang],
  }[s]
}

export default function EnquiryPanel({ enquiry, sources, onSaved, onClose, onDeleted }: Props) {
  const { lang } = useLanguage()
  const [form, setForm] = useState<FormState>(() => toForm(enquiry))
  const [notes, setNotes] = useState<EnquiryNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [formLink, setFormLink] = useState<{ token: string } | null>(null)
  const [refreshed, setRefreshed] = useState(false)

  const isNew = !enquiry
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  // No effect syncing form to the `enquiry` prop: the parent already remounts
  // this component (key={current?.id ?? 'new'}) when switching to a different
  // enquiry, so useState's lazy initializer handles that. Reacting to prop
  // *reference* changes here was actively harmful — realtime refetches the
  // whole `enquiries` table on any change (including addNote()'s own touch of
  // last_contact_at), which hands down a new object for the SAME enquiry and
  // was silently wiping whatever gui had just typed but not yet saved.

  useEffect(() => {
    if (!enquiry) { setNotes([]); return }
    let cancelled = false
    supabase.from('enquiry_notes').select('*').eq('enquiry_id', enquiry.id).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        // A silent failure here would show an empty history and make gui think
        // he never wrote anything down.
        if (error) { alert(`Could not load the notes.\n\n${error.message}`); return }
        setNotes(data ?? [])
      })
    return () => { cancelled = true }
  }, [enquiry])

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const row = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      message: form.message.trim() || null,
      source_id: form.source_id || null,
      source_other: form.source_other.trim() || null,
      party_size: form.party_size.trim() === '' ? null : parseInt(form.party_size, 10),
      arrival_month: form.arrival_month || null,
      budget_eur: form.budget_eur.trim() === '' ? null : parseFloat(form.budget_eur),
      wants_lessons: form.wants_lessons,
      wants_rental: form.wants_rental,
      wants_accommodation: form.wants_accommodation,
      status: form.status,
      lost_reason: form.status === 'lost' ? (form.lost_reason.trim() || null) : null,
    }
    const { error } = isNew
      ? await supabase.from('enquiries').insert([{ ...row, channel: 'manual' }])
      : await supabase.from('enquiries').update(row).eq('id', enquiry.id)
    setSaving(false)
    if (error) { alert(`The enquiry was NOT saved.\n\n${error.message}`); return }
    onSaved()
  }

  async function addNote() {
    if (!enquiry || !newNote.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('enquiry_notes')
      .insert({ enquiry_id: enquiry.id, body: newNote.trim() }).select().single()
    if (error) { setSaving(false); alert(`The note was NOT saved.\n\n${error.message}`); return }
    // Writing a note IS the exchange, so it resets the silence counter. Done
    // here rather than by a database trigger: this project keeps its rules
    // visible in the code.
    const { error: touchErr } = await supabase.from('enquiries')
      .update({ last_contact_at: new Date().toISOString() }).eq('id', enquiry.id)
    setSaving(false)
    if (touchErr) alert(`Note saved, but the silence counter was not reset.\n\n${touchErr.message}`)
    setNotes(n => [data as EnquiryNote, ...n])
    setNewNote('')
    onSaved()
  }

  /** The link that already exists for this enquiry, if any. No column stores it:
   *  the `shared_links` row IS the record, which is one fewer thing to keep in
   *  step with reality. */
  useEffect(() => {
    if (!enquiry) { setFormLink(null); return }
    let cancelled = false
    supabase.from('shared_links').select('token, params').eq('type', 'booking_form')
      .then(({ data }) => {
        if (cancelled) return
        const hit = (data ?? []).find(l => (l.params as Record<string, string> | null)?.enquiry_id === enquiry.id)
        setFormLink(hit ? { token: hit.token as string } : null)
      })
    return () => { cancelled = true }
  }, [enquiry])

  function formUrl(token: string) {
    return `${window.location.origin}/?share=${token}`
  }

  function formLinkParams(e: Enquiry) {
    return {
      enquiry_id: e.id,
      name: e.name,
      email: e.email ?? '',
      phone: e.phone ?? '',
      language: e.language,
    }
  }

  async function createFormLink() {
    if (!enquiry) return
    setSaving(true)
    const token = `booking_form_${crypto.randomUUID()}`
    const { error } = await supabase.from('shared_links').insert({
      token, type: 'booking_form',
      label: `Booking form — ${enquiry.name}`,
      // Snapshotted at creation time, not looked up live — anon has no SELECT
      // on enquiries, and re-fetching would mean widening that boundary just
      // to pre-fill four fields. Use "Refresh" below if the enquiry changes.
      params: formLinkParams(enquiry),
      expires_at: addDaysISO(todayISO(), 365),
      is_active: true,
    })
    setSaving(false)
    if (error) { alert(`The link was NOT created.\n\n${error.message}`); return }
    setFormLink({ token })
  }

  // Same token (nothing already sent needs to change), fresh snapshot — for
  // links created before name/email/phone/language rode along, or after the
  // enquiry was edited since the link went out.
  async function refreshFormLink() {
    if (!enquiry || !formLink) return
    setSaving(true)
    const { error } = await supabase.from('shared_links').update({
      label: `Booking form — ${enquiry.name}`,
      params: formLinkParams(enquiry),
    }).eq('token', formLink.token)
    setSaving(false)
    if (error) { alert(`The link was NOT refreshed.\n\n${error.message}`); return }
    setRefreshed(true)
    setTimeout(() => setRefreshed(false), 2500)
  }

  async function remove() {
    if (!enquiry) return
    if (!confirm(`Delete the enquiry from ${enquiry.name}?\n\nIts notes go with it. Nothing else is touched.`)) return
    const { error } = await supabase.from('enquiries').delete().eq('id', enquiry.id)
    if (error) { alert(`Could not delete it.\n\n${error.message}`); return }
    onDeleted?.()
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {isNew ? i18n.enquiries.ep_new_enquiry[lang] : form.name || enquiry?.name}
          {!isNew && enquiry && (
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
              {enquiry.channel === 'form' ? i18n.enquiries.ep_from_website[lang] : i18n.enquiries.ep_added_by_hand[lang]}
            </span>
          )}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xl leading-none">✕</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Left: who, and what they wrote ─────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <label className={labelCls}>{i18n.enquiries.ep_label_name[lang]}</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{i18n.common.label_email[lang]}</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{i18n.common.label_phone[lang]}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>
              {enquiry?.channel === 'form' ? i18n.enquiries.ep_label_what_they_wrote[lang] : i18n.enquiries.ep_label_message_context[lang]}
            </label>
            <textarea value={form.message} onChange={e => set('message', e.target.value)} rows={7}
              placeholder={isNew ? i18n.enquiries.ep_placeholder_message[lang] : ''}
              className={`${inputCls} font-normal leading-relaxed`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{i18n.enquiries.ep_label_heard_via[lang]}</label>
              <select value={form.source_id} onChange={e => set('source_id', e.target.value)} className={inputCls}>
                <option value="">—</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.label?.en || i18n.enquiries.ep_unnamed[lang]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{i18n.enquiries.ep_label_or_words[lang]}</label>
              <input value={form.source_other} onChange={e => set('source_other', e.target.value)}
                placeholder={i18n.enquiries.ep_placeholder_source_other[lang]} className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── Right: the four fields that turn prose into a row ───────────── */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{i18n.enquiries.ep_label_how_many[lang]}</label>
              <input type="number" min="1" value={form.party_size}
                onChange={e => set('party_size', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{i18n.enquiries.ep_label_when[lang]}</label>
              {/* A month, never a day: "February" is what people say, and an
                  invented day reads like a commitment. */}
              <MonthInput value={form.arrival_month} allowEmpty
                onChange={v => set('arrival_month', v)} className="w-full" />
            </div>
          </div>

          <div>
            <label className={labelCls}>{i18n.enquiries.ep_label_interested_in[lang]}</label>
            <div className="flex flex-wrap gap-3 text-sm text-gray-700 dark:text-gray-300">
              {([
                ['wants_lessons', i18n.enquiries.ep_check_lessons[lang]],
                ['wants_rental', i18n.enquiries.ep_check_rental[lang]],
                ['wants_accommodation', i18n.enquiries.ep_check_accommodation[lang]],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>{i18n.enquiries.ep_label_budget[lang]}</label>
            <input type="number" min="0" value={form.budget_eur}
              onChange={e => set('budget_eur', e.target.value)} className={`${inputCls} sm:w-40`} />
          </div>

          <div>
            <label className={labelCls}>{i18n.common.label_status[lang]}</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map(s => (
                <button key={s} type="button" onClick={() => set('status', s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.status === s
                      ? `${STATUS_META[s].pill} border-transparent`
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}>
                  {statusLabel(s, lang)}
                </button>
              ))}
            </div>
          </div>

          {form.status === 'lost' && (
            <div>
              <label className={labelCls}>{i18n.enquiries.ep_label_lost_reason[lang]}</label>
              <input value={form.lost_reason} onChange={e => set('lost_reason', e.target.value)}
                placeholder={i18n.enquiries.ep_placeholder_lost_reason[lang]} className={inputCls} />
            </div>
          )}

          {form.status === 'won' && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {i18n.enquiries.ep_msg_won[lang]}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={save} disabled={!form.name.trim() || saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-semibold text-sm">
          {saving ? i18n.enquiries.ep_saving[lang] : isNew ? i18n.enquiries.ep_btn_create[lang] : i18n.common.btn_save[lang]}
        </button>
        <button onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium text-sm">
          {i18n.common.btn_cancel[lang]}
        </button>
        {!isNew && (
          <button onClick={remove}
            className="ml-auto px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded">
            {i18n.common.btn_delete[lang]}
          </button>
        )}
      </div>

      {/* Brevo, said out loud. A CRM push that failed in silence is a contact
          gui thinks he has and does not — worse than not syncing at all. */}
      {!isNew && enquiry?.channel === 'form' && enquiry.email && (
        <p className="text-xs">
          {enquiry.crm_error ? (
            <span className="text-red-600 dark:text-red-400">
              {i18n.enquiries.ep_brevo_error[lang].replace('{error}', enquiry.crm_error)}
            </span>
          ) : enquiry.crm_synced_at ? (
            <span className="text-gray-500 dark:text-gray-400">
              {i18n.enquiries.ep_brevo_synced[lang].replace('{date}', new Date(enquiry.crm_synced_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">{i18n.enquiries.ep_brevo_not_configured[lang]}</span>
          )}
        </p>
      )}

      {/* ── The bridge to a real booking ───────────────────────────────────── */}
      {!isNew && enquiry && (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{i18n.enquiries.ep_section_full_form[lang]}</h3>
          {formLink ? (
            <>
              <div className="flex gap-2">
                <input readOnly value={formUrl(formLink.token)} onFocus={e => e.currentTarget.select()}
                  className={`${inputCls} font-mono text-xs`} />
                <button type="button" onClick={() => navigator.clipboard?.writeText(formUrl(formLink.token))}
                  className="shrink-0 px-3 py-1.5 bg-gray-800 dark:bg-gray-700 text-white rounded text-sm font-medium">
                  {i18n.enquiries.ep_btn_copy[lang]}
                </button>
                <button type="button" onClick={refreshFormLink} disabled={saving}
                  title={i18n.enquiries.ep_refresh_tooltip[lang]}
                  className="shrink-0 px-3 py-1.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 rounded text-sm font-medium">
                  {refreshed ? '✅' : i18n.enquiries.ep_btn_refresh[lang]}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {enquiry.form_submission_id
                  ? i18n.enquiries.ep_form_filled[lang]
                  : i18n.enquiries.ep_form_not_filled[lang]}
              </p>
            </>
          ) : (
            <>
              <button type="button" onClick={createFormLink} disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-semibold text-sm">
                {i18n.enquiries.ep_btn_create_link[lang]}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {i18n.enquiries.ep_create_link_desc[lang]}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Notes: the thread ─────────────────────────────────────────────── */}
      {!isNew && (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{i18n.common.label_notes[lang]}</h3>
            {enquiry && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {i18n.enquiries.ep_last_exchange[lang].replace('{date}', new Date(enquiry.last_contact_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}
                {enquiry.arrival_month && i18n.enquiries.ep_arriving[lang].replace('{month}', fmtArrivalMonth(enquiry.arrival_month))}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input value={newNote} onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addNote() }}
              placeholder={i18n.enquiries.ep_note_placeholder[lang]} className={inputCls} />
            <button onClick={addNote} disabled={!newNote.trim() || saving}
              className="shrink-0 px-3 py-1.5 bg-gray-800 dark:bg-gray-700 disabled:opacity-40 text-white rounded text-sm font-medium">
              {i18n.common.btn_add[lang]}
            </button>
          </div>

          {notes.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">{i18n.enquiries.ep_no_notes[lang]}</p>
          ) : (
            <ul className="space-y-1.5">
              {notes.map(n => (
                <li key={n.id} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 w-16 pt-0.5">
                    {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="flex-1">{n.body}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
