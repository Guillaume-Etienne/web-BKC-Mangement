import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { tr, LANGS, detectLang } from '../data/formI18n'
import { waiverText, WAIVER_VERSION } from '../data/waiver'
import type { Lang, FormTraveler, BookingFormPayload, EnquirySource, KiteLevel } from '../types/database'
import type { FormI18nKey } from '../data/formI18n'
import { referralLabel } from '../utils/referral'
import { missingOnStep, EMPTY_FORM } from '../utils/bookingFormCompleteness'
import type { FormData, MissingAnswer } from '../utils/bookingFormCompleteness'

// ─── Public booking intake form (no auth) ─────────────────────────────────────
// Reached via ?share=<token> on a shared_link of type 'booking_form'.
// Writes a 'pending' row into form_submissions; an admin reviews it later.

const STEPS: { icon: string; labelKey: 'step_group' | 'step_trip' | 'step_logistics' | 'step_crew' | 'step_finish' }[] = [
  { icon: '👤', labelKey: 'step_group' },
  { icon: '✈️', labelKey: 'step_trip' },
  { icon: '🧳', labelKey: 'step_logistics' },
  { icon: '🪂', labelKey: 'step_crew' },
  { icon: '🧾', labelKey: 'step_finish' },
]
const TOTAL = STEPS.length

// ─── Kite level options ────────────────────────────────────────────────────────
const KITE_LEVELS: { value: KiteLevel; labelKey: FormI18nKey }[] = [
  { value: 'beg-total',      labelKey: 'kite_lvl_beg_total' },
  { value: 'beg-bodydrag',   labelKey: 'kite_lvl_bodydrag' },
  { value: 'beg-waterstart', labelKey: 'kite_lvl_waterstart' },
  { value: 'intermediate',   labelKey: 'kite_lvl_intermediate' },
  { value: 'advanced',       labelKey: 'kite_lvl_advanced' },
]

// ─── Reusable controls (module scope = focus-safe) ────────────────────────────
const inputCls = 'w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:border-sky-600 transition'

function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}{required && <span className="text-rose-500 dark:text-rose-400"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Counter({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-800 font-bold text-xl leading-none flex items-center justify-center transition">−</button>
      <span className="w-10 text-center text-lg font-semibold text-gray-800 dark:text-gray-200">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-800 font-bold text-xl leading-none flex items-center justify-center transition">+</button>
    </div>
  )
}

function YesNo({ value, onChange, lang }: { value: boolean; onChange: (v: boolean) => void; lang: Lang }) {
  const base = 'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition'
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)}
        className={`${base} ${value ? 'bg-sky-600 text-white border-sky-600 dark:border-sky-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-sky-300 dark:hover:border-sky-800'}`}>
        {tr.yes[lang]}
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={`${base} ${!value ? 'bg-sky-600 text-white border-sky-600 dark:border-sky-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-sky-300 dark:hover:border-sky-800'}`}>
        {tr.no[lang]}
      </button>
    </div>
  )
}

interface TravelerCardProps {
  index: number
  t: FormTraveler
  lang: Lang
  canRemove: boolean
  onChange: (patch: Partial<FormTraveler>) => void
  onRemove: () => void
}
function TravelerCard({ index, t, lang, canRemove, onChange, onRemove }: TravelerCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-3 bg-white dark:bg-gray-900/70">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-sky-700 dark:text-sky-400">🏄 {tr.traveler[lang]} {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-gray-400 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition">
            {tr.remove[lang]}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={tr.f_first_name[lang]} required>
          <input className={inputCls} value={t.first_name} onChange={e => onChange({ first_name: e.target.value })} />
        </Field>
        <Field label={tr.f_last_name[lang]} required>
          <input className={inputCls} value={t.last_name} onChange={e => onChange({ last_name: e.target.value })} />
        </Field>
      </div>
      <Field label={tr.f_passport[lang]}>
        <input className={inputCls} value={t.passport_number} onChange={e => onChange({ passport_number: e.target.value })} />
      </Field>

      {/* Kite activity */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
        <p className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wide">{tr.kite_section[lang]}</p>
        <Field label={tr.kite_does_kite[lang]}>
          <YesNo value={t.does_kite ?? false} onChange={v => onChange({ does_kite: v })} lang={lang} />
        </Field>
        {t.does_kite && (
          <>
            <Field label={tr.kite_level_label[lang]}>
              <div className="grid grid-cols-1 gap-1.5">
                {KITE_LEVELS.map(lv => (
                  <button key={lv.value} type="button"
                    onClick={() => onChange({ kite_level: lv.value })}
                    className={`px-3 py-2 rounded-lg text-sm text-left border-2 transition
                      ${t.kite_level === lv.value
                        ? 'bg-sky-600 text-white border-sky-600 dark:border-sky-500'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-sky-300 dark:hover:border-sky-800'}`}>
                    {tr[lv.labelKey][lang]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={tr.kite_brings_gear[lang]}>
              <YesNo value={t.brings_own_gear ?? false} onChange={v => onChange({ brings_own_gear: v })} lang={lang} />
            </Field>
            {t.brings_own_gear && (
              <Field label={tr.kite_needs_storage[lang]}>
                <YesNo value={t.needs_storage ?? false} onChange={v => onChange({ needs_storage: v })} lang={lang} />
              </Field>
            )}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr.kite_interests[lang]}</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={t.wants_kite_lessons ?? false}
                    onChange={e => onChange({ wants_kite_lessons: e.target.checked })}
                    className="w-4 h-4 accent-sky-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{tr.kite_lessons[lang]}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={t.wants_kite_rental ?? false}
                    onChange={e => onChange({ wants_kite_rental: e.target.checked })}
                    className="w-4 h-4 accent-sky-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{tr.kite_rental[lang]}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={t.wants_wing_lessons ?? false}
                    onChange={e => onChange({ wants_wing_lessons: e.target.checked })}
                    className="w-4 h-4 accent-sky-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{tr.wing_lessons[lang]}</span>
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
/** `enquiryId` and the prefill fields are carried by the personalised link gui
 *  sends from an enquiry — a snapshot taken when the link was created (see
 *  EnquiryPanel.createFormLink), not a live lookup: anon has no SELECT on
 *  enquiries. `enquiryId` itself still rides along in the payload so the
 *  submission comes back attached, instead of being matched afterwards on a
 *  name and an email that may both have changed. All absent when someone
 *  finds the form on their own.
 *
 *  `targetBookingId` is the same idea for a link generated from an EXISTING
 *  booking instead of an enquiry (Documents → Overview → Update Form) —
 *  mutually exclusive with `enquiryId`. Review then updates that booking
 *  instead of creating a new one. */
interface BookingFormPageProps {
  enquiryId?: string
  targetBookingId?: string
  prefillName?: string
  prefillEmail?: string
  prefillPhone?: string
  prefillLang?: string
}

function isLang(v: string | undefined): v is Lang {
  return v === 'fr' || v === 'en' || v === 'es'
}

export default function BookingFormPage({ enquiryId, targetBookingId, prefillName, prefillEmail, prefillPhone, prefillLang }: BookingFormPageProps = {}) {
  const [lang, setLang] = useState<Lang>(() => isLang(prefillLang) ? prefillLang : detectLang())
  const [step, setStep] = useState(1)
  const [maxReached, setMaxReached] = useState(1)
  const [d, setD] = useState<FormData>(() => ({
    ...EMPTY_FORM,
    reference_name: prefillName || '',
    email: prefillEmail || '',
    phone: prefillPhone || '',
  }))
  const [travelers, setTravelers] = useState<FormTraveler[]>([{ first_name: '', last_name: '', passport_number: '' }])
  const [showWaiver, setShowWaiver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  // The reason, not just "it failed": the visitor reads it out to gui over the
  // phone, which is the only debugging channel a guest on a shared link has.
  const [error, setError] = useState<string | null>(null)
  // Turned on when a nav button is pressed on an unfinished step, so the list of
  // what is missing gets the eye — and gets scrolled to, on a phone.
  const [showMissing, setShowMissing] = useState(false)
  const missingRef = useRef<HTMLDivElement | null>(null)
  // Anti-spam: honeypot (hidden field humans never see) + page-load timestamp
  const [honeypot, setHoneypot] = useState('')
  const mountedAt = useRef(Date.now())

  // "How did you hear about us?" — the same list gui edits in Options → Sources,
  // read through the share token like the enquiry form does. Never asked when
  // the visitor arrived from an enquiry (the answer is already on it).
  const [sources, setSources] = useState<EnquirySource[]>([])
  useEffect(() => {
    if (enquiryId) return
    supabase.from('enquiry_sources').select('id, label, sort_order, is_active').order('sort_order')
      .then(({ data }) => setSources((data ?? []) as EnquirySource[]))
    // A failure here is not worth an error screen: "Other" plus the free line
    // still carry the answer, same call as on the enquiry form.
  }, [enquiryId])

  function update(patch: Partial<FormData>) { setD(prev => ({ ...prev, ...patch })) }

  // Toggling a transfer ON pre-fills its pickup date/time from the matching flight
  // (only if still empty); turning it off clears the pickup fields.
  function toggleArrivalTransfer(v: boolean) {
    setD(prev => ({
      ...prev,
      taxi_arrival: v,
      transfer_to_bilene_date: v ? (prev.transfer_to_bilene_date || prev.country_entry_date) : '',
      transfer_to_bilene_time: v ? (prev.transfer_to_bilene_time || prev.arrival_time) : '',
    }))
  }
  function toggleDepartureTransfer(v: boolean) {
    setD(prev => ({
      ...prev,
      taxi_departure: v,
      transfer_to_airport_date: v ? (prev.transfer_to_airport_date || prev.country_exit_date) : '',
      transfer_to_airport_time: v ? (prev.transfer_to_airport_time || prev.departure_time) : '',
    }))
  }

  // When reaching the crew step, pre-fill traveler #1 from the reference name
  // (split on first space) so only the passport number is left to enter.
  // Only fills if still untouched — never clobbers a manual edit.
  useEffect(() => {
    if (step !== 4) return
    const full = d.reference_name.trim()
    if (!full) return
    setTravelers(prev => {
      const first = prev[0]
      if (!first || first.first_name.trim() || first.last_name.trim()) return prev
      const parts = full.split(/\s+/)
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ')
      return prev.map((t, idx) => idx === 0 ? { ...t, first_name: firstName, last_name: lastName } : t)
    })
  }, [step, d.reference_name])

  function updateTraveler(i: number, patch: Partial<FormTraveler>) {
    setTravelers(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t))
  }
  function addTraveler() { setTravelers(prev => [...prev, { first_name: '', last_name: '', passport_number: '', does_kite: false }]) }
  function removeTraveler(i: number) { setTravelers(prev => prev.filter((_, idx) => idx !== i)) }

  // One list decides both whether the step can be left and what the visitor is
  // told is missing — see utils/bookingFormCompleteness.ts.
  const missing: MissingAnswer[] = missingOnStep(step, d, travelers)

  function goTo(n: number) {
    setStep(n)
    setMaxReached(m => Math.max(m, n))
  }
  /** Pressed on an unfinished step: show what is missing and scroll to it,
   *  rather than doing nothing. */
  function blockedByMissing(): boolean {
    if (missing.length === 0) return false
    setShowMissing(true)
    missingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  }
  function next() {
    if (blockedByMissing()) return
    setShowMissing(false)
    goTo(Math.min(TOTAL, step + 1))
  }
  function back() { setShowMissing(false); setStep(s => Math.max(1, s - 1)) }

  async function submit() {
    if (blockedByMissing()) return
    // Anti-spam (see BACKLOG): honeypot filled, or submitted <3s after page load
    // (impossible for a human on a 5-step wizard) → fake success, insert nothing.
    // Silent on purpose: don't teach bots what tripped them.
    if (honeypot.trim() || Date.now() - mountedAt.current < 3000) { setDone(true); return }
    setSubmitting(true)
    setError(null)
    const payload: BookingFormPayload = {
      language: lang,
      ...(enquiryId ? { enquiry_id: enquiryId } : {}),
      ...(targetBookingId ? { target_booking_id: targetBookingId } : {}),
      reference_name: d.reference_name.trim(),
      email: d.email.trim(),
      phone: d.phone.trim(),
      // Both forms of the answer travel: the id, so a later migration can
      // backfill a real foreign key without guessing, and the canonical English
      // label, so everything that already reads `referral_source` (the booking
      // column, the admin panel) keeps working and starts agreeing with the
      // enquiry stats. 'other' carries the free line instead.
      ...(d.referral_source_id && d.referral_source_id !== 'other'
        ? { referral_source_id: d.referral_source_id }
        : {}),
      referral_source: referralLabel({ sourceId: d.referral_source_id, freeText: d.referral_source }, sources),
      country_entry_date: d.country_entry_date,
      country_exit_date: d.country_exit_date,
      nights_bilene: d.nights_bilene,
      arrival_time: d.arrival_time,
      departure_time: d.departure_time,
      taxi_arrival: d.taxi_arrival,
      taxi_departure: d.taxi_departure,
      transfer_to_bilene_date: d.taxi_arrival ? d.transfer_to_bilene_date : '',
      transfer_to_bilene_time: d.taxi_arrival ? d.transfer_to_bilene_time : '',
      transfer_to_airport_date: d.taxi_departure ? d.transfer_to_airport_date : '',
      transfer_to_airport_time: d.taxi_departure ? d.transfer_to_airport_time : '',
      luggage_count: d.luggage_count,
      boardbag_count: d.boardbag_count,
      double_beds: d.double_beds,
      single_beds: d.single_beds,
      has_travel_insurance: d.has_travel_insurance,
      travelers: travelers.map(t => ({
        first_name: t.first_name.trim(),
        last_name: t.last_name.trim(),
        passport_number: t.passport_number.trim(),
        does_kite: t.does_kite ?? false,
        kite_level: t.does_kite ? (t.kite_level ?? undefined) : undefined,
        brings_own_gear: t.does_kite ? (t.brings_own_gear ?? false) : undefined,
        needs_storage: (t.does_kite && t.brings_own_gear) ? (t.needs_storage ?? false) : undefined,
        wants_kite_lessons: t.does_kite ? (t.wants_kite_lessons ?? false) : undefined,
        wants_kite_rental: t.does_kite ? (t.wants_kite_rental ?? false) : undefined,
        wants_wing_lessons: t.does_kite ? (t.wants_wing_lessons ?? false) : undefined,
      })),
      emergency_contact_name: d.emergency_contact_name.trim(),
      emergency_contact_phone: d.emergency_contact_phone.trim(),
      emergency_contact_email: d.emergency_contact_email.trim(),
      emergency_contact_relation: d.emergency_contact_relation.trim(),
      waiver_accepted: d.waiver_accepted,
      waiver_version: WAIVER_VERSION,
    }
    const { error: insErr } = await supabase.from('form_submissions').insert([{
      status: 'pending',
      language: lang,
      reference_name: payload.reference_name,
      email: payload.email,
      num_travelers: travelers.length,
      arrival_date: payload.country_entry_date || null,
      payload,
    }])
    setSubmitting(false)
    if (insErr) { setError(insErr.message || insErr.code || 'unknown'); return }
    setDone(true)
  }

  const pct = Math.round((step / TOTAL) * 100)

  // ── Success screen ──
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-200 dark:via-sky-800 to-amber-100 dark:to-amber-900/30 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl max-w-md w-full p-8 text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{tr.success_title[lang]}</h1>
          <p className="text-gray-600 dark:text-gray-400">{tr.success_msg[lang]}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-200 dark:via-sky-800 to-amber-100 dark:to-amber-900/30 py-6 px-4">
      <style>{`@keyframes bkcfade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="max-w-xl mx-auto">
        {/* Header + language picker */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-400/70">{tr.brand[lang]}</p>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">{tr.header_title[lang]}</h1>
          </div>
          <div className="flex gap-1">
            {LANGS.map(l => (
              <button key={l.code} type="button" onClick={() => setLang(l.code)} title={l.label}
                className={`px-2 py-1 rounded-lg text-sm transition ${lang === l.code ? 'bg-white dark:bg-gray-900 shadow' : 'opacity-60 hover:opacity-100'}`}>
                {l.flag}
              </button>
            ))}
          </div>
        </div>

        {/* Honeypot — moved off-screen (not display:none), humans never see or tab
            into it; bots autofilling every field will trip it. Checked in submit(). */}
        <input
          type="text"
          name="bkc_extra"
          data-lpignore="true"
          data-1p-ignore=""
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute -left-[9999px] w-px h-px opacity-0"
        />

        {/* Progress bar with advancing kite */}
        <div className="relative h-7 mb-5">
          <div className="absolute top-3 left-0 right-0 h-1.5 bg-white dark:bg-gray-900/50 rounded-full" />
          <div className="absolute top-3 left-0 h-1.5 bg-sky-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          <div className="absolute top-0 transition-all duration-500" style={{ left: `calc(${pct}% - 12px)` }}>
            <span className="text-xl">🪁</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden">
          {/* Step tabs */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-1">
            {STEPS.map((s, i) => {
              const n = i + 1
              const active = n === step
              const reachable = n <= maxReached
              return (
                <button key={n} type="button" onClick={() => reachable && goTo(n)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-medium transition
                    ${active ? 'text-sky-700 dark:text-sky-400' : reachable ? 'text-gray-500 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400' : 'text-gray-300 dark:text-gray-500 cursor-default'}`}>
                  <span className="text-lg">{n < step ? '✅' : s.icon}</span>
                  <span className="hidden sm:block">{tr[s.labelKey][lang]}</span>
                </button>
              )
            })}
          </div>

          <div key={step} className="px-6 py-5 space-y-5" style={{ animation: 'bkcfade .35s ease' }}>
            {/* Step 1 — Group */}
            {step === 1 && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{tr.s1_title[lang]}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr.s1_intro[lang]}</p>
                </div>
                <Field label={tr.f_reference_name[lang]} required>
                  <input className={inputCls} placeholder={tr.ph_reference_name[lang]} value={d.reference_name} onChange={e => update({ reference_name: e.target.value })} />
                </Field>
                <Field label={tr.f_email[lang]} required>
                  <input type="email" className={inputCls} placeholder={tr.ph_email[lang]} value={d.email} onChange={e => update({ email: e.target.value })} />
                </Field>
                <Field label={tr.f_phone[lang]}>
                  <input className={inputCls} placeholder={tr.ph_phone[lang]} value={d.phone} onChange={e => update({ phone: e.target.value })} />
                </Field>
                {/* Asked from the same curated list as the enquiry form — it is
                    the same question, and two different answer sets made the
                    attribution stats unusable. Not asked at all when the visitor
                    came through a personalised link: their enquiry already
                    carries the answer, and asking twice invites two answers. */}
                {!enquiryId && (
                  <Field label={tr.f_referral[lang]}>
                    <select className={inputCls} value={d.referral_source_id}
                      onChange={e => update({ referral_source_id: e.target.value, referral_source: '' })}>
                      <option value="">{tr.opt_choose[lang]}</option>
                      {sources.map(s => (
                        <option key={s.id} value={s.id}>{s.label?.[lang] || s.label?.en || ''}</option>
                      ))}
                      {/* Always last, never removable — same reason as on the
                          enquiry form: without it, someone who came through a
                          friend is pushed into a box that does not fit, and the
                          statistic looks clean while being wrong. */}
                      <option value="other">{tr.opt_other[lang]}</option>
                    </select>
                    {d.referral_source_id === 'other' && (
                      <input className={`${inputCls} mt-2`} placeholder={tr.ph_referral[lang]}
                        value={d.referral_source} onChange={e => update({ referral_source: e.target.value })} />
                    )}
                  </Field>
                )}
              </>
            )}

            {/* Step 2 — Trip */}
            {step === 2 && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{tr.s2_title[lang]}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr.s2_intro[lang]}</p>
                </div>

                <Field label={tr.f_nights[lang]} required>
                  <Counter value={d.nights_bilene} onChange={v => update({ nights_bilene: v })} min={1} />
                </Field>

                {/* Arrival block */}
                <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-3 bg-white dark:bg-gray-900/70">
                  <h3 className="text-sm font-bold text-sky-700 dark:text-sky-400">✈️ {tr.arrival_heading[lang]}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={tr.f_country_entry[lang]} required>
                      <input type="date" className={inputCls} value={d.country_entry_date} onChange={e => update({ country_entry_date: e.target.value })} />
                    </Field>
                    <Field label={tr.f_arrival_time[lang]}>
                      <input type="time" className={inputCls} value={d.arrival_time} onChange={e => update({ arrival_time: e.target.value })} />
                    </Field>
                  </div>
                  <Field label={tr.f_taxi_arrival[lang]}>
                    <YesNo value={d.taxi_arrival} onChange={toggleArrivalTransfer} lang={lang} />
                  </Field>
                  {d.taxi_arrival && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-3 border-l-2 border-sky-200 dark:border-sky-900">
                      <Field label={tr.f_transfer_pickup_date[lang]} hint={tr.transfer_hint[lang]}>
                        <input type="date" className={inputCls} value={d.transfer_to_bilene_date} onChange={e => update({ transfer_to_bilene_date: e.target.value })} />
                      </Field>
                      <Field label={tr.f_transfer_pickup_time[lang]}>
                        <input type="time" className={inputCls} value={d.transfer_to_bilene_time} onChange={e => update({ transfer_to_bilene_time: e.target.value })} />
                      </Field>
                    </div>
                  )}
                </div>

                {/* Departure block */}
                <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-3 bg-white dark:bg-gray-900/70">
                  <h3 className="text-sm font-bold text-sky-700 dark:text-sky-400">🛬 {tr.departure_heading[lang]}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={tr.f_country_exit[lang]} required>
                      <input type="date" className={inputCls} value={d.country_exit_date} onChange={e => update({ country_exit_date: e.target.value })} />
                    </Field>
                    <Field label={tr.f_departure_time[lang]}>
                      <input type="time" className={inputCls} value={d.departure_time} onChange={e => update({ departure_time: e.target.value })} />
                    </Field>
                  </div>
                  <Field label={tr.f_taxi_departure[lang]}>
                    <YesNo value={d.taxi_departure} onChange={toggleDepartureTransfer} lang={lang} />
                  </Field>
                  {d.taxi_departure && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-3 border-l-2 border-sky-200 dark:border-sky-900">
                      <Field label={tr.f_transfer_drop_date[lang]} hint={tr.transfer_hint[lang]}>
                        <input type="date" className={inputCls} value={d.transfer_to_airport_date} onChange={e => update({ transfer_to_airport_date: e.target.value })} />
                      </Field>
                      <Field label={tr.f_transfer_drop_time[lang]}>
                        <input type="time" className={inputCls} value={d.transfer_to_airport_time} onChange={e => update({ transfer_to_airport_time: e.target.value })} />
                      </Field>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Step 3 — Logistics */}
            {step === 3 && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{tr.s3_title[lang]}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr.s3_intro[lang]}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr.f_luggage[lang]}</span>
                  <Counter value={d.luggage_count} onChange={v => update({ luggage_count: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr.f_boardbags[lang]}</span>
                  <Counter value={d.boardbag_count} onChange={v => update({ boardbag_count: v })} />
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-xs text-gray-400 dark:text-gray-400 mb-3">{tr.beds_hint[lang]}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr.f_double_beds[lang]}</span>
                    <Counter value={d.double_beds} onChange={v => update({ double_beds: v })} />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr.f_single_beds[lang]}</span>
                    <Counter value={d.single_beds} onChange={v => update({ single_beds: v })} />
                  </div>
                </div>
                <Field label={tr.f_insurance[lang]}>
                  <YesNo value={d.has_travel_insurance} onChange={v => update({ has_travel_insurance: v })} lang={lang} />
                </Field>
              </>
            )}

            {/* Step 4 — Crew */}
            {step === 4 && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{tr.s4_title[lang]}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr.s4_intro[lang]}</p>
                </div>
                <div className="rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-400">
                  {tr.s4_passport_warning[lang]}
                </div>
                {travelers.map((t, i) => (
                  <TravelerCard key={i} index={i} t={t} lang={lang} canRemove={travelers.length > 1}
                    onChange={patch => updateTraveler(i, patch)} onRemove={() => removeTraveler(i)} />
                ))}
                <button type="button" onClick={addTraveler}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-sky-300 dark:border-sky-800 text-sky-600 dark:text-sky-400 text-sm font-semibold hover:bg-sky-50 dark:hover:bg-sky-950/40 transition">
                  {tr.add_traveler[lang]}
                </button>
              </>
            )}

            {/* Step 5 — Finish */}
            {step === 5 && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{tr.s5_title[lang]}</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{tr.emergency_heading[lang]}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">{tr.emergency_intro[lang]}</p>
                  </div>
                  <Field label={tr.f_ec_name[lang]} required>
                    <input className={inputCls} value={d.emergency_contact_name} onChange={e => update({ emergency_contact_name: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={tr.f_ec_phone[lang]} required>
                      <input className={inputCls} value={d.emergency_contact_phone} onChange={e => update({ emergency_contact_phone: e.target.value })} />
                    </Field>
                    <Field label={tr.f_ec_email[lang]}>
                      <input type="email" className={inputCls} value={d.emergency_contact_email} onChange={e => update({ emergency_contact_email: e.target.value })} />
                    </Field>
                  </div>
                  <Field label={tr.f_ec_relation[lang]}>
                    <input className={inputCls} placeholder={tr.ph_ec_relation[lang]} value={d.emergency_contact_relation} onChange={e => update({ emergency_contact_relation: e.target.value })} />
                  </Field>
                </div>

                {/* Waiver */}
                <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-4 bg-gray-50 dark:bg-gray-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{tr.waiver_heading[lang]}</h3>
                    <button type="button" onClick={() => setShowWaiver(s => !s)} className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline">
                      {showWaiver ? tr.waiver_hide[lang] : tr.waiver_show[lang]}
                    </button>
                  </div>
                  {showWaiver && (
                    <div className="max-h-56 overflow-y-auto text-[11px] leading-relaxed text-gray-600 dark:text-gray-400 space-y-2 pr-1">
                      <p className="font-semibold">{waiverText[lang].title}</p>
                      {waiverText[lang].paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  )}
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={d.waiver_accepted} onChange={e => update({ waiver_accepted: e.target.checked })}
                      className="mt-0.5 w-4 h-4 accent-sky-600 shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{tr.waiver_checkbox[lang]}</span>
                  </label>
                </div>

                {error && (
                  <div className="text-sm text-rose-600 dark:text-rose-400 space-y-1">
                    <p>{tr.error_msg[lang]}</p>
                    <p className="text-[11px] font-mono opacity-70 break-all">{error}</p>
                  </div>
                )}
              </>
            )}

            {/* Step 4 used to be excluded here, which is exactly where a link
                carrying a one-word name left the last name empty and the button
                grey with nothing on screen saying why. */}
            {missing.length > 0 && (
              <div ref={missingRef}
                className={`rounded-xl px-3 py-2.5 text-xs transition ${showMissing
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300'
                  : 'text-amber-600 dark:text-amber-400'}`}>
                <p className="font-semibold">{tr.missing_heading[lang]}</p>
                <ul className="mt-1 space-y-0.5">
                  {missing.map((m, i) => (
                    <li key={i}>
                      • {tr[m.key][lang]}
                      {m.traveler !== undefined && ` — ${tr.traveler[lang]} ${m.traveler}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <button type="button" onClick={back} disabled={step === 1}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${step === 1 ? 'text-gray-300 dark:text-gray-500 cursor-default' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              ← {tr.back[lang]}
            </button>
            {/* Neither nav button is ever disabled: a dead button on a phone
                tells the visitor nothing. Pressing it says what is missing. */}
            {step < TOTAL ? (
              <button type="button" onClick={next}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition ${missing.length === 0 ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-sky-600/40 text-white'}`}>
                {tr.next[lang]} →
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition ${submitting ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-400' : missing.length === 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-emerald-600/40 text-white'}`}>
                {submitting ? tr.submitting[lang] : tr.submit[lang]}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
