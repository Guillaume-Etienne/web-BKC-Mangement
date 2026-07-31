# BACKLOG — reste à faire (source de vérité unique)

> **La** liste canonique des tâches restantes. Mise à jour à chaque session (ajouter/rayer ici,
> pas dans la mémoire). Chaque entrée dit : quoi, pourquoi, et comment s'y prendre.
> Rappels transverses : migrations = **TEST + PROD dans la foulée, une seule tâche** ;
> vérifier les migrations sécu par **curl anon direct** (pas seulement `has_table_privilege`) ;
> Claude commit, **gui push lui-même** ; `npm run build` avant tout push.

---

## 🚨 MIGRATIONS SQL EN ATTENTE D'APPLICATION (gui)

> Registre des migrations écrites mais **pas encore passées**. Une ligne par migration ;
> on la raye seulement après vérification **par curl anon** sur les DEUX bases.
> Rappel : TEST + PROD dans la foulée, et ne jamais croire « c'est passé » sans test réel
> (piège vécu le 2026-07-06 : SQL editor ouvert sur le mauvais projet, migration idempotente
> → zéro erreur et faux positif).

| Migration | Contenu | TEST | PROD |
|---|---|---|---|
| `2026-07-31_equipment_pricing_defaults.sql` | Nouvelle table `equipment_pricing_defaults` (1 ligne) : les 3 curseurs du tab Equipment → CA (part matériel, part accessoires, ratio kite/planche), jusque-là en dur dans `EquipmentPage.tsx`. Pas d'accès anon. | ⬜ | ⬜ |
| ~~`2026-07-29_lesson_pricing.sql`~~ | `price_items.lesson_type` + `lessons.price_per_hour` + REVOKE anon sur `instructors.rate_*` et `lesson_rate_overrides` | ✅ 2026-07-29 | ✅ 2026-07-30 |
| ~~`2026-07-30a_price_category_values.sql`~~ | **À passer SEUL et EN PREMIER** : ajoute les catégories `meal` et `center_access` | ✅ 2026-07-30 | ✅ 2026-07-31 |
| ~~`2026-07-30b_billable_types.sql`~~ | `price_items.billable_type` (fusionne et remplace `lesson_type`), semis des 10 postes aux montants jusque-là codés en dur, suppression des lignes `taxi` fantômes, **snapshot de la paie moniteur** (`lessons.instructor_rate`), et **C3** : `room_rates` lisible par un lien client, limité à SES chambres | ✅ 2026-07-30 | ✅ 2026-07-31 |
| ~~`2026-07-30c_room_rates_revoke.sql`~~ | Correctif du REVOKE manquant sur `room_rates` (2 lignes). **Inutile en PROD** : déjà intégré dans (b), qui n'y est pas encore passé | ✅ 2026-07-31 | — (inclus dans b) |

> ⚠️ **Deux fichiers, pas un — et dans cet ordre.** PostgreSQL refuse d'utiliser une
> valeur d'enum ajoutée dans la même transaction, et l'éditeur SQL du dashboard exécute
> tout un script dans UNE transaction (contrairement à `psql`, où des `ALTER TYPE` placés
> avant le `BEGIN` s'auto-committent). Erreur si on les fusionne :
> `55P04 unsafe use of new value "center_access" of enum type price_category`.
> **Leçon générale** : toute migration qui ajoute une valeur d'enum *et* s'en sert doit
> être coupée en deux fichiers.

### ⛔ Ne PAS déployer ce code sans passer la migration du 2026-07-30

Sans la colonne `billable_type`, **plus aucun tarif n'est trouvé** : leçons, locations,
accès centre et repas se proposent à 0 €. C'est visible (rouge à l'écran, « no rate
configured ») et non destructeur — les montants déjà enregistrés sont figés sur leurs
lignes — mais l'app est inutilisable pour saisir. La migration et le déploiement vont
ensemble. Côté C3, sans la migration la page client garde son comportement actuel
(0 €/nuit quand le prix figé manque) : la requête `room_rates` revient juste vide.

⚠️ La migration **supprime `price_items.lesson_type`**, appliquée le 2026-07-29. C'est
assumé : la PROD ne contient aucune donnée réelle avant l'ouverture de mi-septembre 2026.
Ne pas reprendre cette liberté après.

### ✅ Vérifié sur TEST le 2026-07-30 (app locale pilotée au navigateur + curl anon)

| Contrôle | Résultat |
|---|---|
| Options → Pricing | 5 sections, **10 badges 🔒**, **zéro ligne rouge** |
| Les 5 lignes de location de TEST | rattachées par leur nom, **prix et libellés inchangés**, rien semé en double |
| Repas / Accès centre | lignes créées (0 € et 5 €), verrouillées comme les autres |
| Tarif de location dans le planning | Kite → 40 €, Board → 20 €, lus en base |
| Accès centre dans le wizard | pré-rempli à **5 €/jour** (la constante `5` n'existe plus dans le code) |
| Full house sans tarif configuré | **0 €/nuit** au lieu du 100 € inventé |
| Verrou d'une ligne qui facture | nom `readOnly` (« ZZZ » tapé dedans reste « Group »), « Applies to » `disabled`, prix éditable, corbeille éteinte |
| **C3 par curl anon** | token client → **sa seule chambre** (H1/F, 60 €), **pas** le tarif du bungalow ; sans token → `[]` ; token taxi → `[]` |

Aucune donnée créée pendant les tests (toujours 9 réservations, wizard fermé sans
enregistrer). **Seule modification laissée dans TEST** : tarif **H1 / chambre F = 60 €/nuit**,
posé pour prouver le filtrage par ligne — à garder ou vider selon l'envie de gui.

#### 🔴 Bug trouvé par le curl (et corrigé) — le REVOKE manquant

`room_rates?select=notes` répondait `[]` au lieu de **42501** : anon gardait le `SELECT`
**de table** que Supabase pose par défaut sur tout le schéma public, donc les GRANT de
colonnes ne restreignaient **rien** — les notes internes des tarifs seraient devenues
lisibles depuis n'importe quel lien client dès qu'une ligne passe la policy. Aucune fuite
réelle (aucune maison de TEST n'avait de tarif → zéro ligne rendue). C'est le gabarit du
Lot C (REVOKE puis GRANT colonnes), appliqué à 4 tables en juillet et oublié ici.
**Leçon : un GRANT de colonnes ne protège que si le GRANT de table a été retiré avant.**

✅ **Correctif appliqué sur TEST le 2026-07-31 et vérifié par 5 curls** : `select=notes`
et `select=*` avec un token client → **42501** (c'était `[]`) ; `select=room_id,
price_per_night` → **la seule chambre du booking** ; sans token et token taxi → `[]`.
Colonnes et lignes tiennent désormais ensemble. **C3 est bon sur TEST.**

### ✅ PROD appliquée et vérifiée le 2026-07-31 — registre vide

**Structure, par curl anon** : `price_items.billable_type` présent (`[]`) tandis que
`lesson_type` et `rental_type` répondent **42703 « column does not exist »** — la fusion a
bien eu lieu, pas seulement l'ajout ; `lessons.instructor_rate` et `price_per_hour`
présents ; `room_rates` → **42501** sur `notes` et sur `*` (le REVOKE inclus dans (b) a
mordu) et `[]` sur les colonnes autorisées sans token. Contrôle négatif habituel :
`select=nonexistent_col` → 42703, donc les `[]` prouvent bien l'existence des colonnes.

**Données, en ouvrant l'app locale sur PROD en lecture seule** (puis rebasculée sur TEST) :
les 10 postes sont là et **aucune ligne rouge**. Les 3 leçons ont gardé **leurs** prix
(60 / 36 / 40), les 5 locations les leurs (40 / 20 / 55 / 25 / 35), repas 0 €, accès centre
5 €. Les lignes `taxi` fantômes ont disparu (le panneau Taxi Pricing Defaults, lui, est
intact : 120 € / 6 000 MZN / 1 000 MZN / 70). Activités : catalogue libre, sans badge.
**Rien n'a été modifié en PROD.**

⬜ **Non vérifié en PROD, à contrôler par gui** : Options → Accommodations. Sur TEST les 3
maisons n'ont aucun tarif ; si c'est pareil en PROD, une résa maison entière démarrera à
**0 €** (avant, elle prenait 100 € en dur — un montant que personne n'avait choisi).

**TEST : appliquée et vérifiée le 2026-07-29** — les 4 contrôles verts (tarifs rattachés,
zéro orpheline, colonne snapshot présente, `rate_private` en anon → 42501 et
`id,first_name` → 200/0 ligne). Revenu leçons passé de 687 € à **1 052 €** comme prédit.

**PROD : appliquée le 2026-07-30, vérifiée par curl anon le jour même** — `rate_private` et
`rate_group,rate_supervision` → **42501** (la fuite de salaires est fermée),
`id,first_name` → `[]` et **pas** 42501 (les pages partagées lisent encore l'identité),
`lesson_rate_overrides` → **42501**. Les deux colonnes ajoutées existent bien :
`lessons?select=price_per_hour` et `price_items?select=lesson_type` répondent `[]`, et le
**contrôle négatif** `select=nonexistent_col` répond `42703` — donc `[]` prouve que la
colonne existe, ce n'est pas un champ ignoré en silence. Les 6 contrôles donnent le même
résultat sur TEST : les deux bases sont alignées.

⚠️ **Ce que le curl ne peut pas prouver** (RLS masque les lignes en anon) : que les 3 lignes
de tarif ont bien reçu leur `lesson_type`. À contrôler par gui — le plus simple est d'ouvrir
**Options → Pricing** en PROD : les 3 lignes de cours doivent afficher un « Applies to »
rempli (Private / Group / Supervision) et **aucune** mention rouge « no price configured ».

### ⛔ ~~Ne PAS déployer le code sans passer la migration~~ — sans objet depuis le 2026-07-30

*(Gardé pour la leçon : le repli silencieux à 0 € est le vrai piège de ce genre de migration.)*

Vérifié sur TEST le 2026-07-29 (app locale branchée sur TEST, migration non passée) :
le dashboard affiche **Lessons = 0 €** alors que la base contient 8 leçons. C'est le repli
sûr (pas de crash, pas de NaN), mais c'est bien 0 € facturé. Vercel déploie au push →
**passer la migration avant ou en même temps que le push**. PROD n'a aucune leçon
aujourd'hui, donc la fenêtre est sans danger tant qu'aucune leçon n'y est créée.

**Vérifications** (détail en bas du fichier SQL) :
1. `SELECT name, price, lesson_type FROM price_items WHERE category='lesson';`
   → Private/60/private, Group/36/group, Supervision/40/supervision.
2. **Orphelines** : `SELECT name FROM price_items WHERE category='lesson' AND lesson_type IS NULL;`
   → doit être vide. ✅ **Vérifié le 2026-07-29 : les deux bases nomment leurs lignes
   `Private`/`Group`/`Supervision`**, le rattachement auto marchera partout (ma crainte d'un
   seed TEST en français était infondée — contrôlé par API sur TEST).
3. **Curl anon** : `instructors?select=rate_private` → **42501** (c'était une fuite de
   salaires : ces colonnes étaient lisibles depuis n'importe quel lien client, cf. Lot C) ;
   `instructors?select=id,first_name` → `[]` (RLS Phase 2), **pas** 42501.
4. **Chiffres attendus sur TEST après migration** (mesurés avant, le 2026-07-29) :
   revenu leçons **687 € → 1 052 €**, coûts moniteurs **517 € inchangés**
   (dont un override à 60 € « TEST override » qui ne joue désormais que sur la paie).
   Marge du centre sur les cours : 200 € → 565 €.

**Puis, côté données** : Options → Instructors, mettre la paie de gui et de sa compagne à
**0**, vérifier Rémi et Tere (encore aux défauts 50/35/25 — seul Pierrot est renseigné).

Contexte complet : `.claude/docs/LESSON_PRICING.md`.

---

## 🔎 Audit global du 2026-07-31 (Opus, nuit) — 3 constats qui demandent une DÉCISION de gui

> Le reste de l'audit a été corrigé et committé (6 commits `ae096c1`→`5576d38`). Ces trois-là
> touchent à des **montants affichés** ou à un choix de design : je n'ai rien changé, exprès.

### 1. 💸 CashFlow ignore `palmeiras_entries`, que le Dashboard compte
**Vérifié dans le code** : `utils.ts:388-390` fait entrer les `palmeiras_entries`
(type `income`/`expense`) dans le `palmeirasNet` du **Dashboard**, alors que
`cashFlowUtils.ts` ne les lit **nulle part** — la colonne `palmIn` n'additionne que les
`palmeirasReversals`. Donc un même euro Palmeiras apparaît dans le résultat net et pas
dans le cash flow mensuel. Les entrées portent déjà un `month` (`YYYY-MM`), la clé exacte
sur laquelle CashFlow regroupe : techniquement c'est 2 lignes à ajouter.
**Pourquoi je ne l'ai pas fait** : il faut choisir *où* elles atterrissent (income → `palmIn` ?
expense → `expenses`, qui est aujourd'hui la table `expenses` générale ? ou `palmIn` devient
le net Palmeiras hors loyer ?). Chaque option change un chiffre affiché, et les tests ont
figé le comportement actuel. **→ dis-moi la colonne voulue, c'est 10 min.**
*(L'audit externe accusait aussi `activity_payments` : **c'est faux**, ils ne sont lus par
aucun calcul comptable, ni Dashboard ni CashFlow — juste affichés dans ActivitiesPage.
Question ouverte au passage : devraient-ils compter quelque part ?)*

### 2. 📅 « Net result » n'est pas filtré par saison
`computeSeasonTotals` lit **toutes** les résas, dépenses et leçons depuis l'origine ; la
table `seasons` est passée dans `SharedAccountingData` mais **jamais utilisée**. Le libellé
disait « Net result (season) ». Sans donnée réelle et avec une seule saison, ça ne change
rien aujourd'hui ; à la deuxième saison le chiffre devient un cumul à vie sous une étiquette
« saison ». **J'ai seulement rendu le libellé honnête (« all time »)** — implémenter un vrai
filtre demande tes règles : quelle saison est « courante », et on coupe sur la date de résa,
de check-in ou de paiement ? **→ à trancher avant l'ouverture de mi-septembre.**

### 3. 🧾 Une chambre sans tarif s'affiche « €0 » **sur la page client partagée**
Constaté en vrai sur le lien client `#021` : `H1/B 11 nuits ×100 € = 1 100 €`, puis
**`H1/F 11 nuits × 0 € = 0 €`**. C'est le point « tarifs des maisons » déjà listé plus bas,
mais vu du client : un lien partagé qui circule (WhatsApp, mail transféré) montre une
chambre facturée 0 €. **→ soit saisir le tarif, soit masquer/étiqueter les lignes à 0 sur
la page client.**

---

## 🎯 OÙ ON EN EST — chantier fiabilité compta (2026-07-29)

**Plan convenu avec gui, dans cet ordre.** Les étapes 1 et 2 sont faites.

1. ✅ **Faire atterrir la tarification des leçons** — migrations TEST (29/07) et **PROD
   (30/07)** passées et vérifiées par curl anon, code poussé et déployé.

### ✅ RÉGLAGES DE DONNÉES — faits en PROD le 2026-07-31

- **Tarifs des chambres** : H2 et H3 n'avaient **que** leur prix maison entière ; F et B y
  sont ajoutés à **70 / 50** (les tarifs donnés par gui, identiques à ceux que H1 portait
  déjà). ⚠️ **Les prix maison entière n'ont PAS été touchés** : gui a dit « 100 € », mais
  PROD porte **150 / 140 / 160**, un prix distinct par maison — c'était très probablement le
  100 de l'ancienne constante en dur, répété de mémoire. **En attente de sa confirmation.**
- **Prix du dîner** : **12 €** (Options → Pricing → Meals). Variable dans les faits, c'est le
  montant d'ouverture d'un nouveau repas, éditable repas par repas.
- **Paie des moniteurs** : rien à faire, **déjà correct** — Tere **0/0/0** (compagne de gui),
  Gui **0/0/0**, Pierrot 18/20/8, Rémi 18/20/5. La note « encore aux défauts 50/35/25 »
  était périmée.
- ⬜ **Reste ouvert** : le bungalow **B1 n'a pas de prix de vente** (`—`, coût 45 €/n) et
  **San Martinho** (catégorie « other ») non plus. À confirmer avec gui — un séjour y sera
  facturé 0 tant que rien n'est saisi.
2. ✅ **Extraire les agrégats** dashboard + CashFlow en fonctions pures et les tester.
   Vérifié iso-comportement sur TEST (4 413 € / +891 €). Détail : `TEST_SUITE_ACCOUNTING.md`.
3. 🔶 **Trancher les décisions métier** (`TEST_SUITE_ACCOUNTING.md`, section « Comportements
   encodés à confirmer »). Important : les tests ont **figé le comportement actuel**, donc
   si l'un est faux on a verrouillé une erreur.
   ✅ Tranchés : paiement « à vérifier » (compté, + ligne « still to verify », `b027763`) ;
   booking à 0 nuit (corrigé, `cee05fb`) ; baisse du montant payé (avertissement wizard,
   `104a9ec`) ; marge bungalow Palmeiras tab ≠ dashboard (**voulu**, verrouillé par un test).
   ✅ Aussi tranché : **leçon de groupe** facturée par tête / payée à plat = le modèle
   décidé le 2026-07-29 (`LESSON_PRICING.md`) — l'entrée « à confirmer » était périmée.
   ✅ **Tranché aussi le 2026-07-30** : (a) `computeBookingTotal` ne filtre pas les annulés →
   **on ne touche à rien** (les 5 appelants filtrent correctement, et le panneau de détail a
   besoin du total d'une résa annulée) ; (b) convives `extra` d'un repas → ils paient sur
   place, bouton **Unpaid / ✓ Paid** dans Now + total « to collect ». **Étape 3 close.**
4. ✅ **Tests côté base — FAIT**. Les 2 garde-fous, la non-duplication des `taxi_trips`, le
   snapshot `booking_room_prices` (écriture, mise à jour et rechargement) et le delta de
   paiement sont vérifiés bout-en-bout sur TEST — tableau complet dans
   `TEST_SUITE_ACCOUNTING.md`. Les 5 liens partagés PROD testés en anon, aucun 42501.
   Base TEST restaurée à l'identique après les tests.
   ✅ **Point remonté, réglé** : baisser le montant payé ne crée aucune écriture, donc
   `amount_paid` et la table `payments` divergeaient en silence (mesuré : 200 vs 260).
   Le wizard annonce désormais l'effet du save — avertissement si le montant est sous ce
   qui est déjà encaissé, ligne explicite sur le paiement créé sinon (`104a9ec`).
5. ✅ **Tous les prix passent par un lien unique `billable_type`** — audit du 2026-07-30
   à la demande de gui (« TOUS les prix devraient être comme ça »). Résultat de l'audit :
   sur 11 sources de montants, `price_items` catégories **activity et taxi n'étaient lues
   par personne** (donnée morte, comme les leçons avant le 29/07), les **repas** et
   l'**accès centre** n'avaient aucun écran de réglage, et trois montants vivaient dans le
   code (accès centre 5 €, full house 100 €, tarifs de location 40/20/55/25/35).
   Tout est semé en base **aux montants d'avant**, donc rien ne change dans ce qui est
   facturé — ces prix deviennent visibles et modifiables. ⬜ Reste : appliquer la migration.

7. ✅ **Snapshot de la paie moniteur** (`lessons.instructor_rate`, 2026-07-30). C'était la
   seule source de montant sans gel : la paie était lue au tarif **courant**, donc monter
   le tarif d'un moniteur en octobre augmentait ce qu'on lui devait pour juillet. Le taux
   est désormais figé à la création de la leçon (planning **et** forecast). L'ordre reste :
   override par leçon > taux figé > taux courant. Testé, dont le cas « 0 figé reste 0 ».

6. ✅ **Tarifs qui facturent = verrouillés** (demande gui du 2026-07-30). Une ligne de
   Options → Pricing liée à un `billable_type` ne peut plus être **renommée**,
   **déplacée** vers un autre type, ni **supprimée** : elle porte un badge « 🔒 bills … »,
   seul son prix reste éditable. Raison : le nom ne facture rien, le lien si — laisser le
   nom modifiable entretenait exactement l'illusion qui a coûté de l'argent trois fois
   (full house 100 €, leçons par nom, locations par nom). Un type facturable sans tarif
   apparaît en rouge « no rate configured, billed 0€ » au lieu de passer inaperçu.
   Le reste du catalogue (activités, taxi) reste librement éditable.

**Écarté volontairement** (rediscuter seulement si le problème se manifeste) : contrainte
`EXCLUDE` / trigger en base pour doubler les garde-fous applicatifs (conflit de dates, refus
d'annulation) ; normalisation des convives de repas (`dining_events.attendees` est du JSON,
`person_id` sans FK → repas orphelins si un participant est supprimé).

**État des tests** : `cd client && npm test` → **147 tests, ~1 s**. `npm run build`
type-checke aussi les tests. Trois suites : `utils.test.ts` (couche de calcul + agrégats
saison), `cashFlowUtils.test.ts` et `palmeirasUtils.test.ts`.

**Corrigé pendant ce chantier** (tout committé) : conflit de dates au save, coût des
hébergements externes lu sur le snapshot et non le référentiel, override sur repas gratuit
(garde-fou dupliqué à 5 endroits), arrondi taxi du dashboard désaligné du détail, refus
d'annuler une résa avec leçons/locations, `NaN` possible avant migration, fuite des salaires
moniteurs via les liens partagés, `as any` de `DocumentsPage` qui masquait un crash.

---

## ✅ Sécurité anon — CHANTIER TERMINÉ (2026-07-06)

Lots A+B+C (colonnes) + Phase 2 (lignes token-aware) tous appliqués & vérifiés par curl anon
sur TEST **et** PROD. État final + pièges : `.claude/docs/security-rls.md`. Ce qui reste de
sécu vit dans « Quand gui veut » (anti-spam) et Housekeeping (PAT).
**Micro-reste** : smoke visuel des vrais liens PROD par gui (Geraldo/driver/client) —
les curls sont verts, il s'agit juste de confirmer l'affichage des pages.

### Lot B — `bookings` full read — ✅ TERMINÉ & VÉRIFIÉ (2026-07-04)
Migration `2026-07-04_lot_b_bookings_columns.sql` appliquée **TEST + PROD** par gui, vérifiée
par curl anon direct sur les 2 bases : 42501 sur `select=*` / notes / amount_paid /
emergency_contact / visa ; 200 sur les 8 colonnes autorisées + embed `client:clients`.
ClientSharePage narrowé (commit `86b6a5a`). Dernier check visuel : ouvrir la page client
du seed en TEST après le prochain déploiement Vercel.

### Lot C — instructors / taxi_drivers / activity_providers — ✅ TERMINÉ & VÉRIFIÉ (2026-07-06)
Décisions gui (recos confirmées) : instructors → identité + tarifs (ClientSharePage en a
besoin) ; taxi_drivers → id/name/phone (gardé volontairement)/vehicle/seats ; providers →
tout sauf `notes`. Migration `2026-07-06_lot_c_columns.sql` + 6 pages narrowées + schema.sql.
Vérifié par curl sur TEST (6 types de tokens, colonnes bloquées → 42501, pages non cassées)
et PROD (grants). Seul type jamais curl-testé avec token : `activity_provider` (policies du
même gabarit ; à tester si un lien provider déconne un jour).

### Phase 2 — RLS token-aware — ✅ TERMINÉ & VÉRIFIÉ TEST + PROD (2026-07-06)
D1–D4 tranchés par gui (= les 4 recos). Header `x-share-token` dans `supabase.ts` +
migration `2026-07-06_phase2_token_rls.sql` (5 helpers + 22 policies) + `schema.sql` sync.
Vérifié par curls anon sur les 2 bases : sans token / token bidon → `[]` sur les 22 tables ;
en TEST avec les 5 tokens du seed : chaque type ne voit que SES lignes (D1 prouvé — Beach BBQ
invisible pour le client ; D4 prouvé — trajet margin=0 invisible pour Geraldo). Smoke visuel
des pages partagées TEST fait par gui. ⚠️ Piège vécu : première « application PROD » était en
fait sur TEST (SQL editor sur le mauvais projet, migration idempotente = aucun message
d'erreur) — détecté par curl, refaite sur le vrai PROD `oslsbansxaajcpwhivmx`.
**Micro-reste** : (a) gui ouvre ses vrais liens PROD (Geraldo, driver, client) pour smoke
visuel ; (b) tokens `restaurant` / `activity_provider` absents du seed → types non
curl-testés (policies identiques aux autres ; à couvrir si un lien de ces types déconne).
⚠️ Realtime : pages partagées sans live-update (websocket sans header) — assumé, refresh OK.

---

## 🟠 Compta

### CashFlow — sorties MZN chauffeurs/manager — ✅ IMPLÉMENTÉ (2026-07-04)
Q1 répondue (chauffeurs payés au trajet, Geraldo au réel) → colonne « Taxi out » dans CashFlow
(drivers = trips `done`, manager = `taxi_manager_payments`, MZN→€ taux global) + TaxiFinanceTab
bi-devise (MZN + ≈€) avec colonne Centre margin. Détail : `cashflow-mzn-design.md`.

### Dashboard compta — marge taxi mise en avant — ✅ FAIT (2026-07-04, validé gui)
Card inversée : « Taxi margin » en gros chiffre, « X€ billed − Y€ costs (MZN→€) » en sous-titre.
La barre « Taxis » du Revenue breakdown reste en BRUT (cohérence Billed/Collected/Outstanding —
les clients doivent le brut). Formule du Net result inchangée.

---

## ✅ Responsive mobile — Home/Clients/Planning/Management (2026-07-09)

Commit `5b32f44`. Home : 6 raccourcis compacts (+ Accounting/Equipment/Taxis/Activities) +
pending actions sur une ligne (troncature). Clients : toggle List/Cards mobile (défaut
List si écran <768px), bouton delete ajouté au panneau détail. Planning : contrôles
saison/mois/now + barre d'onglets compressés sur une ligne mobile (libellés abrégés).
Management : barre d'onglets qui débordait à droite en mobile — corrigée (scroll fallback
+ libellés compacts). Pas de vérif visuelle par Claude (login admin requis) — testé par gui.

---

## 🟠 Templates de documents en DB + Welcome Guide (2026-07-09) — reste le Save initial par gui

Code fait & build OK. Découverte : les sections des guides vivaient en **localStorage**
(par navigateur, perdues au clear cache, pas partagées entre admins) et chaque frappe
était « sauvée » sans validation. Refonte :
- Table **`document_templates`** (admin-only, REVOKE anon) — sections des 2 guides.
- Nouveau document **Welcome Guide** 🏝️ (infos sur place : wifi, repas, eau, élec,
  programme, linge, argent, urgences, check-out — défauts avec placeholders `[…]` à
  personnaliser dans Templates) : onglet dédié, PDF FR/EN/ES + email (`welcome_guide`).
- Édition en brouillon + **bouton Save explicite** (Cancel, indicateur unsaved) dans les
  onglets Travel Guide / Welcome Guide / Templates (switcher Travel/Welcome).
- Premier Save sème la table (fallback : localStorage legacy pour le travel guide → les
  éditions existantes de gui sont récupérées **dans le navigateur habituel**).

1. ~~Migration TEST + PROD~~ ✅ appliquée par gui (2026-07-10).
2. ~~Vérif curl anon~~ ✅ FAIT (2026-07-10) sur les 2 bases : SELECT **et** INSERT anon sur
   `document_templates` → `42501 permission denied` (pas `[]` — REVOKE effectif, table
   présente). Enum `welcome_guide` prouvé présent : `email_logs?type=eq.welcome_guide`
   passe le parseur (`[]`) alors que `eq.zzz_bidon` → `22P02 invalid input value`.
3. **RESTE** : gui ouvre Documents → Travel Guide **dans son navigateur habituel** et clique
   **Save** (migre ses textes localStorage vers la DB — sur PROD **et** TEST si les textes
   diffèrent) ; idem Welcome Guide après avoir rempli les placeholders `[…]`.
4. **RESTE — traductions EN/ES des textes FR de gui** (workflow convenu 2026-07-10,
   Claude n'a pas accès à la table — anon 42501) : gui rédige le FR dans l'app + Save,
   puis colle à Claude le résultat de
   `SELECT id, title->>'fr', content->>'fr' FROM document_templates WHERE doc_type='welcome_guide' ORDER BY sort_order;`
   → Claude rend un script `UPDATE … jsonb_set(…)` en/es idempotent → gui l'applique
   **TEST + PROD**. Retouches ponctuelles ensuite : simple copier-coller chat → éditeur
   Templates. (Plan C : Claude in Chrome sur la session admin — lent, dernier recours.)

---

## 🔴 Audit externe 2026-07-25 — findings vérifiés (C1+C2 corrigés le 2026-07-28)

Audit lancé par gui depuis Claude **web** sur le même repo. Rapport `docs/audit-2026-07.md`
**perdu** (conteneur éphémère, push 403) — gui a le .md téléchargé de son côté. Les findings
ci-dessous ont été **revérifiés dans le code par Claude Code le 2026-07-25** : deux
descriptions de l'audit web étaient fausses dans le détail, c'est la version corrigée qui
fait foi. Rien n'est corrigé à ce stade, décision gui = « on y revient plus tard ».

### C1 — Full house : le tarif configuré n'est JAMAIS lu 💸 — ✅ CORRIGÉ (2026-07-28)
Était : `BookingsPage.tsx:361` → `const each = 100 / accRoomIds.length` (100 € en dur), le
tarif saisi dans Management (`room_rates` clé `full_{accommodation.id}`) n'était lu nulle part.
**Fix** : nouveau module `client/src/utils/roomPricing.ts` (`getFullHouseRate`,
`DEFAULT_FULL_HOUSE_RATE = 100`) ; `toggleFullHouse(accId, accRoomIds)` lit
`full_${accId}` et retombe sur 100 seulement si le tarif n'est pas configuré.

### C2 — `getRoomNightlyRate` renvoie 0 sans fallback 💸 — ✅ CORRIGÉ (2026-07-28)
Était : `components/accounting/utils.ts:13` → `snapshot?.price_per_night ?? 0` malgré le
commentaire « snapshot → base rate fallback » ⇒ hébergement à 0 € dès qu'une ligne
`booking_room_prices` manque.
**Fix** : `getBaseNightlyRate()` dans `utils/roomPricing.ts` — fallback `room_rates`,
**full-house-aware** (si TOUTES les chambres d'une maison sont sur la résa, on prend le tarif
`full_{accId}` divisé par le nombre de chambres, pas la somme F+B qui surfacturerait).
Utilisé par `getRoomNightlyRate` (donc AccountingDashboard/HousesTab/BookingFinances/CashFlow)
**et** par `bookingToWizard` (qui avait un fallback naïf, non full-house). `roomRates` ajouté à
`SharedAccountingData` (fourni par AccountingPage ; DocumentsPage passe aussi
rooms/accommodations/roomRates au calcul du total Summary, même bug là-bas).
`BookingFinances` : le badge rouge dit maintenant « ⚠ base rate » quand un tarif de repli est
appliqué, « ⚠ no price » quand il n'y a vraiment rien (0 €).
**Reste → tâche C3 ci-dessous** (décidé avec gui le 2026-07-28 : on le fait ensuite).

### C3 — Même fallback sur la page client partagée — ✅ CODÉ (2026-07-30), ⬜ migration à appliquer
`ClientSharePage` retombe désormais sur `getBaseNightlyRate()` quand la résa n'a pas de prix
figé, au lieu d'afficher **0 €/nuit** au client. Code fait ; il ne s'allume qu'une fois la
migration `2026-07-30_rental_pricing_and_room_rates.sql` passée.

**Décision gui (2026-07-30) : liens `client` uniquement**, et j'ai resserré plus loin que la
spec d'origine — un token client ne lit **que les clés de sa propre réservation**
(ses chambres + la clé `full_{accId}` de leur maison), pas toute la grille. Helper
`share_room_keys()` (SECURITY DEFINER, gabarit Phase 2) + `GRANT SELECT (room_id,
price_per_night)` — jamais `notes`.
**Pourquoi ce resserrage** : un lien partagé est une URL, et une URL circule (WhatsApp, mail
transféré). Ce qui sort par cette porte doit être la facture du porteur, pas le catalogue.
**Vérif obligatoire, 4 curls par base** (détaillés en bas du fichier SQL) : sans token → `[]`,
avec token client → seulement ses chambres, `notes` → 42501, token taxi → `[]`.

### S1 — `send-email` = relais mail — ✅ CORRIGÉ & DÉPLOYÉ PROD (2026-07-28)
La fonction exige désormais un **utilisateur connecté** : le JWT `Authorization` est revérifié
par `auth.getUser()` (clé anon) et tout ce qui n'est pas un vrai compte → **401**.
La clé anon publique et les liens partagés ne suffisent plus. Rien d'autre ne change
(templates toujours côté front) ; seul appelant = `DocumentsPage` (admin loggué).
**Redéployée en PROD par gui + VÉRIFIÉE par curl** : avant = `400 Missing required fields`
(la clé anon publique passait), après = **401** y compris avec un payload complet.
⚠️ **TEST n'a pas la fonction `send-email` du tout** (curl → `404`) — rien à y déployer, et
donc pas de faille de ce côté. La bascule PROD/TEST ne sert qu'en `npm run dev` local.
_Contexte d'origine ci-dessous._
`supabase/functions/send-email/index.ts:19` accepte `to`/`subject`/`html` arbitraires, envoie
en `no-reply@bilenekite.com` avec le service_role ; seul rempart = `verify_jwt` que la clé
anon (publique, dans le bundle Vercel) satisfait.
**MAIS** la fonction exige un `booking_id` et `email_logs.booking_id` est
`NOT NULL REFERENCES bookings(id)` (`schema.sql:555`) : sans UUID de booking **valide**,
l'insert échoue → 500 → **aucun mail parti**. Et depuis la Phase 2, anon ne lit plus
`bookings` sans token valide. ⇒ Le périmètre réel n'est pas « tout internet » mais
**« quelqu'un qui détient un lien partagé »** (ex-client, chauffeur, Geraldo) et voit un
booking_id — aggravé par le fait que **les tokens n'expirent jamais**. Chaque abus laisse
une ligne dans `email_logs`. Priorité : à réparer, pas un incendie.
**Fix le plus simple** : rejeter si le rôle du JWT appelant ≠ `authenticated` (garder les
templates côté front, pas de refonte). Fix fort (plus tard) : construire le HTML côté serveur
depuis `booking_id` + `type`.

### S2 — signup Supabase — ✅ FERMÉ par gui (2026-07-28)
Authentication → « Allow new users to sign up » : **était ON sur les 2 bases**, passé **OFF**
sur PROD et TEST. C'était le finding le plus grave : policy admin
`FOR ALL TO authenticated USING (true)` sur 38 tables ⇒ n'importe qui pouvait créer un compte
via `/auth/v1/signup` et lire passeports, paiements et compta.
⏳ **Contrôle associé (à confirmer par gui)** : Authentication → Users sur les 2 bases, il ne
doit y avoir QUE les 2 comptes admin. Un compte inconnu = ne pas supprimer avant d'avoir noté
email + `Created at`.

### S3 — `notify-submission` fail-open — ✅ CORRIGÉ & DÉPLOYÉ PROD (2026-07-28)
Était `if (secret && …)` : sans `NOTIFY_SECRET`, plus aucun contrôle. Devenu `if (!secret || …)`
→ fail **closed** (+ `console.error` explicite dans les logs).
`NOTIFY_SECRET` vérifié présent sur les 2 bases par gui avant redéploiement (indispensable,
sinon le webhook tomberait en 401). Curl sans le header → 401 sur PROD **et** TEST.
⏳ **TEST tourne encore l'ancienne version** (le fix n'y change rien tant que le secret est en
place) — à redéployer un jour par cohérence repo↔runtime, non urgent.

### Findings non revérifiés par Claude Code (à instruire le jour venu)
- « Net result (season) » pas filtré par saison (cumul depuis l'origine) ; cours d'un booking
  annulé comptés en coût instructeur sans revenu en face.
- CashFlow ignorerait `palmeiras_entries` et `activity_payments` que le Dashboard compte.
- Formulaire public sans captcha/rate-limit → **déjà traité** : honeypot + délai 3s
  (`318e467`, cf. « Quand gui veut »). Turnstile toujours hors périmètre.
- Un lien `restaurant` lit toute la liste clients du centre ; tokens sans expiration.
- **Divergence `bookings.amount_paid` vs table `payments`** : ce n'est PAS un bug, c'est
  assumé — `payments` est la source de vérité (cf. mémoire projet).
- **Question ouverte pour gui** : le tarif instructeur sert de prix client ET de coût ⇒ marge
  nulle sur les cours particuliers. Modèle voulu (marge sur hébergement/location) ou bug ?

---

## 📧 Emails — demandes de gui (2026-07-28)

### Retouches sur l'email de documents — 🔜 gui doit préciser
Test d'envoi depuis Documents fait le 2026-07-28 (post-fix S1) : **ça marche**, mais gui veut
des **modifications sur le contenu de ce mail**. À préciser : *lequel* (`visa_letter`,
`booking_confirmation`, `travel_guide`, `welcome_guide`) et *quoi*.
👉 Ces templates sont **côté front** (`client/src/utils/emailTemplates.ts`) : modification
simple, pas de redéploiement d'Edge Function, juste un build + push Vercel.
⚠️ Ne pas confondre avec les textes de `notify-submission` (formulaire public), eux **en dur
dans l'Edge Function** — décision gui, demander avant de toucher.

### Email admin `contact@bilenekite.com` — ✅ FAUSSE ALERTE (2026-07-28)
Test du formulaire public post-fix S3 : accusé client OK, notif admin « manquante »… en fait
**simple latence POP3**. `contact@bilenekite.com` est une boîte **Infomaniak** que le Gmail
`kitesurfingmozambique@gmail.com` relève en POP3 ; le mail est apparu dès le cycle de relève
suivant. Chaîne d'envoi 100 % fonctionnelle, rien à corriger dans le code.
**Config DNS vérifiée au passage (RAS, ne pas y toucher)** : MX `mta-gw.infomaniak.ch`,
SPF racine `include:spf.infomaniak.ch -all`, DMARC `p=reject`, et Resend correctement câblé
sur `send.bilenekite.com` (SPF amazonses) + DKIM `resend._domainkey` → alignement DMARC par
DKIM. ⚠️ **Ne PAS ajouter Resend au SPF racine** : l'enveloppe part de `send.bilenekite.com`,
c'est déjà autorisé là-bas.
**Suggestion non faite** (choix de gui) : remplacer la relève POP3 par une **redirection**
Infomaniak → Gmail, pour recevoir les demandes de résa instantanément au lieu d'attendre
jusqu'à ~1 h.

## 🟡 Quand gui veut

- **Bug prix taxi 8000 €** — fix code fait (`order updated_at desc` des 2 côtés, commit `4364316`).
  Diag `diagnostics_taxi_pricing.sql` : **TEST fait le 06/07 → OK, rien à corriger** ;
  **PROD en attente** (incident Supabase le 06/07 au soir) → relancer sur PROD dès que
  rétabli, puis corriger si besoin (`default_price_eur`=120, purger doublons
  `taxi_pricing_defaults`).
- ~~**Anti-spam formulaire public**~~ ✅ FAIT (2026-07-06, `318e467`) : honeypot off-screen
  (`website`) + refus silencieux des soumissions <3s après chargement — les deux tombent sur
  le faux écran de succès (zéro insert, zéro email, le bot n'apprend rien). Kill switch
  inchangé (`shared_links.is_active=false`). Turnstile seulement si le lien devient vraiment
  public un jour (nécessiterait une Edge Function pour l'insert).
- **Waiver EN/ES** — traductions auto à faire relire (FR = source gui). `WAIVER_VERSION = 'v1-2026'`.
- ~~**Supprimer l'import CSV**~~ ✅ FAIT (2026-07-06) : `ImportCSVModal` + `parseGoogleFormsCSV.ts`
  supprimés, ClientsPage nettoyée (bouton, state, handleImport). `import_id` conservé
  (dédup SubmissionsPage).
- **Logo sur documents** — préciser avec gui QUELS documents avant d'agir.
  Assets : `client/public/docs/logo-mas.png`, `signature-mas.png`.
- **Lien partagé `restaurant` en PROD** — à créer depuis Options → Shared Links quand besoin.

## 🧹 Housekeeping

- ~~Révoquer le PAT Supabase du 2026-06-26~~ ✅ RÉGLÉ (2026-07-06) : `Juin2026TEMP` était
  temporaire (Expired de lui-même) et supprimé du dashboard ; token CLI `cli_gui@LAPTOP…`
  révoqué aussi. **Plus aucun token Supabase actif.**
- ~~Supprimer `supabase/seed/supabase_logs.json`~~ ✅ FAIT (2026-07-06).
- Redéployer `notify-submission` (TEST et/ou PROD) **seulement si** l'email admin semble pauvre —
  la chaîne fonctionne, c'est juste la richesse du récap (non bloquant).
- ~~Nettoyer `client/.env.local`~~ ✅ FAIT (2026-07-06) : clés Resend + records DNS retirés,
  ne restent que URLs + clés anon des 2 bases (utiles curls). ⚠️ Les clés Resend ne sont plus
  QUE dans les secrets Edge Functions Supabase (et le dashboard Resend).

## 🧊 Gelé / à NE PAS faire

- **Kanban taxi** (`TaxiKanbanView`) — gelé, peut-être l'an prochain. Ne pas factoriser la
  duplication Kanban↔List tant que c'est gelé. Améliorations planning taxi = **List view** only.
- **Refactor des gros fichiers** (BookingsPage 1600 l., ManagementPage…) — ça marche, c'est
  documenté ; mauvais rapport risque/bénéfice.
- **UI d'édition des textes d'emails** `notify-submission` — décision gui : textes EN DUR dans
  l'Edge Function ; pour changer le wording → éditer `notify-submission/index.ts` + redéployer.

---

*Historique des chantiers clos : `.claude/archive/memory/` (README explicatif dedans).*
