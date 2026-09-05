# BACKLOG — reste à faire (source de vérité unique)

> Tout ce qui est **clos** est sorti d'ici le 2026-09-05 →
> `.claude/archive/memory/backlog_closed_2026.md` (1600 lignes d'historique, décisions et
> vérifications). Ici : **l'ouvert uniquement.** Une ligne close se raye et se déplace.

## 🚨 Migrations SQL — registre

**Aucune en attente au 2026-09-05.** Dernières vérifiées en curl anon réel :
`2026-09-05_client_errors.sql` (insert anon valide = 201, `kind` hors liste = `42501` sur les deux
bases), `2026-09-05b_deposit_requested.sql` (`42501` et non `42703` = colonne présente, anon exclu)
et `2026-09-03_client_notes.sql` (reconfirmée sur les deux bases).

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
