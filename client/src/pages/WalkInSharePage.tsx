import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Client, Lesson, EquipmentRental, Payment, LessonType, RentalSlot } from '../types/database'
import { usePref, Segmented } from './taxiShareUI'
import { fromISODate } from '../utils/dates'

interface Props { clientId: string }

// What anon is actually served (column-level GRANTs — see security-rls.md): the
// client price comes through the `share_price*` mirrors, never the instructor's
// pay. Typed narrowly so a future edit cannot reach for a column that is closed.
type VisitLesson = Pick<Lesson, 'id' | 'booking_id' | 'instructor_id' | 'date' | 'start_time' | 'duration_hours' | 'type'>
  & { share_price_per_hour: number | null }
type VisitRental = Pick<EquipmentRental, 'id' | 'booking_id' | 'equipment_id' | 'date' | 'slot'>
  & { share_price: number | null }
type VisitPayment = Pick<Payment, 'id' | 'booking_id' | 'date' | 'amount' | 'method' | 'is_discount' | 'is_deposit'>
interface Visit { id: string; check_in: string }

type Lang = 'en' | 'fr' | 'pt'

const LANGS: { code: Lang; flag: string }[] = [
  { code: 'en', flag: '🇬🇧' },
  { code: 'fr', flag: '🇫🇷' },
  { code: 'pt', flag: '🇲🇿' },
]

const tr = {
  title:       { en: 'My visits',            fr: 'Mes venues',            pt: 'As minhas visitas' },
  loading:     { en: 'Loading…',             fr: 'Chargement…',           pt: 'A carregar…' },
  not_found:   { en: 'Client not found.',    fr: 'Client introuvable.',   pt: 'Cliente não encontrado.' },
  hours:       { en: 'Hours',                fr: 'Heures',                pt: 'Horas' },
  visits:      { en: 'Visits',               fr: 'Venues',                pt: 'Visitas' },
  total:       { en: 'Total',                fr: 'Total',                 pt: 'Total' },
  paid:        { en: 'Paid',                 fr: 'Payé',                  pt: 'Pago' },
  due:         { en: 'Balance due',          fr: 'Reste à payer',         pt: 'Em falta' },
  settled:     { en: 'All settled',          fr: 'Tout est réglé',        pt: 'Tudo pago' },
  lessons:     { en: 'Lessons',              fr: 'Cours',                 pt: 'Aulas' },
  rentals:     { en: 'Rentals',              fr: 'Locations',             pt: 'Aluguer' },
  payment:     { en: 'Payment',              fr: 'Paiement',              pt: 'Pagamento' },
  discount:    { en: 'Discount',             fr: 'Remise',                pt: 'Desconto' },
  deposit:     { en: 'Deposit',              fr: 'Acompte',               pt: 'Sinal' },
  none:        { en: 'No visit yet.',        fr: 'Aucune venue pour le moment.', pt: 'Ainda sem visitas.' },
  private:     { en: 'Private',              fr: 'Privé',                 pt: 'Privado' },
  group:       { en: 'Group',                fr: 'Groupe',                pt: 'Grupo' },
  supervision: { en: 'Supervision',          fr: 'Supervision',           pt: 'Supervisão' },
  morning:     { en: 'Morning',              fr: 'Matin',                 pt: 'Manhã' },
  afternoon:   { en: 'Afternoon',            fr: 'Après-midi',            pt: 'Tarde' },
  full_day:    { en: 'Full day',             fr: 'Journée',               pt: 'Dia inteiro' },
  rental:      { en: 'Rental',               fr: 'Location',              pt: 'Aluguer' },
  with:        { en: 'with',                 fr: 'avec',                  pt: 'com' },
} as const

const LOCALE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT' }

const fmtH = (n: number) => `${Number(n.toFixed(2))}`
const fmtEur = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })

function dateLabel(iso: string, lang: Lang): string {
  return fromISODate(iso).toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const lessonCost = (l: VisitLesson) => (l.share_price_per_hour ?? 0) * l.duration_hours

export default function WalkInSharePage({ clientId }: Props) {
  const [client,   setClient]   = useState<Pick<Client, 'id' | 'first_name' | 'last_name'> | null>(null)
  const [visits,   setVisits]   = useState<Visit[]>([])
  const [lessons,  setLessons]  = useState<VisitLesson[]>([])
  const [rentals,  setRentals]  = useState<VisitRental[]>([])
  const [payments, setPayments] = useState<VisitPayment[]>([])
  const [instrNames, setInstrNames] = useState<Record<string, string>>({})
  const [gearNames,  setGearNames]  = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = usePref<Lang>('walkin_share_lang', 'en')

  useEffect(() => {
    async function load() {
      // RLS already narrows every one of these to the token's client and to
      // his day-visitor visits; the filters are for the reader, not the guard.
      const [cRes, bRes, lRes, rRes, pRes, iRes, eRes] = await Promise.all([
        supabase.from('clients').select('id, first_name, last_name').eq('id', clientId).single(),
        supabase.from('bookings').select('id, check_in').eq('client_id', clientId).eq('kind', 'day_visitor').order('check_in', { ascending: false }),
        supabase.from('lessons').select('id, booking_id, instructor_id, date, start_time, duration_hours, type, share_price_per_hour'),
        supabase.from('equipment_rentals').select('id, booking_id, equipment_id, date, slot, share_price'),
        supabase.from('payments').select('id, booking_id, date, amount, method, is_discount, is_deposit').order('date'),
        supabase.from('instructors').select('id, first_name'),
        supabase.from('equipment').select('id, name'),
      ])
      setClient((cRes.data ?? null) as typeof client)
      setVisits((bRes.data ?? []) as Visit[])
      setLessons((lRes.data ?? []) as VisitLesson[])
      setRentals((rRes.data ?? []) as VisitRental[])
      setPayments((pRes.data ?? []) as VisitPayment[])
      setInstrNames(Object.fromEntries(((iRes.data ?? []) as { id: string; first_name: string }[]).map(i => [i.id, i.first_name])))
      setGearNames(Object.fromEntries(((eRes.data ?? []) as { id: string; name: string }[]).map(e => [e.id, e.name])))
      setLoading(false)
    }
    load()
  }, [clientId])

  const totals = useMemo(() => {
    const hours = lessons.reduce((s, l) => s + l.duration_hours, 0)
    const billed = lessons.reduce((s, l) => s + lessonCost(l), 0) + rentals.reduce((s, r) => s + (r.share_price ?? 0), 0)
    const paid = payments.filter(p => !p.is_discount).reduce((s, p) => s + p.amount, 0)
    const discounts = payments.filter(p => p.is_discount).reduce((s, p) => s + p.amount, 0)
    return { hours, billed, paid, due: billed - paid - discounts }
  }, [lessons, rentals, payments])

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center text-gray-500 dark:text-gray-400">{tr.loading[lang]}</div>
  }
  if (!client) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center text-gray-500 dark:text-gray-400">{tr.not_found[lang]}</div>
  }

  const settled = Math.abs(totals.due) < 0.005

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 dark:text-blue-300 text-sm font-medium uppercase tracking-wide mb-1">{tr.title[lang]}</p>
              <h1 className="text-2xl md:text-3xl font-bold">{client.first_name} {client.last_name}</h1>
            </div>
            <Segmented value={lang} onChange={setLang}
              options={LANGS.map(l => ({ v: l.code, label: `${l.flag} ${l.code.toUpperCase()}` }))} />
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr.hours[lang]}</p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{fmtH(totals.hours)} h</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{visits.length} {tr.visits[lang].toLowerCase()}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr.total[lang]}</p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{fmtEur(totals.billed)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{tr.paid[lang]}</p>
            <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-300">{fmtEur(totals.paid)}</p>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${settled
            ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
            : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40'}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr.due[lang]}</p>
            <p className={`mt-1 text-xl font-bold ${settled ? 'text-gray-900 dark:text-gray-100' : 'text-amber-900 dark:text-amber-300'}`}>
              {settled ? '✓' : fmtEur(totals.due)}
            </p>
            {settled && <p className="text-xs text-gray-500 dark:text-gray-400">{tr.settled[lang]}</p>}
          </div>
        </div>

        {visits.length === 0 && (
          <p className="text-center text-sm italic text-gray-500 dark:text-gray-400 py-6">{tr.none[lang]}</p>
        )}

        {/* One card per visit, newest first */}
        {visits.map(v => {
          const vl = lessons.filter(l => l.booking_id === v.id).sort((a, b) => a.start_time.localeCompare(b.start_time))
          const vr = rentals.filter(r => r.booking_id === v.id)
          const vp = payments.filter(p => p.booking_id === v.id)
          const billed = vl.reduce((s, l) => s + lessonCost(l), 0) + vr.reduce((s, r) => s + (r.share_price ?? 0), 0)
          const paid = vp.filter(p => !p.is_discount).reduce((s, p) => s + p.amount, 0)
          const disc = vp.filter(p => p.is_discount).reduce((s, p) => s + p.amount, 0)
          const due = billed - paid - disc
          return (
            <div key={v.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 capitalize">{dateLabel(v.check_in, lang)}</h2>
                <span className={`text-xs font-semibold ${Math.abs(due) < 0.005 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {Math.abs(due) < 0.005 ? `✓ ${tr.settled[lang]}` : `${tr.due[lang]}: ${fmtEur(due)}`}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {vl.map(l => (
                  <div key={l.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 text-gray-800 dark:text-gray-200">
                      <span className="font-medium">{l.start_time.slice(0, 5)}</span>{' '}
                      {tr[l.type as LessonType][lang]} · {fmtH(l.duration_hours)} h
                      {instrNames[l.instructor_id] && <span className="text-gray-500 dark:text-gray-400"> {tr.with[lang]} {instrNames[l.instructor_id]}</span>}
                    </div>
                    <div className="shrink-0 font-semibold text-gray-800 dark:text-gray-200">{l.share_price_per_hour != null ? fmtEur(lessonCost(l)) : '—'}</div>
                  </div>
                ))}
                {vr.map(r => (
                  <div key={r.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 text-gray-800 dark:text-gray-200">
                      🪁 {tr.rental[lang]}{r.equipment_id && gearNames[r.equipment_id] ? ` · ${gearNames[r.equipment_id]}` : ''}
                      <span className="text-gray-500 dark:text-gray-400"> · {tr[r.slot as RentalSlot][lang]}</span>
                    </div>
                    <div className="shrink-0 font-semibold text-gray-800 dark:text-gray-200">{r.share_price != null ? fmtEur(r.share_price) : '—'}</div>
                  </div>
                ))}
                {vp.map(p => (
                  <div key={p.id} className={`px-5 py-2.5 flex items-start justify-between gap-3 ${p.is_discount ? 'bg-purple-50 dark:bg-purple-950/40' : 'bg-emerald-50/50 dark:bg-emerald-950/20'}`}>
                    <div className="text-gray-700 dark:text-gray-300">
                      {p.is_discount ? tr.discount[lang] : tr.payment[lang]}
                      {p.is_deposit && <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">{tr.deposit[lang]}</span>}
                    </div>
                    <div className={`shrink-0 font-semibold ${p.is_discount ? 'text-purple-700 dark:text-purple-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {p.is_discount ? '-' : ''}{fmtEur(p.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
