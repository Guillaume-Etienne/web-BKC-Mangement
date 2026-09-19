import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { i18n } from '../data/i18n'
import type { PendingAction, Page } from '../components/pending/pendingActions'
import type { FollowUp } from '../utils/followUps'
import type { Lang } from '../types/database'

function getPriorityStyles(lang: Lang): Record<string, { bg: string; border: string; dot: string; label: string }> {
  return {
    urgent:  { bg: 'bg-red-50 dark:bg-red-950/40',    border: 'border-red-200 dark:border-red-900',    dot: 'bg-red-500',    label: i18n.pages.status_urgent[lang] },
    week:    { bg: 'bg-amber-50 dark:bg-amber-950/40',  border: 'border-amber-200 dark:border-amber-900',  dot: 'bg-amber-400',  label: i18n.common.period_week[lang] },
    monitor: { bg: 'bg-green-50 dark:bg-green-950/40',  border: 'border-green-200 dark:border-green-900',  dot: 'bg-green-500',  label: i18n.pages.priority_monitor[lang] },
  }
}

interface HomePageProps {
  onNavigate: (page: Page) => void
  /** Ce qui reste à regarder — les affaires classées en sont déjà retirées. */
  pendingActions?: PendingAction[]
  /** Vu, et traité ailleurs. Toujours vrai dans les données : ces lignes sont
   *  recalculées comme les autres, et disparaissent d'elles-mêmes le jour où la
   *  situation se règle pour de bon. */
  closedActions?: PendingAction[]
  onCloseAction?: (a: PendingAction) => void
  onReopenAction?: (a: PendingAction) => void
  /** Who has been waiting, longest first — see utils/followUps.ts. */
  followUps?: FollowUp[]
  /** Opens the person's file / the booking, rather than dropping gui on a list. */
  onOpenFollowUp?: (f: FollowUp) => void
}

interface Shortcut {
  page: Page
  icon: string
  label: string
  description: string
}

function getShortcuts(lang: Lang): Shortcut[] {
  return [
    { page: 'planning',   icon: '📅',  label: i18n.nav.nav_planning[lang],   description: 'Booking plan' },
    { page: 'bookings',   icon: '📋',  label: i18n.nav.nav_bookings[lang],   description: 'Manage bookings' },
    { page: 'accounting', icon: '💰',  label: i18n.nav.nav_accounting[lang], description: 'Revenue & payments' },
    { page: 'equipment',  icon: '🎿',  label: i18n.nav.nav_equipment[lang],  description: 'Gear & rentals' },
    { page: 'taxis',      icon: '🚕',  label: i18n.nav.nav_taxis[lang],      description: 'Transfers & drivers' },
    { page: 'activities', icon: '🏕️', label: i18n.nav.nav_activities[lang], description: 'External providers' },
  ]
}

export default function HomePage({ onNavigate, pendingActions = [], closedActions = [], onCloseAction, onReopenAction, followUps = [], onOpenFollowUp }: HomePageProps) {
  const { lang } = useLanguage()
  const PRIORITY_STYLES = getPriorityStyles(lang)
  const SHORTCUTS = getShortcuts(lang)
  const urgentCount = pendingActions.filter(a => a.priority === 'urgent').length
  // Fermé par défaut, et pas mémorisé : l'accordéon est une archive qu'on va
  // consulter, pas un deuxième écran de travail qui reprendrait la place gagnée.
  const [showClosed, setShowClosed] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-indigo-100 dark:to-indigo-900/30">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-16">
        {/* Header */}
        <div className="text-center mb-6 md:mb-16">
          <h1 className="text-2xl md:text-5xl font-bold text-gray-800 dark:text-gray-200 mb-1 md:mb-4">
            🏄 BKC-Management
          </h1>
          <p className="text-sm md:text-xl text-gray-600 dark:text-gray-400 hidden sm:block">
            Manage everything from here: reservations, planning, clients and more!
          </p>
        </div>

        {/* Ce qui reste à faire — et ce qui n'en est plus.
            Une ligne peut être vraie dans les données et fausse pour gui : le
            guide de voyage parti par WhatsApp, l'acompte reçu en main propre.
            « Case closed » ne touche à aucune donnée, elle range la ligne dans
            l'accordéon du bas (table `dismissed_actions`) ; l'alerte remonte
            d'elle-même si le sujet change — voir dismissKey / dismissCount. */}
        {(pendingActions.length > 0 || closedActions.length > 0) && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{i18n.pages.section_pending[lang]}</h2>
              {urgentCount > 0 && (
                <span className="bg-red-500 text-white text-sm font-bold rounded-full px-2 py-0.5">
                  {urgentCount} {i18n.pages.status_urgent[lang]}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {pendingActions.map(action => {
                const style = PRIORITY_STYLES[action.priority]
                return (
                  <div
                    key={action.id}
                    className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg border ${style.bg} ${style.border}`}
                  >
                    <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${style.dot}`} />
                    <span className="hidden sm:inline flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {style.label}
                    </span>
                    {action.bookingRef && (
                      <span className="flex-shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-300">{action.bookingRef}</span>
                    )}
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">{action.message}</span>
                    <button
                      onClick={() => onNavigate(action.route)}
                      className="flex-shrink-0 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400 whitespace-nowrap"
                    >
                      {action.routeLabel} →
                    </button>
                    {onCloseAction && (
                      <button
                        onClick={() => onCloseAction(action)}
                        title={i18n.pages.btn_case_closed[lang]}
                        aria-label={i18n.pages.btn_case_closed[lang]}
                        className="flex-shrink-0 rounded-md border border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-200 whitespace-nowrap"
                      >
                        <span className="md:hidden">✓</span>
                        <span className="hidden md:inline">✓ {i18n.pages.btn_case_closed[lang]}</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Tout est classé : le dire, sinon le titre « Pending » surplombe
                un vide qui ressemble à un écran cassé. */}
            {pendingActions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{i18n.pages.msg_all_filed[lang]}</p>
            )}

            {closedActions.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowClosed(v => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span className="text-xs">{showClosed ? '▾' : '▸'}</span>
                  {i18n.pages.section_closed_cases[lang]}
                  <span className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs tabular-nums">{closedActions.length}</span>
                </button>
                {showClosed && (
                  <>
                    <p className="mt-2 mb-2 text-xs text-gray-500 dark:text-gray-400">{i18n.pages.desc_closed_cases[lang]}</p>
                    <div className="space-y-2">
                      {closedActions.map(action => (
                        <div
                          key={action.id}
                          className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50"
                        >
                          <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-700" />
                          {action.bookingRef && (
                            <span className="flex-shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-400">{action.bookingRef}</span>
                          )}
                          <span className="flex-1 min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">{action.message}</span>
                          <button
                            onClick={() => onNavigate(action.route)}
                            className="hidden sm:inline flex-shrink-0 text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap"
                          >
                            {action.routeLabel} →
                          </button>
                          {onReopenAction && (
                            <button
                              onClick={() => onReopenAction(action)}
                              className="flex-shrink-0 rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-200 whitespace-nowrap"
                            >
                              ↩ {i18n.pages.btn_reopen[lang]}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Waiting on you — silence, not deadlines.
            The block above speaks in dates (check-in in N days, visa in N days);
            this one answers the other question: who has been left hanging, and
            what did they want? A prospect and a booking that never got
            confirmed sit in the same list, because from the person's side there
            is no difference — they are both waiting for gui. */}
        {followUps.length > 0 && (
          <div className="mb-10">
            <div className="flex items-baseline gap-3 mb-1">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{i18n.pages.section_follow[lang]}</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {followUps.length} {followUps.length > 1 ? 'people' : 'person'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Nobody has spoken to them in a while — enquiries and bookings that never got confirmed.
            </p>
            <div className="space-y-2">
              {followUps.map(f => (
                <button
                  key={f.id}
                  onClick={() => onOpenFollowUp?.(f)}
                  className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg border transition-colors ${
                    f.tone === 'urgent'
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="flex-shrink-0 text-base">{f.kind === 'enquiry' ? '📣' : '📋'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {f.name}
                      {f.when && <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">{f.when}</span>}
                    </span>
                    <span className="block text-xs text-gray-600 dark:text-gray-400 truncate">{f.wants}</span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">{f.reason}</span>
                  </span>
                  <span className={`flex-shrink-0 text-sm font-bold tabular-nums ${
                    f.silenceDays >= 14 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {f.silenceDays}d
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-8">
          {SHORTCUTS.map(s => (
            <button
              key={s.page}
              onClick={() => onNavigate(s.page)}
              className="group bg-white dark:bg-gray-900 rounded-xl shadow-lg hover:shadow-xl transition-all p-4 md:p-8 text-left flex flex-col"
            >
              <div className="text-3xl md:text-5xl mb-1 md:mb-4">{s.icon}</div>
              <h2 className="text-base md:text-2xl font-bold text-gray-800 dark:text-gray-200 mb-0.5 md:mb-3">{s.label}</h2>
              <p className="hidden md:block text-gray-600 dark:text-gray-400 mb-4">
                {s.description}
              </p>
              <div className="hidden md:inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold group-hover:gap-2 transition-all">
                Open <span className="ml-1">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
