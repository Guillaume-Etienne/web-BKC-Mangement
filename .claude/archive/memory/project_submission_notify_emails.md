---
name: project_submission_notify_emails
description: "Booking-form submission triggers 2 hardcoded emails (client ack + admin notif) via notify-submission Edge Function — TEST opérationnel, PROD à faire"
metadata: 
  node_type: memory
  type: project
  originSessionId: 309efdb6-341d-476f-8837-aec221425e33
---

À chaque soumission du formulaire public ([[project_booking_form]]), **2 emails partent automatiquement** via l'Edge Function `supabase/functions/notify-submission/index.ts`, déclenchée par un **Database Webhook** sur `form_submissions` INSERT (côté serveur → pas spammable, indépendant du navigateur) :
1. **Accusé client** → l'email de la soumission, trilingue FR/EN/ES (ton "Fair winds! 🌊").
2. **Notif admin** → `contact@bilenekite.com` avec récap (nom, email, tél, voyageurs, dates pays, nuits Bilene, langue, provenance).

Ne touche PAS à `email_logs` (réservée aux 3 docs officiels, `booking_id` NOT NULL). Provider **Resend**, `FROM = 'BKC <no-reply@bilenekite.com>'` (voir [[email-system-+-pending-actions-dashboard]]).

**IMPORTANT — textes en dur, NON éditables depuis l'app.** Pour modifier le wording : éditer `notify-submission/index.ts` + redéployer. Rappel visible ajouté en haut de `SubmissionsPage.tsx` (bandeau bleu). Décision gui (2026-06-09) : on reste en dur, pas d'UI d'édition.

## ✅ TEST — 100% opérationnel (2026-06-09)
Chaîne validée bout-en-bout : formulaire → webhook → fonction → Resend → **délivré en boîte de réception**. Setup réalisé sur le projet Supabase de TEST :
- Fonction `notify-submission` déployée **avec Verify JWT désactivé** (le webhook n'envoie pas de JWT user → on s'appuie sur un secret).
- Secrets : `NOTIFY_SECRET` (nouveau) + `RESEND_API_KEY` (il a fallu l'ajouter en test, elle n'existait qu'en prod ; clé Resend dédiée "supabase-test" créée).
- Database Webhook (Database → Webhooks) : table `form_submissions`, event **Insert** only, type Edge Function `notify-submission`, header `x-notify-secret = <NOTIFY_SECRET>`. La fonction renvoie 401 si le header ne matche pas.
- Diagnostic utile : `SELECT id,status_code,content FROM net._http_response ORDER BY created DESC` montre le code HTTP + le body `{"adminOk":..,"clientOk":..}` renvoyé par la fonction.

## ⚠️ La galère de la délivrabilité (résolue) — à RE-FAIRE en partie pour la prod ? NON (DNS = niveau domaine)
Au 1er test : Resend acceptait (200, adminOk/clientOk true) mais **bounces "550 rejected by DMARC policy"** + spam. Cause : **gui a changé d'hébergeur → DNS désormais chez Infomaniak** (NS `ns11/ns12.infomaniak.ch`, MX `mta-gw.infomaniak.ch`, SPF `include:spf.infomaniak.ch -all`, **DMARC `p=reject`**), et les enregistrements DNS de Resend (DKIM/SPF) n'avaient pas suivi → mails non authentifiés → rejetés par DMARC strict.

**Fix appliqué dans la zone DNS Infomaniak de `bilenekite.com`** (Resend région **eu-west-1**) :
- `TXT` `resend._domainkey` = `p=MIGfMA0...QAB` (clé DKIM, publique) ← **le record décisif**
- `MX` `send` = `feedback-smtp.eu-west-1.amazonses.com` priorité 10
- `TXT` `send` = `v=spf1 include:amazonses.com ~all`
Ne PAS toucher au SPF racine ni au MX Infomaniak (on ajoute seulement). Cache négatif DNS = 3600s (1h) → propagation a pris ~30-60 min, Resend est repassé **"verified"** tout seul. (Resend détecte à tort "IONOS" comme hébergeur = bug cosmétique, ignorer.)
➡️ **Ces records DNS sont au niveau du DOMAINE → ils valent aussi pour la PROD** : la délivrabilité de TOUS les mails Resend (lettres visa, confirmations DocumentsPage…) est donc réparée d'un coup, pas seulement le formulaire.

## ✅ PROD — 100% opérationnel (2026-06-27)
Chaîne validée bout-en-bout en prod : formulaire → trigger pg_net (pas webhook UI, schema manquant) → fonction → Resend → délivré. Setup prod :
- Fonction `notify-submission` déployée (CLI npx supabase, token PAT révoqué après)
- Secret `NOTIFY_SECRET` ajouté via CLI (valeur volontairement non archivée — visible dans les secrets Edge Functions du dashboard Supabase PROD)
- Trigger pg_net créé manuellement (Database Webhooks UI indisponible : schema `supabase_functions` absent du projet prod)
- RESEND_API_KEY était déjà présente en prod
- Lien public `booking_form` créé depuis ManagementPage → Links

## (archivé) PROD — RESTE À FAIRE (prochaine session)
Sur le projet Supabase de **PROD** (RESEND_API_KEY y est déjà) :
1. Appliquer d'abord la migration `2026-05-31_booking_form.sql` en prod (sinon pas de table `form_submissions`) — voir [[project_booking_form]].
2. Déployer la fonction `notify-submission` (Verify JWT OFF).
3. Ajouter le secret `NOTIFY_SECRET` (générer un **nouveau** GUID pour la prod, ne pas réutiliser celui de test).
4. Créer le Database Webhook (form_submissions / Insert / Edge Function `notify-submission` / header `x-notify-secret`).
5. Créer le lien public `booking_form` depuis ManagementPage → Links **en prod**.
6. Test de bout en bout (DNS déjà OK).

**Pense-bête** : nettoyer `client/.env.local` des secrets/records que gui y a collés pendant la session (clé Resend, NOTIFY_SECRET, enregistrements DNS) — rien de tout ça n'a à y être.
