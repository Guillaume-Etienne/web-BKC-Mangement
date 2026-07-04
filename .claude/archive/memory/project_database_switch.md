---
name: Database switch prod/test
description: État et prochaines étapes pour le switch de base de données prod/test
type: project
---

## État au 2026-04-01

### ✅ Code TERMINÉ
- `client/src/lib/supabase.ts` — lit `localStorage('supabase_env')` au boot, bascule prod/test si credentials dispo
- `client/src/components/management/DatabaseTab.tsx` — onglet Management → 🗄️ Database avec toggle + stats DB
- `client/src/pages/ManagementPage.tsx` — onglet "database" ajouté
- `supabase/schema.sql` — fonction `get_db_stats()` ajoutée (pg_class + pg_namespace, SECURITY DEFINER)

### ✅ Infra prod
- Fonction `get_db_stats()` créée en prod + GRANT EXECUTE TO authenticated

### ✅ Stats DB fonctionnelles
- Taille totale DB, nb tables, total rows, détail par table (rows, table size, index size, total)

### 🔲 Prochaine étape : créer la base de test

1. Aller sur supabase.com → New project (free tier)
2. Une fois créé : Settings → API → copier l'URL et l'anon key
3. Ajouter dans `client/.env.local` :
   ```
   VITE_SUPABASE_TEST_URL=https://XXXXXXXXXX.supabase.co
   VITE_SUPABASE_TEST_KEY=eyJ...
   ```
4. Redémarrer le dev server
5. Exécuter tout `supabase/schema.sql` sur la nouvelle base (SQL Editor)
6. Exécuter aussi `get_db_stats()` + GRANT sur la base test
7. Le toggle s'active automatiquement dans Management → Database
