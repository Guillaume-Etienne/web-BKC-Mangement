# Journal des sessions — août 2026 (archivé le 2026-08-18)

Sorti de `MEMORY.md` (index plafonné en taille) une fois les chantiers clos ou repris
dans `.claude/docs/BACKLOG.md`. **Le reste-à-faire ne vit PAS ici** : source de vérité =
`.claude/docs/BACKLOG.md`. Gardé pour le « pourquoi » des décisions et les pièges vécus.

## 2026-08-17 — Agences partenaires, Phases 3 + 5 livrées

- **Livrées ensemble exprès** (`892c12d`, doc `0bde803`) : rattacher un service à une ligne de
  facture agence (Phase 3) **oblige** à l'exclure des totaux client (Phase 5), sinon le même
  euro est facturé deux fois. **Aucune migration** — les 4 colonnes existaient depuis le 16/08.
- **Décision gui sur l'ergonomie** : panneau **🤝 Agency billing dans la fiche résa**
  (Accounting → Bookings), pas de sélecteur dans le planning — parce que les cours de #022
  étaient **déjà saisis** et qu'un sélecteur à la création ne les aurait jamais rattrapés.
  Périmètre choisi par gui : **les 4 sources** (cours, locations, transferts, chambres).
- Piège traité : un transfert facturé à l'agence **garde son coût chauffeur** et n'abandonne que
  le prix client → marge négative, compensée par la ligne agence. Sinon la course paraît gratuite.
- **323 tests**, dont un garde-fou d'iso-comportement sur un jeu sans ligne agence.
  Curl anon vérifié sur les 2 bases (les 4 colonnes → 200 `[]`, `agency_billing_lines` → 42501).
- **Campagne de test complète sur TEST** (Claude in Chrome + service_role, base restaurée à
  l'identique) : tout marche — 1 326 € → 606 €, compteur d'heures, dépassement ambre, tampons,
  suppression rendant les services au client, page client avec « — ». **3 défauts corrigés**
  (`16eb23d`), détail dans BACKLOG § « Les 3 défauts trouvés par la campagne » :
  1. dashboard affichant un total que ses lignes ne faisaient pas (part agence sans ligne) ;
  2. **`mcp-server/` cassé** — son bundle n'avait ni `priceTiers` ni les collections agence ;
  3. `npm run build` (`tsc -b`) attrape ce que `tsc --noEmit` laisse passer.
- ~~**⚠️ PROD : `lessons` est VIDE**~~ — **conclusion FAUSSE, corrigée le 18/08** : c'est normal,
  [les cours se saisissent la veille](project_lessons_entered_the_day_before.md). Ne pas les
  saisir à l'avance.
- ~~**⬜ Restent : Phase 6 et Phase 4**~~ — **Phase 6 livrée le 18/08** (voir section du jour) ;
  restent la Phase 4 et la décision colonne CashFlow.
- **✅ Poussé** : `origin/master` = `378b475` (vérifié 18/08) — `e8b631d`, `16eb23d` et `378b475`
  sont bien sur le remote, plus rien en attente de push à cette date.
- **⚠️ Deux sessions Claude Code en parallèle ce jour-là** : une sur le MCP (taxi/payments/
  clients/planning, `e8b631d`), une sur les Agences (Phases 3+5 + campagne de test + fixes,
  `892c12d`/`16eb23d`/`378b475`) — d'où l'écriture croisée dans cette section. Les deux
  travaillaient sur `mcp-server/` en même temps (`fetchAccountingBundle.ts`) sans se marcher
  dessus : la session MCP a délibérément laissé ce fichier intact pendant que l'autre le
  terminait.

## 2026-08-16 — grosse session : agences, paliers de prix, ping Brevo, bug Firefox

- Secrets tournés (clé Brevo + `NOTIFY_ENQUIRY_SECRET`) — clos, ne plus remonter.
- Bug Firefox corrigé : `<input type="month">` non implémenté → `MonthInput` (2 `<select>`),
  9 endroits, commit `42e769d`.
- Conversion réelle d'une enquête Fun&Fly en résa (`#022`, Loïc SENE), à la main, étape par
  étape — a révélé San Martinho sans `external_billing` coché en PROD malgré le chantier du
  12 août, corrigé — [[reference-feature-delivered-not-applied]].
- **Ping mensuel Brevo** codé et vérifié TEST+PROD (`brevo-ping` + `pg_cron`,
  `2026-08-16_brevo_keepalive_ping.sql`) — **PROD uniquement**, décision gui (comme le reste
  de Brevo).
- **Chantier Agences partenaires** (conçu via `/plan`, 3 agents d'exploration) : Phase 1
  (`agencies`/`agency_rate_items`/`agency_billing_lines` + écran Options → 🤝 Agencies) et
  Phase 2 (`agency_id` dans le wizard) livrées, vérifiées TEST+PROD+navigateur — résa `#022`
  réellement reliée à Fun & Fly. Phases 3+5 livrées le 17/08 (voir plus haut) ; **4 et 6
  restent** : BACKLOG § Facturation agences partenaires.
- **Chantier Tarification dégressive par palier** (cours privés/groupe, cumul **à vie**, pas
  par séjour/saison — conçu via `/plan`, 2 agents) : livré et vérifié TEST+PROD
  (`2026-08-16c_lesson_price_tiers.sql`), compteur "lifetime hours" sur la fiche client, 299
  tests. **✅ Paliers réels saisis le 2026-08-17** via Options → Pricing (PROD, navigateur) :
  Private 60€/h base → 4h:55€ → 10h:52€ ; Group 45€/h base → 4h:43€ → 10h:41€.
  Détail : `.claude/docs/LESSON_PRICING.md` § Tarification dégressive.
- Repo laissé propre en fin de session : un fix trouvé en attente non commité
  (`AccountingPage.tsx`, select mobile pour la barre d'onglets au lieu du scroller horizontal
  qui cache la moitié des onglets sur téléphone) a été vérifié (`tsc --noEmit` OK) et commité
  à part (`78ca5cd`). **⬜ Reste (gui) : push de toute la journée** — rien n'est encore poussé.


---

> **Note de clôture (2026-08-18)** : les mentions « rien n'est encore poussé » ci-dessus sont
> périmées — tout est sur `origin/master` jusqu'à `7ba227a` inclus (vérifié au reflog le 18/08).

## 2026-08-18 — Agences : les 6 phases livrées (clos)

Phase 6 (onglet Agencies), marqueur `(FF)` (colonne `short_code`, **pas** un mapping par nom),
Phase 4 (redaction réelle des prix par **colonne générée**, pas de fonction SECURITY DEFINER qui
aurait contourné la RLS), **2 fuites fermées** (`lessons.instructor_rate` = paie moniteur, et
`taxi_trips.price_eur`), colonne **Agencies du CashFlow**, et **2 bugs d'argent**
([[reference_refreeze_snapshots_on_reassign]], [[reference_agency_package_hours]]).
Tout passé, poussé et vérifié avec de vrais tokens. La **première facture Fun & Fly** a été
saisie en PROD le 19/08 (890 € brut / 712 € net). Piège vécu ce jour-là, repéré avant d'écrire :
[[reference_dev_port_changes_database]] (navigateur laissé sur TEST).

## 2026-08-19 — Génération de la facture agence (livrée)

Vraie table `agency_invoices` : **une facture = une résa**, notre `INVOICE N°` = `AAAAMMJJ`
(`-2` si deux le même jour) vs la **réf F&Fly** qu'ils donnent et veulent relire sur la facture —
deux numéros à ne jamais confondre. Adresses/IBAN en dur, libellés au format F&Fly, doc en FR.
Les tampons `invoiced_at`/`paid_at` ont déménagé de la ligne vers la facture (on solde une
facture, pas une ligne — vérifié qu'aucune ligne n'en portait avant migration).
Pas de `UNIQUE (booking_id, agency_id)` exprès (une résa peut avoir 2 factures dans le temps).
Adresse destinataire indexée par `short_code`, jamais par le nom. 371 tests.
Le vrai modèle F&Fly a été décodé depuis un `.xlsx` réel (zip + `sharedStrings.xml`, aucune lib
nécessaire) — a prouvé indépendamment que le transfert Maputo↔Bilene est **par trajet** (168 €).
🔴 Bug trouvé par le premier essai réel (`d570495`) : la facture se créait sans rattacher ses
lignes → [[reference_persist_fk_ordering]]. Les alertes bloquantes gèlent aussi Claude in Chrome.
**Facture #022 créée en PROD** (`INVOICE N° 20260819`, 890 € brut / 712 € net) — réf F&Fly et
relecture de l'impression contre le modèle Excel laissées à gui (fenêtre d'impression hors du
groupe de l'extension, Claude ne peut pas la voir). ⬜ Reste : `2026-08-19c`, DROP des 2 colonnes
mortes (`invoiced_at`/`paid_at` sur `agency_billing_lines`), après déploiement — sans urgence.

## 2026-08-20 — Travel Guide traduit, et deux bugs d'affichage (clos)

✅ Traductions EN + ES du Travel Guide livrées et appliquées (`58d0654`), vérifiées TEST+PROD :
`jsonb_set` sur les seules clés `en`/`es`, le FR de gui survit à un rejeu. TEST et PROD ont des
FR différents (gui rédige dans PROD) — attendu, ne pas aligner. Coquilles FR signalées, non
corrigées (texte de gui).
🔴 Overview des Documents : un envoi réel s'affichait « never sent » (`0ad1fac`) — la donnée était
juste, c'est la couleur posée sur une `<input type=checkbox>` native qui ignorait `bg`/`border` →
[[reference_native_checkbox_ignores_bg]].
🔴 Diagnostic FAUX donné avant ça : un curl demandait une colonne inexistante (`42703`), le script
a lu l'objet d'erreur comme un tableau vide → « email_logs est vide » affirmé à tort, gui avait
raison → [[reference_read_the_error_not_the_empty_array]].
🧹 5 serveurs vite tournaient (5173→5177), 4 laissés malgré TaskStop → [[reference_kill_vite_orphans]].
