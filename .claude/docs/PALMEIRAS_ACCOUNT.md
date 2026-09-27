# Compte courant Palmeiras — conception (2026-09-27) · rien de codé

> Réfléchi avec gui en discussion les 26–27/09, à partir d'un cas réel (résa **#39**, Bungalow
> See View 5, client qui paie le Palmeiras en direct). **Pas une ligne de code** : ce document
> est à relire avec gui avant tout chantier. Questions encore ouvertes en § 7.

## 1. Le constat

- Les **bungalows appartiennent au Palmeiras** (les maisons, c'est nous qui les gérons).
- Selon le client, c'est **au cas par cas** :
  - **sous-location** : le client nous paie le bungalow, on doit sa part au Palmeiras ;
  - **paiement direct** : le client paie le Palmeiras, qui nous doit notre commission.
- Le Palmeiras est aussi le seul à avoir un **terminal CB** : des clients à nous paient par carte
  chez eux (mode de paiement `card_palmeiras`), donc **l'argent est chez eux**.
- On ne se règle pas ligne à ligne : **on compense** (le loyer qu'on leur doit, leur part d'un
  bungalow, nos commissions, les paiements CB) et seul le solde est réglé.

→ Le Palmeiras n'est pas un fournisseur : c'est un **compte courant**.

## 2. Ce que fait l'app aujourd'hui (vérifié dans le code le 2026-09-27)

| Élément | Où | Comportement |
|---|---|---|
| Coût bungalow | `accommodations.cost_per_night` (Options → Accommodations) | Ce qu'on paie au propriétaire. **Relu en direct**, pas figé sur la résa (`palmeirasUtils.buildBungalowRows`) → le changer réécrit toutes les marges passées |
| Prix de vente | grille « Sell rate » → figé dans `booking_room_prices` à la résa | Ce que le client **nous** doit |
| Marge bungalow | onglet Palmeiras | (vente − coût) × nuits |
| Dashboard | carte « bungalow owners » | coût × nuits compté comme dépense |
| Reversals | Palmeiras → Reversals | Saisie **manuelle** mensuelle : « Total they collected » × % (**15 % par défaut**) = ce qu'ils nous doivent. Sens exact inconnu (§ 7) |
| Rent / Free Entries | Palmeiras → Rent / Free Entries | Saisies manuelles mensuelles |
| `card_palmeiras` | `payments.method` | Solde la dette du client — **et c'est tout** : n'apparaît nulle part dans la relation Palmeiras |

**Seul modèle connu pour un bungalow : la sous-location.** Le paiement direct n'existe pas :
- #39 affiche le client **dû 340 €** au centre (faux) et une dette de **308 €** au Palmeiras
  (fausse) ; les ~34 € que le Palmeiras nous doit n'apparaissent nulle part ;
- la fiche Bungalow See View 5 encode la commission à la main (vente 170 / coût 154 ≈ 10 %),
  alors que gui pense que la marge est plutôt de **15 %** — l'une des deux valeurs est fausse.

L'onglet Palmeiras mélange deux questions : **« combien le Palmeiras nous rapporte »**
(résultat) et **« qui doit combien à qui »** (compte courant). Il ne répond qu'à la première,
et encore sans les paiements CB.

## 3. Décisions prises

| Question | Décision |
|---|---|
| Paiement direct : pour tous les bungalows ou au cas par cas ? | **Au cas par cas**, par résa |
| Sur quoi porte la commission ? | Sur le **prix réellement payé par le client** |
| Taux de commission | **Modifiable** (gui ne se souvient plus du chiffre exact, a priori **15 %**) |
| Comment se règle-t-on ? | **Par compensation** avec ce qu'on leur doit (loyer, part d'un bungalow sous-loué) |
| Paiements `card_palmeiras` | Argent de nos clients encaissé chez eux → **ils nous le doivent**, se soustrait dans le compte |
| Pistes écartées | Dupliquer le bungalow en version « direct » (2 lignes au planning, dispos qui se contredisent) ; tout passer par Reversals à la main (le faux « dû » client reste affiché) |

## 4. Le modèle proposé

### 4.1 Le taux de commission

- Un champ **« Commission % »** sur la fiche bungalow, pré-rempli à **15 %**. Il **remplace**
  `cost_per_night` (voir la question ouverte § 7.2).
- **Figé sur la résa** à la réservation, comme le prix de la nuit. Changer le taux plus tard ne
  réécrit pas le passé.
- **Modifiable résa par résa** dans les finances de la résa, **note obligatoire** (même geste
  que les corrections de prix existantes). Sert aussi à rattraper les anciennes résas quand le
  vrai taux sera retrouvé.

### 4.2 L'option « payé en direct au Palmeiras »

Sur la chambre bungalow d'une résa (`booking_room_prices` ou équivalent) :

| | Sous-location (défaut actuel) | Payé en direct |
|---|---|---|
| Le client doit au centre | prix × nuits | **0** (ligne affichée « paid directly to Palmeiras ») |
| Revenu hébergement | prix × nuits | **0** |
| Le centre doit au Palmeiras | (100 % − taux) × prix payé | **0** |
| Le Palmeiras doit au centre | 0 | **taux × prix payé** |
| Planning | bungalow occupé | bungalow occupé (inchangé) |

Le même taux sert dans les deux sens : **une seule règle**.

### 4.3 Le compte courant

| Le centre doit au Palmeiras | Le Palmeiras doit au centre |
|---|---|
| Loyer du mois (Rent) | Commission des bungalows **payés en direct** |
| Part d'un bungalow **sous-loué** (payé chez nous) | Paiements **`card_palmeiras`** de nos clients |
| Dépenses manuelles (Free Entries) | Reversals (§ 7.1) |
| | Recettes manuelles (Free Entries) |

+ une ligne **« Règlement »** (qui a payé le solde, quand, combien) → **solde reporté de mois en
mois**, lisible comme un relevé : « au 30/09, le Palmeiras nous doit X € ».

Les lignes automatiques (commissions, parts, CB) se **dérivent** des résas et des paiements,
comme `buildBungalowRows` aujourd'hui : rien à ressaisir. Seuls le loyer, les entrées libres et
les règlements restent manuels.

### 4.4 Deux vues, pas une

- **Compte courant** (nouveau) : qui doit combien à qui, soldes, règlements. Les paiements CB y
  sont — ce sont des flux d'argent, pas du résultat.
- **Résultat** (existant, KPI dashboard + net de l'onglet) : ce que la relation rapporte. Les
  paiements CB n'y sont **pas** (déjà comptés comme revenu client). ⚠️ L'écart voulu entre net de
  l'onglet et KPI dashboard (`TEST_SUITE_ACCOUNTING.md` § Palmeiras) est à revoir avec le modèle.

## 5. Ce que ça touche (repérage, pas un plan)

- Migration : taux sur `accommodations`, taux figé + drapeau « direct » par chambre de résa,
  table des règlements Palmeiras. Garder la redaction anon (`share_price*`, § gotchas n°4).
- `palmeirasUtils.ts` (+ tests) : lignes bungalow par taux, compte courant.
- `computeSeasonTotals` : revenu hébergement / `bungalowCosts` sans les séjours directs,
  commission comptée.
- `BookingFinances` : ligne « paid directly », override du taux.
- `computeBookingTotal` et **tous ses appelants** (dû client, CollectionsModal, pages partagées
  client, mcp-server — cf. [[reference_mcp_server_consumes_client_code]]).
- Formulaire de résa : cocher « payé en direct » à la création.
- `PalmeirasTab` : vue compte courant.

## 6. Reprise des données existantes

- **#39** (Bungalow See View 5, 25→27/09) : à passer en « payé en direct » dès que c'est codé.
  En attendant : **ne rien encaisser** pour le bungalow, le « dû 340 € » est faux.
- Les Reversals déjà saisis : voir s'ils contiennent déjà des commissions bungalow (risque de
  **double comptage** une fois les commissions automatiques).
- Les anciens séjours bungalow : taux figé = à déduire de vente/coût actuels, ou taux par défaut ?

## 7. Questions ouvertes

1. **Reversals : 15 % de quoi ?** Si c'est déjà « ce qu'ils ont encaissé en bungalows × 15 % »,
   c'est la version manuelle de § 4.2 et il faut éviter de compter deux fois. Piste : relire les
   notes des Reversals saisis.
2. **Sous-location : on leur doit (100 % − taux) du prix payé, ou un coût fixe par nuit ?**
   Si c'est le pourcentage, `cost_per_night` disparaît (et le piège du coût non figé avec).
3. **Le vrai taux** (15 % ? 10 % ?) et s'il est le même pour tous les bungalows (B1 : coût 45 €).
4. **Règlements** : faut-il un moyen de paiement (cash / virement) et une pièce jointe ?
5. **Solde d'ouverture** : à partir de quand démarre le compte courant, avec quel solde ?
