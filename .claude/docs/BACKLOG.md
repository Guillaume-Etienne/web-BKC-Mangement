# BACKLOG — reste à faire (source de vérité unique)

> **La** liste canonique des tâches restantes. Mise à jour à chaque session (ajouter/rayer ici,
> pas dans la mémoire). Chaque entrée dit : quoi, pourquoi, et comment s'y prendre.
> Rappels transverses : migrations = **TEST + PROD dans la foulée, une seule tâche** ;
> vérifier les migrations sécu par **curl anon direct** (pas seulement `has_table_privilege`) ;
> Claude commit, **gui push lui-même** ; `npm run build` avant tout push.

---

## 🚨 MIGRATIONS SQL EN ATTENTE D'APPLICATION (gui)

> ✅ **`2026-08-16c_lesson_price_tiers.sql` appliquée et vérifiée TEST + PROD le
> 2026-08-16** — tarification dégressive par palier. Curl anon sur `price_tiers` →
> **42501** sur les deux bases, contrôle négatif `colonne_bidon` → **42703**. Registre
> vide sur ce fichier désormais.

> ✅ **`2026-08-16b_agency_billing_foundation.sql` appliquée et vérifiée TEST + PROD le
> 2026-08-16** — fondations de la facturation aux agences partenaires (§ Requests/Enquiries
> point 5). Curl anon sur les 3 tables (`agencies`, `agency_rate_items`,
> `agency_billing_lines`) → **42501** sur les deux bases ; contrôle négatif `colonne_bidon` →
> **42703** ; `lessons.agency_billing_line_id` → **200 `[]`** (colonne présente, RLS masque
> juste les lignes). Registre vide sur ce fichier désormais.

> ✅ **`2026-08-16_brevo_keepalive_ping.sql` appliquée et vérifiée en PROD le 2026-08-16**
> (ping mensuel Brevo, § Requests/Enquiries point 2 — **PROD uniquement**, décision gui, même
> écart assumé que pour `BREVO_API_KEY`). Job `cron.job` créé (`jobid=1`, premier job cron du
> projet), `SELECT ping_brevo_keepalive();` puis `net._http_response` → **status_code 200**.
> **Pas exécutée sur TEST — normal, ne pas la rejouer là-bas.**

> ✅ **Registre vide au 2026-08-15 avant ce qui précède.** Les trois migrations du chantier Enquiries (`14a`, `14b`,
> `14c`) sont passées sur TEST **et** PROD, et la chaîne email est prouvée bout-en-bout des
> deux côtés. Contrôles PROD du 2026-08-15 : `notify-enquiry` → **401** avec un mauvais secret
> (déployée, fail-closed), insertion `channel='form'` → **201**, écriture de `budget_eur` par
> un visiteur → **42501**, lecture des demandes → **42501**.
>
> ✅ **Registre vide au 2026-08-12 également.** Les deux migrations « séjours externes » (11 et 12) sont
> passées sur TEST **et** PROD, et les 7 contrôles curl anon donnent **exactement le même
> résultat sur les deux bases** : `external_accommodations` → 404 (table supprimée),
> `accommodation_id` → 200, `external_accommodation_id` → 42703, `total_cost` → **42501**
> (marge fermée), contrôle négatif → 42703, `external_billing` → 200.
> ⚠️ **Reste à pousser le code** : Vercel déploie du code qui lit `accommodation_id`.

> Registre des migrations écrites mais **pas encore passées**. Une ligne par migration ;
> on la raye seulement après vérification **par curl anon** sur les DEUX bases.
> Rappel : TEST + PROD dans la foulée, et ne jamais croire « c'est passé » sans test réel
> (piège vécu le 2026-07-06 : SQL editor ouvert sur le mauvais projet, migration idempotente
> → zéro erreur et faux positif).

| Migration | Contenu | TEST | PROD |
|---|---|---|---|
| ~~`2026-08-14c_enquiry_notify_trigger.sql`~~ | Trigger pg_net sur `enquiries` INSERT → Edge Function **`notify-enquiry`** (à déployer d'abord : `supabase functions deploy notify-enquiry --no-verify-jwt`). Envoie la notif admin + l'accusé au visiteur. ⚠️ **Secret DÉDIÉ `NOTIFY_ENQUIRY_SECRET`**, à créer par base, surtout pas le `NOTIFY_SECRET` de `notify-submission` : un secret Supabase **ne se relit pas** (empreinte seule), donc le réécrire aurait cassé les emails du formulaire de réservation. Ne se déclenche **que** sur `channel='form'` : une fiche saisie à la main n'envoie pas d'email. **Chaîne prouvée bout-en-bout sur TEST le 2026-08-15** (insertion → trigger → fonction → Resend → boîte de gui, notification admin **et** accusé visiteur). **Sur PROD, 4 gestes dans cet ordre** : créer le secret `NOTIFY_ENQUIRY_SECRET` (valeur au choix), déployer `notify-enquiry`, rejouer ce fichier avec la même valeur + `oslsbansxaajcpwhivmx`, tester. | ✅ 2026-08-15 | ✅ 2026-08-15 |
| ~~`2026-08-14a_enquiry_form_link_type.sql`~~ | Ajoute la valeur d'enum `enquiry_form` à `shared_link_type` (le formulaire léger est une page publique servie par lien signé). **Ne peut pas être fusionnée avec (b)** : PostgreSQL refuse d'utiliser une valeur d'enum ajoutée dans la même transaction, et le dashboard exécute tout un script dans UNE transaction → `55P04`. | ✅ 2026-08-14 | ✅ 2026-08-14 |
| ~~`2026-08-14b_enquiries.sql`~~ | **Tout le schéma du chantier Enquiries** en un fichier (`ENQUIRIES.md`) : `enquiry_sources` (origines trilingues, semées ×6, éditables Options → 📣 Sources), `enquiries` (identité, message, qualification, statut, silence, rattachements, témoin de synchro CRM) et `enquiry_notes` (le fil de la conversation). Le formulaire public **écrit** (colonnes bornées par GRANT) et **ne relit jamais** ; notes strictement admin. **6 vérifs en bas du fichier**, dont **deux connectées** — le curl anon ne peut pas voir les lignes. | ✅ 2026-08-14 | ✅ 2026-08-14 |
| ~~`2026-08-12_external_stays_single_place.sql`~~ | **Suite du 11.** Le séjour externe pointe désormais sur `accommodations` (`accommodation_id`) et le référentiel parallèle `external_accommodations` est **supprimé** — préalable au chantier San Martinho (planning + séjours simultanés). **Réécrite le 2026-08-12 après un échec** : elle **rattache** les lignes existantes (crée l'hébergement + ses emplacements, re-pointe les séjours, `NOT NULL` seulement après) au lieu de supposer la table vide. **7 vérifs en bas du fichier**, dont une **connectée** (le curl anon ne peut pas voir les lignes). ⚠️ **Le code déployé lit `accommodation_id`** : sans la migration, `ClientSharePage` demande une colonne inexistante → 42703, page client vide. Appliquer **avant ou avec** le push. | ✅ 2026-08-12 | ✅ 2026-08-12 |
| ~~`2026-08-11_external_stays_flat_rate.sql`~~ | Séjours externes : forfait (`total_cost` / `total_sell_price`) au lieu du par-nuit, `accommodations.external_billing`, et **fermeture d'une fuite de marge** — `total_cost` était lisible par les liens partagés. | ✅ 2026-08-12 | ✅ 2026-08-12 |
| ~~`2026-07-31_equipment_pricing_defaults.sql`~~ | Nouvelle table `equipment_pricing_defaults` (1 ligne) : les 3 curseurs du tab Equipment → CA (part matériel, part accessoires, ratio kite/planche), jusque-là en dur dans `EquipmentPage.tsx`. Pas d'accès anon. | ✅ 2026-08-01 | ✅ 2026-08-01 |

> ✅ **`2026-08-11` vérifiée le 2026-08-12 par curl anon sur les DEUX bases** (gui l'avait
> appliquée sans le dire ; la vérif a servi à trancher *quelle version* était passée) :
> `cost_per_night` → **42703** (le par-nuit a disparu), `total_cost` → **42501** (la fuite de
> marge est fermée), `accommodations?select=external_billing` → **200**, contrôle négatif
> `colonne_bidon` → 42703. Et `external_accommodations?select=id` → **200 []** :
> c'est bien la version committée qui a tourné, pas le refactor « un seul lieu ».
>
> ⚠️ **Ne jamais réécrire un fichier de migration déjà appliqué** — d'où le fichier
> `2026-08-12` séparé plutôt qu'une retouche du `2026-08-11`.
>
> 🔴 **LEÇON DU 2026-08-12 — `[]` en anon ne veut PAS dire « table vide ».** Depuis la
> Phase 2, RLS masque les lignes tant qu'il n'y a pas de `x-share-token` valide : un curl
> anon qui renvoie `[]` prouve seulement « rien de lisible sans token ». La migration du 11
> a été écrite en croyant `external_accommodation_bookings` vide sur la foi de ce `[]` — elle
> a **remplacé les colonnes par-nuit par des colonnes forfait `DEFAULT 0`**, donc mis à zéro
> les montants de la ligne qui s'y trouvait (du seed sur TEST : 30/45 €/nuit perdus). Le
> garde-fou de la migration du 12 l'a révélé en refusant de tourner.
> **→ Pour compter des lignes, il faut être connecté** (SQL editor, ou l'app avec la session
> admin). Le curl anon sert à prouver des **permissions** (42501/42703), jamais un volume.

> ✅ **Registre vide au 2026-08-01.** Vérifié par curl anon sur les DEUX bases :
> `equipment_pricing_defaults?select=equipment_share` → **200**, et le contrôle négatif
> `select=colonne_bidon` → **42703** — donc la colonne existe bien, ce n'est pas un champ
> ignoré en silence.
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

~~⬜ Non vérifié en PROD : Options → Accommodations~~ ✅ **Fait le 2026-08-11** — H1/H2/H3
portent 100 €/n chacune, saisies par gui (détail plus bas dans « Réglages de données »).

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

## 📥 Requests / Enquiries — ✅ EN SERVICE (2026-08-15), 1 reste

Chantier livré et vérifié **sur les deux bases** : origines trilingues (Options → 📣 Sources),
tableau scannable, formulaire léger en iframe (`?lang=`), rattachement demande↔réservation,
emails (notif admin + accusé visiteur), synchro Brevo, onglet unique **📥 Requests** à deux
sous-onglets, 3 lignes de pending actions, `frame-ancestors` limité à bilenekite.com.
**283 tests.** Conception et décisions : **`.claude/docs/ENQUIRIES.md`**. Contrat pour le
projet site web : **`.claude/docs/ENQUIRY_FORM_EMBED.md`**.

### ✅ 1. Faire tourner deux secrets — RÉGLÉ (2026-08-16)

Le 2026-08-15, gui avait collé dans `client/.env.local` sa **clé API Brevo** et
`NOTIFY_ENQUIRY_SECRET`, qui se sont affichées en clair dans une conversation archivée
(fichier bien gitignored — aucune fuite vers le dépôt). **Les deux ont été tournées et
vérifiées par gui le 2026-08-16** : nouvelle clé Brevo (`BREVO_API_KEY`) et nouvelle valeur de
`NOTIFY_ENQUIRY_SECRET` rejouée avec `2026-08-14c` sur PROD. Le fichier `.env.local` porte
désormais un avertissement en commentaire — **aucun secret n'a sa place là**, seulement les
URLs et les clés anon, publiques par nature.

### ✅ 2. Ping mensuel pour garder la clé Brevo vivante — LIVRÉ et vérifié le 2026-08-16

**Une clé Brevo se désactive après 90 jours sans appel**, et la synchro n'est appelée que par
une demande du formulaire. L'activité étant saisonnière (sept → mi-mars), le creux d'avril à
août suffit à la tuer — et la panne ne se verrait qu'à la première demande de la rentrée, quand
les contacts comptent le plus.

Parade : Edge Function **`brevo-ping`** (`supabase/functions/brevo-ping/`) qui tape
`GET /v3/account` — rien n'est envoyé, le compteur repart à zéro — protégée par son propre
secret `BREVO_PING_SECRET` (même gabarit que `notify-enquiry`, un secret par consommateur).
Appelée mensuellement par `pg_cron` (migration `2026-08-16_brevo_keepalive_ping.sql`, 1er de
chaque mois à 03:00 UTC). **PROD uniquement** (décision gui), comme le reste de Brevo — skippe
proprement si `BREVO_API_KEY` est absente, mais la tâche n'est même pas posée sur TEST.
✅ **Déployée et vérifiée en PROD le 2026-08-16** : job cron actif (`jobid=1`), appel manuel
`SELECT ping_brevo_keepalive();` → **`net._http_response.status_code = 200`**.

### ✅ 3. Périmètre Brevo — TRANCHÉ (2026-08-16) : rien à changer

**Décision gui** : le périmètre actuel suffit — tant que Brevo est alimenté quand quelqu'un
contacte via le site (formulaire léger `channel='form'`), c'est bon. Le formulaire de
réservation complet et les fiches saisies à la main (WhatsApp, Instagram) **n'ont pas besoin**
d'alimenter Brevo. Ne pas rouvrir cette question sans une raison nouvelle.

### ✅ 4. Restes de test en PROD — nettoyé (2026-08-16)

Demandes `BREVO-V2 14h18` et `Guillaume` (l'essai de gui lui-même), plus le contact
`gsetienne9+brevotest@gmail.com` dans Brevo — supprimés par gui.

### ✅ 5. Facturation aux agences partenaires (Fun&Fly & co.) — fondations livrées et vérifiées (2026-08-16)

Repéré le 2026-08-16 en traitant une demande venue de **Fun&Fly** : le centre rend le service
(cours, location, transfert, parfois hébergement en maison/bungalow) mais c'est l'**agence**
qui doit être facturée, pas le client — à un tarif catalogue propre à chaque agence, moins une
commission qu'elle retient. gui dit qu'il y a **plusieurs agences comme ça**. Confirmé sur une
vraie facture Fun&Fly (`temp/Factu BKC 2025 FFLY Famille Brunet.xlsx` : catalogue fixe par
agence, ex. "Pack cours Privé 10x 2h" = 450€, commission 20% retenue sur le total). Ne pas
confondre avec `enquiry_sources` (« comment nous avez-vous trouvé », lecture seule côté
visiteur) — une agence partenaire réserve activement, ce n'est pas un canal statistique.
Design complet et exploration du code : `.claude/docs/data-model.md` § agencies.

**✅ Phase 1 — fondations livrées** (plan approuvé, 3 tables + écran de gestion) :
- Migration `2026-08-16b_agency_billing_foundation.sql` : `agencies`, `agency_rate_items`
  (grille tarifaire par agence, TEXT+CHECK plutôt qu'un enum), `agency_billing_lines` (une
  ligne = une ligne de facture, découplée des leçons individuelles — un forfait 10×2h reste
  une seule ligne à 450€ même en 10 séances planning) ; colonnes `agency_id`/
  `agency_billing_line_id` posées sur `bookings`/`lessons`/`equipment_rentals`/`taxi_trips`/
  `booking_room_prices` (nullables, rien ne les remplit encore). RLS admin-only, `REVOKE ALL`
  anon (même gabarit que `document_templates`). ✅ **Migration appliquée et vérifiée TEST +
  PROD le 2026-08-16** — curl anon → 42501 sur les 3 tables, contrôle négatif → 42703 (détail
  en tête de fichier, § Migrations en attente).
- Nouvel onglet **Options → 🤝 Agencies** (`AgenciesTab.tsx`) : CRUD agence (nom, commission %,
  actif) + grille tarifaire (catégorie, libellé, heures de forfait, prix — désactivable jamais
  supprimable, même règle que les tarifs verrouillés de Pricing). `npm run build`/`test` OK,
  283 tests (aucun test cassé, aucune logique de calcul touchée).
  ✅ **Vérifié au navigateur sur PROD le 2026-08-16** (Claude in Chrome) : agence **Fun & Fly**
  créée (20% commission, notes avec la raison sociale Aquaphyle/Toulouse/TVA relevées sur la
  facture), 3 lignes de grille saisies — Pack cours Privé 10x2h (20h, 450€), Pack cours Semi
  Privé 10x2h (20h, 330€), Transfert Maputo↔Bilene (220€, catégorie transfer → pas de champ
  heures, comme prévu). Bascule Deactivate/Reactivate testée sur une ligne, comportement
  correct (grisée, bouton inversé, remise à l'identique). Trois lignes suffisent au catalogue :
  les doublons de la facture réelle (3× Pack Privé, 2× Pack Semi Privé) viennent du nombre de
  personnes facturées, pas de tarifs différents — pas de 4ᵉ ligne à créer. **Phase 1 close.**

**✅ Phase 2 — `agency_id` branché dans le wizard (2026-08-16)** : sélecteur "Referred by
(optional)" ajouté à l'étape Client (`BookingsPage.tsx`), sous la recherche/création de
client — liste les agences actives, "— direct booking —" par défaut, hint explicite ("ne
change pas la facturation, tague juste la résa"). Champ `agency_id` sur `WizardData`, transmis
par `bookingToWizard`/`bookingFields` dans les deux sens. `npm run build`/`test` OK, 283 tests.
✅ **Vérifié au navigateur sur PROD** : "Fun & Fly" listée dans le sélecteur ; résa réelle
**#022 (Loïc SENE) reliée à Fun & Fly** — celle-là même qui a motivé ce chantier — et
`agency_id` confirmé en base par requête directe. Aucune régression sur les résas existantes
(#021, #023 rouvertes en édition, "— direct booking —" par défaut comme attendu).
**Toujours pas de changement de facturation** : c'est juste le tag, la consommation (Phase 3)
et le masquage client (Phase 4) restent à faire.

**✅ Phases 3 + 5 — consommation et exclusion du calcul client (2026-08-17, `892c12d`)**
Livrées **ensemble, exprès** : dès qu'un service porte un `agency_billing_line_id`, le laisser
dans les totaux client facture deux fois le même euro. **Aucune migration** — les 4 colonnes
étaient déjà en base depuis le 16/08.
- **Ergonomie tranchée avec gui** : pas de sélecteur dans le planning, un **panneau dans la
  fiche résa** (Accounting → Bookings → 🤝 Agency billing, `AgencyBillingPanel.tsx`), visible
  seulement si la résa porte un `agency_id`. Raison : les cours de #022 étaient **déjà saisis**,
  un sélecteur à la création ne les aurait jamais rattrapés. **Périmètre choisi : les 4
  sources** (cours, locations, transferts, chambres).
- Le panneau : créer une ligne de facture depuis la grille de l'agence (prix et `unit_hours`
  **figés à la création**, éditables car une vraie facture s'écarte parfois du catalogue),
  barre de progression *heures faites / forfait* (⚠ ambre au dépassement), un `<select>` par
  service (« — billed to guest — » ou une ligne), tampons Invoiced/Paid, suppression avec
  avertissement du nombre de services qui repartent chez le client.
- **Couche de calcul** : `isAgencyBilled` / `isRoomAgencyBilled` / `agencyLineHoursUsed` /
  `computeAgencyTotals` (commission **par agence**, jamais un % global). Les 4 `compute*Revenue`
  sautent les lignes agence ; `computeSeasonTotals` récupère l'argent en `agencyRev` **net de
  commission** (même convention que le taxi, où seule la marge est comptée) + `agencyGross`,
  `agencyCommission`, `agencyOutstanding`.
- ⚠️ **Le taxi garde son COÛT** sur un transfert agence (le chauffeur est payé quoi qu'il
  arrive) et n'abandonne que le prix client — donc la marge d'une course agence est négative,
  compensée par la ligne agence. Sans ça la course paraîtrait gratuite. Verrouillé par un test.
- **Garde-fou de non-régression** : un test vérifie que sur un jeu **sans aucune ligne agence**
  tous les chiffres sont identiques à avant. 23 nouveaux tests, **322 au total**.
- `filterDataToSeason` : une ligne de facture n'a pas de date propre → elle **suit sa résa**.
- ✅ **Vérifié par curl anon sur les DEUX bases** : les 4 colonnes `agency_billing_line_id`
  → **200 `[]`**, contrôle négatif `colonne_bidon` → **42703**, `agency_billing_lines`
  → **42501** (la table de facturation reste fermée en anon).
- ⬜ **Reste (gui)** : test au navigateur sur la résa **#022** (Claude in Chrome proposé) —
  créer la ligne « Pack cours Privé 10x2h » à 450 € pour Loïc SENE et y rattacher les 14h
  déjà saisies.

**🔶 Phase 4 — masquage côté client : la moitié visible est faite, la protection réseau non.**
Fait le 2026-08-17 dans `ClientSharePage.tsx` : une ligne couverte par l'agence affiche
**« — »** au lieu d'un prix, sort du sous-total et du solde, et une note explique la mention au
client (« covered by the agency that arranged your trip »). Les chambres agence tombent à 0 →
elles disparaissent, comme toute ligne à 0 depuis le 2026-08-02.
⚠️ **C'est un masquage d'AFFICHAGE, pas une protection** : `price_per_hour` voyage toujours dans
la réponse réseau (vérifié : les 4 colonnes sont lisibles en anon, c'est d'ailleurs ce qui fait
marcher le masquage). La vraie redaction demande toujours une fonction **SECURITY DEFINER**
façon `share_room_keys()` renvoyant `price_per_hour` à `NULL` quand la ligne est facturée à une
agence — un GRANT de colonne ne peut pas conditionner par la valeur d'une autre colonne.
Terrain nouveau (jusqu'ici les fonctions RLS scopent des lignes, pas des colonnes
conditionnelles) — à vérifier par curl **avec un vrai token client**, sans exception.

**⬜ Phase 6 — onglet compta Agencies** : calqué sur `PalmeirasTab.tsx` — sélecteur de
période, KPI (brut facturé / commission / net dû), tableau des `agency_billing_lines` avec
`invoiced_at`/`paid_at` à cocher. Facturation **au fil de l'eau, revue avec gui avant envoi**
(pas d'automatisation de l'envoi) — décision gui.
**Déjà fait pour elle** : `computeAgencyTotals` (pur, testé, scopable par agence ou par résa)
et les tampons invoiced/paid, posables depuis le panneau de la fiche résa. Il reste la **vue
d'ensemble** : aujourd'hui on ne peut pas répondre à « que me doit Fun & Fly, toutes résas
confondues ? » sans ouvrir chaque réservation.
⬜ **Décision ouverte, pas tranchée le 17/08** : le **CashFlow** ne connaît pas l'argent des
agences. Un `paid_at` est pourtant une vraie date d'encaissement — il manque une colonne
« Agencies », exactement comme celles décidées pour Palmeiras (01/08) et Providers (01/08).
Chacune de ces colonnes a fait l'objet d'une décision de gui : je n'en invente pas une seule.

### ✅ 6. San Martinho — `external_billing` activé en PROD (2026-08-16)

En convertissant la demande Fun&Fly (ci-dessus) en réservation, trouvé que la vraie fiche
PROD de San Martinho n'avait **jamais eu la case « Billed per stay, not per night » cochée**,
alors que le chantier du 2026-08-12 avait bien livré et vérifié la fonctionnalité — juste
jamais appliquée à la fiche réelle. Symptôme avant correctif : badge rouge « no sell price:
Room — billed 0€ » dans Options → Accommodations, et le wizard New Booking proposait San
Martinho comme une chambre normale à 0 €/nuit au lieu du bloc We pay/Charged.
**Corrigé au navigateur (Options → Accommodations → San Martinho → coché la case → Save)**,
confirmé revenu à « per-stay pricing · 1 spot » sans badge. Aucune donnée existante touchée.

### ✅ 7. Réservation #022 (Loïc SENE / Fun&Fly) — cours détaillés dans le planning (2026-08-16)

Créée le 2026-08-16 (conversion enquête → résa) : Loïc SENE + Julie LE FOULER, 19→28/10/2026,
San Martinho (0€/0€, per-stay, rien facturé), statut **Provisional**, 0€ payé. Les deux blocs
de cours (stage privatif **10h du 20 au 24/10**, puis privatif **4h du 25 au 26/10**, Loïc
uniquement) sont désormais saisis dans le planning par gui. Enquête d'origine marquée **Won**
et reliée (`client_id`/`booking_id`).

---

## ✅ Tarification dégressive par palier (cours privés/groupe) — livrée (2026-08-16)

Repéré en concevant la facturation agences : aujourd'hui 2h ou 20h de cours coûtent le même
prix à l'heure, pour tout le monde. Décisions gui : prix/h par palier (pas %), calé sur le
**cumul d'heures avant la leçon du jour** (celle qui franchit le seuil reste à l'ancien tarif),
cumul **à vie** (jamais remis à zéro), cours privés et groupe seulement (jamais supervision),
un seul tarif pour toute une leçon groupe basé sur le **premier participant**. Conçu avec
`/plan` (2 agents d'exploration), design complet dans `.claude/docs/LESSON_PRICING.md`
§ Tarification dégressive par palier.

**Livré** :
- Migration `2026-08-16c_lesson_price_tiers.sql` — table `price_tiers` (`billable_type`,
  `min_hours`, `price_per_hour`), admin-only. Le tarif de base (`price_items.price`) reste le
  palier "0h+" implicite.
- Calcul pur dans `accounting/utils.ts` : `clientParticipantIds` (le join croisé-résas qui
  n'existait nulle part), `cumulativeHoursBefore` (tri chronologique + cumul, modèle
  `runningBalances` de `cashFlowUtils.ts`), `getTierRate`, et `getLessonClientRate` étendue
  (le snapshot gagne toujours ; `resolveLessonRate` séparée pour préserver le `null` — "rien
  configuré" — qu'un nouveau `price_per_hour` doit figer, distinct du `0` d'affichage).
  Propagation gratuite à `computeBookingTotal`/`computeSeasonTotals`/`AccountingDashboard` via
  `computeLessonsRevenue` ; 2 sites d'appel directs mis à jour dans `BookingFinances.tsx`.
- `LessonWeekView.tsx` fige le tarif au palier applicable **à la création** de la leçon (comme
  le reste des snapshots du projet). `ForecastView.tsx` continue de soumettre `null`
  (comportement déjà existant, pas touché) — ses leçons héritent du calcul au moment de leur
  lecture, pas de leur création ; différence mineure préexistante, pas une régression.
- **Fiche client** (`ClientsPage.tsx`, onglet Info) : compteur "Lifetime kite hours" (Private/
  Group séparés) + légende rappelant que le cumul ne se remet jamais à zéro — le rappel visible
  demandé par gui plutôt qu'une note qui se perd.
- **Options → Pricing**, sous les lignes Private/Group : bloc "🎚️ Volume tiers", liste des
  paliers existants + formulaire d'ajout (heures, prix). Pas de suppression/édition dans l'UI
  pour l'instant (décision : ajouter/lister d'abord, gui demandera si besoin une fois testé).
- **16 nouveaux tests** (`utils.test.ts`), style existant (fixtures `mk*`, un `it()` par cas) :
  boundary exact du palier, cumul multi-résas (l'habitué qui revient), leçon groupe basée sur
  le premier participant, repli sur les heures de cette résa seule quand personne n'est lié à
  un `Client`, snapshot toujours prioritaire, jamais de palier sur supervision. **299 tests.**

✅ **Migration appliquée et vérifiée TEST + PROD le 2026-08-16** — curl anon sur
`price_tiers` → 42501 sur les deux bases, contrôle négatif → 42703.
⬜ **Reste (gui)** : saisir les vrais seuils dans Options → Pricing (le formulaire existe,
aucun palier n'est encore posé).

🔶 **Déviation assumée par rapport au plan initial** : `EquipmentPage.tsx` (calcul de marge
matériel, déjà une estimation approximative) **n'a pas été rendu tier-aware** — il n'a
aujourd'hui aucun accès à `bookingParticipants`, et le fil à tirer (3 fonctions imbriquées)
était disproportionné pour un chiffre déjà approximatif. Impact réel quasi nul : ne joue que
pour une leçon jamais résolue (`price_per_hour` encore `null`), un cas de plus en plus rare
puisque `LessonWeekView` fige désormais le prix à la création. À faire si gui le demande.

⬜ **Hors scope, noté pour plus tard** : le rattachement à l'épuisement d'un forfait agence
(réutilisera `cumulativeHoursBefore` telle quelle) ; suppression/édition des paliers dans l'UI ;
prix barré sur les PDF/emails de résa (aucun des deux fichiers concernés ne touche
aujourd'hui à un prix de leçon).

---

## 🔎 Audit global du 2026-07-31 (Opus, nuit) — 3 constats qui demandent une DÉCISION de gui

> Le reste de l'audit a été corrigé et committé (6 commits `ae096c1`→`5576d38`). Ces trois-là
> touchent à des **montants affichés** ou à un choix de design : je n'ai rien changé, exprès.

### 1. ~~💸 CashFlow ignore `palmeiras_entries`~~ — ✅ CORRIGÉ (2026-08-01, `f346901`)
**Décision gui** : `palmIn` devient le **net Palmeiras hors loyer** (reversals + free income
− free expenses), plutôt que d'envoyer les dépenses libres dans la colonne `expenses` — qui
est la table `expenses` générale et aurait alors voulu dire deux choses. Bénéfice : une
identité vérifiable **`palmIn − rent === palmeirasNet`**, verrouillée par un test, donc les
deux écrans ne peuvent plus diverger. Colonne renommée « Palmeiras net » (elle peut être
négative, le signe suit la valeur). Rien ne change à l'écran tant qu'aucune ligne libre
n'existe. **185 tests.**

<details><summary>Constat d'origine (gardé pour la leçon)</summary>
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
</details>

✅ **`activity_payments` — CORRIGÉ aussi (2026-08-01, `129faaf`)**. Ils n'étaient lus par
aucun calcul comptable : chargés dans `sharedData` et jamais consommés. Or régler un
prestataire sort du cash réel — le **coût** était bien compté (netté dans `billed`, en
engagement), mais **le jour où l'argent sort de la caisse n'apparaissait nulle part**,
exactement le trou que `taxiOut` comble déjà pour les chauffeurs.
**Décision gui : colonne dédiée « Providers »** = payé au prestataire − reçu de lui, datée
du **règlement** (pas de l'activité), les deux sens nettés, signe suivant la valeur. Pas de
double comptage : le coût est dans `billed`, qui ne fait pas partie de `net` — verrouillé
par un test. Le KPI « Total out » a été mis à jour aussi, sinon il contredisait le tableau
juste en dessous. **191 tests.**

### 2. ~~📅 « Net result » n'est pas filtré par saison~~ — ✅ CORRIGÉ (2026-08-02, `16a5fac`→`4ac9faa`)
**Décisions gui** : découpe sur la **date de check-in** (une résa appartient entièrement à la
saison de son arrivée, jamais coupée en deux), et les 3 étapes faites d'un coup.
Implémentation en 3 commits : `filterDataToSeason` **restreint le jeu de données en amont**
sans toucher à un seul calcul (donc rien à revérifier côté maths) ; écran Options → Seasons
pour créer/éditer les saisons ; sélecteur `All time / saison / ⇄ Compare` sur le Dashboard.
Invariant verrouillé par un test : deux saisons adjacentes doivent sommer au total all-time.
**208 tests.**
✅ **Fait (gui)** : vraies dates de saison saisies dans Options → Seasons
(une saison = début septembre → mi-mars, sans chevauchement).
✅ **FAIT le 2026-08-13** — `PlanningView` lit la table `seasons`, la 3ᵉ source de vérité a
disparu. Nouveau module pur `utils/seasonWindow.ts` (**16 tests**, 239 au total) :
- La grille s'ouvre sur la saison **contenant aujourd'hui**, sinon la **prochaine à démarrer**
  (le creux avril→août n'appartient à aucune saison : on y montre celle qu'on est en train de
  remplir, pas celle qui vient de finir), sinon la dernière connue.
- Les flèches parcourent les saisons de la table et **s'éteignent aux extrémités**.
- ⚠️ **Piège traité** : l'ancienne fenêtre commençait un 1er et finissait un dernier-du-mois,
  donc l'en-tête comptait des **mois entiers**. Une saison saisie à la main finit « mi-mars » :
  compter mars pour 31 jours décalait **toutes les barres** d'une quinzaine. Premier et dernier
  mois sont désormais rognés sur les vraies bornes — vérifié à l'écran sur TEST avec la saison
  15/09 → 15/03 : septembre = **16 colonnes**, mars = **15**, total 182.
- **Repli si la table est vide** : comportement d'avant à l'identique (Sep→Mar, navigation par
  année, libellé `2026/27` suivi d'un `*`), pour qu'un planning ne devienne jamais vide faute
  de configuration.
- ✅ **Chevauchement nettoyé sur TEST le 2026-08-13** : il y avait deux « 2026-2027 »
  (01/09→31/05 et 15/09→15/03) — la compta aurait compté deux fois en mode Compare.
  **Décision gui : garder 15/09/2026 → 15/03/2027**, l'autre supprimée. TEST n'a plus qu'une
  saison ; le bouton *Compare* disparaît de lui-même (il exige 2 saisons).
  ✅ **PROD fait par gui (2026-08-16)**.

### 3. ~~🧾 Une chambre sans tarif s'affiche « €0 » sur la page client partagée~~ — ✅ CORRIGÉ (2026-08-02, `09df7f2`)
**Décision gui : masquer purement et simplement** la ligne à 0 €, plutôt que l'étiqueter.
`ClientSharePage` ne liste plus que les lignes `total > 0`. Attention au piège : le 0 vient
d'un `0.00` **explicitement écrit** en base (motif « maison entière » — tout le prix est porté
par une seule chambre), pas d'une donnée manquante, donc aucun repli `??` ne pouvait
l'attraper. Le total facturé est inchangé.
⚠️ **Ça traite le symptôme visible par le client, pas la cause** : les hébergements sans
tarif de vente restent listés ci-dessous (B1, San Martinho, prix maison entière à confirmer).

---

## 🎯 OÙ ON EN EST — chantier fiabilité compta (2026-07-29)

**Plan convenu avec gui, dans cet ordre.** Les étapes 1 et 2 sont faites.

1. ✅ **Faire atterrir la tarification des leçons** — migrations TEST (29/07) et **PROD
   (30/07)** passées et vérifiées par curl anon, code poussé et déployé.

### ✅ RÉGLAGES DE DONNÉES — faits en PROD le 2026-07-31

- **Tarifs des chambres** : H2 et H3 n'avaient **que** leur prix maison entière ; F et B y
  sont ajoutés à **70 / 50** (les tarifs donnés par gui, identiques à ceux que H1 portait
  déjà). ✅ **Prix maison entière tranchés — vérifié à l'écran sur PROD le 2026-08-11** :
  H1/H2/H3 portent **100 €/n** chacune (gui les a saisis lui-même depuis le 31/07 ; le
  150/140/160 relevé alors n'existe plus). Conséquence assumée : la maison entière est
  **20 € moins chère** que ses deux chambres vendues séparément (F 70 + B 50 = 120), soit
  −17 %. `getBaseNightlyRate` applique bien 100/2 par chambre en full house, jamais F+B.
- **Prix du dîner** : **12 €** (Options → Pricing → Meals). Variable dans les faits, c'est le
  montant d'ouverture d'un nouveau repas, éditable repas par repas.
- **Paie des moniteurs** : rien à faire, **déjà correct** — Tere **0/0/0** (compagne de gui),
  Gui **0/0/0**, Pierrot 18/20/8, Rémi 18/20/5. La note « encore aux défauts 50/35/25 »
  était périmée.
- ✅ **B1 a bien un prix de vente** (50 €/n, coût 45 €/n) — vérifié à l'écran sur PROD le
  2026-08-11. L'entrée précédente (« B1 n'a pas de prix ») était périmée. ⚠️ Marge de
  **5 €/nuit** seulement : à assumer ou à revoir, ce n'est pas un bug.
- 🔶 **San Martinho — cas spécial, en cours de conception (2026-08-11)**. Seul hébergement
  sans prix de vente, et ce n'est **pas** un oubli : décision gui, les clients s'y logent en
  direct, **aucun argent ne transite par le centre** (ni revenu ni coût). Ce qu'on veut
  quand même suivre : nombre de clients, cours, locations. Deux besoins distincts en sortent
  — (a) hébergement **non facturable**, (b) **plusieurs réservations simultanées** sur le
  même lieu (impossible aujourd'hui : un `other` n'a qu'une chambre `Room`).
  ⛔ Ne pas poser de badge « no rate configured » dessus avant d'avoir tranché, sinon
  l'alerte est fausse en permanence.
  **✅ LIVRÉ le 2026-08-12** (reste la migration du 12 à passer). Comment ça marche :
  - **(a) non facturable** : `accommodations.external_billing` — le lieu ne porte aucun
    `room_rate`, pas de badge rouge, et Management affiche « per-stay pricing · N spots ».
  - **(b) séjours simultanés** : une **chambre = un emplacement**, créée depuis le crayon.
    Le planning dessine déjà une ligne par chambre → **zéro changement** au drag & drop,
    et le détecteur de conflit empêche deux résas sur le même emplacement.
  - **La saisie** : dans le wizard (étape Stay), cocher un emplacement fait apparaître un
    bloc « whole stay » avec **We pay / Charged** et la marge calculée. Écrit une ligne
    `external_accommodation_bookings` par lieu (pas par emplacement) aux dates de la résa.
  - **La compta** : le prix client était déjà dans `accomRev`, mais **le coût n'était
    soustrait nulle part** — corrigé (`externalStayCosts`, même traitement que les
    bungalows), sinon le premier séjour saisi aurait compté l'argent de l'hôtel comme
    notre marge. Verrouillé par 2 tests + l'identité du Net result.
  ✅ **Vérifié bout-en-bout sur TEST le 2026-08-12** (migration passée + app pilotée au
  navigateur) : deux résas **qui se chevauchent** posées sur Spot 1 et Spot 2 du même lieu,
  Spot 1 passant à « ⚠ Booked » sur les dates communes ; les 2 lignes écrites en base avec
  leurs forfaits ; dashboard **2 250 → 2 715 €** de CA et **+742 → +897 €** de résultat
  (= +465 encaissés −310 payés à l'hôtel), carte « External stays −310 € » apparue.
  Données de test supprimées, dashboard revenu **exactement** à +742 € / 2 250 €.
  ✅ **Page client partagée vérifiée le 2026-08-13** (vrai lien `client_…` de la résa #003) :
  la ligne du séjour affiche le **nom du lieu**, « — » en Per night (aucun prix/nuit inventé
  à partir d'un forfait) et **€315** en total, inclus dans le sous-total. Surtout, **testé
  avec le vrai token** : `select=total_cost` → **42501**, `notes` → 42501, `select=*` → 42501,
  seules les colonnes accordées passent. La fuite de marge est fermée en conditions réelles,
  pas seulement en théorie.
  ⬜ **Décisions laissées ouvertes** (aucune ne bloque l'usage) : le séjour prend les dates
  de la résa (pas de dates propres — à ouvrir si un client change d'hébergement en cours
  de séjour) ; le coût n'apparaît **pas** dans le CashFlow, comme les bungalows et les
  loyers de maison : c'est un engagement, la sortie de caisse se saisit dans Expenses.
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
   facturé — ces prix deviennent visibles et modifiables. ✅ Migration passée TEST 30/07,
   PROD 31/07 (registre en tête de fichier).

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
   🔶 **Travel Guide : gui dit l'avoir rempli en FR le 2026-08-11** — reste à confirmer que
   le **Save** a bien été fait (l'éditeur travaille sur un brouillon local) et sur quelle base.
4. 🔶 **EN COURS — traductions EN/ES des textes FR de gui** (workflow : mémoire
   `templates-translation-workflow` ; Claude n'a **aucun** accès à la table — anon 42501).
   **⏸️ En attente de gui au 2026-08-11** : il a rempli le **Travel Guide** en français et
   demandé les traductions. Requête à lui redemander s'il revient sans l'avoir collée —
   elle renvoie **une seule cellule**, donc un clic pour copier, pas de colonnes tronquées :

   ```sql
   SELECT jsonb_pretty(jsonb_agg(jsonb_build_object(
            'id', id, 'order', sort_order, 'active', is_active,
            'title_fr', title->>'fr', 'content_fr', content->>'fr'
          ) ORDER BY sort_order))
   FROM document_templates WHERE doc_type = 'travel_guide';
   ```

   → Claude rend un script `UPDATE … jsonb_set(…)` idempotent qui ne touche **que** `en`/`es`
   (jamais `fr`) → gui l'applique **TEST + PROD**. Résultat `null` = rien n'a été sauvé.
   Même chose ensuite pour `welcome_guide`. Retouches ponctuelles : copier-coller chat →
   éditeur Templates. (Plan C : Claude in Chrome sur la session admin — lent, dernier recours.)

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

### C3 — Même fallback sur la page client partagée — ✅ TERMINÉ (code 2026-07-30, migration TEST 30/07 + PROD 31/07)
`ClientSharePage` retombe désormais sur `getBaseNightlyRate()` quand la résa n'a pas de prix
figé, au lieu d'afficher **0 €/nuit** au client. Migration passée sur les deux bases et
vérifiée par curl (4 contrôles, cf. registre en tête de fichier).

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
- ~~**Question ouverte** : le tarif instructeur sert de prix client ET de coût ⇒ marge nulle
  sur les cours particuliers.~~ ✅ **SANS OBJET depuis le 2026-07-29** — l'audit date du 25/07,
  la séparation prix client / paie moniteur a été livrée le 29. Deux barèmes indépendants :
  prix client dans `price_items` (Options → Pricing), paie dans `instructors.rate_*`, les deux
  figés à la création de la leçon. Cf. `LESSON_PRICING.md`. **Ne pas re-poser la question** :
  elle a déjà fait perdre du temps le 2026-08-11 en étant relayée depuis cette liste.

---

## 📧 Emails — demandes de gui (2026-07-28)

### Retouches sur l'email de documents — 🔶 une demande traitée, les autres à préciser
Test d'envoi depuis Documents fait le 2026-07-28 (post-fix S1) : **ça marche**, mais gui veut
des **modifications sur le contenu de ce mail**. À préciser : *lequel* (`visa_letter`,
`booking_confirmation`, `travel_guide`, `welcome_guide`) et *quoi*.

✅ **Première demande traitée (2026-08-02, `6ccaafb`) — `booking_confirmation`** : les
**estimations de prix disparaissent**, dans les 3 langues et dans le **PDF comme dans l'email**
(ne corriger que le PDF aurait envoyé un mail le contredisant). Il ne reste que le **montant
réglé**. Partent avec : le « Total estimé » (reconstruit à chaque affichage depuis des prix
qui bougent encore — un client lit ça comme un devis) et le « Solde restant », qui n'était que
`total − versé`. Effet de bord bienvenu : suppression de l'input « Estimated total » et d'un
`useEffect` qui lançait **11 requêtes Supabase en parallèle** à chaque changement de résa.
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
