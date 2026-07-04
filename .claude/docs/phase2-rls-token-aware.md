# Phase 2 — RLS token-aware (design, 2026-07-04)

> **Statut : DESIGN — rien d'implémenté.** Écrit par Fable avant le passage à Opus, pour que
> l'implémentation soit mécanique. Lire d'abord `security-rls.md` (état actuel) et suivre le
> § Rollout à la lettre (l'ordre front → TEST → PROD évite de casser les pages en prod).

## 1. Objectif

Après les Lots A/B (colonnes), `anon` lit encore **toutes les LIGNES** des tables exposées :
n'importe qui avec la clé anon liste tous les bookings (dates/statuts/n°), tous les noms de
clients/participants, tous les trajets taxi avec tarifs, toutes les commissions manager.
Cible : **`anon` ne lit une ligne que s'il présente un token de partage actif qui y donne droit.**
Sans token → rien. Token `client` → uniquement le booking du token. Token `driver` → uniquement
les trajets de ce chauffeur. Etc.

## 2. Mécanisme retenu (décision gui 2026-07-02 : pas d'Edge Functions)

Le front envoie le token dans un **header `x-share-token`** sur chaque requête REST.
PostgREST expose les headers à SQL via `current_setting('request.headers', true)`.
Des **fonctions helper** valident le token une fois, les **policies anon** s'en servent.

### 2.1 Helpers SQL (sketch)

```sql
-- Le lien actif correspondant au header, ou NULL. STABLE = évalué 1×/statement.
CREATE OR REPLACE FUNCTION share_ctx() RETURNS shared_links
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.* FROM shared_links s
  WHERE s.token = current_setting('request.headers', true)::json->>'x-share-token'
    AND s.is_active
    AND (s.expires_at IS NULL OR s.expires_at >= CURRENT_DATE)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION share_type() RETURNS shared_link_type
LANGUAGE sql STABLE AS $$ SELECT (share_ctx()).type $$;

-- L'id du booking ciblé par un token 'client' (params.booking_number), sinon NULL
CREATE OR REPLACE FUNCTION share_booking_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id FROM bookings b
  WHERE (share_ctx()).type = 'client'
    AND b.booking_number = ((share_ctx()).params->>'booking_number')::int;
$$;
```

`REVOKE EXECUTE … FROM PUBLIC; GRANT EXECUTE … TO anon, authenticated;` sur les trois.
⚠️ `share_booking_id()` est SECURITY DEFINER car il lit `bookings` hors policy.

### 2.2 Changement front (minuscule)

`client/src/lib/supabase.ts` : le module lit déjà l'URL au boot ; ajouter :

```ts
const shareToken = new URLSearchParams(window.location.search).get('share')
// dans createClient(url, key, {...}) :
...(shareToken ? { global: { headers: { 'x-share-token': shareToken } } } : {})
```

Toutes les pages partagées (elles vivent sous `?share=…`) envoient alors le header
automatiquement — **aucun changement dans les pages**. L'app admin connectée n'a pas de
`?share=` → pas de header → rôle `authenticated`, policies admin inchangées.

## 3. Matrice d'accès (inventaire du 2026-07-04, vérifié dans le code)

Légende : **cible** = lignes du token seulement · **toutes** = toutes les lignes si token de ce
type · — = pas d'accès. Une table absente d'une colonne = ce type n'y accède pas.

| Table | client (booking_number) | forecast | taxi | driver (driver_id) | taxi_manager | activity_provider (provider_id) | restaurant |
|---|---|---|---|---|---|---|---|
| bookings | cible (`id = share_booking_id()`) | — | toutes (id/client_id pour noms) | toutes (embed noms) | toutes (embed noms) | — | toutes |
| clients | cible (client du booking) | toutes (noms) | toutes (noms) | toutes (noms) | toutes (noms) | — | toutes (noms) |
| booking_participants | cible (`booking_id`) | — | — | — | — | — | — |
| booking_rooms / booking_room_prices | cible (`booking_id`) | — | — | — | — | — | — |
| payments | cible (`booking_id`) | — | — | — | — | — | — |
| lessons | cible (`booking_id`) | toutes | — | — | — | — | — |
| equipment_rentals | cible (`booking_id`) | toutes | — | — | — | — | — |
| taxi_trips | cible (`booking_id`) | — | toutes | cible (`taxi_driver_id`) | toutes¹ | — | — |
| external_accommodation_bookings | cible (`booking_id`) | — | — | — | — | — | — |
| activity_bookings | cible (`booking_id`) | — | — | — | — | cible (`provider_id`) | — |
| activity_payments | — | — | — | — | — | cible (`provider_id`) | — |
| activity_providers | — | — | — | — | — | cible (`id`) | — |
| taxi_drivers | — | — | toutes | cible (`id`) | toutes | — | — |
| taxi_manager_payments | — | — | — | — | toutes | — | — |
| dining_events | toutes² | — | — | — | — | — | — |
| lesson_rate_overrides | toutes² | — | — | — | — | — | — |
| **Référentiel** : rooms, accommodations, instructors, equipment, external_accommodations | toutes (n'importe quel token valide) | idem | idem | idem | idem | idem | idem |

¹ TaxiManagerSharePage filtre `margin_manager_mzn > 0` côté JS ; on PEUT le remonter dans la
policy (les trajets privés deviennent invisibles au niveau DB). Recommandé : oui.
² Pas de FK vers booking : `dining_events` matche par `attendees` JSONB, les overrides par
`lesson_id`. Filtrer en SQL est possible mais lourd → **décision D1/D2 ci-dessous**.

### Pattern de policy (exemple `taxi_trips`)

```sql
DROP POLICY "anon_read_taxi_trips" ON taxi_trips;
CREATE POLICY "anon_read_taxi_trips" ON taxi_trips FOR SELECT TO anon USING (
  share_type() = 'taxi'
  OR (share_type() = 'taxi_manager' AND margin_manager_mzn > 0)
  OR (share_type() = 'driver' AND taxi_driver_id = ((share_ctx()).params->>'driver_id')::uuid)
  OR (share_type() = 'client' AND booking_id = share_booking_id())
);
```

Même gabarit pour chaque table de la matrice. Référentiel : `USING (share_ctx() IS NOT NULL)`.
⚠️ Les GRANT colonnes des Lots A/B **restent** : colonnes et lignes se composent (AND).

## 4. Pièges connus (à ne pas redécouvrir)

1. **Ordre de déploiement** : le front DOIT envoyer le header AVANT que les policies ne
   l'exigent, sinon toutes les pages partagées déployées cassent (cf. § Rollout).
2. **Realtime** : `useTable` s'abonne à `postgres_changes` ; le websocket n'envoie PAS le header
   → RLS y refusera tout → **les pages partagées perdent le live-update** (elles chargent
   normalement au refresh). Dégradation acceptée — personne ne regarde ces pages en continu.
3. **Embeds** : `booking:bookings(client:clients(…))` exige que la policy de CHAQUE table passe
   pour le même token (d'où bookings/clients « toutes » pour taxi/driver/manager/restaurant).
4. **`resolve_share_token(p_token)`** : inchangé — il prend le token en argument, pas en header.
5. **Header en minuscules** dans `request.headers` (`x-share-token`).
6. **Tester le 401 vs vide** : une policy qui ne matche pas → `[]` (200), pas une erreur.
   Les curls de vérif doivent comparer le CONTENU, pas juste le code HTTP.
7. **`shared_links` reste non-listable** (Lot A) : `share_ctx()` est SECURITY DEFINER, il n'a
   pas besoin de policy anon sur shared_links.

## 5. Décisions à prendre avec gui AVANT d'implémenter

- **D1 `dining_events`** : (a) filtrage SQL par JSONB (`EXISTS` sur booking_participants du
  booking cible ∩ attendees) — propre mais requête velue ; (b) laisser « toutes » pour token
  `client` (expose noms des convives des autres groupes + prix/repas). Reco : **(a)**.
- **D2 `lesson_rate_overrides`** : idem — (a) `lesson_id IN (SELECT id FROM lessons WHERE
  booking_id = share_booking_id())` ; (b) toutes (expose juste des tarifs). Reco : **(a)**,
  c'est une sous-requête simple.
- **D3 forecast et les noms** : ForecastSharePage affiche les noms de tous les clients — c'est
  sa raison d'être (planning cours pour l'équipe). Confirmer que ça reste « toutes ».
- **D4** : remonter le filtre `margin_manager_mzn > 0` (manager) en policy ? Reco : oui.

## 6. Rollout (runbook Opus)

1. **Front d'abord** : header `x-share-token` dans `supabase.ts` (§2.2). Build, commit, push gui,
   attendre le déploiement Vercel. **Sans risque** : header ignoré par les policies actuelles.
2. **Migration `AAAA-MM-JJ_phase2_token_rls.sql`** : helpers §2.1 + DROP/CREATE de chaque policy
   anon selon la matrice §3. Idempotente (DROP POLICY IF EXISTS). Garder le fichier en un seul
   bloc transactionnel.
3. Appliquer sur **TEST**. Smoke : ouvrir les liens du seed (client #1, driver, manager, taxi,
   forecast, restaurant, activity) — chaque page doit afficher SES données ; puis curls §7.
4. Appliquer sur **PROD le même jour** (feedback sync TEST/PROD). Re-curls sur PROD.
5. Mettre à jour `security-rls.md` (tableau → « lignes scoping par token ») + BACKLOG.

**Rollback** : re-créer les policies `USING (true)` d'avant (les garder en commentaire en tête
de la migration) — le front continue de marcher, header ou pas.

## 7. Vérification (pattern curl, clés anon dans `client/.env.local`)

```bash
# sans token → vide (200 [])
curl "$U/rest/v1/bookings?select=id" -H "apikey: $K"
# token bidon → vide
curl "$U/rest/v1/bookings?select=id" -H "apikey: $K" -H "x-share-token: nope"
# token client (seed) → exactement 1 booking
curl "$U/rest/v1/bookings?select=id,booking_number" -H "apikey: $K" -H "x-share-token: $TOKEN_CLIENT"
# token client → payments d'un AUTRE booking : vide
curl "$U/rest/v1/payments?select=id&booking_id=eq.$AUTRE" -H "apikey: $K" -H "x-share-token: $TOKEN_CLIENT"
# token driver → uniquement ses trajets ; token manager → aucun trajet margin=0
```

## 8. Effort estimé

1 migration (~150 lignes de SQL très répétitif) + ~5 lignes de front + smoke tests.
Une session Opus en suivant ce document. Les seuls points de jugement sont D1–D4 (gui).
