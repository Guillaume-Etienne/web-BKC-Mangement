# CashFlow — sorties MZN chauffeurs & manager (design, 2026-07-04)

> **Statut : DESIGN — rien d'implémenté.** Une question opérationnelle (Q1) à poser à gui,
> puis l'implémentation est mécanique (voir §4). Contexte : audit 2026-07-02 — le « Net cash »
> de CashFlow est optimiste car les décaissements taxi (MZN) n'y figurent pas.

## 1. État des lieux (vérifié dans le code le 2026-07-04)

CashFlow (`components/accounting/CashFlow.tsx`) : sorties = `expenses` + `palmeirasRents`
+ `instructorPayments`. **Manquent** : ce qu'on verse aux chauffeurs et à Geraldo (manager).

- **Manager** : les versements réels SONT saisis — table `taxi_manager_payments`
  (`date, amount_mzn, notes`, alimentée via TaxiFinanceTab). Ils ne sont juste **pas branchés**
  dans CashFlow (pas dans `SharedAccountingData`).
- **Chauffeurs** : AUCUNE table de décaissement. Le dû est calculable (`price_driver_mzn` par
  trajet) mais la date/le fait du paiement ne sont enregistrés nulle part.

## 2. Manager — pas de décision à prendre

Brancher `taxi_manager_payments` (cash réel, daté) dans CashFlow, converti au taux global
`eurMznRate` (déjà dans `SharedAccountingData`). Zéro migration, zéro saisie en plus.

## 3. Chauffeurs — 3 options, dépend de **Q1**

> **Q1 (gui)** : en pratique, tu payes les chauffeurs **quand** ? (a) cash au trajet /
> dans la foulée ; (b) regroupé (fin de semaine / fin de mois) ; (c) ça dépend.

| Option | Principe | Migration | Saisie gui | Exactitude cash |
|---|---|---|---|---|
| **A — proxy par trajet** (reco si Q1=a) | Sortie = `price_driver_mzn` des trajets `status='done'`, au mois du trajet, ÷ taux global | aucune | aucune | bonne si payés au trajet |
| **B — table `taxi_driver_payments`** (reco si Q1=b) | Comme le manager : table (`driver_id, date, amount_mzn, notes`) + UI dans TaxiFinanceTab/DriverStatementPanel + solde par chauffeur (earned − paid) | 1 table + RLS admin | à chaque paiement | exacte |
| **C — à la main dans Expenses** | gui saisit une expense mensuelle « Drivers sept » | aucune | mensuelle, manuelle | dépend de la discipline |

**Reco** : si les chauffeurs sont payés au trajet (vraisemblable), **A** — zéro friction, cash
quasi exact. B seulement si gui veut suivre des soldes chauffeurs (avances, retards). Éviter C.
NB : A et B peuvent coexister plus tard (A = défaut, B si besoin de soldes) ; commencer par A.

## 4. Implémentation (option A + manager) — runbook Opus

1. `SharedAccountingData` (`accounting/types.ts`) : + `taxiManagerPayments: TaxiManagerPayment[]`.
2. `AccountingPage` : + `useTable<TaxiManagerPayment>('taxi_manager_payments')` → passer dans
   `sharedData` (pattern des 21 hooks existants).
3. `CashFlow.tsx` :
   - `MonthRow` : + `taxiOut: number` ;
   - agrégation : trajets `status === 'done'` → `taxiOut += price_driver_mzn / eurMznRate` au
     mois du trajet ; manager payments → `taxiOut += amount_mzn / eurMznRate` au mois du
     paiement ;
   - `net = collected + palmIn − expenses − rent − instrPaid − taxiOut` ;
   - table : + colonne « Taxi out » (rouge) ; KPI « Total out » : + taxiOut ; légende : « Taxi
     out = drivers (per done trip) + manager payments, MZN→€ at global rate ».
4. Build + smoke : vérifier avec le seed TEST (trips done + saldo Geraldo) que les mois bougent.

**Caveats assumés** (les documenter dans la légende, pas de sur-ingénierie) :
- Conversion au **taux global actuel**, y compris pour les mois passés — même approximation
  que la marge taxi du dashboard, cohérent partout.
- Ne PAS confondre avec la card « Taxi costs » du dashboard (P&L en engagé) : CashFlow = cash ;
  les deux vues divergent légitimement (un trajet done non encore payé à Geraldo).
- Trajets des bookings annulés : jamais `done` → exclus naturellement.
