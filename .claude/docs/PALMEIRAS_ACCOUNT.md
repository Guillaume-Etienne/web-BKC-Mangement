# Compte Palmeiras

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
