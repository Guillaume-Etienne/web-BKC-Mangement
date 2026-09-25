# Walk-ins & packs — conception (2026-09-25) · étape 1 livrée

> Décidé avec gui en discussion le 2026-09-25. **Étape 1 codée le soir même** (`d024495`, non poussé),
> migration `2026-09-25_walk_ins.sql` **à passer** TEST + PROD. Étape 2 (packs) : rien de codé.
> Avancement : `BACKLOG.md` § 🚶 Walk-ins.

## Le besoin

Des clients viennent **juste** pour un cours, une location ou une supervision, sans rien
réserver d'autre chez nous. Ça arrive **souvent**, ce sont surtout des locaux (« des potes de
potes »), et ils **reviennent**. Il faut les enregistrer, les retrouver et suivre leur historique.

Aujourd'hui c'est impossible proprement : `lessons.booking_id` est **obligatoire** et
`lessons.participant_ids` pointe vers `booking_participants`. Pas de résa = pas de cours.

## Décisions prises

| Question | Décision |
|---|---|
| Rendre les leçons indépendantes des résas (`booking_id` nullable, comme les taxis) ? | **Non.** Participants, paiements, compta, RLS de partage et paie moniteur passent tous par la résa : trop de risques |
| Modèle retenu | Une **résa normale marquée « Day visitor »**, créée en coulisse, sans chambre |
| Un « client walk-in » à part ? | **Non.** C'est un **client normal**, c'est sa **venue** qui est de type walk-in |
| Apparaît au planning général (hébergement) ? | **Non.** Filtré de la ligne « No room ». Pas de nouvelle ligne |
| Où le voit-on ? | **Daily** (badge Walk-in), **fiche client** (historique), **compta**, **paie moniteur** |
| Prix | **Libres partout.** Tarif officiel = simple valeur proposée. Plus un **tarif perso** facultatif sur le client |
| Paiement | À la séance **et** par forfaits (packs) |
| Pack : expiration | **Jamais** |
| Pack : partagé (couple, potes) | **Non**, un pack = un client |
| Pack : utilisable par un client hébergé | **Non**, réservé aux walk-ins |
| Pack : note | **Oui**, champ libre (« ce qui a été facturé en gros ») |
| Devise | **Tout en EUR** |

## Étape 1 — Walk-in à la séance

**Point d'entrée : l'onglet Daily** (`components/planning/LessonWeekView.tsx`), à côté de
l'ajout de cours / location. Clic sur un créneau → « Walk-in ».

Fenêtre en un seul écran :
1. **Recherche client** (2-3 lettres). Trouvé → sa fiche remonte avec son tarif perso, son
   solde de pack et l'état de sa décharge.
2. Pas trouvé → **« + New client »** dans la même fenêtre, champs minimaux : prénom, nom,
   WhatsApp, email facultatif, tarif perso facultatif. Création via `utils/clientIdentity.ts`
   (réutiliser avant d'insérer, jamais sur un nom).
3. **Décharge** (si jamais signée) : case « signée sur papier » ou envoi du lien de signature.
4. **Ce qu'il fait** : cours / location / supervision, moniteur, matos, durée, prix proposé
   (tarif perso → sinon `price_items`), modifiable.
5. **Paiement** encaissé tout de suite (facultatif).

En coulisse : une résa `check_in = check_out = date`, sans chambre, marquée day visitor, avec un
participant = le client, puis la leçon ou la location dessus.

Côté app, la résa day visitor :
- est **exclue** : planning hébergement (ligne « No room »), occupation, alertes de séjour de la
  page d'accueil (taxi, formulaire, passeport, acompte…), formulaires de séjour ;
- **compte** : chiffre d'affaires cours / location, paie moniteur, paiements, dossier client ;
- reste visible dans Bookings, avec un filtre pour les masquer ou ne voir qu'elles.

Modèle de données (à préciser au moment de coder) :
- `bookings` : un marqueur de type, par exemple `kind` (`stay` | `day_visitor`), défaut `stay`
  → rien ne change pour l'existant.
- `clients` : `custom_lesson_rate` (EUR/h, nullable) = le tarif perso.
- **Décharge sur le client** : aujourd'hui `waiver_accepted_at` / `waiver_version` sont sur
  `bookings`. Pour un habitué, il faut une décharge **une fois par client** (colonnes côté
  `clients`, la résa pouvant continuer d'hériter). Ne pas casser le formulaire public, qui écrit
  sur la résa.

## Étape 1 — ce qui a été livré (2026-09-25)

| Quoi | Où |
|---|---|
| Règles (qui est une visite, présent quel jour, réutiliser la visite du jour, tarif proposé, recherche) | `utils/dayVisitor.ts` + tests |
| Formulaire (modale, mobile en bas d'écran) | `components/planning/WalkInForm.tsx` |
| Enregistrement séquencé client → visite → cours/location → paiement | `components/planning/walkInSave.ts` |
| Bouton 🚶 Walk-in dans chaque créneau du Daily, badge 🚶 sur les cartes, légende | `LessonWeekView.tsx` |
| Hors grille hébergement (ligne No room + totaux) et hors Now | `PlanningView.tsx` (`gridBookings`) |
| Hors alertes de séjour (paiements non vérifiés toujours signalés) | `pendingActions.ts` |
| Hors Documents, complétude (⚠️), attribution des sources | `DocumentsPage`, `bookingCompleteness`, `attribution` |
| Bookings : chip « 🚶 Walk-ins », visites exclues des autres filtres, badge 🚶 | `BookingsPage.tsx` |
| Fiche client : tarif perso, décharge (lecture + édition), nombre de venues | `ClientsPage.tsx` |

Détails qui comptent :
- **`check_out = check_in + 1`** (contrainte `check_dates`), mais une visite n'est « présente » que
  le jour de `check_in` : toujours passer par `isOnSiteOn`, jamais `check_in <= d <= check_out`.
- Même client, même jour → **même visite** (un cours le matin + une location l'après-midi = une
  résa, un solde). Ne marche **qu'après la migration** (il faut `kind` pour reconnaître une visite).
- Prix proposé = tarif perso, sinon tarif officiel **avec paliers** (les heures des venues passées
  comptent, via le `client_id` du participant). Toujours modifiable, figé sur la leçon.
- Paiement « Payé maintenant » : `is_verified = true`, note « Walk-in ».
- Nouveau client : réutilise un client existant si l'email correspond exactement (`clientIdentity`).
- **Sans la migration** : tout s'enregistre, un avertissement liste ce qui manque, et la visite
  apparaît comme une résa normale dans la ligne « No room ». Vérifié à l'écran sur TEST le
  2026-09-25 (client fictif créé puis tout supprimé, 0 ligne restante).

### Reste à faire / points ouverts de l'étape 1
- ⬜ **Passer la migration** TEST + PROD, puis refaire le test écran (même visite réutilisée,
  visite absente de « No room », tarif perso et décharge enregistrés).
- ⬜ **Page partagée Restaurant** : elle liste les résas présentes et ne peut pas lire `kind`
  (pas de GRANT anon, volontairement). Un walk-in y apparaîtra comme un invité d'une nuit.
  Décision à prendre par gui : `GRANT SELECT (kind) ON bookings TO anon` (colonne non
  sensible) + filtre dans `RestaurantSharePage`, ou laisser tel quel.
- ⬜ Décharge **par lien** (signée sur le téléphone du client) : pas faite, seule la case
  « signée sur papier » existe.
- ⬜ Pas de bouton « + Walk-in » ailleurs que dans le Daily (Prévisions, Home) : à voir à l'usage.

## Étape 2 — Packs

Un **pack** appartient à **un client** (pas à une résa).

- **Vente** : nombre d'heures, prix total libre, date, **note libre**, paiement encaissé.
  Le chiffre d'affaires est compté **à la vente**, dans la saison de la vente.
- **Consommation** : sur une venue walk-in, la leçon est marquée « couverte par le pack ».
  → prix client 0 (déjà payé), **paie moniteur normale** (`instructor_rate`, déjà séparé du
  prix client).
- **Solde** : « 6h / 10h utilisées » sur la fiche client et dans la fenêtre Walk-in, avec la note.
- **Pas d'expiration** : le solde passe d'une saison à l'autre. Conséquence assumée : une saison
  peut montrer des leçons couvertes sans revenu en face → à afficher clairement en compta.
- Même principe que les forfaits agence Fun & Fly : on encaisse le forfait, le compteur d'heures
  sert au suivi (voir mémoire `project_agency_flat_packages_no_hour_tracking`).

Modèle de données (à préciser) : table `lesson_packs` (client_id, hours, price, sold_at, notes)
+ un lien leçon → pack (`lessons.pack_id` nullable). Admin-only, aucun GRANT anon.

## Points ouverts (à trancher en codant)

- Une location (et pas un cours) peut-elle être couverte par un pack ? Aujourd'hui le pack est
  pensé **en heures de cours**. La note libre couvre les cas mixtes.
- Que faire quand le solde tombe à 0 en pleine leçon (pack de 10h, leçon de 2h, reste 1h) ?
  Proposition : couvrir 1h par le pack, facturer l'heure restante au tarif perso.
