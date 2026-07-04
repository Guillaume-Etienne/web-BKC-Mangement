---
name: audit-2026-07-general-review
description: "Revue générale 2026-07-02 (docs + code + sécu) — 2 doubles comptages dans le Net result du dashboard compta, trous sécu anon restants (bookings, get_db_stats, shared_links)"
metadata: 
  node_type: memory
  type: project
  originSessionId: e767802a-6814-4e71-b7fb-69050c1d49c7
---

Revue générale du 2026-07-02. **Points compta 1–3 CORRIGÉS le jour même** (refonte AccountingDashboard, voir components.md § AccountingDashboard). Sécu = toujours à faire.

**✅ Compta — corrigé 2026-07-02 (gui a confirmé : paiements chauffeurs/manager et coûts bungalows ne sont saisis NI en Expenses ni ailleurs) :**
1. ~~Taxi double compté~~ → dashboard passé en brut facturé + card « Taxi costs » (driver+manager MZN→€ au taux global) soustraite du net, marge en sous-titre.
2. ~~Marge bungalows double comptée~~ → card « Bungalow owners » (cost_per_night × nuits) soustraite du net ; « Palmeiras net » = reversals + entries − rent (sans marge bungalow, détail dans PalmeirasTab).
3. ~~KPI Outstanding/Collected incohérent~~ → Collected/Outstanding basés sur `billedNet` (Σ computeBookingTotal − discounts, bookings actifs) ; activités en brut (price_client / reversal) + card « Activity providers » en coût ; trips/activités des bookings annulés exclus des deux côtés. `computeActivityNetRevenue` supprimée (plus utilisée).
4. 🟡 Reste ouvert — CashFlow : le net cash mensuel ne compte pas les sorties chauffeurs/manager MZN (elles ne sont saisies nulle part) → cash net optimiste ; à traiter un jour si gui veut un cash-flow exact.

**🔒 Sécu (anon) restant après le durcissement 2026-06-30 :**
- 🔴 `bookings` entièrement lisible anon (`USING true`, pas de GRANT colonne) : emergency_contact_*, notes, amount_paid, visa dates, waiver, referral_source publics. ClientSharePage fait `select('*')` sur bookings → à rétrécir en même temps qu'un GRANT colonne (comme clients/booking_participants).
- 🟠 `get_db_stats()` SECURITY DEFINER : EXECUTE est PUBLIC par défaut en Postgres → probablement appelable par anon via RPC. Fix : `REVOKE EXECUTE ON FUNCTION get_db_stats() FROM PUBLIC, anon;`.
- 🟠 `shared_links` : la policy anon permet de LISTER tous les tokens actifs (`GET /rest/v1/shared_links?select=token`) → énumération de tous les liens partagés. Vrai fix = RPC de validation de token (lié au chantier Edge Functions de [[security-rls]]).
- 🟠 `instructors` / `taxi_drivers` / `activity_providers` : phone/email/notes lisibles anon (déjà connu 🟠 dans security-rls.md). Durcissement colonne possible ; attention ClientSharePage a besoin des rates instructeurs.

**✅ Sain :** build TS strict OK ; tous les `.order()` sur colonnes existantes ; computeBookingTotal agrège bien les 7 postes ; share pages récentes bien durcies (clients/participants colonnes identité) ; CashFlow cohérent ; docs .claude/docs à jour sauf 2 broutilles : INDEX.md ligne 44 mentionne encore `schemaOutdated` (supprimé mai 2026), commentaire shared_links dans schema.sql liste 5 types au lieu de 7 (manque taxi_manager, booking_form).
