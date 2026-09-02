# BACKLOG — reste à faire (source de vérité unique)

> **La** liste canonique des tâches restantes. Mise à jour à chaque session (ajouter/rayer ici,
> pas dans la mémoire). Chaque entrée dit : quoi, pourquoi, et comment s'y prendre.
> Rappels transverses : migrations = **TEST + PROD dans la foulée, une seule tâche** ;
> vérifier les migrations sécu par **curl anon direct** (pas seulement `has_table_privilege`) ;
> Claude commit, **gui push lui-même** ; `npm run build` avant tout push.

---

## 🔐 Audit sécu du 2026-08-21 (revue indépendante, agent Opus 5) — reste 1 point sur 3

Contexte complet (ce qui est solide, ce qui ne l'est pas) : mémoire, section du jour.
Le point 1 (tokens `Math.random()` → `crypto.randomUUID()`) est **fait et commité** (`6ef3f81`).

✅ **Expiration par défaut posée le 21/08** (1 an, `gui` : *« 1 an ? qu'en penses-tu ? »* → validé) :
les 5 générateurs dédiés qui codaient `expires_at: null` en dur (`TaxiPage.tsx` driver,
`ActivitiesPage.tsx` activity_provider, `DocumentsPage.tsx` client et booking_form/update-form,
`EnquiryPanel.tsx` booking_form) posent maintenant `addDaysISO(todayISO(), 365)`. Le formulaire
manuel « + New link » d'Options → Shared Links (seul endroit qui crée aussi `taxi_manager` et
`restaurant`) préremplit désormais le même défaut, éditable/effaçable à la main — gui peut encore
faire un lien permanent en vidant le champ (utile pour `enquiry_form`, l'iframe du site, qui doit
rester valide en continu). **Correction sur ce que j'avais dit à gui** : ce n'était pas
`driver`/`taxi`/`taxi_manager`/`restaurant` comme annoncé — `taxi` et les 2 types cités n'avaient
jamais de générateur dédié, seulement le formulaire manuel où la date était déjà éditable.
Petit **panneau « ⏰ Expired »** ajouté dans Options → Shared Links (`ManagementPage.tsx`) : un
lien dont `expires_at` est passé s'affiche distinctement (badge rouge, ligne grisée, date en
rouge) au lieu de rester marqué « Active » jusqu'à ce que quelqu'un signale que ça ne marche plus.
Vérifié au navigateur (TEST) : lien créé avec une date passée → badge + ligne grisée, corrigé.
⚠️ Ne resserre pas encore la policy RLS `driver` sur `bookings`/`clients`
(`supabase/schema.sql:990-996`) à ses seules courses — un lien chauffeur transféré donne toujours
accès à **tous** les noms de clients et dates (pas d'email/tel/passeport/argent). Reste à faire.

- ⬜ **Le formulaire public (`enquiries`/`form_submissions`) n'a de garde-fou anti-spam que côté
  navigateur** (honeypot + délai 3 s, `EnquiryFormPage.tsx:75`) — contournable en tapant
  directement l'API. Pas de fuite de données (colonnes bornées, `status`/`channel` verrouillés),
  mais risque de nuisance (boîte mail noyée, quota Resend, Brevo pollué). Pas de backend pour
  poser une vraie limite de fréquence — solution la plus simple : un garde-fou en base (refuser
  au-delà de N insertions/heure depuis la même adresse email par exemple).
- Optionnel, sans urgence : CSP quasi vide dans `client/vercel.json` (seulement
  `frame-ancestors`) — mais zéro `dangerouslySetInnerHTML` dans le repo, donc surface XSS réelle
  très faible. `Referrer-Policy: no-referrer` serait un ajout gratuit vu que les tokens voyagent
  dans l'URL.

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
| **`2026-09-02_transfer_reference_prices.sql`** | **⬜ À PASSER (TEST + PROD) EN PREMIER. Sans danger** — nouvelle table `transfer_reference_prices` (admin-only, `REVOKE ALL FROM anon`) : la liste de prix indicative des transferts (Maputo/Bilene/Tofo/Vilankulo, taxi local, Chappa, avion, bateau Macaneta) pour le sous-onglet **Options → Prices → Reference info**, seedée à partir de `temp/Trip orga - contacts.xlsx` (1er onglet). Purement informatif, **aucun calcul de l'app ne lit cette table**. **Pas de colonne devise** (retiré le 2026-09-02, gui) : 3 colonnes prix fixes et nullables `price_mzn`/`price_eur`/`price_usd` — cette page ne renseigne que `price_mzn` (+ `price_eur` quand gui connaît le montant, l'excel source n'en donnait aucun) ; une colonne `page` (`'transfers'`/`'kruger'`) sépare aussi cette table en 2 sous-onglets, voir la migration `b` ci-dessous. Quelques lignes du fichier source étaient ambiguës (cellules fusionnées/décalées, un « 220 $ » pour Komatipoort, le bloc bateau/4x4 Macaneta) — gardées en note dans le champ `notes`, **à vérifier par gui** une fois visibles dans l'UI. | ⬜ | ⬜ |
| **`2026-09-02b_kruger_reference_prices.sql`** | **⬜ À PASSER (TEST + PROD) JUSTE APRÈS la migration ci-dessus** — seed seul (aucun schéma), 23 lignes dans la même table `transfer_reference_prices` mais `page='kruger'` : **son propre sous-onglet Options → Prices → « Kruger & Eswatini »** (gui a demandé un onglet à part, 2026-09-02), pas une section repliable de Reference info. Forfaits Kruger 1j/2j/3j, combos Eswatini/Kruger, Blyde River Canyon, hébergement, conditions de dépôt/Paypal — tout en `price_usd` (page 100 % USD, pas de MZN/EUR ici). Seedé depuis `temp/kruger.xlsx`, dont l'onglet mélangeait ce catalogue de prix avec **un vrai historique de réservations (noms clients réels, n° de résa, paiements)** — **volontairement exclu** de ce fichier (gui, 2026-09-02) : hors sujet pour un outil de réponse aux clients, et ça expose des noms. Idem pour la note commission agence « 10 %/5 % STO », plus proche du chantier `agencies`/`agency_rate_items` que de ce tableau. | ⬜ | ⬜ |
| **`2026-08-21_hide_empty_rooms.sql`** | **⬜ À PASSER (TEST + PROD). Sans danger** — ajoute `accommodations.hide_empty_rooms` (`BOOLEAN NOT NULL DEFAULT false`) : le planning n'affiche que les emplacements occupés **plus une ligne libre**, pour un hébergement dont les « emplacements » sont une commodité de saisie (San Martinho, passé à 6). Tant que la case n'est pas cochée, **le planning se comporte exactement comme avant**. Backfill `ILIKE '%martinho%'` : n'active que PROD, sans objet sur TEST (« Palmeiras Room (demo) »). ⚠️ **Un drapeau en base, pas un test sur le nom** dans le code. | ⬜ | ⬜ |
| ~~`2026-08-21_update_form_email_type.sql`~~ | 6ᵉ valeur d'`email_log_type` → `'update_form'`, pour la colonne Documents → Overview qui envoie à un client déjà en résa le lien du formulaire public complet (dates de visa, passeports, contact d'urgence) sur une résa **existante** au lieu d'une enquiry (`params.target_booking_id`). Fichier seul, rien ne s'en sert dans la même transaction. ✅ **Vérifiée le 2026-08-21 en service_role sur les deux bases** (email_logs admin-only, le curl anon ne prouve rien) : `email_logs?type=eq.update_form` → **200 `[]`**, contrôle négatif `zzz_bidon` → **22P02**. | ✅ 2026-08-21 | ✅ 2026-08-21 |
| ~~`2026-08-20_travel_guide_translations.sql`~~ | **✅ Passée et vérifiée TEST + PROD le 2026-08-20.** Les **traductions EN + ES** des 6 sections du Travel Guide, écrites à partir du FR terminé par gui. **Ne touche pas au français** : `jsonb_set` sur les seules clés `en`/`es`, aucune instruction ne nomme `{fr}`. Idempotent, rejouable. Ce n'est pas du schéma mais du contenu — même endroit que le backfill des `short_code`. Vérifié en service_role sur les 2 bases : **FR manquant = 0, EN/ES manquant = 0**, guillemets et ponctuation intacts, et les longueurs PROD enfin du même ordre (`549/456/516`, `970/882/950`...). | ✅ 2026-08-20 | ✅ 2026-08-20 |
| **`2026-08-19_agency_invoices.sql`** | **⬜ À PASSER (TEST + PROD).** La **génération de facture agence** : table `agency_invoices` (notre n° `AAAAMMJJ` unique, la **réf que l'agence nous donne**, date, tampons sent/paid) + `agency_billing_lines.agency_invoice_id`. **Aucun DROP → ne peut rien casser.** Les tampons `invoiced_at`/`paid_at` **déménagent de la ligne vers la facture** (on solde une facture, pas une ligne) — vérifié avant d'écrire : **aucune ligne ne portait de tampon sur les 2 bases**, rien n'est perdu. Admin-only (REVOKE anon). ⚠️ Table admin-only → **le curl anon ne prouve rien**, vérifier en service_role ; recette en bas du fichier. | ⬜ | ⬜ |
| **`2026-08-19c`** *(pas encore écrite — renommée, `b` était déjà pris)* | Le `DROP` des colonnes `invoiced_at`/`paid_at` devenues mortes sur `agency_billing_lines`, **après** que Vercel ait déployé le code qui ne les lit plus. Même prudence en 2 temps que la Phase 4. Sans urgence : deux colonnes vides ne gênent personne, mais les laisser indéfiniment finirait par tromper quelqu'un. | ⬜ | ⬜ |
| ~~`2026-08-19b_client_account_email_type.sql`~~ | *(Session Documents, en parallèle — sans lien avec les agences.)* 5ᵉ valeur d'enum `email_log_type` → `'client_account'`, pour créer/voir/renvoyer le lien perso `?share=` d'une résa depuis Documents → Overview sans passer par Options → Shared Links. Fichier seul (rien n'utilise la valeur dans la même transaction). ✅ **Vérifiée le 2026-08-19 en service_role sur les deux bases** (`email_logs` est admin-only, le curl anon ne prouve rien ici) : `email_logs?type=eq.client_account` → **200 `[]`** (valeur acceptée), contrôle négatif `zzz_bidon` → **22P02 invalid input value**. | ✅ 2026-08-19 | ✅ 2026-08-19 |
| ~~`2026-08-18b_agency_price_redaction_columns.sql`~~ | Les 4 colonnes générées `share_price*` (`lessons`, `equipment_rentals`, `taxi_trips`, `booking_room_prices`), NULL quand la ligne est facturée à une agence. Phase 4 des agences. Vérifiées en service_role sur les 2 bases → **HTTP 200 sur les 4**. | ✅ 2026-08-18 | ✅ 2026-08-18 |
| ~~`2026-08-18c_agency_price_revoke.sql`~~ | Le `REVOKE`/`GRANT` par colonne qui **ferme réellement la fuite**. ✅ **Vérifié le 2026-08-19 avec de VRAIS tokens** (client #021, driver, taxi_manager) sur les 2 bases — la seule preuve valable ici, un curl anon nu ne prouve rien. **Colonnes brutes fermées** : `lessons.price_per_hour`, **`lessons.instructor_rate` (paie moniteur)**, `equipment_rentals.price`, `taxi_trips.price_eur`, `booking_room_prices.price_per_night` et `lessons?select=*` → **42501** partout, y compris avec un token driver/manager. **Et les pages marchent** : les 4 `select()` réels de `ClientSharePage` → **200 avec données** (l'alias fonctionne : `price_eur: 120` vient de `share_price_eur`), Driver et TaxiManager → **200**. | ✅ 2026-08-18 | ✅ 2026-08-18 |
| ~~`2026-08-18_agency_short_code.sql`~~ | Ajoute `agencies.short_code` — le badge `(FF)` affiché à côté du nom du client dans le planning, les cartes Daily/Forecast, la liste Bookings et la compta. Sème les 3 codes existants (`FF`, `Adek`, `Decat`) par `ILIKE` sur le nom : **backfill unique dont le résultat est stocké**, pas une correspondance par nom à l'exécution (une agence non reconnue n'aura simplement pas de badge, à saisir dans Options → 🤝 Agencies). **Pas de GRANT anon** : `agencies` reste admin-only, sinon le planning Forecast partagé exposerait le nom commercial des partenaires. ⚠️ **Le curl anon ne prouve RIEN ici** (table admin-only : `42501` avant comme après) — vérifiée le 2026-08-18 en **service_role** sur les deux bases : `select=short_code` répond, contrôle négatif `colonne_bidon` → **42703**. PROD porte les 3 codes semés (`Adekua`→`Adek` 12 %, `Decathlon`→`Decat` 10 %, `Fun & Fly`→`FF` 20 %) ; TEST rend `[]`, normal, il a été nettoyé après la campagne du 18. | ✅ 2026-08-18 | ✅ 2026-08-18 |
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
  facture), 3 lignes de grille saisies — Pack cours Privé 10x2h (**10h**, 450€), Pack cours Semi
  Privé 10x2h (**10h**, 330€), Transfert Maputo↔Bilene (220€, catégorie transfer → pas de champ
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
**Toujours pas de changement de facturation** à ce stade : c'était juste le tag. *(La
consommation — Phase 3 — a suivi le 17/08, et la redaction client — Phase 4 — le 18/08.)*

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
- ✅ **Campagne de test complète menée le 2026-08-17 sur TEST** (Claude in Chrome + service_role),
  base restaurée à ses chiffres exacts (4 817 € / #001 = 1 326 €) :
  agence + grille créées à l'écran, résa taguée, **5 services des 4 types** rattachés → total
  client **1 326 € → 606 €** (exactement les 720 € déplacés), compteur **3,5h/20h**,
  **dépassement 2h/1h en ambre**, déplacement d'un service d'une ligne à l'autre, tampons
  invoiced/paid (timestamps en base), suppression de ligne rendant ses services au client
  (`ON DELETE SET NULL` **et** état local), **page client partagée** affichant « — » avec le
  solde inchangé (chambre agence disparue, cours visibles sans prix, sous-total cours 0 €).
  Écriture vérifiée en base sur les 4 tables. **3 défauts trouvés et corrigés** (`16eb23d`) —
  détail ci-dessous.
- ℹ️ **La saisie des cours de #022 attend octobre, et c'est normal** — les cours se saisissent
  la veille, voir le point juste après. La ligne de facture Fun & Fly, elle, peut être créée
  dès maintenant : elle ne dépend pas des leçons.

#### 🔴 Les 3 défauts trouvés par la campagne (corrigés, `16eb23d`)

1. **Le dashboard affichait un total que ses propres lignes ne faisaient pas** : 4 022 € au
   sommet de lignes sommant à 3 662 €. La part agence était bien dans `totalRevenue` mais
   n'avait **aucune ligne** dans « Revenue breakdown », alors que les services qu'elle couvre
   avaient été retirés des lignes du dessus. Ligne **Agencies** ajoutée (masquée tant qu'elle
   vaut 0, sous-titre « brut − commission ») + **un test verrouille l'identité** « la somme des
   lignes == totalRevenue ». C'est le défaut que la couche de calcul seule ne pouvait pas voir.
2. **Le serveur MCP était cassé** : `fetchAccountingBundle` construisait un
   `SharedAccountingData` **sans `priceTiers`** (manquant depuis le chantier paliers du 16/08)
   **ni les 3 collections agence**. `computeSeasonTotals` fait `.filter` dessus →
   `get_accounting_summary` et `get_booking` auraient jeté une TypeError **au prochain
   redémarrage** du serveur (le process en cours tenait encore l'ancien module en mémoire, d'où
   l'absence de symptôme). `npm run typecheck` dans `mcp-server/` le disait déjà.
   **Leçon : `mcp-server/` consomme le code de `client/` — tout ajout à `SharedAccountingData`
   doit être répercuté là-bas, et son typecheck lancé.**
3. **`npm run build` (`tsc -b`) est plus strict que `tsc --noEmit`** : il a seul attrapé un
   narrowing perdu dans une closure (`agency` possiblement `undefined`). Confirme la règle déjà
   écrite en tête de ce fichier : **`npm run build` avant tout push**, pas seulement un typecheck.

*(Noté sans conclusion : un warning React « unique key prop » dans `BookingFinances` est apparu
une fois dans la console pendant la campagne, **non reproductible** ensuite — ni sur une résa
avec agence, ni sans, ni en rejouant la séquence. Toutes les listes des deux fichiers ont bien
une `key`. Probablement un rechargement à chaud de Vite pendant que j'éditais les sources.
À resignaler s'il réapparaît en conditions normales.)*

#### ℹ️ PROD : `lessons` est vide, et c'est NORMAL — ne pas le traiter comme une anomalie

Constaté le 2026-08-17 via le MCP : `lessons` compte 0 ligne en PROD, #022 n'a aucun cours.
J'en avais conclu à tort que la saisie du 16/08 « n'était pas passée » et qu'il fallait la
rattraper. **Faux — corrigé le 2026-08-18 par gui : les cours se saisissent LA VEILLE**, quand
la météo, les niveaux et les moniteurs disponibles sont connus. Une résa d'octobre sans leçon
en août est l'état attendu, pas un oubli.
Le programme convenu vit dans les **notes de la réservation** (« 10h privatif 20-24/10, puis 4h
privatif 25-26/10 ») — c'est là qu'il doit rester jusqu'à la veille.
**→ Ne jamais saisir de leçons à l'avance « pour compléter » une résa.** Ce qui reste à faire
le moment venu : gui saisit les cours au jour le jour, puis la ligne « Pack cours Privé 10x2h »
(450 €, 20h) est créée pour Loïc SENE et les leçons s'y rattachent **au fil de l'eau** — la
ligne de facture peut d'ailleurs être créée dès maintenant, elle ne dépend pas des cours.
*(PROD contient bien l'agence Fun & Fly, ses 3 lignes de grille et les 4 paliers de prix.)*

#### ✅ Conséquence directe : le tarif moniteur suit désormais la réassignation (`9fb1d76`)

Ce process — planning bâti la veille, donc leçons réassignées après coup — rendait un défaut
préexistant coûteux : `instructor_rate` était figé à la création et **jamais recalculé**, alors
que trois écrans permettent de changer le moniteur d'une leçon (les deux modales d'édition et
le **glisser-déposer** de `ForecastView` vers la colonne d'un autre moniteur, le plus discret
des trois). Un propriétaire à 0 €/h héritant de 18 €/h invente un coût ; un moniteur payé
héritant de 0 €/h voit une vraie dette disparaître. `reFreezeInstructorRate`
(`accounting/utils.ts`, pur, 6 tests) re-fige la paie **uniquement** si le moniteur ou le type
a changé — un snapshot intact continue de protéger la paie passée d'une augmentation ultérieure.
Le prix client n'est **pas** retouché : il est éditable à la main depuis Accounting, le
recalculer effacerait cette décision en silence. **329 tests.**

**✅ Phase 4 — redaction réelle des prix agence (2026-08-18)**
La moitié visible datait du 17/08 (`ClientSharePage` affiche **« — »**, exclut la ligne du solde,
et une note explique la mention au client). Ce qui manquait — la protection réseau — est livré :
`price_per_hour` ne voyage plus du tout.
- **Mécanisme : une colonne générée**, pas la fonction SECURITY DEFINER envisagée au départ.
  4 miroirs `share_price*` (`GENERATED ALWAYS AS (CASE WHEN agency_billing_line_id IS NULL THEN
  <prix> END) STORED`), seuls lisibles par `anon`, relus sous leur nom d'origine par **alias
  PostgREST** (`price_per_hour:share_price_per_hour`) → aucun calcul de page réécrit.
  **Pourquoi ce choix** : une fonction SECURITY DEFINER (ou une vue non `security_invoker`)
  tourne avec les droits du propriétaire et **contourne la RLS** — tout le scoping de lignes des
  policies `anon_read_*` aurait dû être réécrit dedans, où une seule erreur de `WHERE` fuite la
  table entière. La colonne générée ne touche à aucune policy, et n'est pas inscriptible.
  Raisonnement complet : `security-rls.md` § Rédaction conditionnelle d'une colonne.
- **`NULL` et non `0`** : zéro est un prix légitime (location offerte), donc le « — » continue de
  s'appuyer sur `agency_billing_line_id`, qui reste lisible.
- **5 pages partagées narrowées** dans le même commit (`*` → 42501 après le REVOKE) : Client,
  Forecast, Taxi, Driver, TaxiManager. Chacune est désormais **typée sur la forme réellement
  servie** (`Pick<>`), pour qu'aller chercher une colonne fermée ne compile plus.
- **🔴 Deux fuites fermées au passage** : `lessons.instructor_rate` — la **paie moniteur**, 3ᵉ
  copie du chiffre que le durcissement du 2026-07-29 avait manquée (il avait révoqué
  `instructors.rate_*` et `lesson_rate_overrides`), lisible jusqu'ici depuis n'importe quel lien
  client ; et `taxi_trips.price_eur`, qu'aucune page taxi n'affiche.
- **Un défaut de cohérence corrigé** : la ventilation par invité de `ClientSharePage` chiffrait
  les services d'agence que les sous-totaux excluaient — les deux ne s'additionnaient donc pas
  au même nombre sur une résa agence. Elles sont maintenant omises, comme partout ailleurs.
- ✅ **En service depuis le 2026-08-18** : les 2 migrations sont passées sur TEST **et** PROD, et
  la Phase 4 est **prouvée le 2026-08-19 avec de vrais tokens** (client, driver, taxi_manager) —
  prix bruts et `instructor_rate` en **42501**, pages partagées en **200**. Détail dans le
  registre en tête. Le découpage en 2 fichiers a tenu sa promesse : aucun lien client cassé.

**🔓 Reste ouvert (décision gui) — la marge chauffeur est visible par le client.**
`taxi_trips.price_driver_mzn` et `margin_manager_mzn` sont lisibles par **tout** token valide, y
compris un token client : un hôte peut voir ce qu'on paie son chauffeur, donc notre marge. Même
famille que la fuite `total_cost` fermée le 2026-08-11, mais elle ne se ferme pas par un GRANT :
un privilège de colonne est par **rôle**, pas par type de token, et les pages driver/manager en
ont un besoin réel. Il faudrait une surface par type de token (vue ou fonction) — à trancher.

**✅ Phase 6 — onglet Accounting → 🤝 Agencies (2026-08-18, `f1b05ba`)**
Répond à « que me doit Fun & Fly, toutes résas confondues ? » — il fallait jusque-là ouvrir
chaque réservation une par une. Filtre All time / saison, sélecteur d'agence, KPI (brut,
commission, net, encore dû), une ligne par facture avec compteur de forfait et tampons
invoiced/paid. **Facturation manuelle et relue avant envoi** (décision gui) : l'écran
enregistre ce qui est sorti et ce qui est rentré, il n'envoie rien.
- `buildAgencyInvoiceRows` (pur, **9 tests**) résout chaque ligne contre son agence, sa résa,
  son voyageur, son libellé catalogue et ses heures consommées. **Chacune de ces jointures peut
  revenir vide sur des données réelles** (ligne dont la résa a été supprimée, forfait sans
  voyageur nommé) → un repli et un test pour chacune, plutôt qu'un crash de tout l'onglet.
- **Le filtre de période réutilise `filterDataToSeason`** au lieu d'inventer une 2ᵉ règle : une
  ligne de facture n'a pas de date propre, elle suit sa réservation — et ces chiffres doivent
  coller à ceux du dashboard.
- **Un test verrouille « la somme des lignes == les KPI »** : les deux sont calculés séparément,
  c'est exactement comme ça qu'ils divergent (leçon du 17/08 sur le dashboard).
- Le sélecteur d'agence ne liste que les agences **présentes dans la période**, pour qu'en
  choisir une ne donne jamais un tableau vide.
✅ **Vérifié à l'écran sur TEST** avec 2 agences à commissions différentes (10 % et 20 %) :
670 € brut / −112 € / 558 € net / 360 € dus, compteur 3,5h/10h, filtre saison écartant bien un
check-in du 14/09 d'une saison démarrant le 15/09, tampon écrit en base. TEST nettoyé après.
**338 tests.**
✅ **Colonne « Agencies » du CashFlow — tranchée OUI par gui le 2026-08-19 et livrée.**
Troisième colonne du genre après Palmeiras (01/08) et Providers (01/08). `agenciesIn` = l'argent
des agences **net de commission, au mois de `paid_at`**, et il entre dans `net`. Aucun double
compte : une facture agence ne passe jamais par `payments` (les paiements CLIENTS), et les
services rattachés sont déjà exclus des totaux client depuis la Phase 5. **Deux dates distinctes**
— `billed` au mois de check-in de la résa (une ligne de facture n'a pas de date propre : même
règle que le filtre de saison de l'onglet Agencies), `agenciesIn` sur `paid_at`. Une facture
envoyée mais impayée compte en `billed` et pour rien en caisse. Commission factorisée dans
`agencyCommission()` — **une seule définition** partagée avec `computeAgencyTotals`, parce que
deux formules qui divergent, c'est le bug récurrent du projet. **8 tests**, dont un qui verrouille
`billed === computeSeasonTotals().agencyRev` (le même garde-fou que l'identité Palmeiras).
**354 tests.**

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

🔴 **Correction du 2026-08-18 — les cours ne sont PAS en base.** Compté en service_role sur
PROD : `lessons` = **0 ligne**, `agency_billing_lines` = **0 ligne**. La phrase ci-dessus est
donc fausse (soit saisis sur TEST par erreur, soit jamais enregistrés). Ce n'est pas alarmant
en soi — [les cours se saisissent la veille](../../CLAUDE.md), et le séjour est en octobre —
mais deux conséquences à connaître : **l'onglet Accounting → 🤝 Agencies est vide en PROD**
(aucune ligne à facturer tant que rien n'est rattaché), et le badge `(FF)` ne peut apparaître
que là où il ne dépend pas d'une leçon (barre de résa du planning, liste Bookings, compta) —
pas sur les cartes de cours Forecast, faute de cours.

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
✅ **Paliers réels saisis par gui le 2026-08-17** (PROD, Options → Pricing) :
**privé** 60 €/h de base → **4h : 55 €/h** → **10h : 52 €/h** ; **groupe** 45 €/h de base →
**4h : 43 €/h** → **10h : 41 €/h**. Le chantier est clos, plus rien en attente ici.

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
3. ✅ **Travel Guide : Save CONFIRMÉ** (mesuré le 2026-08-18 en service_role) — `document_templates`
   PROD porte **6 sections `travel_guide`** avec le FR de gui (Argent liquide, Mise à jour Argent
   liquide en Meticals, Ce qu'il faut apporter, Santé, Comment nous rejoindre, Visa). TEST en a
   aussi mais **divergent** (titre #1 `en` = « General » vs « Cash » en PROD) — normal, deux bases,
   ne pas chercher à les aligner.
   ⬜ **RESTE : le Welcome Guide n'a JAMAIS été sauvé** — **0 ligne `welcome_guide`** en PROD. Il
   tourne donc encore sur les défauts en dur avec les placeholders `[…]`. gui doit remplir les
   placeholders dans Documents → Welcome Guide puis cliquer **Save**.
4. ✅ **TRADUCTIONS EN/ES FAITES le 2026-08-20** (`58d0654`), gui ayant terminé la rédaction FR des
   6 sections. Script prêt : **`supabase/migrations/2026-08-20_travel_guide_translations.sql`** —
   ⬜ **reste à l'appliquer sur TEST + PROD** (registre en tête).
   - `jsonb_set` sur les seules clés `en`/`es` : **aucune instruction ne nomme `{fr}`** (vérifié
     mécaniquement sur le fichier produit), donc le français de gui survit à un rejeu. Idempotent.
   - Écrit avec `to_jsonb('...'::text)` plutôt qu'avec du JSON littéral : les textes portent des
     guillemets et de la ponctuation typographique qu'il aurait fallu échapper à la main.
   - Mêmes ids `tg1..tg6` sur les deux bases, vérifié avant d'écrire → le fichier s'applique tel quel.
   - ✅ **Appliqué et vérifié le 2026-08-20** : sur PROD, `FR manquant = 0`, `EN/ES manquant = 0`,
     guillemets et ponctuation intacts, longueurs enfin du même ordre (`549/456/516`, `970/882/950`).
   - ℹ️ **Sur TEST, l'EN/ES ne correspond pas au FR local, et c'est attendu** : les deux bases ont
     des textes FR différents (gui rédige dans PROD), le script traduit celui de PROD. Écart le plus
     visible : section #5, `fr 196 / en 882`. Sans conséquence — aucun guide ne part depuis TEST.
     Ne PAS chercher à aligner les deux bases, c'était déjà la conclusion du 2026-08-19.
   - ⚠️ **Coquilles relevées dans le FR, volontairement NON corrigées** (le FR est la source de gui,
     Claude n'y touche pas) : « elle-même limitées en nombre par jours » et « un peu de ce cet
     argent » (tg1) · « surpplus » (tg2) · « tout ce même un sweet/pantanlon » et « soirée fraiche »
     (tg3) · « qu'ils vous fournirons » (tg5). Plus une **ambiguïté** dans tg1 : « les taux sont
     largement au dessus de la normale » — traduit par « bien meilleurs qu'ailleurs », à confirmer.

   *Constat d'origine, conservé pour mémoire :* le guide envoyé aux clients étrangers ne disait
   **pas** la même chose que le français. Mesuré le 2026-08-18, longueur du contenu par section :
   `fr 549 / en 125 / es 166` · `171/151/175` · `393/174/200` · `221/196/234` · **`970/174/200`** ·
   `593/149/191`. Autrement dit **EN et ES sont restés les textes par défaut d'origine** pendant que
   gui réécrivait le FR — jusqu'à 5× plus court, et parfois sur un autre sujet (titre #2 : FR
   « Mise à jour Argent liquide en Meticals » vs EN « Airport currency exchange »).
   ✅ **Le blocage annoncé le 2026-08-11 n'existe plus** : « Claude n'a aucun accès à la table »
   était vrai en **anon** (42501), mais `mcp-server/.env` porte les **clés service_role des deux
   bases** — la table se lit directement, sans aller-retour SQL par gui. L'aller-retour ne reste
   nécessaire que pour **écrire** (décision : Claude produit le script, gui l'applique).
   Requête d'origine, conservée si gui préfère la coller lui-même — elle renvoie **une seule
   cellule**, donc un clic pour copier :

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
~~**Suggestion non faite** : remplacer la relève POP3 par une redirection Infomaniak → Gmail.~~
✅ **FAIT par gui (confirmé le 2026-08-19)** — les demandes arrivent désormais sans attendre le
cycle de relève. Ne plus le proposer.

## 🧾 À FAIRE AVEC GUI — la première vraie facture Fun & Fly (demandé le 2026-08-19)

Premier passage à l'acte du chantier agences : facturer réellement Fun & Fly pour la résa **#022**
(Loic SENE + Julie LE FOULER, 19→28/10/2026). **Écran : Accounting → Bookings → #022 → panneau
🤝 Agency billing.** L'écran n'envoie rien — il enregistre ce qui est sorti et ce qui est rentré,
la facture part à la main, relue (décision gui).

**État réel de #022 en PROD, relevé le 2026-08-19 (service_role) :**
- ✅ Grille Fun & Fly en place : **Pack cours Privé 10h = 450 €**, Pack Semi-Privé 10h = 330 €,
  **Transfert Maputo ↔ Bilene = 220 €**. Commission Fun & Fly = **20 %**.
- ✅ 2 voyageurs enregistrés (un forfait se rattache à **un** voyageur, pas à la résa).
- ⚠️ **Rien de facturable n'est encore saisi** : `lessons` **vide**, `equipment_rentals` **vide**,
  `taxi_trips` **vide**, et la seule chambre est à **0 €/nuit** (San Martinho, per-stay, rien
  facturé au client — c'est voulu).

**✅ Procédure tranchée par gui le 2026-08-19 : on facture LE FORFAIT, sans attendre les cours.**
« Fun & Fly fait payer des forfaits, pas besoin de décompter les heures avec eux (et sur la
facture). » Donc la ligne se crée **dès maintenant**, le montant étant connu d'avance. Vérifié
dans le code : **rien à modifier** — le prix vient de `agency_billing_lines.price`, jamais des
heures ; le compteur « X h / 10 h » et son ⚠ restent un **indicateur interne** (c'est lui qui a
révélé les forfaits saisis à 20h au lieu de 10h). Un « 0h / 10h » sur une ligne neuve est normal.

### ✅ SAISIE FAITE EN PROD le 2026-08-19 (au navigateur, avec gui) — **890 € brut / 712 € net**

**Réponses de gui** : les 220 € du tarif « Transfert Maputo ↔ Bilene » valent **par trajet**, pas
l'aller-retour (ma recommandation était l'inverse — **le libellé ne dit rien du périmètre, il faut
demander**, même leçon que [[reference_agency_package_hours]]) · chauffeur **Ruiz** · horaires
déduits de ses habitudes et confirmés.

**2 transferts créés** (Taxis → Add trip), rattachés chacun à sa ligne :
| Date | Heure | Sens | Règle appliquée |
|---|---|---|---|
| 19/10/2026 | 15:05 | Airport → Centre | **l'heure exacte du vol** (arrivée 15:05) |
| 28/10/2026 | 10:45 | Centre → Airport | **5 h avant le vol** de 15:45 |
Règles relevées sur ses trajets existants, pas inventées (#023 : vol 09:40 → départ 04:40).
Prix client 120 €, chauffeur 6 000 MZN, manager 1 000 MZN — les défauts de l'app.

**3 lignes de facture Fun & Fly** (Accounting → Bookings → #022 → 🤝 Agency billing) :
| Ligne | Brut | Commission 20 % | Net |
|---|---|---|---|
| Pack cours Privé 10h — Loic SENE | 450 € | −90 € | **360 €** |
| Transfert Maputo ↔ Bilene *(arrivée 19/10)* | 220 € | −44 € | **176 €** |
| Transfert Maputo ↔ Bilene *(départ 28/10)* | 220 € | −44 € | **176 €** |
| **Total** | **890 €** | **−178 €** | **712 €** |

✅ **Vérifié à l'écran ET en base** : le total client de #022 est retombé de **240 € à 0 €** (les
transferts sont sortis des totaux client), le total facturé aux clients a baissé de 240 €, et
**chaque transfert garde son coût chauffeur de 6 000 MZN** — le piège connu, correctement géré.
Les deux lignes de transfert portent une **note** (« Arrival transfer 19/10 », « Departure transfer
28/10 ») parce qu'elles s'affichent sinon à l'identique.

### 🧾 GÉNÉRATION DE FACTURE — livrée le 2026-08-19 (à passer + tester)

gui demandait « on a fait la partie génération de facture ? » — **non**, jusqu'ici l'app savait ce
qui était **dû** mais n'avait aucune notion de facture (ni numéro, ni référence, ni document) ;
les boutons « Invoice/Paid » n'étaient que des tampons de date. Conçu à partir du **vrai modèle**
qu'attend Fun & Fly, décodé depuis `temp/Factu BKC 2025 FFLY Famille Brunet.xlsx`.

**Ce que le modèle a appris** (et confirmé indépendamment) : les 2 transferts y sont facturés
**220 € chacun** → la réponse de gui du 19/08 (« par trajet ») est prouvée par sa propre facture
2025. Une **ligne par voyageur** (3 packs privés + 2 semi-privés = 5 personnes). **Pas de TVA** à
calculer : « TOTAL TTC » est la somme des lignes. Et **deux numéros**, à ne pas confondre.

**Décisions de gui (2026-08-19)** : ① `INVOICE N°` = **la date en AAAAMMJJ**, on **incrémente**
si deux le même jour · ② une **vraie table** plutôt qu'une colonne sur les lignes · ③ **une
facture = une résa** · ④ adresses et IBAN **en dur** · ⑤ libellés **au format F&Fly**.

- **Modèle** : `agency_invoices` + `agency_billing_lines.agency_invoice_id`. Les **tampons
  déménagent sur la facture** — on solde une facture, pas une ligne ; deux sources de vérité pour
  « payé » sont exactement la divergence que ce projet a déjà payée. `computeAgencyTotals` et la
  colonne « Agencies » du CashFlow lisent donc `agency_invoices.paid_at`.
- **Pas de contrainte `UNIQUE (booking_id, agency_id)`**, volontairement : le bloc de 4h de #022
  arrive plus tard, et si la première facture est déjà partie il faudra une seconde facture sur la
  même résa — la contrainte aurait bloqué le cas qu'on sait déjà venir.
- **Le document** (`printAgencyInvoice.ts`) : FR, en-tête **Moçambique Action Sport Lda.** (entité
  légale, comme la lettre de visa), destinataire indexé par **`short_code`** et **jamais par le
  nom** — une agence inconnue imprime son nom sans adresse, parce qu'une mauvaise adresse sur une
  facture est pire qu'aucune. Rien n'est envoyé : page imprimable, relue avant expédition.
- **Libellés au format agence** : un transfert rattaché se nomme « Transferts aller Maputo -
  Bilene le 19/10/2026 » ; sinon la note de la ligne (le champ existe pour ça) ; sinon le
  catalogue. **16 tests** sur `nextInvoiceNumber`, `agencyInvoiceLineLabel` et
  `buildAgencyInvoiceDoc`, dont un qui verrouille `doc.gross === computeAgencyTotals().gross`.
  **371 tests.**
- **`mcp-server` répercuté** (`fetchAccountingBundle`) — la leçon documentée : toute collection
  ajoutée à `SharedAccountingData` doit y aller aussi.
✅ **Migration passée et vérifiée sur TEST + PROD le 2026-08-19** (service_role : table → 200,
anon → **42501**, contrôle négatif → **42703**, `lines.agency_invoice_id` → 200, aucun tampon resté
sur les lignes). ✅ **Facture de #022 créée en PROD à l'écran** : `INVOICE N° 20260819`,
**3 lignes sur 3 rattachées**, 890 € brut / 712 € net, vérifié en base.

🔴 **Un bug trouvé par ce premier essai réel, et corrigé (`d570495`)** : créer la facture posait le
numéro mais **laissait les 3 lignes détachées**, avec des alertes bloquantes à l'écran. Cause :
`persist` est **fire-and-forget** par conception, donc l'`INSERT` de la facture et les `UPDATE` des
lignes partaient **en parallèle** — l'UPDATE pouvait atteindre Postgres avant que la facture existe,
et la clé étrangère le refusait (**23503**). Corrigé par un handler unique `createAgencyInvoice` qui
**insère, attend, puis rattache en un seul UPDATE groupé** ; si l'insert échoue, les lignes ne sont
pas touchées. La facture orpheline a été supprimée, les 3 lignes étaient intactes.
**Leçon réutilisable** : dès qu'une écriture optimiste en amorce une autre **liée par une FK**, les
séquencer dans un seul handler — le pattern `persist` ne garantit aucun ordre.

- ⬜ **Reste (gui)** : ① **la réf F&Fly de #022** — pas inventée, le champ « Agency ref » est vide,
  et la facture imprime alors « DESIGNATION » sans la mention « ref F&Fly : … » ; ② **comparer
  l'impression au modèle Excel** et dire ce qui cloche dans la mise en page. ⚠️ La fenêtre s'ouvre
  **hors du groupe piloté par l'extension** et lance `window.print()` : **Claude ne peut pas la
  voir**, seul gui peut relire ce rendu (même limite que la lettre de visa et les guides).

**⬜ Ce qui reste sur cette facture :**
- ⏸️ **Le second bloc de cours (4h, 25→26/10)** : pas de forfait 4h dans la grille, **gui verra le
  prix plus tard**. Ne rien inventer.
- ⬜ **Tampons `Invoice` / `Paid`** à cliquer quand la facture partira et quand elle sera réglée.
  C'est le `paid_at` qui alimente la nouvelle colonne « Agencies » du CashFlow.
- ℹ️ La ligne forfait affiche **« 0h / 10h »** (le champ heures a été rempli à 10 par le catalogue).
  gui a dit ne pas décompter les heures avec eux : c'est un **indicateur interne** sans effet sur le
  montant. Si ce compteur le gêne, vider le champ « Package hours » sur la ligne suffit.

## 🧾 EN COURS — résa SCHETTINI (Fun & Fly, 19→31/10/2026), demandée le 2026-08-21

Demande F&Fly confirmée : **3 voyageurs** (Sonia PODGORSKI ép. SCHETTINI 23/04/1974, Eric
SCHETTINI 06/09/1964, **Luca 11 ans** 21/01/2015), tél. commun +33 641679034.
Vols : **arrivée MPM le 19/10 à 06:45** (TAP 281 parti de Lisbonne le 18 à 19:05) ·
**départ MPM le 31/10 à 09:25** (TAP 282). Prestations : transfert **A/R en véhicule privatisé**,
**wingfoil 21→24/10 « 2x privé 4x2h »** (les 2 adultes), **stockage matériel perso 19→30/10**
(les 2 adultes).

**✅ Fait**
- **+5 % appliqué à la grille F&Fly** (décision gui) : Pack Privé 10h **472,50 €**, Semi-Privé
  **346,50 €**, Transfert **168 €**. Les factures déjà émises gardent leurs prix figés — c'est le
  principe des snapshots, #022 reste à 220 €/transfert.
- **Nouvel outil MCP `create_booking`** (`abb9de9`) : le MCP ne savait créer une résa **que** depuis
  une enquête, et il n'y en a aucune pour SCHETTINI. Le nouvel outil crée client + résa +
  voyageurs + chambres, dérive les compteurs `num_*` des voyageurs, et **refuse d'écrire quoi que
  ce soit si une chambre est déjà prise**.
  ⚠️ **Nécessite un redémarrage de la session Claude Code** pour apparaître (les outils MCP sont
  chargés au démarrage ; `tsx` lit le TS directement, donc rien à compiler).

- ✅ **Tarifs Wingfoil et Stockage créés** (décisions gui du 21/08) : **« Pack cours Wing privé 10h »
  à 472,50 €** (« les cours de wing au même prix que le kite ») et **« Gardiennage matériel
  personnel — par personne et par jour » à 7 €**, catégorie `rental` faute de catégorie dédiée
  (les 4 possibles sont lesson/rental/transfer/accommodation).
  ⚠️ Le prix du wing suppose que « même prix que le kite » signifie **le même forfait 10 h**. Si
  F&Fly vend un forfait wing plus court, c'est le **prix du forfait** qu'il faudra revoir, pas le
  taux horaire.

- ✅ **Forfaits 4 h créés** (prix donnés par gui le 21/08) : **Pack cours Privé 4h 200 €** ·
  **Pack cours Groupe 4h 160 €** · **Pack cours Wing privé 4h 200 €** (règle « wing au prix du
  kite »). ⬜ **Question de nommage laissée ouverte** : la grille dit « Semi Privé » sur le 10 h et
  gui a dit « group » pour le 4 h — deux mots pour ce qui est peut-être le même produit. À
  harmoniser (renommer l'un des deux) ou à confirmer comme deux offres distinctes.

**📋 Grille Fun & Fly au 2026-08-21** (après le +5 %, éditable dans Options → 🤝 Agencies) :
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

**✅ #022 (SENE) est débloquée et complète** — le bloc de 4 h manquant a été facturé le 21/08 :
`450 € (10h) + 200 € (4h, Loic, 25→26/10) + 160 € + 160 €` = **970 € brut**, commission 20 %
(−194 €), **776 € à payer**. Facture **`20260819`**, **réf F&Fly `142018`** (saisie par gui),
**pas encore envoyée** (`invoiced_at` nul) — d'où la possibilité d'y ajouter la ligne.
ℹ️ Constaté au passage : gui a **corrigé les transferts de 220 € à 160 €** et **recréé les
voyageurs** (leurs ids ont changé, ce qui a fait échouer un premier INSERT en `23503` ; les notes
que Claude avait mises sur les 2 lignes de transfert ont disparu avec l'ancienne saisie).
⚠️ Les lignes restent figées à **160 €** malgré le passage de la grille à 168 € : c'est **voulu**,
un prix figé ne se refacture pas.

### ▶️ PLAN DE REPRISE — suite au 21/08

**✅ Étapes 1→3 faites** (session du 21/08, outil `create_booking` chargé après redémarrage) :
- **Résa #26 créée** (`d39da6b7-318d-492a-a6dd-f3e281cb9db7`) : SCHETTINI Eric, provisional,
  19/10→31/10, agence Fun & Fly, San Martinho **SM-2** (`508efd80-…`, vérifiée libre par
  `check_accommodation_availability` — SM-1 bien occupée par #022/Loic SENE jusqu'au 28/10),
  `center_access_rate: 0`, 3 voyageurs (Sonia, Eric, Luca) avec dates de naissance en notes,
  notes de résa incluant l'ambiguïté du wing non tranchée.
- **2 transferts créés** (Ruiz, 3 pax, 168 €/trajet) : `b100d3a3-…` (19/10 06:45, aero→centre) et
  `760ec72c-…` (31/10 04:25, centre→aero). `payment_summary.billed` de la résa = **336 €**, cohérent.
  ⚠️ Piège technique noté : passer `&` dans un paramètre de notes via le tool XML l'a stocké en
  `&amp;` littéral au premier essai — corrigé par `update_taxi_trip` juste après.

**⬜ Reste (étapes 4→5, dans l'app — aucun outil MCP pour la facturation agence)**
4. **Créer la facture agence** (panneau 🤝 Agency billing de la résa #26) et y rattacher :
   - 2 × **Transfert Maputo ↔ Bilene** à 168 € (déjà créés, ci-dessus)
   - le **wing** : ⏸️ toujours en attente du nombre d'heures — **ne pas inventer**
   - le **gardiennage** : 7 €/pers./jour × 2 pers. × **11 jours** (19→30/10) = **154 €**
     *(à confirmer : 11 ou 12 jours selon que le 30/10 compte)*
5. **Saisir la réf F&Fly** quand l'agence la donne, puis **imprimer** et envoyer.

**⏸️ Toujours ouvert : « 2x privé 4x2h » = combien d'heures ?** gui : *« mettre une note, il
faudra clarifier ça auprès de F&Fly »*. Ne rien déduire du libellé —
[[reference_agency_package_hours]] : le « 10x 2h » valait 10 h au total, pas 20. Depuis le 21/08
un « Pack cours Privé 4h » existe, ce qui rend le libellé encore plus ambigu : « 4x2h » peut
désigner ce pack (4 h) ou 4 séances de 2 h (8 h). Tant que ce n'est pas clarifié, ne pas créer les
leçons de wing ni la ligne de facturation correspondante.

**✅ Bloquants résolus le 21/08**
- **L'hébergement.** San Martinho passé de 1 emplacement (capacité 2) à **6 emplacements de
  capacité 4** (SM-1→SM-6, `total_rooms = 6`, confirmé par `list_accommodations`). Drapeau
  **`accommodations.hide_empty_rooms`** (migration `2026-08-21_hide_empty_rooms.sql`, **passée et
  vérifiée TEST + PROD par gui le 21/08** — `hide_empty_rooms: true` visible sur San Martinho via
  `list_accommodations`) : le planning ne dessine que les emplacements occupés dans la saison
  affichée, plus une ligne libre. Un drapeau, pas un test sur le nom.
  - **La « note par zone »** passe pour l'instant par les notes de la réservation ; pas de colonne
    dédiée (`booking_rooms` n'en a pas).
- **`create_booking` chargé** après redémarrage de Claude Code (le serveur MCP lit le TS par
  `tsx`, rien à compiler) — confirmé disponible en début de cette session.
- **Migration `2026-08-19_agency_invoices.sql`** — gui indique l'avoir passée aussi (avec la
  précédente) le 21/08. **Pas encore re-vérifiée par cette session** (table admin-only, le curl
  anon ne prouve rien ; à confirmer en service_role ou simplement en ouvrant le panneau Agency
  billing de la résa #26 à l'étape 4 — si le panneau fonctionne, la migration est bien passée).

**🔧 À PRÉVOIR (demandé par gui le 21/08) — le stockage payé par l'agence.**
gui confirme que **F&Fly paie le gardiennage**, et veut que ce soit géré durablement. Or cocher
« matériel perso » sur un voyageur facture l'**accès centre au CLIENT** (`center_access_rate`), et
l'accès centre **n'est pas** une des 4 sources rattachables à une facture agence (cours, locations,
transferts, chambres) — donc rien ne permet de l'exclure. Parade immédiate sur cette résa :
`center_access_rate = 0`. **Vraie solution à trancher** : ajouter l'accès centre comme 5ᵉ source
rattachable, ce qui suppose une colonne `agency_billing_line_id` là où vit cette information —
aujourd'hui elle n'est nulle part, c'est un simple compteur sur la réservation
(`num_center_access` × `center_access_rate`). C'est donc un petit chantier, pas une case à cocher.

**⚠️ Piège identifié : le stockage risque d'être facturé deux fois.** Cocher « matériel perso »
sur un voyageur déclenche l'**accès centre** facturé au client (`center_access_rate`, 5 €/jour),
alors que F&Fly paie le gardiennage. Et l'accès centre **n'est pas** une des 4 sources rattachables
à une facture agence — il n'y a donc aucun mécanisme pour l'exclure. Parade : passer
`center_access_rate: 0` sur cette résa (le paramètre existe dans le nouvel outil MCP).

## 🟡 Quand gui veut

- ~~**Bug prix taxi 8000 €**~~ ✅ **CLOS le 2026-08-18.** Fix code fait le 06/07
  (`order updated_at desc` des 2 côtés, `4364316`) ; le diag restait à passer sur PROD depuis
  l'incident Supabase du 06/07 au soir. **Fait** (service_role, lecture seule) :
  `taxi_pricing_defaults` PROD contient **exactement UNE ligne**, `default_price_eur = 120`,
  6000/1000 MZN, taux 70, `updated_at` 2026-06-30. **Aucun doublon, aucune valeur MZN dans le
  champ EUR → rien à corriger.** Les deux `DELETE`/`UPDATE` optionnels du fichier de diagnostic
  sont donc sans objet.
- ~~**Anti-spam formulaire public**~~ ✅ FAIT (2026-07-06, `318e467`) : honeypot off-screen
  (`website`) + refus silencieux des soumissions <3s après chargement — les deux tombent sur
  le faux écran de succès (zéro insert, zéro email, le bot n'apprend rien). Kill switch
  inchangé (`shared_links.is_active=false`). Turnstile seulement si le lien devient vraiment
  public un jour (nécessiterait une Edge Function pour l'insert).
- **Waiver EN/ES** — traductions auto à faire relire (FR = source gui). `WAIVER_VERSION = 'v1-2026'`.
- ~~**Supprimer l'import CSV**~~ ✅ FAIT (2026-07-06) : `ImportCSVModal` + `parseGoogleFormsCSV.ts`
  supprimés, ClientsPage nettoyée (bouton, state, handleImport). `import_id` conservé
  (dédup SubmissionsPage).
- ~~**Logo sur documents**~~ ✅ **CLOS le 2026-08-19 — rien à coder, décision de gui après
  inventaire.** La demande de juillet était déjà satisfaite : **les 4 documents portent déjà un
  logo**, et deux marques distinctes selon l'usage — **lettre de visa → `logo-mas.png`**
  (« Moçambique Action Sport Lda. », l'entité légale, ce que l'administration attend) ·
  **Travel Guide / Welcome Guide / Confirmation de résa → `LOGO-bkc.png`** (« BKC Kitesurf
  Center », la marque commerciale). gui a écarté le co-branding, le remplacement par MAS et
  l'ajout de la signature sur la confirmation. `signature-mas.png` reste donc réservé au visa.
  **Ne pas re-poser la question.**
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
