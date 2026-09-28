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
