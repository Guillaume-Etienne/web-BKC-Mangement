# BACKLOG — reste à faire (source de vérité unique)

> Tout ce qui est **clos** est sorti d'ici le 2026-09-05 →
> `.claude/archive/memory/backlog_closed_2026.md` (1600 lignes d'historique, décisions et
> vérifications). Ici : **l'ouvert uniquement.** Une ligne close se raye et se déplace.

## 🚨 Migrations SQL — registre

⬜ **`2026-09-25_walk_ins.sql`** (TEST ⬜ / PROD ⬜, **mise à jour le 2026-09-26**) — walk-ins :
`bookings.kind` (`'stay'` défaut | `'day_visitor'`, CHECK), `clients.custom_lesson_rate`,
`clients.waiver_signed_at`, **+ `GRANT SELECT (kind) ON bookings TO anon`** (décision gui du
26/09 : les walk-ins ne doivent pas apparaître sur le lien Restaurant, `RestaurantSharePage.tsx`
sélectionne désormais `kind` — voir WALK_INS.md § Reste à faire). `custom_lesson_rate` et
`waiver_signed_at` restent hors GRANT. **Strictement additive**, rollback dans le fichier.
⚠️ **Cette migration doit être passée sur PROD avant/avec le déploiement du code** (le commit
qui ajoute `kind` au select anon) — sinon la page Restaurant casse entièrement en attendant
(colonne absente ou non accordée = requête anon en échec total, pas juste sans filtre). Vérif :
curl anon `select=id,kind` → **200** (plus `42501`, décision changée), `select=id,custom_lesson_rate`
sur `clients` → toujours `42501`. Puis test écran Daily → Walk-in **et** lien Restaurant (voir
`WALK_INS.md`).

✅ **`2026-09-19b_dismissed_actions.sql`** (TEST ✅ / PROD ✅, passée par gui et **vérifiée le
2026-09-20**) — « affaire classée » sur la page d'accueil : table `dismissed_actions`
(`dismiss_key` PK, `up_to_count`, `dismissed_at`), admin-only. **Strictement additive.**
Curl anon réel sur les deux bases : `42501 permission denied` en lecture **et** en insert
(donc pas `42P01` = la table existe bien, et anon n'y touche pas). Aller-retour à l'écran fait
sur TEST : 11 alertes → « ✓ Affaire classée » sur #031 → 10 + accordéon « Affaires classées 1 »,
**rechargement complet : toujours 10** (l'écriture tient), accordéon ouvert = la ligne en gris
avec son lien Documents, « ↩ Rouvrir » → retour à 11, rechargement → toujours 11 (ligne bien
supprimée). TEST laissé exactement dans l'état trouvé.

✅ **`2026-09-19_expense_categories.sql`** (TEST ✅ / PROD ✅, passée et **vérifiée le 2026-09-19**)
— sous-catégories de dépenses sur 2 niveaux. Vérifs faites en lecture directe sur les deux bases :
PROD 9 catégories / 12 dépenses / 3844.35 € inchangés / 0 orpheline / 0 fusion, TEST 7 / 2 / idem,
anon refusé en **401** sur les deux (et pas un `[]`). Migration strictement additive :
`expenses.category` jamais touchée, rollback en 2 lignes dans le fichier.
⬜ **Phase 3, plus tard** : `ALTER COLUMN category_id SET NOT NULL` + `DROP COLUMN category`.
Celle-là est **destructive** — migration séparée, décision séparée, pas avant plusieurs semaines
de fonctionnement vérifié.

⬜ **`2026-09-07_equipment_category_bar.sql`** (TEST ⬜ / PROD ⬜) — ajoute `'bar'` à l'enum
`equipment_category`. À passer **avant** la suivante.
⬜ **`2026-09-07b_equipment_purchase_resale.sql`** (TEST ⬜ / PROD ⬜) — colonnes achat/revente sur
`equipment` (prix, date, port, fournisseur, acheteur, payé le, liens vers `expenses`) **+ verrouille
les nouvelles colonnes pour anon** (la table `equipment` était grande ouverte à tout token de
partage depuis la Phase 2, jamais colonne-restreinte comme `equipment_rentals`/`lessons`/
`taxi_trips` — ce fichier ferme ça en même temps). Vérif curl anon dans le fichier lui-même.
Nouvel onglet « Achats & reventes » dans Equipment, catégorie Barre dans les 3 sélecteurs —
le code tourne déjà contre ce schéma (`Equipment` TS a les nouveaux champs), donc tant que la
migration n'est pas passée l'onglet affichera juste tout vide (pas d'erreur, `select('*')`).

⬜ **`2026-09-07_ffly_rates_2026_27.sql`** (TEST ⬜ / PROD ⬜) — grille Fun & Fly 2026-27 dans
`agency_rate_items` : cours kite à la nouvelle grille (240/600, 190/400), les 2h qui manquaient,
transferts voiture/pick-up, gardiennage, cours kiteFoil et wing, 8 lignes de location et 6 lignes
d'hébergement. **Données seulement, aucun DDL** — donc pas de curl anon à faire : la table est
admin-only. Preuve = ouvrir **Options → 🤝 Agencies → Fun & Fly** et compter **33 lignes**, dont
l'ancien transfert à 168 € désormais inactif. Détail et reste-à-faire : § 🤝 Agences.

**Pour mémoire — déjà passées et vérifiées le 2026-09-05 (curl anon réel) :**
`2026-09-05_client_errors.sql` (insert anon valide = 201, `kind` hors liste = `42501` sur les deux
bases), `2026-09-05b_deposit_requested.sql` (`42501` et non `42703` = colonne présente, anon exclu)
et `2026-09-03_client_notes.sql` (reconfirmée sur les deux bases).

**Pour mémoire — passée et vérifiée le 2026-09-17 (curl anon réel, TEST + PROD) :**
`2026-09-17_booking_linked_booking.sql` — `bookings.linked_booking_id` (auto-référence nullable) :
une même famille arrivant/repartant en plusieurs vagues garde une résa par sous-groupe (ses propres
chambres, dates, solde) au lieu d'étirer les dates d'une seule résa. Topologie en étoile, badge 🔗
partout où le numéro de résa apparaît déjà (BookingsPage liste desktop+mobile, alertes Home via
`bookingLabel`, `ClientTimeline`/dossier). `select id,linked_booking_id` → `42501` sur les deux
bases (colonne présente, non `42703` = colonne absente), pas de GRANT anon — invisible aux pages
partagées, même règle que `relationship_flag`. Poussé (`768b2b3`), confirmé sur `origin/master`
(`git reflog show origin/master`). ⚠️ Lien croisé sur la page client publique (ClientSharePage)
**volontairement pas fait** — demande une policy RLS dédiée (bookings est déjà filtré par ligne via
le token de partage), pas seulement ce GRANT de colonne.

**Pour mémoire — passée et vérifiée le 2026-09-11 (curl anon réel, TEST + PROD) :**
`2026-09-11_client_relationship_flag.sql` — `select id,relationship_flag` → `42501` (colonne non
accordée) sur les deux bases, alors que `select id,first_name,last_name` → `[]` (lignes filtrées
par RLS faute de jeton, pas une table vide) sur les deux aussi : la colonne existe et reste bien
hors de portée d'anon.

⚠️ **Trois migrations plus anciennes n'ont jamais été re-vérifiées par une session** — gui les dit
passées, l'ancien registre les affichait encore `⬜` par simple oubli de mise à jour :
`2026-08-19_agency_invoices.sql`, `2026-09-02_transfer_reference_prices.sql`,
`2026-09-02b_kruger_reference_prices.sql`. Ce sont des tables admin-only : le curl anon ne prouve
rien. Preuve la plus simple = **ouvrir l'écran** (panneau 🤝 Agency billing d'une résa · Options →
Prices → Reference info / Kruger & Eswatini) : s'il s'affiche, la migration est passée.

⬜ **`2026-08-19c` reste à écrire** : `DROP` des colonnes `invoiced_at`/`paid_at` devenues mortes
sur `agency_billing_lines` (les tampons ont déménagé vers `agency_invoices`), **après** que Vercel
ait déployé le code qui ne les lit plus. Sans urgence — mais deux colonnes vides finiront par
tromper quelqu'un.

Règles : idempotent · TEST **puis** PROD dans la foulée · prose en `/* … */` **jamais en `--`**
(un collage recoupe une longue ligne `--`, la moitié orpheline devient du SQL) · rayer une ligne
d'ici seulement après un **curl anon réel**.

⚠️ Une ligne de test traîne dans `client_errors` **sur TEST** (« migration check 2026-09-05 ») :
Options → Database → **Clear**. Rien en PROD.

---

## 🔴 Ouvert

### 🧑‍🤝‍🧑 À revoir — sélecteur de participants dans Planning/Quotidien (gui, 2026-09-26)

Dans `LessonWeekView.tsx`, le choix des participants d'un cours/location montre soit les invités
actifs à la date (par défaut), soit **tous les invités de la saison** derrière la case « Montrer
tous les invités » (add) — et **toujours tous, sans case ni filtre**, dans les modales d'édition
(cours et location). Sur une base avec beaucoup de réservations ça fait une liste énorme à
parcourir pour trouver la bonne personne. Gui veut qu'on revoie cette UX (recherche par nom ? filtre
par semaine plutôt que par jour actif ? case aussi en édition ?) — **pas encore fait, à discuter
avec lui d'abord.**
⬜ **Corrigé au passage (`8bbbfff`)** : le bug d'affichage qui allait avec — cette longue liste
débordait des modales fixes sans défiler, la molette scrollait la page derrière au lieu du
contenu, rendant Enregistrer/Annuler inatteignables. Les deux modales défilent maintenant en
interne (`max-h-[90vh] flex flex-col` + formulaire en overflow-y-auto). Non poussé.

### 🚶 Walk-ins & packs — étape 1 livrée le 2026-09-25 (`d024495`, non poussé)

Clients qui viennent juste pour un cours ou une location, souvent, surtout des locaux, et qui
reviennent. Conception, livraison et points ouverts : **`.claude/docs/WALK_INS.md`**.
- ✅ **Étape 1 — walk-in à la séance** : bouton Walk-in dans le Daily, client normal créé à la
  volée, résa « day visitor » en coulisse (hors planning hébergement et alertes de séjour),
  tarif perso sur le client, décharge signée une fois par client. 667 tests, build vert, test
  écran sur TEST (mode sans migration) fait et nettoyé.
  ⬜ **À faire par gui** : passer la migration (registre ci-dessus, mise à jour le 2026-09-26),
  puis refaire le test écran **et** vérifier le lien Restaurant.
  ✅ **Décidé le 2026-09-26** : les walk-ins ne doivent PAS apparaître sur la page Restaurant
  partagée — codé, voir WALK_INS.md § Reste à faire et le registre de migrations ci-dessus.
- ⬜ **Étape 2 — packs** : heures prépayées sur le client, sans expiration, non partagés, walk-ins
  seulement, prix libre + note libre, tout en EUR.

### ✅ Demandes ↔ formulaires — livré et **vérifié à l'écran** le 2026-09-13

`15de83a` + `c0764be` (**non poussés**). Un formulaire de réservation reçu compte désormais comme
un signe de vie : le silence part du plus récent entre `last_contact_at` et `submitted_at`, partout
de la même façon (liste Requests, filtre « To chase », compteur, Home, « Waiting on you »). Le
panneau Submissions affiche enfin « Came from the enquiry of X ». 562 tests, build vert. Détail et
décisions : `.claude/docs/ENQUIRIES.md` § 4.

**Vérif écran faite** (Claude in Chrome) :
- **PROD** — non-régression seulement : le cas Sibel s'était refermé entre-temps (gui a créé la
  résa **#031** le 12/09, `form_submission_id` posé, demande passée `won`), et **aucune soumission
  n'est en `pending`**. Donc rien à y prouver, rien de cassé non plus.
- **TEST** — preuve réelle, sur deux lignes créées puis **supprimées** (base revenue à son état
  d'origine : 1 demande, 1 soumission `approved`). Cas reconstitué à l'identique (dernier contact
  il y a 11 j, formulaire reçu la veille) : la ligne affiche **`1 j`** au lieu de 11, **`To chase`
  tombe à 0**, la pastille **📝** et le bandeau vert *« booking form received … — to turn into a
  booking »* sont là, et côté Submissions le bandeau **« 📩 Came from the enquiry of … · asked
  about Feb 2027 »** s'affiche.

⬜ **Reste pour gui** : la résa **#031 (Sibel Darmar)** attend son **email de confirmation**.
⚠️ Et son formulaire la déclare **« no kite »** alors que sa demande parlait d'un **stage de wing
foil** — écart réel, jamais tranché, à clarifier avec elle. `utils/intentGap.ts` ne le montre que
dans le wizard, donc il est passé inaperçu à la création.

### 🔓 EN PAUSE (gui, 2026-09-07) — le dépôt GitHub est PUBLIC avec des données clients

**Rien n'est résolu. Mis de côté par gui pour y revenir plus tard, pas clos.**

`Guillaume-Etienne/web-BKC-Mangement` est public. `temp/` a été committé pendant des mois ;
le `.gitignore` posé le 2026-09-05 (`d3d8ff8`) empêche la suite mais **ne retire rien de
l'historique**. Re-vérifié le 2026-09-07, sans authentification :

```
HTTP 200  temp/TRAVELERS INFORMATION ENGLISH (Responses) - Form responses 1.csv
```

45 personnes : nom, dates et horaires de vol, contact d'urgence (nom, mobile, email, lien de
parenté). Aucun secret n'a jamais été committé (vérifié) — c'est bien de la donnée client.

**Le blocage de gui** : il déploie sur Vercel via une **organisation** GitHub (« sinon je ne les
vois pas ») et craint de devoir passer au plan payant en passant le dépôt en privé.

Ce qui est établi : Vercel Hobby déploie **sans problème un dépôt privé** — la confusion vient de
GitHub Pages. Ce qui **n'est pas** établi : si Hobby accepte un dépôt privé **appartenant à une
organisation**. Ne pas affirmer, c'est là-dessus que tout tient.

**Prochaine action = une expérience, pas un avis.** Créer dans l'org un dépôt privé jetable
(`vercel-privacy-test`, un `index.html`), tenter l'import sur le compte Vercel actuel, puis
supprimer. Le dépôt principal n'est pas touché. Si ça déploie, passer BKC en privé règle tout
d'un clic et c'est réversible.

Piste probable pour le « sinon je ne les vois pas » : le **périmètre d'installation de l'app
GitHub Vercel** (GitHub → Settings → Applications → Vercel → Configure), pas une limite de plan.
Si c'était ça, l'organisation n'a peut-être plus de raison d'être.

Portes de sortie si l'expérience échoue : transférer le dépôt au compte perso · déployer sans
intégration Git (`vercel deploy --prebuilt --prod` depuis une Action, le build est statique) ·
Cloudflare Pages / Netlify · en dernier recours `git filter-repo` en restant public.

⚠️ **`filter-repo` seul ne suffit pas** : après un force-push les anciens commits restent
atteignables sur GitHub **par leur SHA** jusqu'au ramasse-miettes — il faut un ticket au support.
Et ça réécrit 329 des 343 commits, cassant les ~70 SHAs cités dans la doc. **Passer en privé est
la seule action qui coupe l'accès immédiatement.**


### 🗓️ Planning — ligne « No room » : ✅ livrée et vérifiée à l'écran (2026-09-06)

Commits **`a5e9b8e` + `44cc10d`, poussés** (confirmé `origin/master`). Les résas sans chambre
n'apparaissaient nulle part dans le planning — 4 des 10 résas de PROD (#30 Lindquist, #29 Dubos,
#23 Rulliat, #25 Bouteiller), parce que **seul `BookingsPage` écrit `booking_rooms`** : tout ce qui
vient du formulaire public arrive sans chambre. Livré : `UnassignedRow.tsx`, `dropTarget?: boolean`
sur `PlanningRow`, 5 edits dans `PlanningView.tsx`, 3 clés i18n, `components.md`. Build vert, 551
tests verts.

✅ **Vérif navigateur faite le 2026-09-06** (sur TEST, pour ne pas manipuler de vraies résas PROD
par automatisation) : ligne dépliée, glisser-déposer une barre (« Sans hébergement » → chambre)
déclenche bien le bandeau « 1 déplacement en attente » puis la modale « Confirmer 1 déplacement en
attente » avec le résumé `#002 — Anna Schmidt : Sans hébergement → H1/B`. Annulé sans écrire (test
en lecture, pas de changement réel). Comportement conforme à l'attendu.

ℹ️ Deux points à juger à l'œil, une preview statique a été envoyée à gui : largeur du label dans
la colonne de 80px, et contraste de l'ambre en mode sombre.

⬜ **De-attribuer est impossible** (re-glisser vers la ligne « No room ») : voulu, pour que
`'__unassigned__'` ne puisse pas fuir en base. À rouvrir seulement si gui le demande — il faudra
alors trancher le sort de la ligne de prix gelée.

### 🔍 Trois tables admin-only ne sont protégées que par la RLS (à trancher)

`client_errors`, **`payments`**, **`email_logs`** et `form_submissions` répondent `200 []` à un
SELECT anon : le **GRANT SELECT de table existe** (privilèges par défaut de Supabase sur `public`),
et seule la RLS empêche les lignes de sortir. `client_notes` et `enquiries` ont deux couches
(`REVOKE ALL … FROM anon` explicite) et répondent `42501`.

**Aucune fuite aujourd'hui** — vérifié sur des tables qu'on sait non vides (`payments` contient les
100 € de Sassolas, `email_logs` alimente la grille Documents) : elles renvoient bien `[]`, la RLS
mord. Mais c'est une couche au lieu de deux : le jour où quelqu'un pose une policy `FOR ALL` un peu
large sur `payments`, il n'y a plus de filet. Un `2026-09-05c` d'une ligne par table le
refermerait. **Ne pas le faire à moitié** : les quatre ou aucune.

### 🔐 Sécurité — reste 2 points de l'audit du 2026-08-21

- ⬜ **Policy `driver` trop large** (`supabase/schema.sql:990-996`) : un lien chauffeur transféré
  donne accès à **tous** les noms de clients et dates de `bookings`/`clients`, pas seulement à ses
  courses. Pas d'email/tel/passeport/argent. À resserrer sur ses seules courses.
- ⬜ **Formulaire public sans garde-fou serveur** : honeypot + délai 3 s côté navigateur
  (`EnquiryFormPage.tsx:75`), contournable en tapant l'API. Pas de fuite (colonnes bornées,
  `status`/`channel` verrouillés), mais nuisance possible (boîte mail noyée, quota Resend, Brevo
  pollué). Sans backend, le plus simple = un garde-fou en base (N insertions/heure par email).
- ℹ️ Optionnel : CSP quasi vide dans `client/vercel.json` (seulement `frame-ancestors`). Zéro
  `dangerouslySetInnerHTML` dans le repo → surface XSS très faible. `Referrer-Policy: no-referrer`
  serait gratuit, vu que les tokens voyagent dans l'URL.

### 📄 Documents / guides

- ⬜ **Le Welcome Guide n'a jamais été sauvé** : **0 ligne `welcome_guide`** en PROD, il tourne sur
  les défauts en dur avec les placeholders `[…]`. gui doit les remplir dans Documents → Welcome
  Guide puis cliquer **Save** (le premier Save sème la table).
- ⬜ **Waiver EN/ES** : traductions auto à faire relire (FR = source gui). `WAIVER_VERSION = 'v1-2026'`.

### 📧 Emails

- 🔶 **Retouches sur l'email de documents** — gui veut des modifications, reste à préciser *lequel*
  (`visa_letter`, `booking_confirmation`, `travel_guide`, `welcome_guide`) et *quoi*.
  Ces templates sont **côté front** (`client/src/utils/emailTemplates.ts`) : build + push, pas de
  redéploiement d'Edge Function. ⚠️ Ne pas confondre avec `notify-submission`, dont les textes sont
  **en dur dans l'Edge Function** — décision gui, demander avant de toucher.
- ⬜ Redéployer `notify-submission` **seulement si** l'email admin semble pauvre (non bloquant).

### 🤝 Agences — grille Fun & Fly 2026-27 (2026-09-07)

La fiche de synthèse renvoyée à F&Fly (`temp/2026-27 grille de prix détaillée…xlsx`, gitignoré)
a été confrontée au catalogue en base. **Décision de gui : les prix de la fiche sont la base de
facture, marge de 20 % incluse** — même modèle que la facture Brunet 2025. Le catalogue disait
encore 200/472,50 là où la fiche annonce 240/600 : toute facture générée aurait **sous-facturé
l'agence de 127,50 € par pack 10h**. Migration écrite, voir le registre en tête.

- 🔶 **Wing privé 4h / 10h** : le catalogue dit 200 / 472,50, alignés sur l'**ancien** tarif kite.
  Le kite passe à 240 / 600 mais la fiche laisse ces deux cases vides, et vend le wing **moins
  cher** à 2h (120 contre 140) — assumé, il n'y a que du matériel débutant en wing. **Ne rien
  déduire** ([[reference_agency_package_hours]]) : demander les deux chiffres à gui.
- ⬜ **KiteFoil 10h** et **location / gardiennage de 2 à 5 jours puis 8 à 21 jours** : cases encore
  vides dans la fiche, F&Fly les redemandera.
- ⬜ **Ligne 215 de la fiche, « % commission » : toujours vide.** C'est le seul champ qui dit à
  F&Fly que les prix contiennent déjà leur marge. À remplir avant envoi (20).

### 🛟 Location : `full_day` facture le tarif demi-journée (2026-09-07)

`rentalPrice()` (`client/src/components/planning/LessonWeekView.tsx:207`) ne regarde que le
`billable_type`, **jamais le `slot`**. Cocher « journée » facture donc 55 € au lieu des 95 € de la
grille. Le slot `full_day` existe pourtant en base depuis toujours (`rental_slot` enum).

⚠️ **Latent, pas encore nuisible** : vérifié en PROD le 2026-09-07, `equipment_rentals` est **vide**
(0 ligne). Mais la saison démarre, et c'est exactement le genre d'écriture qui ment à l'écran sans
erreur. Deux trous du même tonneau, à traiter ensemble :

- ⬜ **Aucun `billable_type` wing** — l'enum a `rental_kite/board/full/surfboard/foilboard` et
  s'arrête là, alors que la fiche vend du WingFoil 60 €/jour.
- ⬜ **`bookings.center_access_rate` a `DEFAULT 5`** (`schema.sql:126`) alors que le tarif direct est
  7 (`price_items.center_access`). C'est pour ça que la résa #22 est à 5.
- ❓ **Choix de modèle à trancher avec gui** : un tarif jour par type d'équipement dans
  `price_items`, ou une grille dégressive au nombre de jours sur le modèle de `price_tiers` (la
  fiche vend aussi des forfaits 6-7 jours). Le second colle à la fiche, le premier est plus simple.

### 🔗 Divers

- ⬜ **Lien partagé `restaurant` en PROD** — à créer depuis Options → Shared Links quand besoin.

---

## 🧾 EN COURS — résa SCHETTINI (Fun & Fly, 19→31/10/2026)

**Résa #26 créée** (`d39da6b7-318d-492a-a6dd-f3e281cb9db7`) : SCHETTINI Eric, provisional,
San Martinho **SM-2**, agence Fun & Fly, `center_access_rate: 0`, 3 voyageurs (Sonia
PODGORSKI ép. SCHETTINI 23/04/1974 · Eric 06/09/1964 · **Luca 11 ans** 21/01/2015),
tél. commun +33 641679034. Vols : **arrivée MPM 19/10 06:45** (TAP 281) · **départ 31/10 09:25**
(TAP 282). **2 transferts créés** (Ruiz, 3 pax, 168 €/trajet) : `b100d3a3-…` (19/10 06:45) et
`760ec72c-…` (31/10 04:25) — `payment_summary.billed` = 336 €.

**⬜ Reste — dans l'app, aucun outil MCP pour la facturation agence :**
1. **Créer la facture agence** (panneau 🤝 Agency billing de #26) et y rattacher :
   - 2 × **Transfert Maputo ↔ Bilene** à 168 € (déjà créés)
   - le **wing** : ⏸️ **bloqué**, voir ci-dessous — ne rien inventer
   - le **gardiennage** : 7 €/pers./jour × 2 pers. × **11 jours** (19→30/10) = **154 €**
     *(à confirmer : 11 ou 12 jours selon que le 30/10 compte)*
2. **Saisir la réf F&Fly** quand l'agence la donne, puis imprimer et envoyer.

**⏸️ Bloquant : « 2x privé 4x2h » = combien d'heures ?** gui : *« mettre une note, il faudra
clarifier ça auprès de F&Fly »*. Ne rien déduire du libellé —
[[reference_agency_package_hours]] : le « 10x 2h » valait 10 h au total, pas 20. Depuis qu'un
« Pack cours Privé 4h » existe, « 4x2h » peut désigner ce pack (4 h) **ou** 4 séances de 2 h (8 h).
Tant que ce n'est pas clarifié : **ni leçons de wing, ni ligne de facturation.**

**⬜ Question de nommage laissée ouverte** : la grille dit « Semi Privé » sur le 10 h et gui a dit
« group » pour le 4 h — deux mots pour peut-être le même produit. Harmoniser ou confirmer deux
offres distinctes.

**📋 Grille Fun & Fly au 2026-08-21** (+5 % appliqué, éditable dans Options → 🤝 Agencies) :

| Catégorie | Prix | Durée | Libellé |
|---|---|---|---|
| lesson | 472,50 € | 10h | Pack cours Privé 10h |
| lesson | 472,50 € | 10h | Pack cours Wing privé 10h |
| lesson | 346,50 € | 10h | Pack cours Semi Privé 10h |
| lesson | 200 € | 4h | Pack cours Privé 4h |
| lesson | 200 € | 4h | Pack cours Wing privé 4h |
| lesson | 160 € | 4h | Pack cours Groupe 4h |
| rental | 7 € | — | Gardiennage matériel personnel — par personne et par jour |
| transfer | 168 € | — | Transfert Maputo ↔ Bilene |

⚠️ Les factures déjà émises gardent leurs **prix figés** : #022 reste à 160 €/transfert malgré la
grille à 168 €. C'est voulu — un prix figé ne se refacture pas.

**⬜ Facture #022 (SENE), émise, pas encore envoyée** (`invoiced_at` nul) — 970 € brut,
commission 20 %, **776 € à payer**, facture `20260819`, réf F&Fly `142018`.
Reste : **comparer l'impression au modèle Excel** et dire ce qui cloche (la fenêtre d'impression
s'ouvre hors du groupe piloté par l'extension : **Claude ne peut pas la voir**, seul gui peut
relire ce rendu), puis les **tampons `Invoice` / `Paid`** — c'est `paid_at` qui alimente la colonne
« Agencies » du CashFlow.

**🔧 Chantier à trancher — le stockage payé par l'agence.** Cocher « matériel perso » sur un
voyageur facture l'**accès centre au CLIENT** (`center_access_rate`), or F&Fly paie le gardiennage.
Et l'accès centre **n'est pas** une des 4 sources rattachables à une facture agence (cours,
locations, transferts, chambres) : rien ne permet de l'exclure. Parade au cas par cas :
`center_access_rate = 0`. **Vraie solution** : ajouter l'accès centre comme 5ᵉ source rattachable,
ce qui suppose une colonne `agency_billing_line_id` là où vit l'information — aujourd'hui nulle
part, c'est un simple compteur sur la résa (`num_center_access` × `center_access_rate`).
Petit chantier, pas une case à cocher.

---

## 🧊 Gelé / à NE PAS faire

- **Kanban taxi** (`TaxiKanbanView`) — gelé, peut-être l'an prochain. Ne pas factoriser la
  duplication Kanban↔List tant que c'est gelé. Améliorations planning taxi = **List view** only.
- **Refactor des gros fichiers** (BookingsPage 2135 l., ManagementPage…) — ça marche, c'est
  documenté ; mauvais rapport risque/bénéfice.
- **UI d'édition des textes d'emails `notify-submission`** — textes EN DUR dans l'Edge Function
  (décision gui). Pour changer le wording : éditer `notify-submission/index.ts` + redéployer.

## 💤 Volontairement non fait — à rouvrir seulement si gui le demande

- **Fusionner `enquiry_notes` dans `client_notes`** — chantier à part, il touche l'écran de
  qualification qui doit rester expédiable en 20 s.
- **Cours et locations dans la frise du dossier** — c'est du détail de planning, ça noierait le fil.
- **Onglet Documents séparé** sur la fiche client — les envois sont déjà dans la frise.
- **Pré-remplir les participants** à la conversion demande → résa depuis `party_size` + `wants_*` :
  `ENQUIRIES.md` tranche que la conversion ne crée **ni chambre ni participant nommé**, et
  `party_size: 3` fabriquerait trois personnes sans nom que la compta compterait pour vraies.
- **Paliers de prix** : rattachement à l'épuisement d'un forfait agence (réutiliserait
  `cumulativeHoursBefore`), suppression/édition des paliers dans l'UI, prix barré sur les
  PDF/emails.
- **Séjours externes** : dates propres au séjour (aujourd'hui il prend celles de la résa) — à
  ouvrir si un client change d'hébergement en cours de séjour. Le coût n'apparaît pas dans le
  CashFlow : c'est un engagement, la sortie de caisse se saisit dans Expenses.
- 🔶 **`TEST_SUITE_ACCOUNTING.md` § « Comportements encodés à confirmer »** — les tests ont **figé
  le comportement actuel** : si l'un est faux, on a verrouillé une erreur. À relire avec gui.
- ⬜ **Fuite de marge chauffeur par colonne** (`taxi_trips.price_driver_mzn`,
  `margin_manager_mzn`) : lisibles par **tout** token valide, y compris client. Ne se ferme pas
  par un GRANT (un privilège de colonne est par **rôle**, pas par type de token) — il faudrait une
  surface par type de token (vue ou fonction). Assumé par gui, voir ci-dessous.

## 🚫 Déjà tranché — ne pas re-poser la question

- **Tarif instructeur = prix client ET coût ⇒ marge nulle ?** Sans objet depuis le 2026-07-29 :
  deux barèmes indépendants (prix client dans `price_items`, paie dans `instructors.rate_*`), les
  deux figés à la création de la leçon. Cf. `LESSON_PRICING.md`. A déjà fait perdre du temps
  le 2026-08-11 en étant relayée depuis une vieille liste d'audit.
- **Divergence `bookings.amount_paid` vs table `payments`** : pas un bug, assumé — `payments` est
  la source de vérité.
- **Logo sur les documents** : les 4 documents en portent déjà un, et deux marques selon l'usage —
  visa → `logo-mas.png` (entité légale), Travel/Welcome Guide + confirmation → `LOGO-bkc.png`.
  gui a écarté le co-branding, le remplacement par MAS, et la signature sur la confirmation.
- **Marge chauffeur visible par le client** : fuite connue, **assumée par gui** (2026-08-19).
  Ne pas la fermer sans qu'il le redemande.
- **Turnstile / captcha sur le formulaire public** : hors périmètre (nécessiterait une Edge
  Function pour l'insert).
- **Aligner TEST et PROD sur les guides** : divergences normales, deux bases.
- **Relève POP3 `contact@bilenekite.com`** : remplacée par une redirection Infomaniak → Gmail par
  gui (2026-08-19). Ne plus le proposer.
