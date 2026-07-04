---
name: project_booking_form
description: Public booking intake form (FR/EN/ES) + admin review queue — replaces the abandoned CSV import
metadata: 
  node_type: memory
  type: project
  originSessionId: 4701174a-cf21-4784-8e5a-098e94564db9
---

Formulaire public d'inscription client (remplace l'import CSV abandonné, voir [[project_csv_import_bug]]). Codé et buildé le 2026-05-31. **Migration SQL PAS ENCORE appliquée** en test/prod au moment de l'écriture.

**Architecture**
- Page publique `BookingFormPage.tsx` (wizard 5 étapes, thème océan/kite, trilingue) atteinte via `?share=<token>` sur un `shared_link` de type **`booking_form`** (nouveau). Créer le lien depuis ManagementPage → onglet Links.
- Écrit une ligne `pending` dans **`form_submissions`** (anon INSERT only, RLS `WITH CHECK (status='pending')`, pas de SELECT anon). Payload brut complet dans `payload` JSONB + colonnes dénormalisées (reference_name, email, num_travelers, arrival_date).
- `SubmissionsPage.tsx` (admin, nav item "Submissions" 📝 + badge bleu) : review → **Create booking** crée `clients` + `bookings` (provisional) + `booking_participants`, marque la soumission `approved` + `created_booking_id` (garde-fou anti-doublon via `import_id = submission.id`). Bouton **Reject** → `rejected`.
- Pending action `pending-submissions` (priorité week) dans `pendingActions.ts`, comptée dans `App.refreshPendingActions`.

**Décisions de mapping clés** (voir aussi le Google Form source)
- Dates **pays** (arrivée Maputo / vol retour) → `visa_entry_date` / `visa_exit_date` (lettre d'hébergement).
- Dates **Bilene** (`check_in`/`check_out`) calculées depuis `nights_bilene`, **confirmées par l'admin** au moment du Create booking (champ éditable, défaut = country_entry + nights).
- Lits doubles → `couples_count`. Lits simples + nb nuits → conservés dans `payload` (+ note booking), pas de colonne dédiée.
- Étape Trip restructurée en 2 blocs Arrivée/Départ : date+heure du **vol** (→ visa dates) séparées des **date+heure de transfert taxi** (`transfer_to_bilene_*` / `transfer_to_airport_*` dans le payload, pré-remplies depuis le vol mais éditables ; reportées dans les notes du booking à la validation, pas de colonne dédiée). Le client peut donc indiquer un transfert un autre jour/heure que son vol.
- Nouvelles colonnes `bookings` : `has_travel_insurance`, `waiver_accepted_at`, `waiver_version`, `referral_source`.
- Email + téléphone du référent : **ajoutés** (absents du Google Form d'origine).

**Fichiers** : nouveaux = `pages/BookingFormPage.tsx`, `pages/SubmissionsPage.tsx`, `data/formI18n.ts`, `data/waiver.ts`, `supabase/migrations/2026-05-31_booking_form.sql`. Modifiés = `schema.sql`, `types/database.ts`, `App.tsx`, `ManagementPage.tsx`, `Navigation.tsx`, `pendingActions.ts`, + ajout des 4 champs Booking dans `mock.ts` et `parseGoogleFormsCSV.ts`.

**Tester le formulaire (piège env)**
- L'env prod/test vient de `localStorage` (`supabase.ts`). Une **fenêtre de navigation privée a un localStorage vide → tape sur PROD** → si lien créé en test, "introuvable" → l'app affiche LoginPage. Pour tester : ouvrir le lien `?share=` dans la **fenêtre normale en mode test** (le dispatch du share s'exécute avant le gate auth, donc même connecté on voit le form ; pour simuler l'anon, se déconnecter sans quitter la fenêtre). Conséquence prod : un vrai client tape toujours sur PROD → migration + lien doivent être en prod.

**État git** : commité sur master le 2026-06-01 (feature complète + docs). Pas encore déployé/pushé selon le souhait (tester en local d'abord).

**À FAIRE / points ouverts**
- ⚠️ Appliquer `supabase/migrations/2026-05-31_booking_form.sql` d'ABORD en TEST puis PROD (l'`ALTER TYPE shared_link_type ADD VALUE 'booking_form'` doit tourner dans son propre run).
- ⚠️ Texte du waiver EN/ES = traductions auto, **à faire relire** juridiquement (FR = source fournie par gui). `WAIVER_VERSION = 'v1-2026'`.
- Optionnel : ajouter `form_submissions` à la publication realtime si on veut le rafraîchissement live de la file (sinon refresh manuel après action — déjà géré).
- L'import CSV (`ImportCSVModal` + `parseGoogleFormsCSV.ts`) est toujours branché dans ClientsPage : à supprimer une fois le formulaire validé en prod.
