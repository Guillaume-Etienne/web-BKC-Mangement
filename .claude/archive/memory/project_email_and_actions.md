---
name: Email system + Pending actions dashboard
description: Plan for transactional emails (Resend), pending actions on HomePage, and nav badge
type: project
---

## Email system — État au 2026-03-30

### ✅ Code TERMINÉ
- `supabase/functions/send-email/index.ts` — Edge Function déployée sur Supabase
- `supabase/schema.sql` — table `email_logs` + enums ajoutés (à appliquer en prod)
- `client/src/utils/emailTemplates.ts` — 3 templates HTML email (visa_letter, booking_confirmation, travel_guide)
- `client/src/types/database.ts` — types EmailLog, EmailLogType, EmailLogStatus ajoutés
- `client/src/pages/DocumentsPage.tsx` — boutons "Send by email" + champ email pré-rempli + badge statut

### ✅ Infra Supabase FAITE
- Table `email_logs` créée en prod (SQL exécuté manuellement dans console)
- Edge Function `send-email` déployée via dashboard Supabase
- Secret `RESEND_API_KEY` ajouté dans Supabase Edge Functions secrets

### ✅ Envoi email FONCTIONNEL (2026-04-01)
- L'Edge Function `send-email` fonctionne correctement
- Les 3 boutons "Send by email" dans DocumentsPage opérationnels

### Service & architecture
- **Resend** comme provider email (free tier: 3000/month)
- Sender final: `no-reply@bilenekite.com` (domaine à vérifier SPF/DKIM/DMARC sur Hostinger)
- **Supabase Edge Function** comme proxy (protège la clé Resend API)
- Logs dans table `email_logs` (status: pending/sent/delivered/opened/failed)

### Email types (3 templates)
1. **booking_confirmation** — résumé de réservation (=printBookingSummary adapté email)
2. **visa_letter** — lettre visa officielle portugais (=printVisaLetter adapté email)
3. **travel_guide** — guide voyage standalone (FR/EN/ES)

### J-7 automation (pas encore codé)
- pg_cron job daily, checks bookings where `visa_entry_date = today + 7`
- Crée des email_logs avec status = 'pending' pour visa_letter + travel_guide
- Admin valide l'envoi depuis l'app (pas d'auto-send)

---

## Pending Actions system — ✅ TERMINÉ

### Code
- `client/src/components/pending/pendingActions.ts` — moteur de règles (7 règles)
- `client/src/App.tsx` — charge bookings + payments + taxis au login, calcule les actions
- `client/src/components/layout/Navigation.tsx` — badge rouge sur "Home" (urgentCount)
- `client/src/pages/HomePage.tsx` — liste des actions avec code couleur + liens de navigation

### Règles implémentées
**🔴 Urgent**
- Paiements non vérifiés (is_verified = false)
- Réservation provisoire + check_in ≤ J+2
- Visa entry ≤ J+4
- Aucun paiement + check_in ≤ J+1

**🟡 This week**
- Provisoire + check_in ≤ J+7
- Aucun paiement + check_in ≤ J+7
- Visa entry J+5 à J+7

**🟢 Monitor**
- Trajets taxi sans booking_id

### Règles email (à ajouter quand email_logs fonctionne)
- 🔴 email_logs.status = 'pending' (J-7 queue)
- 🟢 sent_at < now-48h AND opened_at = null
