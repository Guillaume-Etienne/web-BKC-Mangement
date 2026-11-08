# Compte Palmeiras

## Meticals comme base — codé le 2026-11-08 (migration `2026-11-08_palmeiras_mzn_base`)

gui : « ils sont QUE en meticals ». Le compte se tient en MZN ; les euros ne sont plus qu'un équivalent.

- **Règle unique** `utils/palmeirasTerms.ts` : `PALMEIRAS_COMMISSION_PCT` (15, ré-exporté par palmeirasStatement), `palmeirasCostMzn` (prix − 15 %), `palmeirasCommissionMzn` (15 %). Tarif = **prix public du Palmeiras** (`accommodations.palmeiras_price_mzn`, saisi dans Options → Accommodations) ; il remplace `cost_per_night_mzn` (jamais rempli, plus lu) et, quand il est là, le coût en € (`bungalowCostPerNight` = 85 % du prix au taux de l'arrivée).
- **Chaque ligne née en MZN porte `mzn` exact** : séjour au prix du Palmeiras (encaissé : nuits × prix − 15 % ; payé chez eux : 15 % de nuits × prix), loyer, règlement (`amount_mzn`), ligne libre (`amount_mzn`), paiement CB sur leur terminal (`payments.amount_mzn`, champ affiché dans le formulaire de paiement quand le moyen est `card_palmeiras`), commission réelle (`net_amount_mzn`). Sinon (vieilles données en €) : MZN = € × taux de sa date, marqué ≈.
- `withMznAmounts(input)` (remplace `withMznCosts`) : calcule les € de tout ce qui est né en MZN, au taux de sa date — appliqué une fois sur l'entrée, côté page partagée ET admin (`statementInputFromData` le renvoie déjà normalisé ; `stayInternalsFromData` lit ces mêmes séjours).
- `buildStatement` rend aussi `toUsMzn`, `toPalmeirasMzn`, `paidByUsMzn`, `paidByThemMzn`, **`balanceMzn`** (somme des MZN ligne à ligne) et `mznExact` ; `buildLedger` : `balanceMzn` / `balanceMznExact` par ligne, `closingMzn` par mois. Commission réelle saisie en MZN : l'écart se prend en MZN (seulement si tous les séjours directs du mois ont un prix MZN, sinon en € comme avant).
- **Affichage** : MZN partout (encadré du solde, tableau, frise, totaux du mois, règlements) ; bascule **MZN | MZN + € equivalents** à côté de Timeline/Table, mémorisée par appareil (`palmeiras_currency`). Sans aucun taux : retour aux €. Le signe se place après le ≈ (`fmtMzn(n, exact, sign)` → « ≈ −500 MZN »). Colonnes admin Billed / Margin : restent en € (chiffres BKC).
- **Formulaires** (onglet Palmeiras) : règlement, ligne libre et commission réelle se saisissent en MZN, € stocké = équivalent au taux du jour (fin de mois pour la commission) ; « Mark paid » pré-remplit les MZN du loyer ; « + Payment » pré-remplit le solde MZN.
- **Exports** : « BKC vous paie 10 200 MZN », « le client vous a payé 36 000 MZN · part BKC 15 % = 5 400 MZN » ; ≈ quand seul l'€ est connu. Fiche interne : coût exact si prix MZN.
- Vue « Internal result » et dashboard : restent en € (compta BKC) ; la commission des séjours payés en direct y suit aussi le prix MZN (`BungalowRow.paidRate`).
- Sécurité : `palmeiras_price_mzn` est LEUR prix public — exposable ; notre prix de vente reste hors de `StatementInput` et de la RPC. `accommodations` est lisible par tout jeton valide (comme `cost_per_night` déjà).
- Tests : `palmeirasStatement.test.ts` § « meticals as the base », `palmeirasUtils.test.ts` § « bungalow price in meticals », `exchangeRates.test.ts`, `palmeirasExports.test.ts`, `PalmeirasLedger.test.tsx`, `PalmeirasTimeline.test.tsx`.

## Taux dans le temps + tarifs en MZN — codé le 2026-11-01 (migration `2026-11-01b`)

- `utils/exchangeRates.ts` : `rateOn(rates, date, repli)` et `bungalowCostPerNight`. `data.eurMznRate` reste le dernier taux, `data.eurMznRates` l'historique. Hook : `useEurMznRateFor`.
- Palmeiras : chaque ligne au taux de sa date (séjour : arrivée, règlement : son jour), soldes au dernier taux, loyer et tarif MZN exacts. `withMznCosts` calcule le coût en € une seule fois sur l'entrée de la page partagée ; côté admin, `bungalowStays` fait le même calcul. Écarts de change : « ± Actual commission ».
- Le taux ne se saisit plus dans « Taxi Pricing Defaults » : `eur_mzn_rate` y est recopié par trigger.

## Table : MZN + prix facturé et marge (admin) — codé le 2026-11-01

- **Des deux côtés** : équivalent MZN sous chaque montant de la vue Table et dans le détail des séjours, au taux courant ; le loyer et son règlement complet gardent leurs vrais MZN. Taux absent : pas de MZN.
- **Admin seul** : colonnes Billed / Margin, ligne « Margin by bungalow » par mois, feuille d'export « Margins · Internal – BKC only ». `stayInternals` passe à part de `StatementInput`, qui ne doit jamais contenir le prix de vente. Tests : `PalmeirasLedger.test.tsx`, `palmeirasExports.test.ts`.
- Margin = ce que BKC garde : vente − coût sur un séjour encaissé, commission sur un séjour payé en direct (gui, 2026-11-01), plus l'éventuel ajustement de commission du mois dans le total. Pas de % au total d'un mois avec commission. Signalés : prix à 0 € (« No price ») et marge sous 15 %.

## Relevé « qui doit quoi à qui » + page partagée — codé le 2026-10-30

Demandé par gui avant son premier point avec le Palmeiras (aucun point fait jusque-là).
Décisions gui : commission **15 %** du prix payé chez eux (petits écarts de change possibles) ;
loyer **10 000 MZN/mois** (≈ 140 €, et non 850 €) ; montants en **€ + équivalent MZN** ;
ligne **règlement** datée pour remettre le solde à zéro ; le Palmeiras ne voit, pour un bungalow
qu'on a encaissé, **que ce qu'on lui doit** (jamais notre prix de vente) ; **nom complet** du client.

- **Onglet Accounting → Palmeiras** : bascule *Statement* (par défaut, ce que voit le Palmeiras)
  / *Internal result* (l'ancienne vue P&L, marge incluse — à ne pas montrer). Barre commune :
  + Rent (saisie en MZN, € proposé au taux courant), + Payment (règlement), + Income / + Expense
  (lignes libres, **leur description est visible du Palmeiras**), ± Actual commission (ex-Reversal).
  Bouton « Create / Copy Palmeiras link » (lien `palmeiras`, 1 an, géré aussi dans Shared Links).
- **Calcul unique** `client/src/utils/palmeirasStatement.ts` (`buildStatement`, testé) : séjour payé chez
  eux → +15 % à BKC ; séjour encaissé par nous → coût/nuit × nuits au Palmeiras ; loyer → au Palmeiras ;
  paiement `card_palmeiras` → à BKC ; ligne libre income/expense ; règlements déduits.
  Un séjour **pas encore commencé** et le loyer d'un mois **à venir** sont listés à part (*Upcoming*), hors solde.
- **Commission réelle** (`palmeiras_reversals`) : si saisie pour un mois, elle remplace les 15 % calculés ;
  le relevé n'affiche que l'écart (« Commission adjustment »). Même règle dans la vue interne et le
  dashboard (`monthlyCommission`) — avant, rien n'était compté tant qu'aucun Reversal n'était saisi.
- **Page partagée** `PalmeirasSharePage` ← RPC `palmeiras_statement()` (voir security-rls.md). Imprimable.
- **Frise des bungalows** (`components/palmeiras/PalmeirasTimeline.tsx`, 2026-10-30, demandée par gui « bien
  visuel, comme le planning ») : en tête du relevé, côté admin ET côté Palmeiras. Une ligne par bungalow (même vide),
  période continue du 1er mois avec séjour à aujourd'hui/dernier séjour, boutons de mois, défilement auto sur
  aujourd'hui. Barre violette = payé au Palmeiras (+15 % BKC), bleue = payé à BKC (coût dû), pointillés = provisoire ;
  montant sur la barre, détail au survol. Ligne « Month total » : nuits occupées, dû à BKC / au Palmeiras
  (lignes du relevé, loyer et CB compris), loyer en MZN, « not due yet ». Liste des bungalows : clé `bungalows`
  de la RPC (migration **30c**) ; sans elle, lignes déduites des séjours.
  Ligne **🏠 House rent** (le loyer de 10 000 MZN de la maison qu'on loue au Palmeiras, confirmé gui) : une barre
  par mois saisi ; un mois commencé sans loyer → « Rent not recorded yet » (visible aussi du Palmeiras) et, côté
  admin, bouton « + 10,000 MZN » qui l'enregistre au taux courant (montant différent → ✏ dans Internal result).
  Onglet admin et page partagée en pleine largeur.
- **Loyer du 15 au 15** (gui, 2026-10-30) : une ligne `palmeiras_rents.month = '2026-10'` = période 15/10 → 15/11,
  datée et due le 15 (`rentPeriod`, `RENT_PERIOD_DAY`). Première période 15/09/2026 (`PALMEIRAS_RENT_START_MONTH`) :
  aucun rappel avant.
- **Deux vues** (bascule mémorisée par appareil, admin ET Palmeiras) : 📅 **Timeline** (frise + liste des règlements)
  et 📋 **Table** = relevé chronologique (`PalmeirasLedger`, `buildLedger` testé) : une ligne par mouvement, solde
  courant, sous-total + solde de clôture par mois, règlements en lignes (− sur le côté qu'ils soldent), ligne « Today »,
  puis « Upcoming » grisé hors solde. L'ancienne liste « par mois » est remplacée par la Table.
- Séjour daté à l'**arrivée** (essai) — 🔔 rappeler à gui qu'on peut passer à la date de départ.
- Lignes libres (Revenu / Dépense) : vraie **date** (`palmeiras_entries.date`, migration **30d**), `month` en découle.
- **Loyer « ✓ Paid le X »** (migration **30e**) : un règlement BKC → Palmeiras peut porter `rent_month` (la période
  qu'il paie). C'est lui qui compte dans le solde ; la frise en déduit la barre verte « ✓ Paid 17/10 », le Tableau
  nomme la ligne « House rent paid (15/10 → 15/11) ». Admin : bouton « Mark paid » sur une barre de loyer non payée →
  formulaire de règlement pré-rempli (montant du loyer, sens, date du jour). Supprimer le règlement = loyer non payé.
  Un loyer réglé dans une compensation mensuelle globale : ne pas le marquer (la barre reste rose, sans « impayé »).
- **Vue « Exports »** (2026-10-31, 3ᵉ bascule à côté de Statement / Internal) : feuilles imprimables façon Palmeiras,
  prévisualisées dans une iframe (= la page imprimée) puis « Print / Save as PDF ». Formats = registre `EXPORT_FORMATS`
  (`utils/palmeirasExports.ts`, testé) : *Month grid* (bungalows × jours), *Bungalow sheets*, *Stay list*. **Ajouter un
  format = une entrée dans le registre.** Construits depuis `StatementInput` → jamais notre prix de vente. Mois par mois ;
  montants optionnels (case), comptés au mois d'arrivée comme le relevé.
- Migrations `2026-10-30` (enum, SEULE) puis `2026-10-30b` : TEST ✅ (Claude, curl vérifié) / PROD à passer.
- Hors périmètre : Cash Flow compte toujours les Reversals saisis (pas la commission calculée) ; les
  règlements n'y apparaissent pas.

---

# Bungalows Palmeiras payés en direct — conception (2026-09-27) · codé le 2026-09-28

> Décidé avec gui le 2026-09-27, à partir de la résa **#39** (Bungalow See View 5).
> Une première version (compte courant complet, taux figé par résa, règlements) a été
> **abandonnée par gui : trop compliqué pour ce que c'est.** On reste **manuel**, avec **une
> seule case à cocher** en plus.

## Comment ça marche avec le Palmeiras (à rappeler à gui s'il oublie)

Les **bungalows appartiennent au Palmeiras** (les maisons, c'est nous). Deux cas, **au cas par
cas** selon le client :

| Cas | Qui encaisse | Qui doit quoi | Où c'est suivi |
|---|---|---|---|
| **1. Le client nous paie** (sous-location) | le centre | le centre doit au Palmeiras le prix **moins notre marge** | **Déjà en place** : coût/nuit sur la fiche bungalow (Options → Accommodations) → onglet Accounting → Palmeiras, marge par séjour |
| **2. Le client paie le Palmeiras** | le Palmeiras | le Palmeiras nous doit **notre %** du prix payé (~15 %, chiffre exact oublié) | **Manuel** : sous-onglet Palmeiras → **Reversals**, une ligne par mois : total encaissé chez eux × % |

gui fait les **comptes avec le Palmeiras une fois par mois**, par compensation (loyer, parts
bungalow, commissions). Les paiements clients passés sur **leur terminal CB** (`card_palmeiras`)
se déduisent à la main, en **Free Entries**, au même moment.

## Le seul trou (constaté sur #39)

Rien sur la résa ne dit « ce bungalow a été payé au Palmeiras ». L'app croit donc que le client
nous doit le bungalow (#39 : **340 €, faux**) et qu'on doit le coût au Palmeiras (**308 €,
faux**).

## Codé le 2026-09-28 (migration `2026-09-28_room_paid_to_owner.sql` à passer)

**Où :** Accounting → Bookings → la résa → sous la ligne du bungalow, case **« Paid directly to
Palmeiras »** (visible seulement sur un bungalow). La date du paiement va dans la note du prix
(✏️), comme toute correction.

- Stockage : `booking_room_prices.paid_to_owner` ; règle unique `isRoomPaidToOwner` (`utils.ts`).
- Cochée → hors `computeAccommodationRevenue` (donc dû client, dashboard, CollectionsModal,
  mcp-server), hors `bungalowCosts`, coût/marge à 0 dans `buildBungalowRows` et `HousesTab`.
  Le montant reste affiché barré sur la résa.
- Onglet Palmeiras : badge « Paid to Palmeiras » dans « Bungalow bookings detail » + ligne
  « Paid directly to Palmeiras this period : X € » = la base à recopier dans un **+ Reversal**.
- Page client partagée : bungalow retiré de la facture (requête à part, tolérante à la migration).
- Au passage : modifier une résa (BookingsPage) **effaçait** note de prix, ligne agence et
  maintenant la case ; ils survivent désormais tant que la chambre reste (note : si le prix
  ne change pas).
- Tests : `palmeirasUtils.test.ts` § « bungalow paid directly to Palmeiras ».

## Écarté (ne pas relancer sans que gui le demande)

Compte courant automatique avec soldes reportés, taux de commission figé par résa, lignes de
règlement, suppression de `cost_per_night`, déduction automatique des paiements CB.

## Reprise

- **#39** : ne rien encaisser pour le bungalow. Une fois codé : cocher la case, noter la date,
  puis le mettre dans Reversals au prochain point mensuel.
- Remarque : la fiche Bungalow See View 5 est à vente 170 / coût 154 (≈ 10 % de marge), alors
  que gui pense à 15 %. À vérifier un jour, sans urgence.
