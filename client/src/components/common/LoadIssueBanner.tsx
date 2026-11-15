// What a share page says when some of its reads failed (see utils/shareLoad.ts).
// Public pages: no admin i18n here, each page passes its own language code.

type IssueLang = 'fr' | 'en' | 'es' | 'pt'

const TEXT: Record<IssueLang, { partial: string; failed: string; reload: string }> = {
  fr: {
    partial: 'Une partie des informations n’a pas pu être chargée (connexion ?). Les montants affichés peuvent être incomplets.',
    failed: 'Impossible de charger cette page pour le moment. Vérifiez votre connexion, puis rechargez.',
    reload: 'Recharger',
  },
  en: {
    partial: 'Some information could not be loaded (connection?). The amounts shown may be incomplete.',
    failed: 'This page could not be loaded right now. Check your connection, then reload.',
    reload: 'Reload',
  },
  es: {
    partial: 'Parte de la información no se pudo cargar (¿conexión?). Los importes mostrados pueden estar incompletos.',
    failed: 'No se pudo cargar esta página por ahora. Compruebe su conexión y vuelva a cargar.',
    reload: 'Recargar',
  },
  pt: {
    partial: 'Algumas informações não puderam ser carregadas (ligação?). Os valores mostrados podem estar incompletos.',
    failed: 'Não foi possível carregar esta página agora. Verifique a ligação e recarregue.',
    reload: 'Recarregar',
  },
}

const textFor = (lang: string) => TEXT[(lang in TEXT ? lang : 'en') as IssueLang]

const reload = () => window.location.reload()

/** Above the content: the page is shown, but something is missing from it. */
export function LoadIssueBanner({ lang }: { lang: string }) {
  const t = textFor(lang)
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
      <span className="flex-1 min-w-0">⚠️ {t.partial}</span>
      <button type="button" onClick={reload}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold">
        {t.reload}
      </button>
    </div>
  )
}

/** Instead of the page: its main read failed — never "not found", which would
 *  tell a guest their link is dead when only the network was. */
export function LoadFailedScreen({ lang }: { lang: string }) {
  const t = textFor(lang)
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div role="alert" className="max-w-sm text-center space-y-4">
        <p className="text-gray-600 dark:text-gray-300">⚠️ {t.failed}</p>
        <button type="button" onClick={reload}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
          {t.reload}
        </button>
      </div>
    </div>
  )
}
