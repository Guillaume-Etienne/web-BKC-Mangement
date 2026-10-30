-- Empreinte du schéma `public` — détecter une dérive TEST ↔ PROD (2026-10-30).
-- LECTURE SEULE. À lancer tel quel sur les deux bases (SQL editor ou MCP), puis comparer.
--
-- Chaque objet = une ligne (kind, name, detail) : tables + RLS, colonnes, contraintes, index,
-- policies, droits table (anon/authenticated), droits colonne anon, fonctions (corps haché,
-- SECURITY DEFINER, search_path, droits EXECUTE), enums, triggers.
--
-- Mode 1 (par défaut, ci-dessous) : RÉSUMÉ — une ligne par kind (nombre + md5). Deux bases
--   identiques donnent exactement les mêmes lignes.
-- Mode 2 : DÉTAIL — remplacer le SELECT final par celui en commentaire en bas, pour lister
--   objet par objet (md5 du detail) les kinds qui diffèrent, puis comparer les deux sorties.
-- Tri en COLLATE "C" : TEST et PROD n'ont pas la même version de Postgres, et un tri selon la
-- locale donnait un md5 différent pour des contraintes identiques (constaté le 2026-10-30).
-- Ne compare PAS schema.sql (tenu à la main) : voir BACKLOG « schema.sql incomplet ».

WITH objs(kind, name, detail) AS (
  SELECT 'table', c.relname, 'rls=' || c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
  UNION ALL
  SELECT 'column', c.relname || '.' || a.attname,
         format_type(a.atttypid, a.atttypmod) || ' notnull=' || a.attnotnull
         || ' default=' || coalesce(pg_get_expr(d.adbin, d.adrelid), '')
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'constraint', c.relname || '.' || k.conname, pg_get_constraintdef(k.oid)
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
  UNION ALL
  SELECT 'index', indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
  UNION ALL
  SELECT 'policy', tablename || '.' || policyname,
         cmd || ' roles=' || array_to_string(roles, ',') || ' using=' || coalesce(qual, '')
         || ' check=' || coalesce(with_check, '')
    FROM pg_policies WHERE schemaname = 'public'
  UNION ALL
  SELECT 'grant_table', table_name || '.' || grantee, string_agg(privilege_type, ',' ORDER BY privilege_type)
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
   GROUP BY table_name, grantee
  UNION ALL
  SELECT 'grant_column_anon', table_name || '.' || column_name, string_agg(privilege_type, ',' ORDER BY privilege_type)
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND grantee = 'anon'
   GROUP BY table_name, column_name
  UNION ALL
  SELECT 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'secdef=' || p.prosecdef || ' config=' || coalesce(array_to_string(p.proconfig, ','), '')
         || ' body=' || md5(p.prosrc)
         || ' anon_exec=' || has_function_privilege('anon', p.oid, 'EXECUTE')
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
  UNION ALL
  SELECT 'enum', t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public'
   GROUP BY t.typname
  UNION ALL
  SELECT 'trigger', c.relname || '.' || g.tgname, pg_get_triggerdef(g.oid)
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT g.tgisinternal
)
SELECT kind, count(*) AS n, md5(string_agg(name || '|' || detail, E'\n' ORDER BY name COLLATE "C")) AS fingerprint
  FROM objs GROUP BY kind ORDER BY kind;

-- Mode 2 — DÉTAIL (remplacer le SELECT ci-dessus) :
-- SELECT json_agg(json_build_object('k', kind, 'n', name, 'h', left(md5(detail), 10)) ORDER BY kind, name)
--   FROM objs WHERE kind IN ('policy', 'grant_column_anon');   -- les kinds qui diffèrent
