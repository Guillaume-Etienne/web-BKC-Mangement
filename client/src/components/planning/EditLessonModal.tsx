import { useId, useState } from 'react'
import Modal from '../common/Modal'
import type { Booking, BookingParticipant, Client, Equipment, Instructor, Lesson, LessonDiscipline, LessonType, PriceItem, PriceTier } from '../../types/database'
import { lessonDiscipline } from '../../types/database'
import { reFreezeInstructorRate, resolveLessonRate, currentInstructorRate } from '../accounting/utils'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import GuestPicker from './GuestPicker'
import { DURATION_OPTIONS, GearSection, WingToggle, lessonTypeCfg, riderGearRows, type GearPick } from './lessonFormParts'
import { askConfirm } from '../../lib/confirm'

interface Props {
  lesson: Lesson
  /** All lessons: the client rate is tiered on the guests' cumulative hours. */
  lessons: Lesson[]
  instructors: Instructor[]
  equipment: Equipment[]
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  clients: Client[]
  priceItems: PriceItem[]
  priceTiers: PriceTier[]
  onSave: (l: Lesson) => void
  onClose: () => void
  /** Left out where deleting is not offered (the accounting page). */
  onDelete?: (id: string) => void
  /** A lesson being CREATED (the accounting grid): both prices are frozen at
   *  today's rates on save, whatever was edited — exactly as the Daily does. */
  isNew?: boolean
  title?: string
}

/** Full edit form of one lesson (type, guests, instructor, time, duration, notes, gear).
 *  Shared by the Planning and the Accounting pages: both open the very same form. */
export default function EditLessonModal({
  lesson, lessons, instructors, equipment, bookings, bookingParticipants, clients, priceItems, priceTiers, onSave, onClose, onDelete, isNew, title,
}: Props) {
  const { lang } = useLanguage()
  const LESSON_TYPE_CFG = lessonTypeCfg(lang)
  const titleId = useId()
  const [editData, setEditData] = useState<Partial<Lesson>>({ ...lesson })
  const [riderGear, setRiderGear] = useState<Record<string, GearPick>>(
    Object.fromEntries((lesson.rider_gear ?? []).map(g => [g.participant_id, { kite_id: g.kite_id, board_id: g.board_id }])),
  )

  function bookingForParticipant(participantId: string): string {
    return bookingParticipants.find(p => p.id === participantId)?.booking_id ?? ''
  }

  /** Client price €/h from Options → Pricing, keyed by what it bills (never by name). */
  function lessonPrice(type: LessonType, participantIds: string[], discipline: LessonDiscipline): number | null {
    return resolveLessonRate(
      { id: '', type, discipline, participant_ids: participantIds, price_per_hour: null },
      priceItems,
      { tiers: priceTiers, allLessons: lessons, bookingParticipants },
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // Re-freeze the payout if this lesson just changed instructor or type —
    // see reFreezeInstructorRate. The client price is deliberately NOT touched:
    // it can be overridden by hand from Accounting, and recomputing it here
    // would quietly undo that decision.
    const merged = { ...lesson, ...editData } as Lesson
    // A lesson belongs to its guests' booking, exactly as when it is created.
    // Changing the guests has to move it with them — otherwise it stays on the
    // old booking: billed and shown in the accounting under someone else.
    const firstGuestId = merged.participant_ids?.[0]
    const bookingId = (firstGuestId && bookingForParticipant(firstGuestId)) || lesson.booking_id
    // Switching kite ↔ wing ↔ discovery is a deliberate change of product, so
    // unlike every other edit it re-freezes the client price at the new rate.
    const disciplineNow: LessonDiscipline = merged.type === 'supervision' ? 'kite' : lessonDiscipline(merged)
    const disciplineChanged = disciplineNow !== lessonDiscipline(lesson)
    const gearRows = riderGearRows(merged.type, merged.participant_ids, riderGear, { kite_id: merged.kite_id, board_id: merged.board_id })
    const perRider = merged.type === 'group' && merged.participant_ids.length > 1
    const withDiscipline: Lesson = {
      ...merged, booking_id: bookingId,
      kite_id: perRider ? (gearRows[0]?.kite_id ?? null) : merged.kite_id,
      board_id: perRider ? (gearRows[0]?.board_id ?? null) : merged.board_id,
      rider_gear: gearRows,
      ...(disciplineChanged && {
        discipline: disciplineNow,
        price_per_hour: lessonPrice(merged.type, merged.participant_ids, disciplineNow),
      }),
    }
    if (isNew) {
      // Created, not edited: freeze BOTH of today's scales, as the Daily does —
      // a later price-list or pay change must not reprice this lesson.
      const instr = instructors.find(i => i.id === withDiscipline.instructor_id)
      // A kite lesson carries no `discipline` key AT ALL (the column defaults to
      // kite): `discipline: undefined` is still a key, supabase-js then names the
      // column in the insert and Postgres gets NULL → not-null violation.
      const { discipline: _d, ...rest } = withDiscipline
      onSave({
        ...rest,
        ...(disciplineNow !== 'kite' && { discipline: disciplineNow }),
        price_per_hour: lessonPrice(withDiscipline.type, withDiscipline.participant_ids, disciplineNow),
        instructor_rate: instr ? currentInstructorRate(withDiscipline, instr) : null,
      })
      return
    }
    onSave(reFreezeInstructorRate(withDiscipline, lesson, instructors))
  }

  async function remove() {
    if (!onDelete) return
    if (await askConfirm(i18n.planning.msg_confirm_delete_lesson[lang])) onDelete(lesson.id)
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h3 id={titleId} className="font-bold text-gray-800 dark:text-gray-200">{title ?? i18n.planning.title_edit_lesson[lang]}</h3>
          <button type="button" onClick={onClose} aria-label={i18n.common.btn_close[lang]} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold">✕</button>
        </div>
        {/* The guest chips can run long, so the form scrolls inside the modal or the
            page behind it scrolls instead and Save/Cancel become unreachable. */}
        <form onSubmit={submit} className="p-4 space-y-3 overflow-y-auto min-h-0 flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
            <div className="grid grid-cols-3 gap-1">
              {(['private', 'group', 'supervision'] as LessonType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEditData(d => ({ ...d, type: t }))}
                  className={`text-sm py-1.5 px-1 rounded border transition-colors text-center leading-tight ${
                    editData.type === t
                      ? `${LESSON_TYPE_CFG[t].card} font-semibold ring-1 ring-inset ring-current`
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <div>{LESSON_TYPE_CFG[t].icon}</div>
                  <div>{LESSON_TYPE_CFG[t].label}</div>
                </button>
              ))}
            </div>
          </div>
          <WingToggle type={editData.type ?? lesson.type} discipline={lessonDiscipline(editData)} onChange={d => setEditData(prev => ({ ...prev, discipline: d }))} />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={editData.date || ''}
              onChange={e => setEditData(d => ({ ...d, date: e.target.value }))}
              className="w-full text-sm border rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {editData.type === 'group' ? 'Participants' : 'Participant'}
            </label>
            <GuestPicker
              date={editData.date ?? lesson.date}
              selectedIds={editData.participant_ids ?? []}
              onToggle={id => setEditData(d => {
                if (d.type !== 'group') return { ...d, participant_ids: [id] }
                const ids = d.participant_ids ?? []
                if (ids.includes(id)) {
                  if (ids.length <= 1) return d
                  return { ...d, participant_ids: ids.filter(x => x !== id) }
                }
                return { ...d, participant_ids: [...ids, id] }
              })}
              bookings={bookings} bookingParticipants={bookingParticipants} clients={clients}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instructor</label>
            <select
              value={editData.instructor_id || ''}
              onChange={e => setEditData(d => ({ ...d, instructor_id: e.target.value }))}
              className="w-full text-sm border rounded px-2 py-1.5"
            >
              {instructors.map(i => (
                <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Time</label>
            <input
              type="time"
              value={editData.start_time || ''}
              onChange={e => setEditData(d => ({ ...d, start_time: e.target.value }))}
              className="w-full text-sm border rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Duration</label>
            <div className="grid grid-cols-3 gap-1">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setEditData(ed => ({ ...ed, duration_hours: d }))}
                  className={`text-sm py-1.5 rounded border transition-colors ${
                    (editData.duration_hours || 1) === d
                      ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >{d}h</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <input
              type="text"
              value={editData.notes ?? ''}
              onChange={e => setEditData(d => ({ ...d, notes: e.target.value || null }))}
              className="w-full text-sm border rounded px-2 py-1.5"
            />
          </div>
          <GearSection
            compact={false}
            type={editData.type ?? lesson.type}
            discipline={lessonDiscipline(editData)}
            participantIds={editData.participant_ids ?? lesson.participant_ids}
            solo={{ kite_id: editData.kite_id ?? null, board_id: editData.board_id ?? null }}
            riders={riderGear}
            onSolo={g => setEditData(d => ({ ...d, ...g }))}
            onRider={(pid, g) => setRiderGear(r => ({ ...r, [pid]: g }))}
            equipment={equipment} bookingParticipants={bookingParticipants}
          />
          <div className="flex gap-2 pt-2 border-t">
            {onDelete && (
              <button
                type="button"
                onClick={remove}
                className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded font-medium text-sm"
              >
                {i18n.common.btn_delete[lang]}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm"
            >
              {i18n.common.btn_cancel[lang]}
            </button>
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
            >
              {i18n.common.btn_save[lang]}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
