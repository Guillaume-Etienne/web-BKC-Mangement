# Components Reference
> Tous les composants dans `client/src/components/`

---

## Layout

### `Navigation` — `layout/Navigation.tsx`
**Props :** `{ currentPage: Page; onNavigate: (p: Page) => void; onLogout: () => void; urgentCount?: number; submissionsCount?: number }`
- Navbar sticky top : logo, 11 items, bouton sign out
- Mobile : hamburger → dropdown
- **Items :** Home, Clients, Planning, Bookings, Accounting, Documents, Options, Equipment, Taxis, Activities, **Submissions**
- **Badge Home :** si `urgentCount > 0`, badge rouge sur Home (actions urgentes, via `computePendingActions` dans `App.tsx`)
- **Badge Submissions :** si `submissionsCount > 0`, badge bleu = nombre de `form_submissions` en attente
- State : `mobileMenuOpen: boolean`
- ⚠️ Le type `Page` est une union inline ici (dupliquée avec `App.tsx` et `pendingActions.ts`)

---

## Planning

### `PlanningView` — `planning/PlanningView.tsx`
*(Utilisé comme page, pas de props — hooks directs)*
- Grille planning horizontale Sep→Mar
- 4 sub-tabs : planning (grille), lessons (LessonWeekView), now (NowView), forecast (ForecastView)
- Gère : sélecteur d'année, drag state (`useBookingDrag`), mutations Supabase
- Rend : PlanningRow × N, TotalsRow × 3, composant sub-tab

### `PlanningRow` — `planning/PlanningRow.tsx`
**Props :** `{ roomId, label, totalDays, seasonStart, bookings, bookingParticipants: BookingParticipant[], dragState, onPointerDown, unavailableDays?: Set<number> }`
- Une ligne grille pour une chambre (label + colonnes jour + barres booking)
- `CELL_W = 32px` par jour. Highlighting weekend. Poignées drag sur les bords.
- `unavailableDays` (optional): Set de day-of-season indices pour highlighting unavailable periods
- Utilise `bookingParticipants.filter(p => p.booking_id === b.id).length` pour les badges
- Entièrement contrôlé (pas d'état interne)
- **Dessine lui-même les barres de réservation** (`statusColors`, ligne ~5) : la couleur
  dit le statut (emerald/amber/gris) et porte aussi la couleur du texte. Le nom du client
  est en **texte foncé**, pas blanc : blanc sur emerald ne fait que 2.5:1 et 1.7:1 sur
  amber, illisible sur un téléphone en plein soleil (corrigé le 2026-07-31, 7:1 et 10:1).

### ~~`BookingBar` — `planning/BookingBar.tsx`~~ — ⚠️ CODE MORT
**Importé nulle part** (vérifié le 2026-07-31) — les barres sont dessinées par
`PlanningRow` ci-dessus. Le fichier existe encore mais ne rend rien ; ne pas le modifier
en croyant agir sur le planning. À supprimer un jour, décision de gui.

### `TotalsRow` — `planning/TotalsRow.tsx`
**Props :** `{ label, totalDays, seasonStart, bookings, bookingParticipants: BookingParticipant[], type: 'lessons'|'equipment'|'guests' }`
- Ligne résumé avec comptes journaliers
- Emerald si > 0, gray si 0. Highlighting weekend.

### `LessonWeekView` — `planning/LessonWeekView.tsx`
*(Props : données des hooks + callbacks mutations + `bookingParticipants: BookingParticipant[]` + `clients: Client[]`)*
- Navigateur semaine (Lun–Dim)
- 3 slots/jour (morning, afternoon, evening)
- Modals add/edit lesson, activity, rental
- ⚠️ Formulaires définis au **scope module** (pas dans le render) pour éviter la perte de focus

### `NowView` — `planning/NowView.tsx`
**Props :** `{ bookings: Booking[]; bookingParticipants: BookingParticipant[]; bookingRooms: BookingRoom[]; rooms: Room[]; accommodations: Accommodation[]; instructors: Instructor[] }` + `useTable<DiningEvent>` interne
- Éditeur d'événements dining pour le sub-tab "Now"
- Sélecteur de date (±1 jour)
- EventType : `'count'` (effectif) ou `'menu'` (champs par personne)
- Calcule room_label des participants à partir de bookingRooms/rooms/accommodations
- **Bouton Unpaid/✓ Paid (2026-07-30)** sur les convives `extra` payants uniquement : leur
  repas n'atterrit sur aucune résa ni aucune paie, donc c'est le seul suivi de leur règlement.
  Compteur « €X to collect » à côté du total du repas **et** dans l'historique (pour qu'un
  oubli se voie sans rouvrir chaque repas). Stocké dans le JSON `attendees`, aucune migration ;
  la compta n'a pas bougé (le revenu repas comptait déjà ces convives).
- ⚠️ Formulaires au **scope module**

### `ForecastView` — `planning/ForecastView.tsx`
*(Props : données des hooks + callbacks mutations)*
- Grille horaire instructeurs (même layout que ForecastSharePage mais éditable)
- Sélecteur de date, colonnes instructeurs, blocs de leçons (couleur par type)
- Modal add/edit leçon

---

## Taxi

### `TaxiListView` — `taxi/TaxiListView.tsx`
**Props :**
```ts
{
  trips: TaxiTrip[]; drivers: TaxiDriver[]; bookings: BookingRef[]
  bookingParticipants: BookingParticipant[]
  pricingDefaults: TaxiPricingDefaults  // always present (required) — fournit le taux global eur_mzn_rate
  onAddTrip: (t: Omit<TaxiTrip,'id'>) => Promise<TaxiTrip|null>
  onUpdateTrip: (t: TaxiTrip) => Promise<void>
  onDeleteTrip: (id: string) => Promise<void>
}
```
- Tableau récapitulatif (done vs. planned : client EUR, driver MZN, manager MZN, **Centre €**)
- Tableau trips : date, heure, type, driver, client, statut, personnes, bagages, financials + **colonne Centre €** (`computeTaxiMarginEur` au taux global)
- Add → modal pré-rempli avec `pricingDefaults`. Modal : taux global affiché en lecture seule (plus de checkbox "update rate"), marge centre affichée
- Badges statut : confirmed=gray, needs_details=red, done=green

### `TaxiKanbanView` — `taxi/TaxiKanbanView.tsx`
**Props :** Identiques à TaxiListView
- Colonnes : Unassigned + une par chauffeur ; drag carte entre colonnes → réassigne `taxi_driver_id`
- Carte trip : finance Client/Driver/Manager + **ligne Centre €**

### `TaxiFinanceTab` — `taxi/TaxiFinanceTab.tsx`
**Props :** `{ trips: TaxiTrip[]; payments: TaxiManagerPayment[]; eurMznRate: number; onAddPayment; onDeletePayment }`
- Onglet Finance pour TaxiPage
- **Affichage bi-devise (2026-07-04, demande gui)** : MZN en premier + « ≈ X€ » dessous
  (helper `MznWithEur`), partout (summary, balance manager, historique paiements)
- SummaryTable : colonne **Centre margin** (€) = Client € − (Driver+Manager MZN)/taux global
- Manager payment history (tableau des paiements) + balance earned − paid
- ⚠️ Module-scope form `AddPaymentForm` pour mutations manager payments

### `DriverStatementPanel` — `taxi/DriverStatementPanel.tsx`
**Props :** `{ driver, trips, driverLink: SharedLink|null, onGenerateLink, onEdit, onDelete }`
- 3 KPI cards : Completed / Upcoming / Total (MZN)
- Tables trips passés et à venir (date, heure, route, client, pax, bags, boards, notes, MZN)
- Section share link : bouton "Generate link" → URL + Copy + Open
- Génère un `shared_link` de type `'driver'` avec `params.driver_id`

---

## Clients

> `ImportCSVModal` + `utils/parseGoogleFormsCSV.ts` **supprimés le 2026-07-06** (remplacés
> par le formulaire public `BookingFormPage`). La colonne `import_id` reste : réutilisée par
> `SubmissionsPage` comme clé de dédup (id de la form_submission).

---

## Accounting

Tous les composants accounting partagent :
- **Pattern Props :** `{ data: SharedAccountingData }` ou `{ data, handlers: AccountingHandlers }`
- **Utils :** `components/accounting/utils.ts` — fonctions compute + `fmtEur()`, `fmtMonth()`
- **Types :** `components/accounting/types.ts` — SharedAccountingData, AccountingHandlers

### `AccountingDashboard` — `accounting/AccountingDashboard.tsx`
**Props :** `{ data, onOpenBooking? }`
- KPI cards : Total revenue, Collected, Outstanding
- **⚠️ Taxi = MARGE CENTRE dans le revenu (2026-07-06, demande gui)** : `taxiMargin` =
  Σ `price_eur` − (Σ `price_driver_mzn + margin_manager_mzn`)/taux → entre dans Total revenue
  et la barre « Taxi margin » du breakdown. Le net result ne re-soustrait PLUS `taxiCosts`
  (netté dans le revenu ; chiffre final inchangé). Le BRUT taxi reste dans TaxiFinanceTab,
  Billed/Collected/Outstanding (les clients doivent le brut) et CashFlow.
- Autres revenus en brut facturé (refonte 2026-07-02) : Activities = Σ (`price_client` we_pay /
  `price_provider` reversé) ; trips/activités liés à un booking annulé exclus des deux côtés
- Coûts (cards rangée 2) : instructors, house rentals, **bungalow owners** (`cost_per_night ×
  nuits`), card **Taxi margin** (marge en gros, brut − coûts en sous-titre), **activity
  providers** (`price_provider` we_pay), expenses, Palmeiras net (= reversals + entries − rent,
  SANS marge bungalow — détail dans PalmeirasTab)
- Bandeau net result = revenue (taxi netté) + palmeiras − tous les coûts ci-dessus (⚠️ hypothèse :
  paiements chauffeurs/manager et coûts bungalows ne sont PAS saisis en Expenses, sinon double comptage)
- Collected/Outstanding = basés sur `billedNet` (Σ computeBookingTotal − discounts des bookings actifs), plus sur totalRevenue ; payments des bookings annulés ignorés
- « Collection progress » cliquable → **CollectionsModal** (ci-dessous)
- Liste des soldes instructeurs ; table « Outstanding payments » (top 6, clic → booking)
- Pas de mutations

### `CollectionsModal` — `accounting/CollectionsModal.tsx` (2026-07-06)
**Props :** `{ rows: UnpaidRow[], clients, onClose, onOpenBooking? }`
- « Qui me doit quoi » : TOUS les bookings à solde dû (`unpaidBookings` du dashboard),
  groupés par urgence de recouvrement, sections dépliables/repliables avec sous-totaux :
  **Currently here** (check-in ≤ today ≤ check-out, tri check-out proche, déplié),
  **Departed** (à relancer, plus vieux d'abord, déplié), **Upcoming** (replié par défaut)
- Ligne : client + statut + dates + 📞/✉️ (lookup `data.clients`, **affichage seul**) +
  dû / (payé/total) ; clic → `onOpenBooking(id)` + fermeture. Zéro accès DB propre.

### `BookingFinances` — `accounting/BookingFinances.tsx`
**Props :** `{ data, handlers }`
- Liste bookings avec totaux (dû / payé / solde)
- Clic booking → détail : hébergement, leçons, locations, taxis, dining, activités, **center access**
- Liste paiements : add / edit (✏️) / delete (✕) ; badge vérifié ; lignes discount en violet
- **Formulaires module-scope :** `PaymentForm`, `DiscountForm`, `EditRentalForm`, `LessonRateForm`
- Boutons `+ Payment` (bleu) et `+ Discount` (violet)
- Section "Unlinked taxi trips" (amber) pour les trips sans booking_id

### `UnverifiedPayments` — `accounting/UnverifiedPayments.tsx`
**Props :** `{ data, handlers }`
- Tableau de tous les `payments` où `is_verified=false`, trié par date
- Colonnes : date, booking #, client, méthode, montant, notes, bouton "✓ Verify"
- Footer : total non-vérifié
- État vide : "✅ All payments have been verified."

### `InstructorPayroll` — `accounting/InstructorPayroll.tsx`
**Props :** `{ data, handlers }`
- Liste instructeurs : earned / debts / paid / balance (code couleur)
- Clic → tiroir détail : liste leçons, dettes, paiements, formulaires add dette/paiement
- Overrides de taux de leçon (par leçon, avec note obligatoire)

### `PalmeirasTab` — `accounting/PalmeirasTab.tsx`
**Props :** `{ data, handlers }`
- Sélecteur de mois
- 4 sub-tabs : Rent | Reversals | Sub-lets | Free Entries
- Résumé mensuel en bas
- **Calculs dans `accounting/palmeirasUtils.ts`** (purs, testés) : `buildBungalowRows`
  dérive les séjours bungalow des réservations (annulées exclues, prix = snapshot),
  `computePalmeirasTotals` fait le net de la période.
  ⚠️ Ce net **inclut** la marge bungalow, le KPI Palmeiras du dashboard **l'exclut** :
  écart voulu et verrouillé par un test (sinon la marge serait comptée deux fois côté
  dashboard). Cf. `TEST_SUITE_ACCOUNTING.md`.

### `CashFlow` — `accounting/CashFlow.tsx`
**Props :** `{ data }`
- Sélecteur de période : month / season / custom
- Types de chart : bars / diverging / line
- Tableau mensuel : billed (incl. activités), collected, palmIn, **agenciesIn**, expenses, rent,
  instrPaid, **taxiOut**, providersOut, net
- "Billed" inclut : booking totals + taxi standalone + activity net margin + **net agence** par mois
- **taxiOut (2026-07-04)** : chauffeurs = `price_driver_mzn` des trips `done` au mois du trajet
  (payés cash au trajet, décision gui) + manager = `taxi_manager_payments` réels au mois du
  paiement ; MZN→€ au taux global.
- **agenciesIn (2026-08-19, décision gui)** : l'argent des agences partenaires, **net de leur
  commission**, au mois de `paid_at` — une vraie date d'encaissement. Une facture agence ne passe
  **jamais** par la table `payments` (qui ne contient que ce que paient les CLIENTS), donc aucun
  double compte ; les services rattachés à une ligne agence sont d'ailleurs exclus de tous les
  totaux client depuis la Phase 5. **Deux dates distinctes, non interchangeables** : `billed` suit
  le **mois de check-in de la résa** (une ligne de facture n'a pas de date propre — même règle que
  le filtre de saison de l'onglet Agencies, pour que les chiffres concordent), `agenciesIn` suit
  `paid_at`. Une ligne facturée non payée compte en `billed` et pour rien en caisse, exactement
  comme une résa client impayée. Commission calculée par `agencyCommission()` — **une seule
  définition**, partagée avec `computeAgencyTotals`, et un test verrouille
  `billed === computeSeasonTotals().agencyRev`.
- Net cash = collected + palmIn + agenciesIn − toutes les sorties.
- Pas de mutations

### `AgencyBillingPanel` — `accounting/AgencyBillingPanel.tsx`
**Props :** `{ booking, data, handlers }` — rendu dans la fiche résa de `BookingFinances`,
et **rien du tout** si la résa n'a pas d'`agency_id`.
- Les **lignes** de ce qui est dû par l'agence (forfaits du catalogue ou ligne libre), et le
  rattachement des 4 sources de services (cours, locations, transferts, chambres).
- **La facture elle-même (2026-08-19)** : « Create the invoice » pose un numéro
  (`nextInvoiceNumber` = AAAAMMJJ, `-2` si déjà pris le même jour), la date du jour, et **balaie
  toutes les lignes non facturées de la résa dessus** — une facture = une résa (décision gui).
  Puis : champ **Agency ref** (le numéro que l'agence nous donne, « ref F&Fly : 134606 »),
  tampons **Mark sent / Mark paid**, et **🖨️ Print (FR)**.
- ⚠️ **Les tampons sont sur la FACTURE, plus sur la ligne** : on solde une facture, pas une ligne.
  `computeAgencyTotals` et `buildCashFlowRows` lisent donc `agency_invoices.paid_at`. Deux
  sources de vérité pour « payé » étaient exactement la divergence que ce projet a déjà payée.
- Supprimer une facture **rend ses lignes** au pool « not invoiced » — ça ne annule pas ce que
  l'agence doit.

### `printAgencyInvoice` — `utils/printAgencyInvoice.ts`
Le document **en français**, reproduit du modèle réel que Fun & Fly attend
(`temp/Factu BKC 2025 FFLY Famille Brunet.xlsx`). Page imprimable (même moule que la lettre de
visa) : **rien n'est envoyé**, gui relit avant d'expédier.
- **Émetteur = Moçambique Action Sport Lda.** (l'entité légale, comme la lettre de visa) et
  logo `logo-mas.png` — pas la marque BKC.
- **En dur (décision gui)** : l'adresse de l'émetteur, l'IBAN/SWIFT, et l'adresse du destinataire
  indexée par **`agencies.short_code`** — jamais par le nom. Une agence absente de la table
  imprime son nom **sans adresse** : une mauvaise adresse sur une facture est pire qu'aucune.
- **Libellés au format de l'agence** (`agencyInvoiceLineLabel`, pur et testé) : un transfert
  rattaché se nomme lui-même « Transferts aller Maputo - Bilene le 19/10/2026 » ; sinon la note
  de la ligne ; sinon le libellé du catalogue. Jamais un libellé déduit d'un prix.
- Totaux : **TOTAL TTC** (brut) · **dont commission X%** · **Total à payer** (net) — les trois,
  comme le modèle. Calculés par `buildAgencyInvoiceDoc`, avec un test qui verrouille l'égalité
  avec `computeAgencyTotals` pour que le papier et les KPI ne divergent pas.

### `ExpensesTab` — `accounting/ExpensesTab.tsx`
**Props :** `{ data, handlers }`
- 2 vues : List (tableau + filtres) / Summary (matrice mois × catégorie)
- Catégories free-form, liste par défaut `DEFAULT_CATEGORIES`
- Form `AddExpenseForm` au scope module

### `EventsTab` — `accounting/EventsTab.tsx`
**Props :** `{ data, handlers }`
- Gestion des dining events
- CRUD events + attendees

### `HousesTab` (accounting) — `accounting/HousesTab.tsx`
**Props :** `{ data, handlers }`
- Locations de maisons (house_rentals)
- Tarifs par chambre (room_rates)

---

## Management

### `HousesTab` (management) — `management/HousesTab.tsx`
**Props :** `{ accommodations, rooms, ... }`
- Gestion des maisons et bungalows
- Add/edit/toggle active

---

## Kite Level Display

Utilisé dans ClientsPage, BookingsPage, ManagementPage :
| Value | Label | Couleur |
|-------|-------|---------|
| `beg-total` | Beg-Total | lime |
| `beg-bodydrag` | Beg-BodyDrag | green |
| `beg-waterstart` | Beg-WaterStart | emerald |
| `intermediate` | Intermediate | blue |
| `advanced` | Advanced | purple |

---

## Règles architecturales clés

1. **Formulaires au scope module** — tout composant avec des inputs texte qui re-rend sur changement de state DOIT définir le composant formulaire hors de la fonction parent pour éviter la perte de focus à chaque frappe
2. **Mise à jour optimiste — mais JAMAIS fire-and-forget** ⚠️ *(règle réécrite le 2026-07-31 : elle disait « fire-and-forget (sans await) », c'était le bug)*
   Update du state local immédiatement, puis l'appel Supabase **dont on lit l'erreur**.
   Un refus (RLS, contrainte, réseau coupé) est silencieux : sans ça, l'écran affichait le
   paiement encaissé et la base n'avait rien. Utiliser
   **`components/accounting/persist.ts`** : snapshot du tableau avant mutation, restauré +
   alerte si l'écriture ne passe pas (testé dans `persist.test.ts`).
3. **Pattern refresh()** — après insert/update/delete dans TaxiPage, ManagementPage, ActivitiesPage (pas d'état local mutable) : `const { error } = await supabase...`, **dire si ça a échoué**, puis `refresh()`. Le refresh remet l'écran d'accord avec la base, mais sans le message l'échec est indiscernable d'un succès (le formulaire se ferme, la ligne n'apparaît jamais).
4. **`useEffect` sync** — quand les données du hook alimentent un state local mutable : `useEffect(() => setState(data), [data])`
5. **`CELL_W = 32`** — px par colonne jour dans la grille planning (doit correspondre au Tailwind `w-8`)
6. **Dates calendaires** — `client/src/utils/dates.ts`, jamais `.toISOString()` (décale d'un jour à l'est de Greenwich). Cf. INDEX.md.
7. **Pages chargées à la demande** — `App.tsx` les déclare en `lazy(() => import(...))`, sous un `Suspense` + `ChunkBoundary`. Une nouvelle page suit le même moule.
8. **Contraste** — le texte doit tenir 4.5:1 (3:1 pour les icônes de contrôle). Sur fond sombre, `gray-500`/`600` échouent : `dark:text-gray-400` pour le texte secondaire, `dark:text-gray-500` pour les icônes. `body` porte une couleur par défaut qui suit le thème, donc un élément sans classe de couleur reste lisible.

---

## Arbre de composants

```
App
├── LoginPage
├── Navigation (10 items)
└── [pages]
    ├── HomePage
    ├── PlanningView
    │   ├── PlanningRow[] → BookingBar[]
    │   ├── TotalsRow[]
    │   ├── LessonWeekView   (sub-tab 'lessons')
    │   ├── NowView          (sub-tab 'now')
    │   └── ForecastView     (sub-tab 'forecast')
    ├── BookingsPage  (wizard 6 étapes)
    ├── TaxiPage
    │   ├── TaxiListView | TaxiKanbanView  (onglet 'planning')
    │   └── DriverStatementPanel           (onglet 'drivers')
    ├── EquipmentPage
    ├── DocumentsPage
    ├── AccountingPage
    │   ├── AccountingDashboard
    │   ├── BookingFinances
    │   ├── InstructorPayroll
    │   ├── HousesTab
    │   ├── PalmeirasTab
    │   ├── CashFlow
    │   ├── ExpensesTab
    │   ├── EventsTab
    │   └── UnverifiedPayments
    ├── ManagementPage → HousesTab (management)
    ├── ActivitiesPage            (onglets providers + bookings)
    ├── ForecastSharePage         (public)
    ├── TaxiSharePage             (public)
    ├── ClientSharePage           (public)
    ├── DriverSharePage           (public)
    └── ActivityProviderSharePage (public)
```
