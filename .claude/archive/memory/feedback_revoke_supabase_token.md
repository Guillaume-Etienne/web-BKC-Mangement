---
name: feedback_revoke_supabase_token
description: Rappel de révoquer le Personal Access Token Supabase créé le 2026-06-26 pour le déploiement CLI
metadata: 
  node_type: memory
  type: project
  originSessionId: 462156e9-3c69-46bd-8ea5-63c4c230ac1f
---

Un Personal Access Token Supabase (sans expiry) a été créé le 2026-06-26 pour déployer la fonction `notify-submission` via la CLI. Il faut le révoquer depuis `https://supabase.com/dashboard/account/tokens` dès que le déploiement est terminé.

**Why:** gui n'aime pas laisser des tokens actifs inutilisés — il y en avait déjà un autre actif.
**How to apply:** Rappeler à gui de révoquer ce token en fin de session ou dès que le déploiement prod est validé.
