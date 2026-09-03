# Pages Reference
> Toutes les pages dans `client/src/pages/`
> Routing dans `client/src/App.tsx`

---

## Logique de routing (`App.tsx`)

1. `?share=<token>` dans l'URL → vérifie `shared_links` → affiche page publique (sans auth)
2. `session === undefined` → spinner de chargement
3. `session === null` → `LoginPage`
4. `session` → app authentifiée avec `Navigation` + page switcher
5. Au login : charge en parallèle `bookings` (+ join client), `payments` (4 colonnes), `taxi_trips` (booking_id seul), **count `form_submissions` `pending`** → calcule `pendingActions` via `computePendingActions()` → passe `urgentCount` + **`submissionsCount`** à `Navigation`, `pendingActions` à `HomePage`

**Pages publiques (SharedLinkType) :** → réf. complète + runbooks dans **`taxi-and-shares.md`**
| type | Composant | Props |
|------|-----------|-------|
| `'forecast'` | `ForecastSharePage` | — |
| `'taxi'` | `TaxiSharePage` | — (Public Taxi Schedule, PT/EN, places libres) |
| `'client'` | `ClientSharePage` | `bookingNumber` depuis `sharedLink.params.booking_number` |
| `'driver'` | `DriverSharePage` | `driverId` depuis `sharedLink.params.driver_id` (PT/EN) |
| `'taxi_manager'` | `TaxiManagerSharePage` | — (Geraldo, PT/EN, finances + tous trajets managés) |
| `'activity_provider'` | `ActivityProviderSharePage` | `providerId` depuis `sharedLink.params.provider_id` |
| `'booking_form'` | `BookingFormPage` | — (lien public unique, le client choisit sa langue) |
| `'restaurant'` | `RestaurantSharePage` | — (Hotel Restaurant Planning, PT/EN, timeline des séjours) |

**Pages authentifiées (type `Page`) :**
`'home' | 'planning' | 'bookings' | 'clients' | 'management' | 'taxis' | 'equipment' | 'documents' | 'accounting' | 'activities' | 'submissions'`

> ⚠️ Le type `Page` est dupliqué dans `App.tsx`, `pendingActions.ts` et `Navigation.tsx` (unions inline) → ajouter une nouvelle page = éditer les 3.

---

## Pages publiques

### `ForecastSharePage`
- **Accès :** `?share=<forecast_token>`
- **But :** Planning instructeurs + locations en lecture seule pour une date donnée
- **Hooks :** `useTable` pour lessons, rentals, instructors, clients, equipment
- **State :** `selectedDate` (défaut : demain), `mobileInstrIdx`
- **Layout :** Grille horaire 8:00–19:00 (30 min/slot, 36px), colonnes instructeurs, panel locations

### `TaxiSharePage`
- **Accès :** `?share=<taxi_token>`
- **But :** Planning taxi groupé par date, lecture seule
- **Hooks :** `useTable` pour TaxiTrip, TaxiDriver, Booking (avec join client)
- **State :** `showPast`, `filterDriver`
- **Layout :** Groupes date → cartes trip (type, client, bagages, statut)

### `ClientSharePage`
- **Accès :** `?share=<client_token>` où le token a `params.booking_number`
- **Props :** `{ bookingNumber: number }`
- **But :** Compte client (hébergement, services, paiements, solde)
- **Data :** Requêtes Supabase directes (booking → rooms → payments → consumptions)
- **Layout :** 4 sections : tableau hébergement, services, paiements, carte solde
- **Prix des chambres (C3, 2026-07-30)** : `booking_room_prices` (le prix figé) puis repli
  sur `getBaseNightlyRate()` — avant, une résa sans prix figé affichait **0 €/nuit** au
  client. Le repli lit `room_rates` en anon, ce qui n'est possible **qu'après** la migration
  `2026-07-30_rental_pricing_and_room_rates.sql` ; sans elle la requête revient vide et la
  page retombe sur l'ancien comportement (pas de crash).

### `DriverSharePage`
- **Accès :** `?share=<driver_token>` où le token a `params.driver_id`
- **Props :** `{ driverId: string }`
- **But :** Relevé conducteur (trips à venir + passés avec détails client)
- **Data :** `taxi_drivers` + `taxi_trips` avec join `booking:bookings(client:clients(first_name, last_name))`
- **Layout :** 3 KPI cards (Completed/Upcoming/Total MZN) + 2 tables de trips
- **Colonnes trips :** Date, Time, Route, Client name, Pax, Bags, Boards, Notes, Driver MZN

### `RestaurantSharePage`
- **Accès :** `?share=<restaurant_token>`
- **But :** Timeline mensuelle des séjours (qui part quand) pour la manager du restaurant de l'hôtel — encaisser les notes avant le départ
- **Hooks :** `useTable` bookings (select restreint : id, booking_number, check_in, check_out, status + join clients identité)
- **State :** `lang` (PT défaut/EN via `usePref`), `month` ('YYYY-MM')
- **Layout :** Bandeau « Próximas partidas » (3 jours), nav mois, timeline 1 ligne/booking (`CELL_W = 32`), barres vert/ambre par statut, cap foncé 🧳 = jour de départ, annulés exclus

### `ActivityProviderSharePage`
- **Accès :** `?share=<activity_provider_token>` où le token a `params.provider_id`
- **Props :** `{ providerId: string }`
- **But :** Relevé prestataire activités (planning + compta)
- **Data :** `activity_providers` + `activity_bookings` + `activity_payments`
- **Onglets :**
  - **Planning** (toujours visible) : bookings passés/futurs, filtre par année, prix visibles si `show_prices=true`
  - **Accounting** (seulement si `show_prices=true`) : bilan (center owes you / you owe us), lignes bookings avec flux, historique paiements
- **Filtres :** "All time" + boutons par année

### `BookingFormPage`
- **Accès :** `?share=<booking_form_token>` (un seul lien public permanent, créé dans Management → Links)
- **But :** Formulaire public d'inscription client (remplace l'import CSV). Le client crée une demande de réservation lui-même.
- **Langues :** trilingue **FR/EN/ES** — sélecteur de drapeaux en haut, défaut = langue navigateur (`detectLang()`). Tous les textes dans `data/formI18n.ts` (`tr.key[lang]`), waiver dans `data/waiver.ts`.
- **Wizard 5 étapes** (barre de progression avec kite 🪁, transitions CSS) :
  1. 👤 **Group** — nom référent, email, téléphone, **"how did you hear about us" = la liste
     déroulante `enquiry_sources`** (2026-09-03), la même que le formulaire de demande, + « Autre »
     et sa ligne libre. Lue en anon par le jeton de partage (`share_type() IS NOT NULL`, aucune
     policy à ajouter). **Pas posée du tout** quand le visiteur vient d'un lien personnalisé
     (`enquiryId`) : sa demande porte déjà la réponse. Le payload emporte le **libellé anglais**
     (`referral_source`, via `utils/referral.ts`) **et** l'id (`referral_source_id`).
  2. ✈️ **Trip** — nb nuits Bilene ; bloc **Arrivée** (date+heure vol Maputo + toggle transfert→Bilene + date/heure prise en charge si Oui) ; bloc **Départ** (date+heure vol retour + toggle transfert→aéroport + date/heure dépose si Oui). Le transfert se pré-remplit depuis le vol mais reste éditable.
  3. 🧳 **Logistics** — bagages, bagages kite, lits doubles, lits simples, assurance voyage
  4. 🪂 **Crew** — liste **dynamique** de voyageurs (prénom/nom/passeport)
  5. 🧾 **Finish** — contact d'urgence + waiver déroulant + case obligatoire
- **Validation par étape** (`canProceed`), submit désactivé tant que waiver non coché.
- **Submit :** `supabase.from('form_submissions').insert([...])` (status `pending`, `payload`=`BookingFormPayload` complet + colonnes dénormalisées `reference_name`/`email`/`num_travelers`/`arrival_date`). **PAS de `.select()`** (anon n'a pas de SELECT sur la table). Puis écran de fin 🎉.
- **Anti-spam (2026-07-06)** : honeypot `website` hors écran (pas `display:none`, `tabIndex=-1`) + refus des submits **<3 s** après chargement (`mountedAt` ref). Les deux tombent **silencieusement** sur l'écran de succès — zéro insert, zéro email Resend, le bot n'apprend rien. Kill switch = désactiver le lien.
- **Composants module-scope** (focus-safe) : `Field`, `Counter`, `YesNo`, `TravelerCard`.

---

## Pages authentifiées

### `LoginPage`
- **Affiché quand :** `session === null`
- **Auth :** `supabase.auth.signInWithPassword()`

### `HomePage`
- **Route :** `'home'`
- **Props :** `{ onNavigate; pendingActions?; followUps?; onOpenFollowUp? }`
- **But :** Page d'accueil + **deux** listes de travail, qui répondent à deux questions différentes.
- **Pending actions :** liste color-codée (🔴 urgent / 🟡 week / 🟢 monitor), chaque item a un lien vers la page concernée. Calculé dans `App.tsx` au login via `computePendingActions()` (`pendingActions.ts`). Parle en **échéances**.
- **« Waiting on you » (2026-09-03) :** demandes ouvertes **+ résas provisoires** triées par **silence**, avec « ce qu'ils veulent » sur chaque ligne. Calculé par `computeFollowUps()` (`utils/followUps.ts`) dans le même `.then()` que les pending actions — **sur les mêmes lignes, zéro requête de plus**. Un clic ouvre la demande (Requests) ou la résa (wizard).
- ⚠️ Les deux blocs sont complémentaires, pas redondants : **une échéance n'est pas un silence**. Le dossier qui s'est tu ne déclenche aucune règle d'échéance.

### `PlanningView` *(rendu comme page)*
- **Route :** `'planning'`
- **Fichier :** `components/planning/PlanningView.tsx`
- **Hooks :** useAccommodations, useRooms, useBookings, useBookingRooms, useBookingParticipants, useLessons, useDayActivities, useInstructors, useClients, useEquipment, useEquipmentRentals, **useBookingDrag, useTable<HouseRental>, useTable<PriceItem>**
- **State :** `seasonYear`, `currentTab: 'planning'|'lessons'|'now'|'forecast'`, drag state, **draftMoves (Map), showValidateModal, lessonView, weekStart**
- **Sub-tabs :**
  - `planning` → grille avec BookingBars (draggable)
  - `lessons` → `LessonWeekView`
  - `now` → `NowView` (dining events)
  - `forecast` → `ForecastView`
- **Mutations :**
  - **Drag/resize booking** → Draft mode with validation modal, then bulk apply
  - Lesson/activity/rental CRUD → direct Supabase
- **Important :** Drag operations use draft map, not direct updates. Validation modal before commit.

### `BookingsPage`
- **Route :** `'bookings'`
- **Hooks :** useClients, useBookings, useBookingRooms, **useBookingRoomPrices**, useBookingParticipants, useAccommodations, useRooms, **useTable<HouseRental>**, **useTaxiDrivers**
- **State :** `showWizard`, `wizardStep (1-6)` (not 0-5), `wizardData`, `editingBooking`, `selectedBooking`
- **Wizard steps (1-6):** 1. Client → 2. Stay → 3. Guests → 4. Transport → 5. KiteCenter → 6. Payment
- **Étape 1 — « How did you hear about us? » (2026-09-03) :** même liste `enquiry_sources` que les
  deux formulaires publics, + « Other » et sa ligne libre. Elle manquait, et c'était **la** raison
  pour laquelle la statistique d'origine affichait « Unknown » pour la majorité des clients.
  Écrit en deux temps : le libellé dans `referral_source` avec le reste, puis `source_id` par un
  **UPDATE séparé** — une statistique ne doit jamais pouvoir empêcher une réservation d'exister.
- **Origine (2026-09-03) :** la page lit `useTable<Enquiry>('enquiries')` en lecture seule.
  `originOf(bookingId)` = la demande dont la résa est issue (`enquiries.booking_id`) → pastille
  **📣** dans la liste (tableau desktop **et** cartes mobiles) et **`EnquiryOriginPanel`** en
  tête de l'étape 1 : message d'origine, qualification, notes datées. **Lecture seule** — les
  notes restent sur la demande, elles ne sont jamais recopiées.
- **Step 2 (Stay) :** Bandeau rouge si `check_in >= check_out` (Next désactivé). **Full house** = ligne de prix unique (défaut 100€, split 50/50 entre les 2 chambres en interne).
- **Step 3 (Guests) :** Gère `booking_participants` — delete-all + re-insert au save. Auto-ajoute le client principal si aucun participant saisi (nouveaux bookings).
- **Step 4 (Transport) :** Si taxi arrivée/départ coché → sélecteur **chauffeur optionnel** (`taxi_driver_id`). Pré-assigne le chauffeur + ses `default_*` aux trajets auto-créés. Nouveaux bookings uniquement.
- **Step 5 (KiteCenter) :** Si `num_center_access > 0` → champ **tarif center access** (`center_access_rate`, €/jour, défaut 5).
- **Save (nouveaux bookings, isNew=true) :**
  1. Upsert client → upsert booking → delete+insert `booking_participants` → delete+insert booking_rooms → delete+insert booking_room_prices
  2. Si `amount_paid > 0` → insert `payments` (`method:'transfer'`, `is_verified:false`, note "Auto-created…")
  3. Trajets taxi : si chauffeur pré-assigné → trajets avec ses tarifs + statut `confirmed` ; sinon prix 0 + statut `needs_details`. `taxi_arrival` → `aero-to-center`@check_in ; `taxi_departure` → `center-to-aero`@check_out

### `ClientsPage`
- **Route :** `'clients'`
- **Props :** `{ onNavigate, initialClientId?, onClientOpened? }` — les deux derniers sont la
  cible de ⌘K : la fiche s'ouvre toute seule, puis la demande est rendue au parent.
- **Hooks :** useClients, useBookings, useBookingParticipants, useLessons, **useClientDossier**
- **State :** `searchTerm`, `filterLevel`, `filterNationality`, `filterSeasonId`, `selectedClient`, `detailTab`
- **Features :** Recherche/filtres, **tiroir = le dossier de la personne**. (Import CSV supprimé 2026-07-06 — remplacé par le formulaire public.)
- **Onglets du tiroir (2026-09-03) :** `Timeline` (défaut) · `Info` · `Bookings`
  - **`Timeline`** → `components/clients/ClientTimeline` : tout ce qui est arrivé à cette
    personne dans une seule colonne (demande + message d'origine, notes datées des **deux**
    tables, soumissions, résas, séjours, paiements, documents envoyés, transferts, activités),
    plus le **champ de note unique** en haut et un « Last activity X days ago ».
  - ⚠️ **`Bookings` lit `payments`**, plus `bookings.amount_paid` (cache non fiable), et
    **affiche l'argent non vérifié à part** au lieu de l'additionner.

### `TaxiPage`
- **Route :** `'taxis'`
- **Hooks :** useTaxiTrips, useTaxiDrivers, useBookingParticipants, useTable<BookingRef>, useTable<TaxiPricingDefaults>, useTable<SharedLink>, **useTable<TaxiManagerPayment>**
- **State :** `tab: 'planning'|'finance'|'drivers'`, `planningView: 'kanban'|'list'`, `viewingDriverId`
- **Onglets :**
  - `planning` → Kanban/List views for trip management
  - `finance` → Manager payment history and summaries
  - `drivers` → Grid de cartes → sélection → `DriverStatementPanel`. Form chauffeur inclut les **tarifs par défaut** (`default_price_eur` / `default_driver_mzn` / `default_manager_mzn`).
- **DriverStatementPanel :** trips passés/à venir, KPIs MZN, section share link (génère `shared_link` type `'driver'`, params `{ driver_id }`)
- **Modèle financier :** Client paie `price_eur` (EUR fixe par trajet), driver `price_driver_mzn`, manager `margin_manager_mzn` (MZN). **Taux UNIQUE GLOBAL** (`taxi_pricing_defaults.eur_mzn_rate`, réglé dans Management) — plus de taux par trajet. Marge centre affichée par trajet (`computeTaxiMarginEur`). Plus de bandeau migration `schemaOutdated`.

### `EquipmentPage`
- **Route :** `'equipment'`
- **Hooks :** useEquipment, useEquipmentRentals
- **Features :** Inventaire, badges condition, compteur usage, CRUD

### `DocumentsPage`
- **Route :** `'documents'`
- **Hooks :** useBookings, useBookingRooms, useBookingParticipants, useRooms, useAccommodations, useDocumentSections('travel_guide') + ('welcome_guide')
- **State :** `tab: 'overview'|'visa'|'summary'|'guide'|'welcome'|'templates'`, `guideSections`/`welcomeSections` (copies de travail nullables, init depuis DB), `templatesDoc: 'travel'|'welcome'`, `emailLogs`, `logsRefresh`, `sending: EmailLogType|null`, + le state propre à Overview (`overviewSearch`, `overviewLang`, `selectedCells`, `overviewLogs`, `bulkBusy`)
- **Onglets :**
  - `'overview'` ⭐ **(onglet par défaut, et le vrai plan de travail — absent de cette doc jusqu'au 2026-09-03)** :
    **une ligne par réservation active, une colonne par document** (`DOC_TYPES` : Confirmation,
    Visa Letter, Travel Guide, Welcome Guide, **Client Account**, **Update Form**). On coche des
    cellules puis on **envoie en lot** ou on **marque comme envoyé** (`bulkBusy` porte la
    progression). L'état de chaque cellule vient du **dernier `email_log`** de ce couple
    (booking, type) — `overviewLogs` est trié du plus récent, le premier vu gagne.
    - `client_account` / `update_form` **créent leur lien à la première utilisation** (👁 ouvre,
      ⧉ copie) ; un lien désactivé propose « ⚠ Reactivate ».
    - **« ⚠ no email on file »** sous le nom quand le client n'a pas d'adresse — l'envoi en lot
      ne peut rien pour lui, et le dire dans la grille évite un échec silencieux.
    - Langue FR/EN/ES pour Confirmation / Travel / Welcome ; **la lettre de visa est toujours en
      portugais** (c'est l'administration qui la lit).
    - Ne liste que `activeBookings` : pour une résa passée, passer par les onglets dédiés.
  - `'visa'` → lettre visa (portugais) : sélecteur booking, aperçu dates/guests, Generate PDF + Send email
  - `'summary'` → confirmation réservation : booking, langue (FR/EN/ES), Generate PDF + Send email. **Aucun montant estimé** (retiré le 2026-08-02, demande gui) : le document ne mentionne que `amount_paid`, pas de total ni de solde — c'étaient des estimations qui bougeaient encore et qu'un client lit comme un devis. Le retrait a supprimé avec elles l'input « Estimated total » et un `useEffect` de 11 requêtes parallèles.
  - `'guide'` → guide voyage (avant le séjour) : toggles sections + édition, SaveBar, envoi standalone (PDF + email)
  - `'welcome'` → **Welcome Guide** (infos sur place : wifi, repas, eau, élec, programme…) : même structure que `'guide'`, type email `welcome_guide`
  - `'templates'` → éditeur contenu de base (toutes langues) avec **switcher Travel/Welcome**, SaveBar, 3 boutons Preview PDF (FR/EN/ES)
- **Sauvegarde templates (depuis 2026-07-09) :** DB `document_templates` via `useDocumentSections` — édition en brouillon local, **bouton Save explicite** (SaveBar : dirty par comparaison JSON avec `saved`, Cancel = retour au dernier état sauvé). Si table vide (`saved === null`) : fallback localStorage legacy `bkc_guide_sections` (travel) ou `defaultWelcomeGuideSections` (welcome) + bandeau « Not stored in the database yet » ; le premier Save sème la table.
- **PDF :**
  - `printVisaLetter(booking, participants)`
  - `printBookingSummary(booking, rooms, lang, sections, participants)`
  - `printTravelGuide` / `printWelcomeGuide` `(booking|null, lang, sections)` — `null` pour preview sans booking
- **Email system :** via Edge Function `send-email` (proxy Resend)
  - `SendEmailRow` : champ email pré-rempli depuis `client.email` + bouton Send + `EmailHistory` (3 derniers envois)
  - Types : `visa_letter`, `booking_confirmation`, `travel_guide`, `welcome_guide`
  - Logs fetchés par booking, refresh via compteur `logsRefresh` (incrémenté après envoi réussi)

### `AccountingPage`
- **Route :** `'accounting'`
- **Hooks :** 21 hooks (useAccommodations, useHouseRentals, useBookings, useBookingParticipants, useClients, useRooms, useBookingRooms, useBookingRoomPrices, useExternalAccommodations, useExternalAccommodationBkgs, useDiningEvents, useLessons, useInstructors, useEquipment, useEquipmentRentals, useTaxiTrips, useActivityBookings, useActivityPayments, useSeasons, usePayments, + états mutables)
- **State :** `tab: 'dashboard'|'bookings'|'instructors'|'houses'|'palmeiras'|'cashflow'|'expenses'|'events'|'unverified'`
- **Pattern :** objet `sharedData` + objet `handlers` passés aux sous-composants
- **Mutations :** state local optimiste + appel Supabase fire-and-forget
- **Onglet "⚠️ To Verify"** — liste les `payments` où `is_verified=false`. Badge count sur l'onglet.

### `ManagementPage`
- **Route :** `'management'`
- **Hooks :** useInstructors, useLessons, useTable<PriceItem>, useTable<TaxiPricingDefaults>, useTable<SharedLink>, useBookings, useBookingParticipants
- **State :** `tab: 'instructors'|'houses'|'pricing'|'links'|'bookguest'`
- **Onglets :** Instructors CRUD, Houses, Pricing (items + taxi defaults), Shared links, Bookings & Guests
- **Pricing — deux natures de lignes (2026-07-30)** : celles qui portent un `billable_type`
  **facturent** (badge « 🔒 bills … ») → nom, catégorie et lien verrouillés, suppression
  interdite, **seul le prix reste éditable** ; les autres sont un catalogue libre. Un poste
  facturable sans tarif s'affiche en rouge « no rate configured, billed 0€ ». Le sélecteur
  « Applies to » ne propose que les postes encore libres, donc l'index unique en base ne
  peut plus être heurté par l'écran.
- **5 sections** : Lessons, Rentals, **Meals**, **Center access**, Activities. Les deux du
  milieu sont nées le 2026-07-30 : ces montants vivaient dans le code (repas 0 € à retaper,
  accès centre 5 €/jour). Activities reste un catalogue libre — **aucun calcul ne le lit**,
  les prix d'une activité se saisissent sur la réservation d'activité.
- ⚠️ `CATEGORY_BILLABLES` duplique le CHECK de la base (`price_items_billable_category_chk`)
  — les deux doivent bouger ensemble.
- **Shared links :** formulaire manuel pour types `forecast`, `taxi`, `client`, **`booking_form`**.
  `driver` et `activity_provider` exclus (créés depuis leurs pages dédiées). `booking_form` = lien public du formulaire d'inscription (un seul suffit).
- **`LINK_TYPE_LABELS`** : utilisé pour afficher le type dans la liste, inclut les 6 types.

### `SubmissionsPage`
- **Route :** `'submissions'` — nav item "Submissions" 📝 avec **badge bleu** = nombre de soumissions `pending`.
- **Hooks :** `useTable<FormSubmission>('form_submissions', { order: 'submitted_at', ascending: false })`
- **But :** File de validation des soumissions du `BookingFormPage`.
- **State :** `tab: 'pending'|'approved'|'rejected'` (défaut pending), `openId` (ligne dépliée).
- **Détail (`SubmissionDetail`, module-scope) :** affiche tout le `payload` (trip + transferts taxi avec date/heure, logistics, crew, contact urgence, waiver). Champs date `check_in`/`check_out` Bilene **pré-remplis** (`country_entry_date` + `nights_bilene`) et **éditables** avant création.
- **`bookings.notes` (2026-09-03) :** ne reçoit plus que « Single beds requested: N » — le seul
  élément sans colonne. Le reste (origine du formulaire, transferts, attribution, message
  d'origine) a un vrai foyer : voir `BACKLOG.md` § Parcours, D.2.
- 🔴 **Trajets taxi (2026-09-03) :** créés à `payload.transfer_to_*` (date **et** heure données
  par le visiteur), plus au check-in + heure de vol. La bonne réponse n'existait que dans une
  phrase des notes.
- ⚠️ **« Create booking » réutilise un client existant** (2026-09-03) au lieu d'en créer un
  systématiquement : `utils/clientIdentity.ts` — `enquiry.client_id` d'abord, puis **email
  exact**, jamais un nom. Les champs vides sont complétés (`blanksToFill`), rien n'est écrasé.
  Le panneau **annonce avant le clic** (« Files under the existing client … » / « Creates a new
  client »).
- **« Create booking » :** crée séquentiellement `clients` (nom splitté, email, phone, emergency_*, `import_id = submission.id`) → `bookings` (status `provisional`, `visa_entry/exit_date` = dates pays, `check_in/out` confirmés, taxis, `couples_count`=double_beds, `has_travel_insurance`, `waiver_accepted_at`/`waiver_version`, `referral_source`, transferts + lits simples dans les **notes**, `import_id`) → `booking_participants` (1/voyageur). Puis soumission → `approved` + `created_booking_id`. **Anti-doublon** : bouton désactivé si `created_booking_id` déjà set.
- **« Reject » :** soumission → `rejected`.

### `ActivitiesPage`
- **Route :** `'activities'`
- **Hooks :** useActivityProviders, useActivityBookings, useActivityPayments, useBookingParticipants, useTable<BookingRef>, useTable<SharedLink>
- **State :** `tab: 'providers'|'bookings'`, `viewingId`, `showProviderForm`, `editingProvider`, `filterProvider`
- **Onglet Providers :** grille de cartes → sélection → `ProviderPanel` avec KPIs financiers, liste bookings, liste paiements, share link
- **Onglet Bookings :** tableau de tous les bookings filtrables par prestataire
- **ProviderPanel :** CRUD bookings + paiements, section share link (génère `shared_link` type `'activity_provider'`, params `{ provider_id }`)
- **show_prices toggle :** sur le form provider, contrôle la visibilité de l'onglet Accounting sur la page publique
- **Formulaires module-scope :** `ProviderForm`, `BookingForm` (avec participant picker), `PaymentForm`
