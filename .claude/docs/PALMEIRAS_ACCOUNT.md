# Bungalows Palmeiras payés en direct — conception (2026-09-27) · rien de codé

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

## Ce qu'on code (quand gui dit go)

1. **Case « Paid directly to Palmeiras »** sur la ligne bungalow dans les finances de la résa
   (`BookingFinances`), + note libre (date du paiement).
2. Cochée → le bungalow **sort du dû client** et du **revenu hébergement**, et son **coût
   propriétaire ne compte plus** (onglet Palmeiras + carte « bungalow owners » du dashboard).
   La ligne reste visible, grisée, avec la mention.
3. **Bonus facultatif** : dans l'onglet Palmeiras, liste « bungalows payés en direct ce mois »
   avec leur total, à recopier dans Reversals lors des comptes.

À toucher : `computeBookingTotal` et **tous ses appelants** (dû client, CollectionsModal, pages
partagées client, **mcp-server** — il consomme le code de `client/`), `palmeirasUtils`
+ tests, `computeSeasonTotals`. Stockage probable : un booléen + note sur
`booking_room_prices` (attention aux colonnes `share_price*` générées, cf. gotchas Supabase n°4).

## Écarté (ne pas relancer sans que gui le demande)

Compte courant automatique avec soldes reportés, taux de commission figé par résa, lignes de
règlement, suppression de `cost_per_night`, déduction automatique des paiements CB.

## Reprise

- **#39** : ne rien encaisser pour le bungalow. Une fois codé : cocher la case, noter la date,
  puis le mettre dans Reversals au prochain point mensuel.
- Remarque : la fiche Bungalow See View 5 est à vente 170 / coût 154 (≈ 10 % de marge), alors
  que gui pense à 15 %. À vérifier un jour, sans urgence.
