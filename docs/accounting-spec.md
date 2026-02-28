# Accounting Module — Spec

## Vue d'ensemble

Module de comptabilité couvrant tous les flux financiers du centre.
Tout est en **euros** (on note la devise de paiement mais pas de conversion).

---

## Sources de revenus

| Source | Mécanisme |
|---|---|
| Hébergement maisons (chambres/full) | Prix/nuit × nb nuits, override possible |
| Hébergement Palmeiras bungalows | Prix achat + prix vente → marge temps réel |
| Cours kitesurf | Nb cours × tarif instructeur (par type) |
| Location équipement | Nb locations × tarif |
| Taxis | Prix client − coût driver − marge manager = marge centre |
| Activités | Prix groupe (exceptions par client possibles) − coût prestataire |
| Centre access | Nb personnes × tarif |

---

## Hébergement — Pricing

### Maisons propres
- **Sea-view room** : 70 €/nuit (base)
- **Back room** : 50 €/nuit (base)
- **Full house** : 100 €/nuit (base — tarif distinct, pas additionnel)
- Override manuel possible à tout moment (promos, deals spéciaux)
- Prix stocké sur chaque `BookingRoom` au moment de la réservation (pas recalculé si le tarif de base change)

### Palmeiras bungalows (sous-location)
- On achète à un prix (variable selon bungalow/période), on revend avec marge
- Saisie : prix d'achat + prix de vente → marge affichée en temps réel
- Apparaît dans l'onglet Palmeiras ET dans les grands totaux

### Hôtels externes
- Même logique : prix achat + prix vente → marge temps réel

---

## Palmeiras — Onglet dédié

Relation complexe avec l'hôtel Palmeiras (hébergement principal du centre) :

1. **Loyer mensuel** : on leur paie un loyer pour la maison qu'on habite (montant à retrouver)
2. **Bungalows sous-loués** : on loue leurs bungalows pour nos clients, on marge
3. **% sur leurs propres bookings** : quand des clients bookent directement via Palmeiras, ils nous reversent un % → saisie manuelle mensuelle (montant brut + %)

**Vue Palmeiras :**
- Récap mensuel (flux entrants et sortants liés au Palmeiras)
- Lien exportable (PDF ou impression)
- Les chiffres remontent aussi dans les grands totaux globaux

---

## Paiements clients

- **Devise** : tout en euros, mais on note la méthode :
  - Cash EUR
  - Cash MZN (meticais)
  - Virement bancaire
  - Carte au Palmeiras
- **Acompte** : 30% du total calculé (min. 120€), montant libre à ajuster
- **Solde** : payé sur place, en une ou plusieurs fois
- Toutes les transactions sont loggées avec date + montant + méthode

**Prix calculé automatiquement** = somme de toutes les prestations du booking.
Modifiable manuellement avec note de justification.

---

## Instructeurs — Comptabilité

### Rémunération
- Payés par cours au tarif de leur profil (private / group / supervision)
- Override possible sur chaque cours dans la vue compta (avec note obligatoire)

### Dettes instructeurs envers le centre
- Avances (dîner, sortie, achat...) : ligne manuelle avec date + montant + description
- Apparaissent en déduction sur leur récap

### Versements
- On peut verser tout ou partie à n'importe quel moment
- Chaque versement = ligne avec date + montant + méthode

### Lien public individuel
- Chaque instructeur a son propre lien (géré dans /management/shared-links)
- Il voit : ses cours, les tarifs, ses dettes, les versements reçus, le solde dû

### Lien commun planning
- Le lien Forecast existant suffit pour l'instant

---

## Détail par personne dans un booking

Tracking optionnel par participant (ex: "Jean : 3 cours, Marie : 1 cours + 2 locations").
- Par défaut : totaux au niveau du booking (comportement actuel)
- Si besoin : on peut affecter cours/locations à un participant précis
- Modèle : `ParticipantConsumption` (participant_id × type × quantité)

---

## Saison

- Une seule saison par an : mi-septembre → mi-mars (dates variables)
- Saisie manuelle des dates de début/fin chaque année
- Les rapports peuvent filtrer par saison, ou en période libre

```ts
interface Season {
  id: string
  label: string       // ex: "2025-2026"
  start_date: string  // ISO date
  end_date: string    // ISO date
}
```

---

## Activités — Comptabilité

- Prix de groupe (base) − coût prestataire = marge centre
- **Exceptions** : un client peut avoir un prix différent (plus ou moins), ET une activité peut être individuelle (1 seul client)
- Modèle : `ActivityBooking` a un `price_override` nullable (null = prix groupe par défaut)
- Apparaît dans les grands totaux

---

## Dépenses manuelles

- Achat matériel, réparations, divers
- Ligne : date + catégorie + montant + description
- Catégories : matériel kite, entretien, hébergement, transport, divers

---

## Rapports

### Périodes disponibles
- Par semaine
- Par mois
- Par saison
- Libre (date début → date fin)

### Vues
- **Dashboard global** : CA total, marge totale, par catégorie
- **Par réservation** : total dû vs payé → solde client
- **Par instructeur** : cours × tarif − dettes − versements = à payer
- **Palmeiras** : loyer + bungalows + % bookings = flux net mensuel
- **Cash-flow** : entrées/sorties par période

---

## Types à créer / modifier

```ts
// Prix par nuit (base modifiable)
interface RoomRate {
  room_id: string           // ou 'full_house_{accommodation_id}'
  price_per_night: number
  valid_from: string | null  // null = toujours valide
  notes: string | null
}

// Prix overridé sur un booking précis
interface BookingRoomPrice {
  booking_id: string
  room_id: string
  price_per_night: number   // snapshot au moment du booking
  override_note: string | null
}

// Hébergement externe (hotel / bungalow Palmeiras)
interface ExternalAccommodation {
  id: string
  name: string
  provider: string          // 'palmeiras' | nom hotel
  cost_per_night: number    // ce qu'on paie
  sell_price_per_night: number // ce qu'on facture
  notes: string | null
}

// Paiements clients
interface Payment {
  id: string
  booking_id: string
  date: string
  amount: number
  method: 'cash_eur' | 'cash_mzn' | 'transfer' | 'card_palmeiras'
  notes: string | null
  is_deposit: boolean
}

// Dettes instructeurs
interface InstructorDebt {
  id: string
  instructor_id: string
  date: string
  amount: number
  description: string
}

// Versements instructeurs
interface InstructorPayment {
  id: string
  instructor_id: string
  date: string
  amount: number
  method: 'cash_eur' | 'cash_mzn' | 'transfer'
  notes: string | null
}

// Override tarif cours (compta)
interface LessonRateOverride {
  lesson_id: string
  rate: number
  note: string    // obligatoire
}

// Dépenses manuelles
interface Expense {
  id: string
  date: string
  category: 'equipment' | 'maintenance' | 'accommodation' | 'transport' | 'other'
  amount: number
  description: string
  palmeiras_related: boolean
}

// Palmeiras — reversement mensuel
interface PalmeirasReversal {
  id: string
  month: string             // YYYY-MM
  gross_amount: number
  percent: number
  net_amount: number        // calculé
  notes: string | null
}
```

---

## Fichiers à créer

| Fichier | Rôle |
|---|---|
| `src/pages/AccountingPage.tsx` | Page principale, onglets |
| `src/components/accounting/BookingFinances.tsx` | Vue par réservation |
| `src/components/accounting/InstructorPayroll.tsx` | Vue par instructeur |
| `src/components/accounting/PalmeirasTab.tsx` | Onglet Palmeiras |
| `src/components/accounting/Dashboard.tsx` | Dashboard global |
| `src/components/accounting/CashFlow.tsx` | Vue cash-flow |
