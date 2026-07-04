# Archive mémoire — chantiers clos & audits historiques

Copies des fichiers de la mémoire persistante de Claude (`~/.claude/projects/.../memory/`),
archivés ici le **2026-07-04** lors du grand ménage docs/mémoire, pour être conservés via git.

**Règle** : tout ce qui est ici est **clos, obsolète ou historique**. Rien ici n'est une source
de vérité — les références à jour sont dans `.claude/docs/` (et le reste-à-faire dans
`.claude/docs/BACKLOG.md`). On garde ces fichiers uniquement pour pouvoir retrouver le
« pourquoi » d'une décision passée (modèles de données, galères DNS/Resend, décisions gui…).

| Fichier | Pourquoi archivé |
|---------|------------------|
| `project_accounting_issues.md` | ✅ Clos 2026-05-25 — 4 issues compta résolues/documentées |
| `project_group_lesson_pricing.md` | ✅ Fixé — modèle dual-rate désormais documenté dans `docs/data-model.md` § instructors |
| `project_csv_import_bug.md` | ❌ Abandonné — import CSV remplacé par le formulaire public |
| `project_database_switch.md` / `project_env_switch.md` | ✅ Switch prod/test terminé (avril 2026) |
| `project_realtime.md` | ✅ Realtime en place (mars 2026) |
| `project_email_and_actions.md` | ✅ Emails (Resend) + pending actions terminés |
| `project_submission_notify_emails.md` | ✅ TEST+PROD opérationnels — contient la résolution DNS/DMARC Infomaniak (utile si problème de délivrabilité) |
| `project_form_traveler_kite_info.md` | ✅ Flags par voyageur + notation G·N·LK·R·LW·C livrés |
| `project_uncommitted_ui_fixes.md` | ✅ Commité `67ba184` — contient le gotcha `amount_paid` ≠ source de vérité |
| `project_taxi_shares.md` | ✅ Chantier pages partagées taxi terminé — réf. à jour : `docs/taxi-and-shares.md` |
| `project_booking_form.md` | ✅ Formulaire public livré TEST+PROD — restes (waiver EN/ES) dans BACKLOG |
| `project_test_seed.md` | Réf. à jour : `supabase/seed/README.md` |
| `project_taxi_planning.md` | Décision « Kanban gelé » reprise dans BACKLOG § Gelé |
| `project_logo_documents.md` / `project_form_antispam.md` | TODOs repris dans BACKLOG |
| `bug_taxi_trip_price.md` | Investigué + fix code fait — reste repris dans BACKLOG |
| `audit_2026_03_code_and_docs.md` | Audit historique, tout traité |
| `audit_2026_06_preprod.md` | Audit pré-prod, bascule faite — restes dans BACKLOG |
| `audit_2026_07_general_review.md` | Compta corrigée ; trous sécu repris dans BACKLOG + `docs/security-rls.md` |
| `security_anon_rls_exposure.md` | Remplacé par `docs/security-rls.md` (canonique) |
| `feedback_revoke_supabase_token.md` | Rappel repris dans BACKLOG § Housekeeping |
