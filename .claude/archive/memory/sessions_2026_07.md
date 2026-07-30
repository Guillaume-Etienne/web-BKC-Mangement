# Journal des sessions — juillet 2026 (archivé le 2026-07-30)

Sorti de `MEMORY.md` (index de mémoire, plafonné en taille) une fois ces chantiers clos.
**Le reste-à-faire ne vit PAS ici** : source de vérité = `.claude/docs/BACKLOG.md`.
Gardé pour le « pourquoi » des décisions et les pièges vécus.

## 2026-07-28 (Opus) — audit : C1, C2, S1, S2, S3

**C1 + C2 corrigés** (`c80a0cd`). Nouveau module `client/src/utils/roomPricing.ts` :
`getFullHouseRate` (lit `room_rates` clé `full_{accId}`) + `getBaseNightlyRate` (repli
tarif de base **full-house-aware** : maison entière = prix `full_` / nb chambres, pas la
somme F+B). `roomRates` ajouté à `SharedAccountingData`. *(Le repli à 100 € en dur qui
subsistait alors a été supprimé le 2026-07-30 : sans tarif configuré, on affiche 0 €.)*

**S1 + S3 corrigés et déployés PROD** (`0b2c833`) : `send-email` exige un vrai compte
connecté (`auth.getUser()` → 401 sinon) ; `notify-submission` fail **closed**. Vérifié par
curl : `send-email` PROD passait de 400 à **401** même avec payload complet.
⚠️ **TEST n'a PAS `send-email`** (404) — la bascule PROD/TEST ne sert qu'en `npm run dev`
local ; `notify-submission` TEST tourne encore l'ancienne version (sans gravité).

**S2 = fait** : signup **était ON** sur les 2 bases, gui l'a passé OFF (`4e71aca`).
Tests A (envoi doc) et B (formulaire public) OK par gui. La « notif admin manquante » était
une fausse alerte = latence POP3 (Gmail relève la boîte Infomaniak `contact@`).

## 2026-07-25 (Opus) — audit externe lancé depuis Claude web

Rapport `docs/audit-2026-07.md` perdu (conteneur éphémère, push 403) — gui a le .md
téléchargé. Findings **revérifiés dans le code** : 2 descriptions de l'audit web étaient
fausses (full house = 100 € en dur, pas 70+50 ; `send-email` bien moins exploitable que
dit, FK `booking_id` obligatoire).
⚠️ **Leçon** : ne pas prendre les rapports d'agents pour argent comptant — vérifier dans le
code avant de planifier des corrections.

## 2026-07-09 (Fable) — templates de documents en DB

Templates migrés **localStorage → DB** + nouveau **Welcome Guide** 🏝️ (wifi, repas, eau…,
défauts avec placeholders `[…]`) ; Save/Cancel explicite dans Documents (plus d'autosave).
Commit `ea06f04`. Migration `2026-07-09_document_templates.sql` appliquée TEST+PROD et
vérifiée par curl anon le 2026-07-10 (42501 en SELECT+INSERT sur les 2 bases ; enum
`welcome_guide` prouvé via le truc parse-avant-permission).
Plus tôt le même jour : responsive mobile `5b32f44`.

## 2026-07-06 (Fable) — 🎉 chantier sécu anon terminé (Lots A/B/C + Phase 2)

1. **Phase 2 RLS token-aware** : header `x-share-token` (`supabase.ts`) + migration
   `2026-07-06_phase2_token_rls.sql` (5 helpers + 22 policies, D1–D4 = recos validées par
   gui). Curls verts sur les 2 bases (`bbc7cfe`). Sans token valide, anon ne lit plus RIEN.
2. **Lot C** (`db4b00d`) : GRANT colonnes instructors / taxi_drivers (phone gardé exprès) /
   activity_providers (tout sauf `notes`) + 6 pages narrowées. Vérifié avec 6 types de
   tokens frais créés par gui en TEST + grants curlés en PROD.
   *(Les tarifs `instructors.rate_*` ont été retirés de ce GRANT le 2026-07-29 : devenus de
   la paie, ils n'ont plus à être lisibles depuis un lien client.)*
3. **Compta : taxi en marge centre** (`eb3d2bf`) : Total revenue + barre breakdown = marge
   (facturé − chauffeur − manager) ; brut conservé dans TaxiFinanceTab, Billed/Collected/
   Outstanding et CashFlow. Net result inchangé (plus de double soustraction).
4. **CollectionsModal** (`814d605`, « qui me doit quoi » groupé par urgence) ; **anti-spam
   formulaire** (`318e467`, honeypot + délai 3 s → faux écran de succès, zéro insert) ;
   import CSV supprimé (`b35b821`).
5. Housekeeping : PAT Supabase **tous révoqués** (`Juin2026TEMP` expiré+supprimé, token CLI
   révoqué) ; `.env.local` nettoyé (clés Resend → secrets Edge Functions uniquement).

⚠️ **Leçon majeure** : gui a « appliqué la migration PROD »… sur TEST (SQL editor sur le
mauvais projet ; migration idempotente → zéro erreur, faux positif). **Toujours vérifier par
curl anon APRÈS application, jamais croire « c'est passé »** — d'où le feedback
`feedback_sync_test_prod_migrations.md`.
