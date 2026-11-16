import { useId, useSyncExternalStore } from 'react'
import Modal from './Modal'
import { answerConfirm, getCurrentConfirm, subscribeConfirm } from '../../lib/confirm'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

/** Shows the question asked through askConfirm() (lib/confirm.ts), one at a time. */
export default function ConfirmHost() {
  const req = useSyncExternalStore(subscribeConfirm, getCurrentConfirm)
  const { lang } = useLanguage()
  const messageId = useId()
  if (!req) return null

  const danger = (req.tone ?? 'danger') === 'danger'
  return (
    // key: a queued question gets a fresh dialog, so focus lands on its Cancel again.
    <Modal key={req.id} onClose={() => answerConfirm(req.id, false)} labelledBy={messageId}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-sm p-5">
        <p id={messageId} className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line break-words">
          {req.message}
        </p>
        <div className="flex gap-2 mt-5">
          {/* The safe answer comes first and takes the focus: Enter by reflex keeps the data. */}
          <button
            type="button"
            data-autofocus
            onClick={() => answerConfirm(req.id, false)}
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm"
          >
            {req.cancelLabel ?? i18n.common.btn_cancel[lang]}
          </button>
          <button
            type="button"
            onClick={() => answerConfirm(req.id, true)}
            className={`flex-1 px-3 py-2 rounded font-medium text-sm text-white ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {req.confirmLabel ?? i18n.common.btn_delete[lang]}
          </button>
        </div>
      </div>
    </Modal>
  )
}
