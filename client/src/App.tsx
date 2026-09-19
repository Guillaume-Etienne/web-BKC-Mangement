import './index.css'
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Navigation from './components/layout/Navigation'
import RecoveryBoundary from './components/layout/RecoveryBoundary'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import { computePendingActions, splitDismissed } from './components/pending/pendingActions'
import type { PendingAction, Dismissal, Page } from './components/pending/pendingActions'
import type { Booking, Payment, Enquiry } from './types/database'
import type { EnquirySubmission } from './utils/enquiries'
import { isSettled, isQualified, lastSignOfEnquiry, silenceDays, submissionsByEnquiry, SILENCE_WARN_DAYS } from './utils/enquiries'
import { computeFollowUps } from './utils/followUps'
import type { FollowUp } from './utils/followUps'
import { LanguageProvider } from './contexts/LanguageContext'
import { DataErrorsProvider } from './contexts/DataErrorsContext'
import DataErrorBanner from './components/layout/DataErrorBanner'
import { useAdminLang } from './hooks/useAdminLang'

// Everything past the first screen is fetched when it is actually opened.
// Before this, one bundle held the whole app: a guest opening a taxi or client
// share link downloaded the booking wizard, the accounting screens and the
// management tabs to read a single page — on a phone, on the beach. And the
// admin downloaded all eight share pages they will never open. Login, Home and
// the navigation stay eager: they are the first paint, so splitting them would
// only add a flash.
const PlanningView              = lazy(() => import('./components/planning/PlanningView'))
const BookingsPage              = lazy(() => import('./pages/BookingsPage'))
const ClientsPage               = lazy(() => import('./pages/ClientsPage'))
const ManagementPage            = lazy(() => import('./pages/ManagementPage'))
const TaxiPage                  = lazy(() => import('./pages/TaxiPage'))
const EquipmentPage             = lazy(() => import('./pages/EquipmentPage'))
const DocumentsPage             = lazy(() => import('./pages/DocumentsPage'))
const AccountingPage            = lazy(() => import('./pages/AccountingPage'))
const ActivitiesPage            = lazy(() => import('./pages/ActivitiesPage'))
const RequestsPage              = lazy(() => import('./pages/RequestsPage'))
const ForecastSharePage         = lazy(() => import('./pages/ForecastSharePage'))
const TaxiSharePage             = lazy(() => import('./pages/TaxiSharePage'))
const ClientSharePage           = lazy(() => import('./pages/ClientSharePage'))
const DriverSharePage           = lazy(() => import('./pages/DriverSharePage'))
const TaxiManagerSharePage      = lazy(() => import('./pages/TaxiManagerSharePage'))
const ActivityProviderSharePage = lazy(() => import('./pages/ActivityProviderSharePage'))
const BookingFormPage           = lazy(() => import('./pages/BookingFormPage'))
const EnquiryFormPage           = lazy(() => import('./pages/EnquiryFormPage'))
const RestaurantSharePage       = lazy(() => import('./pages/RestaurantSharePage'))
// Not lazy: ⌘K must answer instantly, and a chunk fetched on first keystroke
// would make the palette feel broken on a bad connection.
import GlobalSearch from './components/common/GlobalSearch'
import type { SharedLink } from './types/database'

/** Shown while a page's chunk is on its way. Same look as the session check,
 *  so a slow connection reads as "still loading" rather than "broken". */
function PageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 dark:text-gray-400 text-lg">Loading…</div>
    </div>
  )
}

// Page lives in pendingActions.ts — one declaration for the whole app.

// ── Public share token from URL (sync, module scope) ──────────────────────
const shareToken = new URLSearchParams(window.location.search).get('share')

// ────────────────────────────────────────────────────────────────────────────

function App() {
  // Owned here, not inside LanguageProvider: computePendingActions (below)
  // bakes the messages' language in at compute time, before the provider
  // even mounts, so it needs the same value the provider hands down — one
  // state, passed both ways, rather than two independent copies drifting.
  const { lang, setLang } = useAdminLang()
  const [session,     setSession]     = useState<Session | null | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [pendingEditBookingId, setPendingEditBookingId] = useState<string | null>(null)
  // Where ⌘K sends you: the page changes AND the row opens, otherwise the
  // palette drops you on a list and the search has to be done twice.
  const [pendingClientId, setPendingClientId] = useState<string | null>(null)
  const [pendingEnquiryId, setPendingEnquiryId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  // undefined = still checking, null = not found / no token
  const [sharedLink, setSharedLink]   = useState<SharedLink | null | undefined>(
    shareToken ? undefined : null
  )
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  // Les affaires classées : ce que gui a vu et traite ailleurs. Séparé des
  // alertes exprès — elles sont recalculées à chaque navigation, la liste des
  // classements ne bouge qu'ici, quand on clique.
  const [dismissals, setDismissals] = useState<Dismissal[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])

  // ⌘K / Ctrl-K opens the palette from anywhere. Bound on the window rather
  // than on a field so it works while a list is scrolled or a drawer is open.
  // Only while logged in: a guest on a share page has no palette, and stealing
  // their browser shortcut to open nothing would be pure loss.
  useEffect(() => {
    if (!session) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    // Listen for sign in / sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load pending actions — refreshed on login and on every page navigation
  const refreshPendingActions = useCallback(() => {
    if (!session) return
    Promise.all([
      supabase.from('bookings').select('*, client:clients(first_name, last_name)'),
      supabase.from('payments').select('id, booking_id, date, is_verified, is_discount'),
      supabase.from('taxi_trips').select('booking_id'),
      // Rows, not a head count: the same read now answers two questions — how
      // many forms are waiting, and which enquiry each one came from. Without
      // the second, a person who filled the whole form yesterday still showed up
      // as weeks of silence (utils/enquiries.ts, submissionsByEnquiry).
      supabase.from('form_submissions').select('id, status, submitted_at, payload').eq('status', 'pending'),
      // Whole rows rather than counts: "unqualified" and "silent" are decided in
      // one place, utils/enquiries.ts, and duplicating either as a SQL filter
      // here would let the Home page and the Requests table disagree.
      supabase.from('enquiries').select('id, name, status, party_size, arrival_month, wants_lessons, wants_rental, wants_accommodation, last_contact_at, crm_error'),
      supabase.from('email_logs').select('booking_id, type, status, sent_at, created_at'),
    ]).then(([{ data: bookings }, { data: payments }, { data: taxis }, { data: submissions }, { data: enquiries }, { data: emailLogs }]) => {
      const bkgs = (bookings ?? []) as Booking[]
      const pmts = (payments ?? []) as Payment[]
      const enqs = (enquiries ?? []) as Enquiry[]
      const subs = (submissions ?? []) as EnquirySubmission[]
      const formByEnquiry = submissionsByEnquiry(subs)
      const unlinked = (taxis ?? []).filter((t: { booking_id: string | null }) => !t.booking_id).length
      const open = enqs.filter(e => !isSettled(e.status))
      setPendingActions(computePendingActions({
        bookings: bkgs, payments: pmts,
        taxiTripUnlinkedCount: unlinked,
        pendingFormSubmissionsCount: subs.length,
        unqualifiedEnquiriesCount: open.filter(e => !isQualified(e)).length,
        // Same rule as the Requests table and the follow-up list: a returned
        // form counts as news, so nobody is chased for a silence they ended.
        silentEnquiriesCount: open.filter(e =>
          silenceDays(lastSignOfEnquiry(e, formByEnquiry.get(e.id))) >= SILENCE_WARN_DAYS).length,
        crmFailedCount: enqs.filter(e => !!e.crm_error).length,
        emailLogs: (emailLogs ?? []) as { booking_id: string; type: string; status: string }[],
      }, lang))
      // Same rows, second question: not "what falls due soon" but "who has been
      // left hanging". Costs no extra query on purpose — a follow-up list that
      // slowed the Home page down would be turned off within a week.
      setFollowUps(computeFollowUps({
        enquiries: enqs,
        bookings: bkgs,
        touch: {
          payments: (payments ?? []) as { booking_id: string; date: string }[],
          emails: (emailLogs ?? []) as { booking_id: string; sent_at?: string | null; created_at?: string | null }[],
        },
        formByEnquiry,
      }, new Date(), lang))
    })
  }, [session, lang])

  useEffect(() => { refreshPendingActions() }, [refreshPendingActions])

  // ── Affaire classée ───────────────────────────────────────────────────────
  // Une seule lecture par session : rien d'autre que cet écran n'écrit dans la
  // table, et les deux boutons mettent l'état à jour sans attendre le serveur.
  // `data ?? []` n'est pas de la prudence gratuite : tant que la migration
  // 2026-09-19b n'est pas passée sur la base, la requête répond une erreur —
  // la page d'accueil doit s'afficher quand même, simplement sans classement.
  const loadDismissals = useCallback(() => {
    if (!session) return
    supabase.from('dismissed_actions').select('dismiss_key, up_to_count')
      .then(({ data }) => setDismissals((data ?? []) as Dismissal[]))
  }, [session])

  useEffect(() => { loadDismissals() }, [loadDismissals])

  const closeAction = useCallback(async (a: PendingAction) => {
    setDismissals(ds => [
      ...ds.filter(d => d.dismiss_key !== a.dismissKey),
      { dismiss_key: a.dismissKey, up_to_count: a.dismissCount ?? null },
    ])
    const { error } = await supabase.from('dismissed_actions').upsert({
      dismiss_key: a.dismissKey,
      up_to_count: a.dismissCount ?? null,
      dismissed_at: new Date().toISOString(),
    }, { onConflict: 'dismiss_key' })
    // On remet la ligne en haut plutôt que de laisser croire qu'elle est rangée :
    // une alerte masquée par erreur est pire que pas de bouton du tout.
    if (error) { loadDismissals(); alert('Could not file this one — ' + error.message) }
  }, [loadDismissals])

  const reopenAction = useCallback(async (a: PendingAction) => {
    setDismissals(ds => ds.filter(d => d.dismiss_key !== a.dismissKey))
    const { error } = await supabase.from('dismissed_actions').delete().eq('dismiss_key', a.dismissKey)
    if (error) { loadDismissals(); alert('Could not reopen this one — ' + error.message) }
  }, [loadDismissals])

  useEffect(() => {
    if (!shareToken) return
    // anon has no SELECT on shared_links (token enumeration) — resolution goes
    // through the resolve_share_token() RPC, which needs the exact token.
    supabase
      .rpc('resolve_share_token', { p_token: shareToken })
      .maybeSingle()
      .then(({ data }) => setSharedLink((data as SharedLink | null) ?? null))
  }, [])

  // Still checking share token
  if (sharedLink === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-400 text-lg">Loading…</div>
      </div>
    )
  }

  // Public share pages — no auth required
  if (sharedLink) {
    const sharePage =
      sharedLink.type === 'forecast'          ? <ForecastSharePage /> :
      sharedLink.type === 'taxi'              ? <TaxiSharePage /> :
      sharedLink.type === 'client'            ? <ClientSharePage bookingNumber={parseInt(sharedLink.params?.booking_number ?? '0')} /> :
      sharedLink.type === 'driver'            ? <DriverSharePage driverId={sharedLink.params?.driver_id ?? ''} /> :
      sharedLink.type === 'taxi_manager'      ? <TaxiManagerSharePage /> :
      sharedLink.type === 'activity_provider' ? <ActivityProviderSharePage providerId={sharedLink.params?.provider_id ?? ''} /> :
      // `enquiry_id` (+ name/email/phone/language snapshot) is present only on
      // a link generated from an enquiry — see EnquiryPanel.createFormLink.
      sharedLink.type === 'booking_form'      ? <BookingFormPage
                                                    enquiryId={sharedLink.params?.enquiry_id}
                                                    targetBookingId={sharedLink.params?.target_booking_id}
                                                    prefillName={sharedLink.params?.name}
                                                    prefillEmail={sharedLink.params?.email}
                                                    prefillPhone={sharedLink.params?.phone}
                                                    prefillLang={sharedLink.params?.language}
                                                  /> :
      sharedLink.type === 'enquiry_form'      ? <EnquiryFormPage /> :
      sharedLink.type === 'restaurant'        ? <RestaurantSharePage /> :
      null
    // An unknown type falls through to the normal app, exactly as before.
    if (sharePage) return (
      <RecoveryBoundary>
        <Suspense fallback={<PageLoading />}>{sharePage}</Suspense>
      </RecoveryBoundary>
    )
  }

  // Loading session
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-400 text-lg">Loading…</div>
      </div>
    )
  }

  // Not authenticated
  if (session === null) {
    return <LoginPage />
  }

  // Une affaire classée quitte le haut de la page ET les compteurs de la barre
  // de navigation : un badge rouge qui compte une ligne rangée plus bas
  // enverrait chercher quelque chose d'introuvable.
  const { open: openActions, closed: closedActions } = splitDismissed(pendingActions, dismissals)

  // Authenticated
  return (
    <LanguageProvider lang={lang} setLang={setLang}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navigation currentPage={currentPage} onNavigate={(p) => { setCurrentPage(p); refreshPendingActions() }} onLogout={() => supabase.auth.signOut()} urgentCount={openActions.filter(a => a.priority === 'urgent').length} submissionsCount={openActions.filter(a => a.id === 'pending-submissions' || a.id === 'unqualified-enquiries').reduce((n, a) => n + (parseInt(a.message) || 0), 0)} />
        {/* Le fournisseur n'enveloppe QUE l'app admin : le bandeau nomme des
            tables et rend le message brut de Postgres. Les pages partagées, plus
            haut dans ce fichier, gardent le contexte inerte par défaut. */}
        <DataErrorsProvider>
        <main className="w-full">
          <DataErrorBanner />
          <RecoveryBoundary>
            <Suspense fallback={<PageLoading />}>
              {currentPage === 'home'       && (
                <HomePage
                  onNavigate={setCurrentPage}
                  pendingActions={openActions}
                  closedActions={closedActions}
                  onCloseAction={closeAction}
                  onReopenAction={reopenAction}
                  followUps={followUps}
                  onOpenFollowUp={(f) => {
                    if (f.kind === 'enquiry') { setPendingEnquiryId(f.targetId); setCurrentPage('requests') }
                    else { setPendingEditBookingId(f.targetId); setCurrentPage('bookings') }
                  }}
                />
              )}
              {currentPage === 'planning'   && <PlanningView onOpenBooking={(id) => { setPendingEditBookingId(id); setCurrentPage('bookings') }} />}
              {currentPage === 'bookings'   && <BookingsPage initialEditBookingId={pendingEditBookingId} onEditOpened={() => setPendingEditBookingId(null)} />}
              {currentPage === 'clients'    && <ClientsPage onNavigate={setCurrentPage} initialClientId={pendingClientId} onClientOpened={() => setPendingClientId(null)} />}
              {currentPage === 'management' && <ManagementPage />}
              {currentPage === 'equipment'  && <EquipmentPage />}
              {currentPage === 'taxis'      && <TaxiPage />}
              {currentPage === 'documents'  && <DocumentsPage />}
              {currentPage === 'accounting' && <AccountingPage onOpenBooking={(id) => { setPendingEditBookingId(id); setCurrentPage('bookings') }} />}
              {currentPage === 'activities' && <ActivitiesPage />}
              {currentPage === 'requests'   && <RequestsPage initialEnquiryId={pendingEnquiryId} onEnquiryOpened={() => setPendingEnquiryId(null)} />}
            </Suspense>
          </RecoveryBoundary>
        </main>
        </DataErrorsProvider>

        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onGo={(t) => {
            if (t.kind === 'client')  { setPendingClientId(t.id);     setCurrentPage('clients') }
            if (t.kind === 'booking') { setPendingEditBookingId(t.id); setCurrentPage('bookings') }
            if (t.kind === 'enquiry') { setPendingEnquiryId(t.id);    setCurrentPage('requests') }
          }}
        />
      </div>
    </LanguageProvider>
  )
}

export default App
