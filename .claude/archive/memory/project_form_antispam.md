---
name: project_form_antispam
description: "TODO plus tard — protéger le formulaire public anti-spam/bots (honeypot + délai mini en priorité, Turnstile si besoin)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 933253e1-21af-4a2a-bb0e-122337ce8afc
---

**À VOIR PLUS TARD** (gui : "on verra plus tard") — protéger le formulaire public d'inscription ([[project_booking_form]]) contre le spam/bots.

## Risque
Le formulaire est accessible à tout anon via `?share=<token>` (lien `booking_form`). Chaque soumission déclenche **2 emails auto** (accusé client + notif contact@bilenekite.com) via trigger pg_net → voir [[project_submission_notify_emails]]. **Le vrai dégât = quota Resend cramé + boîte mail noyée**, plus file d'attente polluée. Les lignes DB sont secondaires.
Menace actuelle faible : token aléatoire (~36¹⁰), non devinable. Vecteur = là où le lien est publié (privé WhatsApp/email = quasi nul ; public site/Insta = bots crawlers).

## Solutions (léger → robuste), la plupart SANS toucher la DB
1. **Honeypot** : champ caché que seuls les bots remplissent → rejet. Très faible coût, zéro DB. Arrête ~90% des bots.
2. **Délai mini** : rejeter si soumis <3s après ouverture du form. Idem, zéro DB.
3. **Kill switch** : DÉJÀ dispo — `shared_links.is_active=false` + recréer un lien. Dépannage immédiat.
4. **Cloudflare Turnstile** (CAPTCHA invisible gratuit) : vraie parade. MAIS pour être bloquant il faut router l'insert via une Edge Function qui vérifie le token (aujourd'hui anon écrit direct via RLS `anon_insert_form_submissions`) → un peu plus d'archi.

## Reco
À la prod, le kill switch suffit si le lien est diffusé surtout en privé. Combo **honeypot + délai mini** = ~15 min de dev, zéro DB, couvre l'essentiel — à faire quand gui veut. Turnstile seulement si le lien est publié largement.
