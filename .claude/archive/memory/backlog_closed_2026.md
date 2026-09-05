# Archive BACKLOG — chantiers clos (février → 5 septembre 2026)

> Sorti de `.claude/docs/BACKLOG.md` le 2026-09-05 : **tout ici est fermé.**
> Le reste-à-faire vit dans `.claude/docs/BACKLOG.md`, qui ne garde plus que l'ouvert.
> Conservé pour retrouver *pourquoi* une décision a été prise, pas pour être relu en entier.

---

## ✅ 2026-09-05 — plus aucune migration en attente

`2026-09-05_client_errors.sql` et `2026-09-05b_deposit_requested.sql` sont **passées sur TEST et
sur PROD**, vérifiées en curl anon réel :

- `client_errors` : un insert anon valide renvoie **201** (testé sur TEST), un `kind` hors liste
  est **refusé par la policy** sur les **deux** bases (`42501 new row violates row-level security
  policy`). Les bornes tiennent côté serveur, pas seulement côté client.
- `bookings.deposit_requested_at` : `42501 permission denied` au lieu de `42703` — la colonne
  existe et anon n'y accède pas.
- `2026-09-03_client_notes.sql` : reconfirmée passée sur les deux bases.

⚠️ **Une ligne de test traîne dans `client_errors` sur TEST** (« migration check 2026-09-05 ») —
un clic sur **Clear** dans Options → Database la fait disparaître. Rien n'a été écrit en PROD.

**Leçon de forme, coûteuse ce jour-là** : la prose des migrations est désormais en `/* … */` et
non en `--`. Un collage dans l'éditeur SQL a recoupé une longue ligne `--`, la moitié orpheline
est devenue du SQL (`42601 syntax error at or near "rien"`) et **rien** ne s'est appliqué. Pire :
l'exemple `DELETE FROM client_errors WHERE occurred_at < now() - interval '90 days';` était sur
une ligne `--` — recoupé, il s'exécutait. Voir `2026-09-05c` ci-dessous pour le second défaut que
ça a fait sortir.

### 🔍 À trancher — trois tables admin-only ne sont protégées que par la RLS

Constaté en vérifiant ci-dessus. `client_errors`, **`payments`**, **`email_logs`** et
`form_submissions` répondent `200 []` à un SELECT anon : le **GRANT SELECT de table existe**
(privilèges par défaut de Supabase sur `public`), et seule la RLS empêche les lignes de sortir.
`client_notes` et `enquiries` ont deux couches (`REVOKE ALL … FROM anon` explicite) et répondent
`42501`.

**Aucune fuite aujourd'hui** — vérifié avec des tables qu'on sait non vides (`payments` contient
les 100 € de Sassolas, `email_logs` alimente la grille Documents) : elles renvoient bien `[]`,
donc la RLS mord. Mais c'est une couche au lieu de deux, et le jour où quelqu'un ajoute une
policy `FOR ALL` un peu large sur `payments`, il n'y a plus de filet. Un `2026-09-05c` d'une ligne
par table le refermerait. **Ne pas le faire à moitié** : soit les quatre, soit aucune — harmoniser
`client_errors` seul serait cosmétique.

## ✅ 2026-09-04 — la reprise est soldée

**La migration `2026-09-03_client_notes.sql` est passée sur TEST et sur PROD** (vérifié en curl
anon : `client_notes` et `bookings.source_id` répondent `42501 permission denied` au lieu de
`PGRST205` / `42703` — la table et la colonne existent, et anon n'y a aucun accès, c'est ce que
la migration voulait). Tout est poussé. **Bruno était bien une faute de frappe** : la demande est
en Jan **2027**.

Il reste **deux choses à trancher**, aucune bloquante :
- **résa #025 (ELISABETH BOUTEILLER) sans aucune chambre**, alors que la demande portait sur
  l'hébergement ;
- **5 résas sur 8 restent « Unknown »** dans « Where they came from ». La reprise d'historique a
  rempli ce qu'elle pouvait ; le reste a été saisi à la main avant que la question existe et rien
  ne peut le deviner. Question ouverte : rendre la question **obligatoire** dans le wizard ?

### 2026-09-04 — Options allégé, la liste des invités a déménagé

L'onglet **Options → « Bookings & Guests » est supprimé** et son seul apport propre (lire qui
dort dans une résa) vit maintenant dans **Bookings** : le compteur `4G` de la colonne Stay est un
bouton qui déplie la liste. La pastille **⚠️** signale en plus un **invité sans passeport** —
c'est ce que le document de visa consomme, et le seul moyen de le repérer était de déplier les
huit résas une par une. Règle sortie de la page dans **`utils/bookingCompleteness.ts`**, testée
(elle décide aussi les filtres Complete/Incomplete). Détail : `pages.md` § BookingsPage.

> ⚠️ **Une autre session Claude travaille en parallèle sur ce repo** : elle ajoute une bascule de
> langue de l'interface admin (`client/src/contexts/`, `client/src/data/i18n/`,
> `hooks/useAdminLang.ts`, + `App.tsx` et `Navigation.tsx` modifiés) — c'est pour ça que la
> navbar est passée en français en cours de route. **Rien à voir avec les commits ci-dessus**,
> qui ont été faits par chemins explicites.

### ✅ 2026-09-04 — i18n Admin : Phase 1 livrée (FR/EN/ES, localStorage, toggle)

**Phase 1 complète** — 10 pages admin migrées, ~350 clés FR/EN/ES traduites.

**Commits:**
- `0332984` — feat(i18n): implement modular i18n system (structure + LanguageContext + hooks)
- `d06414a` — fix(i18n): apply Sonnet audit corrections (4 bugs FR/ES grammar & typos)
- `e16ac8a` — feat(i18n): migrate TaxiPage, ActivitiesPage, EquipmentPage, HomePage to i18n
- `079c17a` — feat(i18n): migrate BookingsPage, RequestsPage, DocumentsPage to i18n

**Pages migrées :**  
Navigation, AccountingPage, ClientsPage, TaxiPage, ActivitiesPage, EquipmentPage, HomePage, BookingsPage, RequestsPage, DocumentsPage.

**Architecture :**  
11 i18n modules (types, navigation, common, accounting, bookings, clients, management, pages, taxis, activities, equipment). LanguageContext.tsx + useAdminLang hook (localStorage "admin_lang"). Language toggle 🇫🇷🇬🇧🇪🇸 en Options → Management. Type-safe pattern avec `satisfies Record<string, Tr>`.

**Reste à faire:**
- **Phase 2** — Pages partagées (TaxiSharePage, DriverSharePage, TaxiManagerSharePage, ActivityProviderSharePage, ClientSharePage)
- **Phase 3** — Emails transactionnels (notify-submission Edge Function)

**Statut :**
- ✅ Build passe (`npm run build` = 6.66s)
- ✅ All commits staged (not pushed — gui pushes himself)
- **En attente gui** : review + push

### ✅ 2026-09-04 — i18n Admin : Phase 1.5 + Phase 2 Part 1 livrées

**Phase 1.5** (pendingActions.ts) + **Phase 2 Part 1** (PlanningView + Management tabs).

**Commits:**
- `042cadb` — feat(i18n): migrate pendingActions messages to i18n (Phase 1.5)
  - 20 clés `msg_*` ajoutées (unverified_payment, provisional_urgent, visa_week, silent_enquiry, etc)
  - `computePendingActions(data, lang)` signature updatée
  - Architectural fix: LanguageProvider accepte props contrôlées `lang`/`setLang` pour réactivité badges d'alertes
  
- `ca90404` — feat(i18n): migrate PlanningView and Management tabs to i18n (Phase 2 part 1)
  - PlanningView.tsx: tabs, buttons, season tooltip, legend, booking quick-view
  - HousesTab/AgenciesTab/AccommodationsTab/SeasonsTab/SourcesTab: tous migrés
  - `typeMeta(lang)` function créée (réagit aux changements de langue)

**Composants migrés:**
Phase 1.5: pendingActions (alertes). Phase 2 Part 1: PlanningView + 5 management tabs.

**i18n keys added:**
- pages.ts: 20 msg_* keys pour alertes
- management.ts: 30+ keys pour PlanningView + tabs
- Reused: status_*, btn_*, label_* keys existantes

**Reste à faire:**
- **Phase 2 Part 2** — BookingFinances, ClientTimeline, EnquiryPanel (en cours)
- **Phase 3** — Emails transactionnels

**Statut :**
- ✅ Build passe
- ✅ gui a pushé Phase 1
- ⏳ Attendant Phase 1.5 + Phase 2 Part 1 (pas encore pushés)

**Issue spotted:** Mauvaises traductions FR auto-générées quelque part ("cours de vol", "cerf volant" pour "kite lessons"). Boardbag label clarifié en code (`formI18n.ts`), reste à tracer la source de "cours de vol".

---

## ⏸️ Le carnet de la session du 2026-09-03 (conservé pour le contexte)

> Écrit au fil de la session pour survivre à une déconnexion. **Les points 1 « à faire » sont
> faits** (voir juste au-dessus) ; le reste documente le pourquoi des chantiers A→H.
> Le détail de chaque chantier est plus bas, § 🧭 Parcours.

### 0. 🔴 gui a poussé pendant la session — une régression était en PROD, elle est corrigée

`git reflog show origin/master` → poussé jusqu'à **`c0bea7c`**. Ce commit contenait un
`select('… , source_id')` sur `bookings` : **PostgREST rejette la requête entière quand une
colonne nommée n'existe pas**, donc tant que la migration n'était pas passée, la colonne
« Guests » de l'écran d'attribution tombait **à zéro partout, sans un seul message à l'écran**.
Constaté en vrai dans le navigateur, corrigé (`isMissingColumn` + requête à part), revérifié :
les chiffres sont revenus (5 / 1 / 1 / 1).

**Leçon, valable au-delà de ce cas** : « le code marche sans la migration » ne se décrète pas,
ça se vérifie — et une colonne pas encore migrée **ne doit jamais être nommée dans un `select`**
que l'app doit survivre. `utils/supabaseErrors.ts` porte les deux détections
(`isMissingTable` = PGRST205/42P01, `isMissingColumn` = 42703/PGRST204).

### 1. Ce que gui doit faire, dans cet ordre

| # | Quoi | Bloquant ? |
|---|---|---|
| 1 | **Passer `supabase/migrations/2026-09-03_client_notes.sql`** sur **TEST puis PROD**. Elle porte **trois** choses : `client_notes`, `bookings.source_id` (+ reprise d'historique), et la reprise de `clients.notes` dans `client_notes`. Recettes de vérification en bas du fichier. | Non — **le code tourne sans**, aucun séquencement à respecter avec le push |
| 2 | **Pousser** les commits (Claude ne pousse jamais) | — |
| 3 | **Relancer le serveur MCP** (process `tsx` démarré en début de session) pour voir les nouveaux outils | Non |
| 4 | Regarder **Requests → Archive → « Where they came from »** et décider si la question « comment nous avez-vous connus » doit devenir obligatoire quelque part | Non |
| 5 | **Trancher deux vraies données que les nouveaux écrans ont sorties** : la résa **#025 (Babeth) sans aucune chambre**, et la demande **Bruno annoncée en « Jan 2026 »** (vraie demande périmée, ou janvier prochain mal saisi ?) | Non |

### 2. Ce qui a été livré (tout est commité, rien n'est poussé)

`7172256` A — conversion sans perte · `5c3691e` B — le dossier client + ⌘K ·
`6778461` C — « Waiting on you » · `3714ec9` D — un seul vocabulaire ·
`f3938d0` fix PGRST205 · `ce33f7a` E — la statistique d'origine ·
F — le doublon `clients.notes` fermé · G — l’écart d’intention sur la résa ·
H — la clôture de saison · + la doc de Documents → Overview, qui n’existait pas
*(la liste se prolonge si la session a continué — `git log --oneline origin/master..HEAD`)*

### 3. Les 6 bugs / trous trouvés en chemin (tous corrigés)

1. **La fiche client totalisait `bookings.amount_paid`** — un cache qui n'est pas la source de
   vérité. Lit `payments` maintenant, et sépare l'argent non vérifié.
2. **Le transfert du client n'arrivait jamais sur le trajet taxi** : le visiteur donne une
   date/heure de prise en charge distincte du vol, le trajet était créé au check-in à l'heure du
   vol. La bonne réponse ne vivait que dans une phrase des notes.
3. **PostgREST répond `PGRST205`, pas `42P01`** pour une table absente → la détection
   « migration pas encore passée » ne se déclenchait jamais (`utils/supabaseErrors.ts`).
4. **5 clients sur 8 sans origine** : le wizard ne posait jamais la question. Ajoutée.
5. **Deux endroits pour noter sur un client** (`clients.notes` en bloc + la frise datée) —
   c'est-à-dire le doublon que ce chantier était censé supprimer. Fermé, voir § Parcours F.
6. 🔎 **Pas un bug de code, une vraie donnée à regarder : la résa #025 (Babeth) n'a aucune
   chambre** alors que la demande portait sur l'hébergement. Trouvé par l'écart d'intention
   (§ Parcours G) dès sa mise en service. **À vérifier avec gui.**

### 4. Décisions prises seul, à confirmer ou renverser

- **Ne PAS pré-remplir les participants** à la conversion d'une demande (`party_size: 3`
  fabriquerait trois personnes sans nom que la compta compterait pour vraies). `ENQUIRIES.md`
  le tranchait déjà ; je m'y suis tenu.
- **Ne rien recopier** d'une demande vers sa réservation : le lien est lu, pas dupliqué.
- **`enquiry_notes` n'est pas fusionnée** dans `client_notes` : ça toucherait l'écran de
  qualification, qui doit rester expédiable en 20 s. Les deux se **lisent** comme un seul fil.
- **La stat d'origine ne compte que les demandes tranchées** pour le taux de transformation.

---

> **La** liste canonique des tâches restantes. Mise à jour à chaque session (ajouter/rayer ici,
> pas dans la mémoire). Chaque entrée dit : quoi, pourquoi, et comment s'y prendre.
> Rappels transverses : migrations = **TEST + PROD dans la foulée, une seule tâche** ;
> vérifier les migrations sécu par **curl anon direct** (pas seulement `has_table_privilege`) ;
> Claude commit, **gui push lui-même** ; `npm run build` avant tout push.

---

## 🧭 Parcours Clients / Bookings / Requests — audit du 2026-09-03, chantier A livré

**La demande de gui** : « je ne sais plus qui veut quoi quand le temps passe, et je dois
chercher dans plusieurs pages — si j'ai eu la bonne idée de le noter ». Diagnostic : l'app a des
**objets** mais pas de **dossier**. Sept champs `notes` qui ne se parlent pas, et le seul écran
qui sait dire « qui attend quoi » (Enquiries) **jette la personne dès qu'elle devient cliente**.

### ✅ A. Conversion sans perte — LIVRÉ le 2026-09-03 (aucune migration)

1. **Plus de client en double.** `SubmissionsPage` et le MCP `create_booking_from_enquiry`
   inséraient un client **inconditionnellement**, même quand la demande portait déjà un
   `client_id` posé à la main. Règle partagée : **`client/src/utils/clientIdentity.ts`** —
   lien explicite d'abord, puis email exact, **jamais un nom** (ces chemins tournent sans gui
   devant l'écran ; une fusion à l'aveugle mélange deux dossiers). Les champs vides du client
   existant sont complétés, **rien n'est écrasé** (`blanksToFill`).
   Le panneau de validation **dit avant le clic** sous quel client la résa va être classée ;
   le MCP renvoie `client_reused: 'linked' | 'email' | null`.
2. **Le lien retour est enfin lu.** `enquiries.booking_id` existait depuis le 14/08 mais
   **aucune page ne le lisait** : `BookingsPage` et `ClientsPage` ne contenaient pas une
   occurrence de « enquir ». Désormais : pastille **📣** dans la liste des résas (desktop **et**
   cartes mobiles) et **`EnquiryOriginPanel`** en tête de l'étape 1 du wizard — message
   d'origine, qualification, notes datées, en lecture seule. `get_booking` (MCP) rend le même
   bloc sous `origin_enquiry`.
   ⚠️ **Les notes ne sont PAS recopiées sur la résa** — deux copies de la même phrase finissent
   par se contredire. Elles restent sur la demande et sont relues par le lien.
   ⚠️ **Le serveur MCP doit être relancé** pour que `origin_enquiry` apparaisse (tsx, process
   démarré au début de session).

### ✅ B. La fiche client est devenue le dossier — LIVRÉ le 2026-09-03

1. **Frise (`Timeline`), onglet par défaut du tiroir client.** Assemblée **à la lecture** par
   `utils/dossier.ts` (pur, testé) depuis les tables existantes : demandes + message verbatim,
   notes datées, soumissions de formulaire, résas, séjours, paiements, documents envoyés
   (`email_logs`), transferts, activités. **Aucune donnée dupliquée** — une frise stockée serait
   une deuxième copie de faits qui vivent ailleurs, et les copies divergent.
   Chargement **à l'ouverture d'une fiche seulement** (`hooks/useClientDossier.ts`, requêtes
   `.in(booking_ids)`) : Clients est un écran de liste, payer pour tout le monde au montage
   annulerait le travail de démarrage du 31/07.
2. **Un seul endroit où écrire** : champ de note en haut de la frise → table `client_notes`
   (migration ci-dessus, **le code marche sans elle**). `enquiry_notes` reste où elle est ;
   les deux se **lisent** comme un seul fil.
3. **Recherche globale ⌘K / Ctrl-K** (`components/common/GlobalSearch.tsx` +
   `utils/globalSearch.ts`, testé) : clients, résas, demandes, **et l'intérieur des messages et
   des notes**. Insensible aux accents (« fevrier » trouve « février »), `#023` trouve la résa
   23. Classement : nom d'abord, puis contact, puis texte libre. **Index chargé à la première
   ouverture, jamais au démarrage.** Le résultat ouvre la fiche/la résa/la demande directement
   (mêmes rails que `pendingEditBookingId`).
4. **Côté MCP** : `get_client_dossier` (la frise complète + `silence_days` + l'argent réel) et
   `search_everything`. C'est ce qui permet de demander « où en est Cindy ? » sans ouvrir l'app.
5. 🔴 **Bug corrigé au passage** : l'onglet Bookings du tiroir client totalisait
   `bookings.amount_paid` — un cache qui n'est **pas** la source de vérité. Il lit maintenant
   `payments`, et **sépare l'argent non vérifié** au lieu de l'additionner au reste.

**Vérifié au navigateur sur PROD le 2026-09-03** (lecture seule) : « Waiting on you » avec les
6 vrais dossiers · frise de Michel Rulliat et de Loïc SENE (transferts, séjour, lettre de visa
envoyée, résa créée, demande + message d'origine) · ⌘K sur « mozambique » → les 2 demandes dont
**le message** contient le mot, Entrée ouvre la bonne fiche · pastilles 📣 sur les 4 résas issues
d'une demande · panneau d'origine en tête du wizard.

🔴 **Bug trouvé par ce test navigateur et corrigé** : PostgREST renvoie **`PGRST205`** (« Could
not find the table … in the schema cache »), **pas `42P01`**, quand une table manque. La
détection ne se déclenchait donc jamais : bandeau d'erreur rouge illisible **et champ de note
resté actif** alors qu'il ne pouvait rien enregistrer. Règle centralisée et testée dans
**`utils/supabaseErrors.ts`** — à réutiliser partout où « table pas encore migrée » doit se
distinguer d'une vraie panne.

⬜ **Restes de B, volontairement non faits** : fusionner `enquiry_notes` dans `client_notes`
(chantier à part) ; faire figurer les cours et les locations dans la frise (aujourd'hui c'est du
détail de planning, ça noierait le fil) ; onglet Documents séparé (les envois sont dans la
frise, un onglet de plus pour trois lignes serait un endroit de plus où chercher).

### ✅ C. « Waiting on you » — LIVRÉ le 2026-09-03 (aucune migration, aucune requête en plus)

Le trou : la colonne **Silence** n'existait que pour les prospects. Le jour où quelqu'un devenait
une résa, il quittait cette liste — et une **résa provisoire sans nouvelles depuis trois semaines
n'apparaissait nulle part**. Les Pending actions ne l'attrapent pas non plus : elles parlent en
**échéances** (check-in dans N jours, visa dans N jours), jamais en **silence**.

- **`utils/followUps.ts`** (pur, 15 tests) : demandes ouvertes **+ résas provisoires** dans une
  seule liste, triée urgent d'abord puis par attente la plus longue.
- **Deux règles pour que la liste reste lisible** : une demande **jamais qualifiée** y est dès le
  premier jour (quelqu'un attend une réponse) ; tout le reste attend un vrai silence de 7 jours
  (`SILENCE_WARN_DAYS`) — une liste qui affiche quelqu'un contacté hier, gui arrête de l'ouvrir.
- **Le silence d'une résa** = jours depuis le dernier signe de vie réel : création, paiement
  enregistré, document envoyé. ⚠️ **Les dates futures sont ignorées** — un séjour en novembre
  n'est pas une nouvelle en septembre, et le compter ferait taire précisément le dossier à
  relancer.
- **Cas à part** : un séjour **terminé** dont la résa est restée `provisional` est signalé en
  urgent, silencieux ou pas — l'argent n'a jamais été soldé.
- **Chaque ligne porte « ce qu'ils veulent »** (🪁 cours · 🎿 loc · 🛏 hébergement, ou les
  compteurs de la résa) : c'est l'autre moitié de la phrase de gui.
- Affiché sur la **Home**, sous les Pending actions, calculé dans `App.tsx` **sur les lignes
  déjà chargées** pour les pending actions (3 colonnes ajoutées aux `select`, zéro requête de
  plus). Un clic ouvre la demande ou la résa.
- **Côté MCP** : `get_pending_actions` renvoie désormais aussi `waiting_on_you`.

### ✅ D. Un seul vocabulaire — LIVRÉ le 2026-09-03 (aucune migration)

1. **Une seule source d'attribution.** Le formulaire de résa demandait « comment nous
   avez-vous connus » en **texte libre** pendant que le formulaire de demande utilisait la
   liste trilingue `enquiry_sources` : les stats d'origine étaient coupées en deux, en deux
   langues. Le formulaire de résa affiche maintenant **la même liste déroulante** (lue en anon
   par le jeton de partage, comme le formulaire de demande — `share_type() IS NOT NULL`, aucune
   policy à changer) + « Autre » et sa ligne libre.
   - `utils/referral.ts` (testé) résout la réponse vers le **libellé anglais canonique** :
     l'accord entre deux réponses ne peut pas reposer sur la langue du visiteur.
   - L'**id choisi voyage aussi** dans le payload (`referral_source_id`, jsonb → gratuit), pour
     qu'une future colonne `bookings.source_id` se remplisse **exactement** au lieu d'un
     rapprochement de chaînes.
   - ⚠️ **La question n'est plus posée à qui vient d'une demande** (lien personnalisé) : la
     réponse est déjà sur la demande, et demander deux fois invite deux réponses.
2. **`bookings.notes` redevient le champ de gui.** Il recevait quatre lignes de bavardage
   machine ; chacune a maintenant un vrai foyer, **sauf une** :
   | Ligne supprimée | Où elle vit désormais |
   |---|---|
   | « Created from public booking form. » | la pastille 📣 et la frise du dossier |
   | « Transfer to Bilene/airport: … » | **le trajet taxi lui-même** (voir 3) |
   | « Heard about us: … » | `bookings.referral_source`, une vraie colonne |
   | « Original message: "…" » | relu sur la demande (`EnquiryOriginPanel`) |
   | « Single beds requested: N » | **reste** — aucune colonne nulle part |
   Idem côté MCP : `create_booking_from_enquiry` n'écrit plus de résumé de qualification.
3. 🔴 **Bug trouvé et corrigé au passage.** Le visiteur donne une date/heure de transfert
   **distincte du vol** (`payload.transfer_to_*`) ; le trajet taxi était pourtant créé à la date
   de **check-in**, à l'heure du **vol**. La bonne réponse n'existait que dans une phrase des
   notes, que gui devait lire pour corriger la ligne à la main. Le trajet porte maintenant la
   date et l'heure données (repli sur séjour/vol si le visiteur n'a rien mis).

### ✅ E. La statistique d'origine existe enfin — LIVRÉ le 2026-09-03

`ENQUIRIES.md` étape 6 (« archivage / statistiques d'origine »), jamais faite : la liste des
sources, ses libellés trilingues et sa règle « on désactive, on ne supprime pas » avaient toutes
été construites pour un écran qui n'existait pas.

- **Requests → Archive → « Where they came from »** (`utils/attribution.ts`, pur, 19 tests) :
  taux de transformation + un tableau **deux colonnes par source — demandes ET clients venus**.
  Une seule des deux ment : les demandes seules récompensent le canal le plus bruyant, les
  clients seuls cachent où on les a trouvés. Sélecteur de saison (demandes par mois d'arrivée,
  résas par check-in — la règle de la compta).
- **Le taux ne compte que les demandes tranchées** : une demande ouverte n'a pas échoué, elle
  n'a pas répondu. La compter en perte ferait passer tout mois sain pour un mauvais mois.
- **Ce qui n'est pas classable est affiché** (`Unknown`), jamais réparti : une statistique qui
  jette discrètement ce qu'elle ne sait pas ranger paraît nette et ment — c'est l'argument même
  qui a mis « Autre » sur le formulaire public.
- 🔴 **Ce que l'écran a immédiatement montré** : **5 des 8 clients en `Unknown`**, parce que le
  **wizard ne posait jamais la question**. Elle y est maintenant (étape 1, même liste), et
  `bookings.source_id` la range là où elle se compte → migration ci-dessus.
- L'origine d'une résa se résout en **4 temps** (`source_id`, puis la demande, puis le
  formulaire, puis le vieux texte `referral_source`) : aucune ligne d'historique n'a eu besoin
  d'être réécrite pour que le compte tombe juste.

**Aussi livré** : `bookings.notes` **était lisible nulle part** sans rouvrir le wizard (constat 4
de l'audit). Il apparaît maintenant dans la frise du dossier et en 📝 dans la liste des résas
(survol pour lire, texte complet sur les cartes mobiles).

### ✅ F. Le doublon que ce chantier avait lui-même créé — fermé le 2026-09-03

En posant la frise datée, j'avais laissé **deux endroits pour écrire sur un client** : le bloc
`clients.notes` (qu'on écrase) dans l'onglet Info, et le fil daté. Exactement le défaut que tout
ce travail visait à supprimer.

- La migration **recopie** `clients.notes` dans `client_notes` — datée de la **création de la
  fiche**, pas d'aujourd'hui : on ne sait pas quand la phrase a été écrite, mais la dater
  d'aujourd'hui la ferait passer pour neuve — puis **vide la colonne** (dans la même
  transaction, donc rien ne peut se perdre entre les deux). Sans ce vidage, la phrase
  s'afficherait deux fois après la migration. **Réversible en une requête**, écrite dans le
  fichier. La colonne n'est **pas supprimée**.
- Le **champ Notes disparaît du formulaire client** : plus rien n'alimente le bloc.
- L'onglet Info **affiche encore l'ancienne note tant qu'elle est là** (« Note (old format) » +
  la mention que ça déménage) : c'est du texte que gui a écrit, il ne doit pas disparaître de
  l'écran avant d'être arrivé dans la frise.
- ⚠️ **⌘K indexe désormais `client_notes`** (app **et** MCP `search_everything`) : sans ça, la
  migration aurait discrètement coûté une recherche. Une table absente n'empêche pas la palette
  de s'ouvrir. En PROD la note d'E. BOUTEILLER (« contacté via Whatsapp aussi ») est le cas réel.

### ✅ G. « Ce qu'ils veulent » — le dernier constat de l'audit, fermé le 2026-09-03

Trois vocabulaires non réconciliés (`enquiry.wants_*` en booléens de groupe, 6 flags par
personne sur les participants, `bookings.num_*` en cache). Une intention pouvait être captée au
premier échange puis **ne jamais exister sur la résa**, sans que rien ne compare.

**`utils/intentGap.ts`** (pur, 8 tests) compare la demande à l'état **vivant du wizard** et
affiche l'écart dans le panneau d'origine, **hors du repli** — une intention perdue est
précisément ce qu'on ne va pas chercher.
- ⚠️ **Ça pose une question, ça ne remplit rien.** Transformer « ils ont parlé de cours » en flag
  inventerait un fait : le client a pu changer d'avis, ou gui a pu dire non. Même raison que
  pour les participants (`ENQUIRIES.md`) : un chiffre inventé arrive jusqu'à la compta où plus
  personne ne le distingue d'un vrai.
- **Seuls les manques sont signalés.** Une résa qui a **plus** que la demande, c'est le cas
  normal et heureux : les gens ajoutent des choses une fois qu'ils vous parlent.
- **L'écart se recalcule à la frappe** : l'alerte s'éteint quand gui remplit l'étape 3.
- Trouvé en PROD dès l'ouverture : **la résa #025 (Babeth) n'a aucune chambre** alors que la
  demande portait sur l'hébergement.

### ✅ H. La clôture de saison — livrée le 2026-09-03

Sans elle, la liste de travail (et donc « Waiting on you ») **ne pouvait que grossir** : une
demande de février qui n'a jamais répondu gardait son compteur de silence et réapparaissait
indéfiniment, jusqu'à ce que la liste soit assez longue pour ne plus être lue. Une liste qu'on
ne vide jamais cesse d'être une liste de travail.

`utils/seasonClose.ts` (8 tests) + `SeasonClosePanel` sur la liste de travail. **Deux motifs
distincts**, jamais mélangés : le mois d'arrivée est **passé** (le silence n'entre pas en compte
— une conversation d'il y a trois jours ne change rien si le mois est fini), ou **pas de dates
et 60 jours** de silence. Quelqu'un qui dit « décembre prochain » puis se tait est **en avance,
pas mort** : jamais proposé.
- **Les noms et les motifs avant le bouton** — c'est la décision de gui, pas celle d'un
  compteur ; l'un d'eux mérite peut-être un coup de fil, et le seul moyen de le savoir est de
  lire la liste.
- **Un seul UPDATE** : clôturer la moitié d'une saison puis s'arrêter laisserait gui sans savoir
  quelle moitié.
- Le mois est écrit en clair (« Jan 2026 ») : **un mois mal saisi saute aux yeux** au lieu
  d'être clôturé en silence. Cas réel trouvé en PROD : Bruno, « Jan 2026 » — soit une vraie
  demande périmée, soit un janvier prochain mal saisi. **À regarder.**

⬜ **Reste de D, volontairement non fait** : **pré-remplir les participants** à la conversion
depuis `party_size` + `wants_*`. Motif : `ENQUIRIES.md` tranche explicitement que la conversion
ne crée **ni chambre ni participant nommé**, et `party_size: 3` fabriquerait trois personnes
sans nom que la compta compterait pour vraies. Depuis le chantier A, la qualification se **lit**
sur la résa (panneau d'origine) — c'était l'essentiel de la perte. À rouvrir avec gui s'il veut
un vrai « proposer, puis valider » dans le wizard.

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
| **`2026-09-03_client_notes.sql`** | **⬜ À PASSER (TEST + PROD). Sans danger, aucun DROP. DEUX choses dans le même fichier** (gui, 2026-09-03 : « tu peux mettre à jour la migration »). **(2) `bookings.source_id`** — `UUID NULL REFERENCES enquiry_sources(id)` + **reprise de l'historique** depuis la demande d'origine puis depuis `form_submissions.payload->>'referral_source_id'` (avec garde-fou de format : `payload` est écrit par un visiteur, un cast raté ferait échouer toute la migration). Motif : l'écran « Where they came from » a montré que **5 des 8 clients étaient « Unknown »**, parce que le wizard ne posait jamais la question — elle y est maintenant. Sans la colonne, un « Instagram » tapé dans le wizard et un « Instagram » choisi sur le formulaire feraient **deux lignes** dans le tableau. ⚠️ **Le code ne casse pas sans elle** : `source_id` s'écrit par un **UPDATE séparé** après l'insert, et l'échec est signalé (« the answer was not recorded ») sans empêcher la résa ; le libellé reste dans `referral_source`. **Rien à séquencer entre le SQL et le déploiement.** Recette n° 3 en bas du fichier. **(1)** table `client_notes` (`client_id` FK ON DELETE CASCADE, `created_at`, `body`), admin-only (`REVOKE ALL FROM anon`, policy `admin_all` seule). C'est **l'endroit unique où écrire sur quelqu'un**, par opposition à `enquiry_notes` qui parle d'une conversation en cours ; les deux se lisent comme un seul fil dans la frise du dossier client. ⚠️ **`enquiry_notes` n'est PAS migrée** : rien n'est copié, donc rien ne peut diverger — la fusion des deux tables est un chantier à part (elle touche l'écran de qualification, qui doit rester expédiable en 20 s). **Le code fonctionne sans cette migration** : le dossier détecte le `42P01`, affiche « notes not stored yet — migration pending » et désactive le champ ; le reste de la frise reste juste. Vérif en service_role (table admin-only, le curl anon ne prouve rien) : recette en bas du fichier — insert orphelin → **23503**, curl anon avec jeton valide → jamais de note. | ⬜ | ⬜ |
| **`2026-09-02_transfer_reference_prices.sql`** | **⬜ À PASSER (TEST + PROD) EN PREMIER. Sans danger, upgrade-safe** — table `transfer_reference_prices` (admin-only, `REVOKE ALL FROM anon`) : la liste de prix indicative des transferts (Maputo/Bilene/Tofo/Vilankulo, taxi local, Chappa, avion, bateau Macaneta) pour le sous-onglet **Options → Prices → Reference info**, seedée à partir de `temp/Trip orga - contacts.xlsx` (1er onglet). Purement informatif, **aucun calcul de l'app ne lit cette table**. **Pas de colonne devise** (retiré le 2026-09-02, gui) : 3 colonnes prix fixes et nullables `price_mzn`/`price_eur`/`price_usd` — cette page ne renseigne que `price_mzn` (+ `price_eur` quand gui connaît le montant, l'excel source n'en donnait aucun) ; une colonne `page` (`'transfers'`/`'kruger'`) sépare aussi cette table en 2 sous-onglets, voir la migration `b` ci-dessous. ⚠️ **gui avait déjà lancé l'ancienne version (schéma `price`+`currency`, sans `page`) sur TEST avant ce redesign** — le fichier détecte maintenant tout seul lequel des deux cas il a en face (`information_schema.columns`) : `CREATE TABLE IF NOT EXISTS` + seed neufs sur une base vierge (PROD), `ALTER`/backfill/skip-reseed sur TEST. **Même fichier, même geste sur les deux bases.** Quelques lignes du fichier source étaient ambiguës (cellules fusionnées/décalées, un « 220 $ » pour Komatipoort, le bloc bateau/4x4 Macaneta) — gardées en note dans le champ `notes`, **à vérifier par gui** une fois visibles dans l'UI. | ⬜ | ⬜ |
| **`2026-09-02b_kruger_reference_prices.sql`** | **⬜ À PASSER (TEST + PROD) JUSTE APRÈS la migration ci-dessus. Upgrade-safe aussi** — seed seul (aucun schéma), 23 lignes dans la même table `transfer_reference_prices` mais `page='kruger'` : sur TEST, la migration précédente a déjà déplacé les 23 lignes que gui y avait fait passer dans leur ancienne forme (section repliable `section_order=5`) vers `page='kruger'`/`section_order=0` — celle-ci trouve donc les lignes déjà là et **ne réinsère rien** ; sur PROD (base vierge), elle insère les 23 lignes normalement. **Même fichier, même geste sur les deux bases.** C'est **son propre sous-onglet Options → Prices → « Kruger & Eswatini »** (gui a demandé un onglet à part, 2026-09-02), pas une section repliable de Reference info. Forfaits Kruger 1j/2j/3j, combos Eswatini/Kruger, Blyde River Canyon, hébergement, conditions de dépôt/Paypal — tout en `price_usd` (page 100 % USD, pas de MZN/EUR ici). Seedé depuis `temp/kruger.xlsx`, dont l'onglet mélangeait ce catalogue de prix avec **un vrai historique de réservations (noms clients réels, n° de résa, paiements)** — **volontairement exclu** de ce fichier (gui, 2026-09-02) : hors sujet pour un outil de réponse aux clients, et ça expose des noms. Idem pour la note commission agence « 10 %/5 % STO », plus proche du chantier `agencies`/`agency_rate_items` que de ce tableau. | ⬜ | ⬜ |
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

