import { useState } from 'react'
import Modal from '../common/Modal'
import type { DayActivity, DaySlot } from '../../types/database'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

interface Props {
  activity: DayActivity
  onSave: (a: DayActivity) => void
  onClose: () => void
}

const SLOTS: DaySlot[] = ['morning', 'afternoon', 'evening']

const inputCls = 'w-full text-sm border rounded px-2 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

/** Edit a Daily-tab activity: name, notes, and the slot of its day.
 *
 *  Only the planning entry changes. If the activity was billed to guests when it
 *  was created, those bills (Accounting → booking → Activities) are separate rows
 *  and are NOT touched — said so in the form. */
export default function EditActivityModal({ activity, onSave, onClose }: Props) {
  const { lang } = useLanguage()
  const t = i18n.planning
  const [name, setName] = useState(activity.name)
  const [notes, setNotes] = useState(activity.notes ?? '')
  const [slot, setSlot] = useState<DaySlot>(activity.slot)

  const canSave = name.trim() !== ''

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    onSave({ ...activity, name: name.trim(), notes: notes.trim() || null, slot })
  }

  return (
    <Modal onClose={onClose} label={t.edit_activity_title[lang]} className="items-end sm:items-center justify-center sm:p-4">
      <form
        onSubmit={submit}
        className="bg-white dark:bg-gray-900 w-full sm:max-w-sm rounded-t-xl sm:rounded-xl shadow-xl p-4 space-y-3"
      >
        <div>
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{t.edit_activity_title[lang]}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{activity.date}</p>
        </div>

        <div>
          <label className={labelCls}>{t.edit_activity_name[lang]}</label>
          <input data-autofocus className={inputCls} value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>{t.edit_activity_slot[lang]}</label>
          <select className={inputCls} value={slot} onChange={e => setSlot(e.target.value as DaySlot)}>
            {SLOTS.map(s => <option key={s} value={s}>{t[`slot_${s}` as const][lang]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={inputCls} rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">{t.edit_activity_bill_hint[lang]}</p>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
          <button type="submit" disabled={!canSave} className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-40">{i18n.common.btn_save[lang]}</button>
        </div>
      </form>
    </Modal>
  )
}
