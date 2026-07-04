---
name: project_taxi_shares
description: Réflexion en cours — pages partagées taxi (chauffeur PT/EN + manager) avec finances
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f5399f4-4b21-4223-99ba-8584a5084480
---

Réflexion (démarrée 2026-06-30, **pas encore codé**) : améliorer les **pages partagées taxi** (`DriverSharePage` existe déjà, type shared_link `'driver'`). Voir aussi [[project_taxi_planning]] (Kanban gelé).

## Page CHAUFFEUR (améliorer l'existant `DriverSharePage`)
- **i18n PT/EN** avec interrupteur, **PT par défaut** (chauffeurs mozambicains), EN pour que gui relise. Traduire tout : titres, KPIs, colonnes, types de trajet, statuts. S'inspirer du pattern `formI18n.ts`.
- **Bloc compta « Mon argent / O meu dinheiro »** en phrases parlantes (ils se projettent mal) : « déjà gagné X MZN sur Y trajets terminés », « vais gagner Z MZN sur W à venir », **+ grand total**.
- **Interrupteurs temporaires pour tester** (on élaguera après essai sur vrai téléphone basse réso) : (1) langue PT/EN, (2) affichage Cartes/Tableau, (3) format date lisible « Seg 30/06 » vs ISO.
- **Garder Notes** (détails fréquents) et **Boards** = `nb_boardbags` (housses de planches, encombrement véhicule).
- Contrainte design réelle = **lisible en capture d'écran / WhatsApp** sur petit écran (pousse vers la vue cartes).
- Ne montrer QUE `price_driver_mzn` au chauffeur, jamais marge centre / prix client.

## Page MANAGER (NOUVELLE page partagée, distincte des chauffeurs)
- Le manager = « l'homme de main » mozambicain, instruit (fait de l'Excel, compta pro), touche `margin_manager_mzn` par trajet.
- **Partagée (lien)** comme les chauffeurs mais **page différente qui résume TOUS les chauffeurs/trajets** (vue opérationnelle complète) + **ses finances perso**.
- **PAS d'export** (CSV/Excel) → « ça reste chez nous ». Juste un bel affichage.
- Finances manager : avances qu'on lui donne, **déductions de salaire**, solde = prochaine somme à lui verser, + onglet historique « quand / combien / pourquoi ».

## Modèle de données — DÉCIDÉ : aucun changement
`TaxiManagerPayment` actuel = `{ id, date, amount_mzn, notes }`. Logique `TaxiFinanceTab` : `balance = totalEarned(Σ margin_manager_mzn) − totalPaid(Σ amount_mzn)`.
**Décision 2026-06-30** : déductions gérées par **montant signé (option A)** — pas de champ `kind`, **pas de migration**. En pratique gui dit que ça ne sera jamais négatif ; le champ `notes` expliquera si ça arrivait. Donc le modèle reste tel quel.

## Langues — DÉCIDÉ
Chauffeur ET manager : **PT par défaut + toggle EN**. Réutiliser le même petit dico i18n PT/EN.

## Liens chauffeur — déjà OK
Un lien partagé par chauffeur (onglet Drivers → Generate link), `DriverSharePage` filtre par `taxi_driver_id` → cloisonnement strict (chacun ne voit que ses trajets + son MZN). Nouveau chauffeur = nouveau lien, rien à changer.

## « Taxi privé » (chauffeur hors manager) — DÉCIDÉ, sans migration
Convention : **`margin_manager_mzn === 0` ⟹ taxi privé** (hors manager), décidé **trajet par trajet** (pas de flag sur le chauffeur, pas de migration). Conséquences automatiques : (1) finances manager = Σ margin_manager_mzn → les privés à 0 n'ajoutent rien ; (2) vue manager filtre `margin_manager_mzn > 0` → privés invisibles pour lui ; (3) marge centre contrôlée par gui en éditant `price_eur`/`price_driver_mzn` (déjà éditables). À FAIRE : **badge « 🔒 Taxi privé / Táxi privado »** sur ces trajets dans les vues admin (List/Kanban). NB : à reconfirmer si gui veut plutôt un statut au niveau chauffeur (→ là il faudrait un flag + migration).

## Les 3 pages partagées taxi (noms finaux + Geraldo)
- **Public Taxi Schedule** (type `taxi`, `TaxiSharePage`) : tous les trajets par jour, **sans finances**, montre **places libres** (`seats − nb_persons`, « — » si pas de chauffeur, se met à jour à l'assignation). PT/EN.
- **Taxi Driver Schedule** (type `driver`, `DriverSharePage`) : 1 chauffeur, ses trajets + son MZN.
- **Taxi Manager GERALDO schedule** (type `taxi_manager`, `TaxiManagerSharePage`) : tous trajets managés + finances. **Geraldo = le manager taxi** (l'« homme de main »).
- `taxi_drivers.seats` (capacité véhicule, défaut **3**) ajouté — éditable dans le form chauffeur (onglet Drivers). 1 seul véhicule/chauffeur (gui bricolera si multi-véhicules).

## Avancement construction
- ✅ **Étape 1+2 FAITES** (commit `a1889f1`) : `taxiShareI18n.ts` + refonte `DriverSharePage.tsx` (toggles langue PT-EN / cartes-tableau / date readable-ISO, bloc « O meu dinheiro »).
- ✅ **Étape 3 FAITE** (commit `b1d75c7`, 2026-06-30) : `TaxiManagerSharePage.tsx` (type lien `taxi_manager`) — finances (comissão ganha − adiantamentos = saldo), résumé par chauffeur, viagens à venir/terminées, historique paiements ; filtre `margin_manager_mzn > 0`. + **centralisation Shared Links** (Options) : création des liens `driver` (dropdown chauffeur → param driver_id) ET `taxi_manager`. `usePref`+`Segmented` extraits dans `taxiShareUI.tsx`. Dispatch App.tsx + SharedLinkType += taxi_manager.
- ✅ **Renommages + Public Taxi Schedule PT/EN + seats FAITS** (commit `e900a54`, 2026-06-30).
- ⚠️ **À APPLIQUER par gui — 2 migrations** en **TEST puis PROD** : (1) `2026-06-30_shared_pages_security.sql` [anon taxi_manager_payments + durcissement colonnes clients/booking_participants, cf. [[security_anon_rls_exposure]]] ; (2) `2026-06-30_taxi_seats.sql` [colonne seats]. Et **push** commits `a1889f1`/`b1d75c7`/`991083c`/`c4bab93`/`e900a54` (+ Vercel).
- ✅ **Étape 4 FAITE** (commit `4364316`) : badge « 🔒 Private » dans vues admin List/Kanban pour `margin_manager_mzn === 0`.
- ⚠️ **Migration enum oubliée** (commit `1d71a9c`) : `shared_link_type` est un ENUM Postgres ; `taxi_manager` ajouté côté TS mais pas en base → création du lien Geraldo échouait. Migration `2026-06-30_taxi_manager_enum.sql` (`ALTER TYPE ADD VALUE`) **à appliquer TEST+PROD** par gui. **Leçon** : tout nouveau type de shared_link (ou tout nouvel enum) nécessite une migration `ALTER TYPE`, pas juste le type TS.
- 📌 gui a appliqué les migrations `shared_pages_security` + `taxi_seats` (2026-06-30). Restent à appliquer : `taxi_manager_enum` + diagnostic `diagnostics_taxi_pricing`.
- NB : `activity_provider` reste exclu du form Shared Links (a son propre flux dans ActivitiesPage) — cf. [[feedback_shared_links_central]] si on veut tout centraliser plus tard.
