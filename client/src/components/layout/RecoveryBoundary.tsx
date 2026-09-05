import { Component, Fragment, type ReactNode } from 'react'
import { classifyError, isSelfHealing, type ErrorKind } from '../../utils/recoverableError'
import { reportClientError } from '../../utils/reportClientError'

interface Props { children: ReactNode }
interface State { error: Error | null; attempt: number }

/** The last thing between a crash and a guest who has no idea what a chunk is.
 *
 *  Was ChunkBoundary, and it only did one thing: print the browser's own
 *  sentence and offer a reload. That is how a client read us "Échec de
 *  l'exécution de « removeChild » sur « Node »" over the phone on 2026-09-04,
 *  from the last step of the booking form, after twenty minutes of typing.
 *  Nothing on that screen was actionable by the person looking at it.
 *
 *  Now it does three things instead:
 *    1. it sorts the crash into a cause (see utils/recoverableError),
 *    2. it repairs the one cause that repairs itself — a translator having
 *       rewritten the DOM under React — by remounting the tree, once, silently,
 *    3. and when it cannot repair, it says what to DO, in the visitor's
 *       language, instead of what went wrong in the browser's.
 *
 *  The form saves a draft on every keystroke (utils/bookingFormDraft), so both
 *  the silent remount and the reload button cost the visitor nothing.
 *
 *  Deliberately a class: error boundaries have no hook equivalent. */

type Bucket = 'translate' | 'update' | 'generic'
type Copy = { title: string; body: string; action: string }

function bucketOf(kind: ErrorKind): Bucket {
  if (kind === 'dom-mutated') return 'translate'
  if (kind === 'chunk') return 'update'
  return 'generic'
}

// Kept here rather than in data/formI18n: this component is in the eager bundle
// (it has to render when everything else has failed), and it must not drag the
// form's whole dictionary in with it. Six sentences are worth the duplication.
const COPY: Record<'fr' | 'en' | 'es', Record<Bucket, Copy>> = {
  fr: {
    translate: {
      title: 'La traduction automatique bloque cette page',
      body: "Votre navigateur traduit la page, et cela l'empêche de fonctionner. Désactivez la traduction, puis rouvrez la page : vos réponses sont conservées. La page existe déjà en français, en anglais et en espagnol — les boutons sont en haut.",
      action: 'Rouvrir la page',
    },
    update: {
      title: 'Cette page n\'a pas fini de se charger',
      body: 'Une nouvelle version vient d\'être mise en ligne, ou la connexion a lâché en cours de route. Rouvrir la page récupère la dernière version.',
      action: 'Rouvrir la page',
    },
    generic: {
      title: 'Cette page s\'est arrêtée',
      body: 'Rouvrez la page : vos réponses sont conservées. Si cela recommence, envoyez-nous la petite ligne grise ci-dessous, elle nous dit où chercher.',
      action: 'Rouvrir la page',
    },
  },
  en: {
    translate: {
      title: 'Page translation is breaking this page',
      body: 'Your browser is translating this page, and that stops it from working. Turn translation off, then reopen the page — your answers are kept. The page already exists in English, French and Spanish; the buttons are at the top.',
      action: 'Reopen the page',
    },
    update: {
      title: "This page didn't finish loading",
      body: 'A new version was just deployed, or the connection dropped mid-load. Reopening the page picks up the latest version.',
      action: 'Reopen the page',
    },
    generic: {
      title: 'This page stopped',
      body: 'Reopen the page — your answers are kept. If it happens again, send us the small grey line below: it tells us where to look.',
      action: 'Reopen the page',
    },
  },
  es: {
    translate: {
      title: 'La traducción automática bloquea esta página',
      body: 'Tu navegador está traduciendo la página, y eso impide que funcione. Desactiva la traducción y vuelve a abrir la página: tus respuestas se conservan. La página ya existe en español, inglés y francés; los botones están arriba.',
      action: 'Volver a abrir',
    },
    update: {
      title: 'Esta página no terminó de cargarse',
      body: 'Se acaba de publicar una nueva versión, o se cortó la conexión. Al volver a abrir la página se carga la última versión.',
      action: 'Volver a abrir',
    },
    generic: {
      title: 'Esta página se detuvo',
      body: 'Vuelve a abrir la página: tus respuestas se conservan. Si vuelve a pasar, envíanos la línea gris de abajo: nos dice dónde buscar.',
      action: 'Volver a abrir',
    },
  },
}

function uiLang(): 'fr' | 'en' | 'es' {
  const n = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return n === 'fr' || n === 'es' ? n : 'en'
}

export default class RecoveryBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error) {
    const kind = classifyError(error)
    console.error(`Page crashed (${kind}):`, error)
    // Sent whether or not we repair it. A crash the visitor never saw is still
    // worth knowing about: it is how we find out that page translation is
    // costing us clients, instead of hearing about it once by telephone.
    const willRecover = isSelfHealing(kind) && this.state.attempt < 1
    reportClientError(error, 'boundary', willRecover)
    // One silent retry, and only for the family a fresh mount actually fixes.
    // A translator rewrites the DOM at a moment of its choosing; if that moment
    // fell in the middle of a React update, rebuilding from scratch is enough
    // and the visitor never learns anything happened. If it crashes a second
    // time the translator is still at work, and no number of retries will win —
    // that is when the screen below has something useful to say.
    if (willRecover) {
      this.setState(s => ({ error: null, attempt: s.attempt + 1 }))
    }
  }

  render() {
    const { error, attempt } = this.state
    // The key is what makes the retry a real remount: same children, new tree,
    // new DOM. Reusing the old one would hand React back the nodes that moved.
    if (!error) return <Fragment key={attempt}>{this.props.children}</Fragment>

    const copy = COPY[uiLang()][bucketOf(classifyError(error))]
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-4xl">🌬️</p>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">{copy.title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{copy.body}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
          >
            {copy.action}
          </button>
          {/* Still there, still small: it is the only thing a guest on a shared
              link can read out to us over the phone. */}
          <p className="text-xs text-gray-400 dark:text-gray-500 break-words">{error.message}</p>
        </div>
      </div>
    )
  }
}
