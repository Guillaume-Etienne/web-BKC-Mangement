/** The Options navigation: 4 groups, one screen per entry.
 *
 *  Was a single row of 9 tabs that scrolled sideways (half hidden on a phone)
 *  with no order to it. Now a sidebar on desktop and one grouped <select> on
 *  mobile. The screen lives in the address as `?tab=pricing` so a bookmark or a
 *  phone shortcut can open it directly; it is written with replaceState, so the
 *  Back button still leaves Options instead of walking through every tab. */

export type OptionsTab =
  | 'instructors' | 'houses' | 'seasons'
  | 'pricing' | 'agencies'
  | 'sources' | 'links'
  | 'language' | 'database' | 'usage' | 'errors'

interface Group { title: string; items: { id: OptionsTab; label: string }[] }

export const OPTIONS_GROUPS: Group[] = [
  { title: 'Center', items: [
    { id: 'instructors', label: '📚 Instructors' },
    { id: 'houses',      label: '🏠 Accommodations' },
    { id: 'seasons',     label: '📆 Seasons' },
  ] },
  { title: 'Money', items: [
    { id: 'pricing',  label: '💰 Pricing' },
    { id: 'agencies', label: '🤝 Agencies' },
  ] },
  { title: 'Marketing', items: [
    { id: 'sources', label: '📣 Sources' },
    { id: 'links',   label: '🔗 Shared Links' },
  ] },
  { title: 'System', items: [
    { id: 'language', label: '🌐 Language' },
    { id: 'usage',    label: '📊 Usage' },
    { id: 'errors',   label: '🐞 Visitor errors' },
    { id: 'database', label: '🗄️ Database' },
  ] },
]

const ALL_TABS: OptionsTab[] = OPTIONS_GROUPS.flatMap(g => g.items.map(i => i.id))

export function isOptionsTab(v: string | null): v is OptionsTab {
  return !!v && (ALL_TABS as string[]).includes(v)
}

/** The screen named by `?tab=…`, or the first one. */
export function tabFromUrl(search: string): OptionsTab {
  const v = new URLSearchParams(search).get('tab')
  return isOptionsTab(v) ? v : 'instructors'
}

/** Keeps the address in step with the screen. Other query parameters are kept. */
export function writeTabToUrl(tab: OptionsTab): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState(window.history.state, '', url)
  } catch { /* an address that cannot be rewritten is not worth an error */ }
}

interface Props { tab: OptionsTab; onChange: (t: OptionsTab) => void }

export default function OptionsMenu({ tab, onChange }: Props) {
  return (
    <>
      {/* Phone / narrow: one grouped selector, pinned under the top bar. */}
      <div className="lg:hidden sticky top-16 z-40 bg-gray-50 dark:bg-gray-950 pb-3 mb-1">
        <select
          value={tab}
          onChange={e => onChange(e.target.value as OptionsTab)}
          aria-label="Options section"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-3 py-2.5 text-base font-medium">
          {OPTIONS_GROUPS.map(g => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Desktop: sidebar, always fully visible. */}
      <nav aria-label="Options" className="hidden lg:block w-52 shrink-0 sticky top-20 self-start space-y-5">
        {OPTIONS_GROUPS.map(g => (
          <div key={g.title}>
            <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{g.title}</div>
            <div className="space-y-0.5">
              {g.items.map(i => (
                <button key={i.id} onClick={() => onChange(i.id)}
                  aria-current={tab === i.id ? 'page' : undefined}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === i.id
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}>
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  )
}
