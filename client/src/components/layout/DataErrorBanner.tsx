/**  Le bandeau qui dit qu'un écran affiche moins que ce qu'il devrait.
 *
 *  Un seul par page, monté dans `App.tsx`. Il ne s'affiche que s'il y a
 *  quelque chose à dire, et il disparaît tout seul dès que la lecture repasse —
 *  `useTable` se ré-abonne au realtime, donc une coupure réseau qui se termine
 *  efface le bandeau sans que personne ne clique.
 *
 *  Il nomme la table et rend le message de Postgres tel quel : les deux
 *  lecteurs sont les admins, et « permission denied for table room_rates » leur
 *  dit quoi faire là où « une erreur est survenue » ne dit rien.
 */
import { useDataErrors } from '../../contexts/DataErrorsContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

export default function DataErrorBanner() {
  const errors = useDataErrors()
  const { lang } = useLanguage()

  if (errors.length === 0) return null

  return (
    <div role="alert"
      className="mx-4 mt-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
            {i18n.common.msg_incomplete_screen[lang]}
          </p>
          <p className="text-amber-800 dark:text-amber-300 text-xs mt-0.5">
            {i18n.common.msg_incomplete_hint[lang]}
          </p>
          <ul className="mt-2 space-y-1">
            {errors.map(e => (
              <li key={`${e.table} ${e.message}`}
                className="text-xs text-amber-900 dark:text-amber-200 font-mono break-words">
                <span className="font-semibold">{e.table}</span> — {e.message}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => window.location.reload()}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700">
          {i18n.common.btn_reload[lang]}
        </button>
      </div>
    </div>
  )
}
