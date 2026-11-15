import { sortKitesBySize } from '../../utils/kiteSort'
import type { BookingParticipant, Equipment, Lang, LessonDiscipline, LessonType } from '../../types/database'
import { i18n } from '../../data/i18n'

// Pieces of the lesson forms shared by the Planning (add + edit) and the
// Accounting page (edit), so a lesson reads and saves the same everywhere.

/** One rider's kite (or wing sail) and board in a lesson. */
export type GearPick = { kite_id: string | null; board_id: string | null }

export const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3]

export function lessonTypeCfg(lang: Lang): Record<LessonType, { label: string; icon: string; card: string; badge: string; dot: string }> {
  return {
    private:    { label: i18n.planning.lesson_type_private[lang],     icon: '🧑‍🏫', card: 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-400', badge: 'bg-purple-500 text-white', dot: 'bg-purple-500' },
    group:      { label: i18n.planning.lesson_type_group[lang],       icon: '👥', card: 'bg-green-50 dark:bg-green-950/40  border-green-300 dark:border-green-800  text-green-900 dark:text-green-400',  badge: 'bg-green-500  text-white', dot: 'bg-green-500'  },
    supervision:{ label: i18n.planning.lesson_type_supervision[lang], icon: '🎓', card: 'bg-blue-50 dark:bg-blue-950/40   border-blue-300 dark:border-blue-800   text-blue-900 dark:text-blue-400',   badge: 'bg-blue-500   text-white', dot: 'bg-blue-500'   },
  }
}

/** Gear lists follow the lesson's discipline, so there is less to sort through:
 *  a wing lesson offers only wing-category gear (sails, foilboards, paddles) in
 *  both slots; every other lesson offers kites and the regular boards. Bars have
 *  no slot on a lesson. */
function gearOptions(equipment: Equipment[], discipline: LessonDiscipline) {
  const active = equipment.filter(e => e.is_active)
  if (discipline !== 'kite') {
    const wing = active.filter(e => e.category === 'wing')
    return { sails: wing, boards: wing }
  }
  return {
    sails: sortKitesBySize(active.filter(e => e.category === 'kite')),
    boards: active.filter(e => e.category === 'board' || e.category === 'surfboard' || e.category === 'foilboard'),
  }
}

/** The equipment pickers of the lesson forms. One pair for the lesson, or one
 *  pair PER RIDER when a group lesson has several riders. */
export function GearSection(o: {
  compact: boolean
  type: LessonType
  discipline: LessonDiscipline
  participantIds: string[]
  solo: GearPick
  riders: Record<string, GearPick>
  onSolo: (g: GearPick) => void
  onRider: (participantId: string, g: GearPick) => void
  equipment: Equipment[]
  bookingParticipants: BookingParticipant[]
}) {
  const { sails, boards } = gearOptions(o.equipment, o.discipline)
  const wing = o.discipline !== 'kite'
  const selCls = o.compact
    ? 'w-full text-sm md:text-xs border rounded px-2 py-2 md:px-1 md:py-1'
    : 'w-full text-sm border rounded px-2 py-1.5'
  const pair = (value: GearPick, onChange: (g: GearPick) => void) => (
    <>
      <select value={value.kite_id || ''} onChange={e => onChange({ ...value, kite_id: e.target.value || null })} className={selCls}>
        <option value="">{wing ? 'No wing' : 'No kite'}</option>
        {sails.map(e => <option key={e.id} value={e.id}>{wing ? '🌬️' : '🪂'} {e.name}</option>)}
      </select>
      <select value={value.board_id || ''} onChange={e => onChange({ ...value, board_id: e.target.value || null })} className={selCls}>
        <option value="">No board</option>
        {boards.map(e => <option key={e.id} value={e.id}>🏄 {e.name}</option>)}
      </select>
    </>
  )
  const perRider = o.type === 'group' && o.participantIds.length > 1
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {perRider ? 'Equipment per rider (optional)' : 'Equipment (optional)'}
      </label>
      {perRider
        ? o.participantIds.map(pid => {
            const person = o.bookingParticipants.find(bp => bp.id === pid)
            // A legacy group lesson holds ONE kite/board on the lesson itself: show it
            // on the first rider until the lesson is saved with per-rider rows.
            const value = o.riders[pid] ?? (pid === o.participantIds[0] ? o.solo : { kite_id: null, board_id: null })
            return (
              <div key={pid} className="rounded border border-gray-200 dark:border-gray-800 p-1.5 space-y-1">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{person?.first_name} {person?.last_name}</div>
                {pair(value, g => o.onRider(pid, g))}
              </div>
            )
          })
        : pair(o.solo, o.onSolo)}
    </div>
  )
}

/** Per-rider rows to save, from the form's picks. Empty when the lesson is not a
 *  multi-rider group (then the lesson's own kite_id/board_id are the whole story). */
export function riderGearRows(type: LessonType, participantIds: string[], riders: Record<string, GearPick>, solo: GearPick) {
  if (!(type === 'group' && participantIds.length > 1)) return []
  return participantIds.flatMap(pid => {
    const g = riders[pid] ?? (pid === participantIds[0] ? solo : undefined)
    return g && (g.kite_id || g.board_id)
      ? [{ lesson_id: '', participant_id: pid, kite_id: g.kite_id, board_id: g.board_id }]
      : []
  })
}

/** The Wing / Discovery boxes of the lesson forms. Hidden for supervision (no wing rate).
 *  Discovery = wing without the foil board: a cheaper hourly rate. */
export function WingToggle({ type, discipline, onChange }: { type: LessonType; discipline: LessonDiscipline; onChange: (d: LessonDiscipline) => void }) {
  if (type === 'supervision') return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm md:text-xs text-gray-700 dark:text-gray-300">
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={discipline !== 'kite'} onChange={e => onChange(e.target.checked ? 'wing' : 'kite')} />
        Wing
      </label>
      {discipline !== 'kite' && (
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={discipline === 'wing_discovery'} onChange={e => onChange(e.target.checked ? 'wing_discovery' : 'wing')} />
          Discovery (no foil board)
        </label>
      )}
    </div>
  )
}
