# Sécurité & RLS — accès `anon` et pages partagées

> **À lire avant de créer une page partagée OU d'ajouter une policy `anon` dans `schema.sql`.**
> Ce fichier explique ce qui est exposé publiquement, pourquoi, et la checklist pour ne pas créer de fuite.

## Le modèle de sécurité en une phrase

L'app n'a **pas de serveur** : le front React parle directement à Supabase avec la **clé `anon`**, qui est **PUBLIQUE** (livrée dans le bundle JS, récupérable par n'importe qui). La seule protection des données = **les policies RLS**. Donc :

> ⚠️ **Une policy `FOR SELECT TO anon USING (true)` rend TOUTE la table lisible par TOUT LE MONDE sur Internet**, pas seulement par les pages de l'app.

## Cause racine (la leçon à retenir)

Le filtre `.eq('booking_id', id)` dans le code des pages partagées **n'est PAS une sécurité** : c'est l'app qui *demande poliment* une ligne. La base, elle, applique la RLS. Si la policy est `USING (true)`, n'importe qui peut ignorer le filtre de l'app et tout lire via l'API. **La règle de filtrage doit vivre dans la base (RLS / privilèges colonne / Edge Function), jamais seulement dans le `.select()` côté client.** C'est exactement comme ça que les passeports se sont retrouvés exposés (policy large posée par simplicité quand on a branché ClientSharePage sur les tables source en mars 2026).

## Le piège à connaître absolument : token ≠ protection

Les liens partagés (`?share=<token>`) **ne protègent PAS les données**. Le token sert uniquement à **router l'UI** côté React (`App.tsx` choisit quelle page afficher). Les données, elles, sont lues par la clé `anon` via l'API REST Supabase.

Conséquence : quelqu'un qui extrait la clé `anon` du bundle peut taper `GET /rest/v1/clients?select=*` et **tout lire**, sans aucun token. Le token ne ralentit même pas.

## Ce qui est exposé en lecture publique aujourd'hui (`USING (true)`)

> **Mise à jour 2026-06-30** : `clients` et `booking_participants` sont désormais **restreintes par colonne** pour `anon` (voir migration `2026-06-30_shared_pages_security.sql`). `anon` n'y lit plus que `id / first_name / last_name` (+`booking_id`) — passeports, emails, téléphones, dates de naissance, contacts d'urgence et notes ne sont **plus** exposés.
> **Mise à jour 2026-07-04 (Lot B)** : `bookings` restreinte par colonne aussi (migration `2026-07-04_lot_b_bookings_columns.sql`) : `anon` ne lit que `id / booking_number / check_in / check_out / status / client_id / num_center_access / center_access_rate` — contacts d'urgence, notes, amount_paid, dates visa, waiver, referral_source ne sont **plus** exposés. ⚠️ Tout `.select()` anon sur bookings doit lister ces colonnes explicitement (`*` → 42501).

| Table | Sensibilité | Exposée pour quelle page |
|-------|-------------|--------------------------|
| `clients` | 🟢 **identité only** (id, prénom, nom) — email/tél/passeport/naissance/contacts d'urgence **bloqués** | ClientSharePage, ForecastSharePage |
| `booking_participants` | 🟢 **identité only** (id, prénom, nom) — passeport/notes/client_id **bloqués** | ClientSharePage |
| `bookings` | 🟢 **planning only** (id, n°, dates, status, client_id, center access) — contacts urgence/notes/amount_paid/visa/waiver **bloqués** | ClientSharePage / RestaurantSharePage / embeds taxi |
| `booking_rooms`, `booking_room_prices` | 🟠 chambres + prix | ClientSharePage / Forecast |
| `payments` | 🔴 **finances** (montants, paiements) | ClientSharePage |
| `taxi_trips`, `taxi_drivers` | 🟠 trajets + tarifs | Taxi / Driver share |
| `taxi_manager_payments` | 🔴 **finances** (commissions, avances) | TaxiManagerSharePage |
| `lessons` | 🟠 cours — inclut `price_per_hour`, le prix **client** figé (c'est ce que la page client affiche) | ClientSharePage / Forecast |
| `instructors` | 🟢 **identité only** (id, prénom, nom) — `rate_*` = **paie**, révoqué depuis `2026-07-29_lesson_pricing.sql` | ClientSharePage / Forecast |
| `lesson_rate_overrides` | ⛔ **non exposée** — exception sur la paie d'un moniteur (révoquée le 2026-07-29) | — |
| `activity_providers`, `activity_bookings`, `activity_payments` | 🟠 activités + finances | ActivityProviderSharePage |
| `equipment`, `equipment_rentals` | 🟡 matériel | ClientSharePage |
| `dining_events` | 🟡 repas | ClientSharePage |
| `external_accommodations`, `external_accommodation_bookings` | 🟡 hébergements ext. | ClientSharePage |
| `rooms`, `accommodations` | 🟢 référentiel | Forecast / Client |

**Bonnes nouvelles (ce qui est correct) :**
- `anon` ne peut que **lire** ces tables — **aucune écriture/suppression** possible (sauf le cas ci-dessous).
- `shared_links` : **aucune lecture anon directe** (depuis Lot A 2026-07-02) — résolution via la RPC `resolve_share_token(token)` (SECURITY DEFINER, token exact + actif + non expiré requis) → plus d'énumération possible des tokens.
- `get_db_stats()` : EXECUTE révoqué pour PUBLIC/anon (Lot A 2026-07-02), admin only.
- `form_submissions` : `anon` peut **INSÉRER** uniquement en `status = 'pending'`, et **ne peut rien lire** (les soumissions ne fuient pas).
- Tables **non exposées** (donc privées) : `expenses`, `instructor_debts/payments`, `palmeiras_*`, `email_logs`, `seasons`, `house_rentals`, `room_rates`, `price_items`, `day_activities`, `taxi_pricing_defaults`, `document_templates` (REVOKE anon explicite), `lesson_rate_overrides` (depuis 2026-07-29), `form_submissions` (lecture).

⚠️ **Piège vécu (2026-07-29)** : révoquer des colonnes casse tout `.select()` anon qui les
liste encore — la requête entière part en **42501** et la page se vide. En révoquant
`instructors.rate_*`, `ClientSharePage` avait été narrowée mais **`ForecastSharePage` avait
été oubliée** (elle sur-récupérait les tarifs sans jamais s'en servir). Aucun lien `forecast`
n'était actif, donc rien n'a cassé en production, mais le réflexe est : après tout REVOKE de
colonne, **grepper le repo** pour la colonne et vérifier chaque page partagée.

## Le risque réel, calibré

- **Type** : fuite de **lecture** de données perso (passeports, emails) et financières. Pas d'intrusion, pas de modification possible.
- **Probabilité** : faible (app de niche, non indexée, pas de cible évidente) mais **non nulle** (clé triviale à extraire).
- **Impact** : moyen→élevé (données RGPD-sensibles : passeports). À prendre au sérieux même à petite échelle.

## ✅ Checklist — avant d'ajouter une page partagée ou une policy `anon`

1. **Ai-je vraiment besoin d'exposer cette table en `anon` ?** Si la donnée n'est lue que par un admin connecté → **NON**, pas de policy anon.
2. **Quelles colonnes sont réellement nécessaires** à la page publique ? `USING (true)` expose **toutes** les colonnes et **toutes** les lignes.
3. **La table contient-elle du 🔴 perso/financier ?** Si oui, signale-le ici et préfère une approche durcie (ci-dessous).
4. **Mettre à jour ce fichier** (tableau ci-dessus) + `schema.sql` + une **migration** datée à appliquer TEST → PROD.
5. Ne jamais croire que le token protège : il ne protège pas.

## Durcissement — plan validé par gui (3 lots + phase 2, suivi dans `BACKLOG.md`)

- **Lot A ✅ fait (2026-07-02)** : `get_db_stats()` admin-only, `shared_links` non listable, RPC `resolve_share_token`.
- **Lot B ✅ fait (2026-07-04)** : GRANT colonnes sur `bookings` + narrowing du `select('*')` de ClientSharePage.
- **Lot C ✅ fait (2026-07-06, décisions gui)** : GRANT colonnes sur les 3 tables restantes (migration `2026-07-06_lot_c_columns.sql`) + narrowing des `select('*')` des 6 pages partagées. `instructors` → identité + tarifs (nécessaires au détail de prix de ClientSharePage) ; `taxi_drivers` → id/name/**phone** (gardé volontairement : appeler son taxi)/vehicle/seats — jamais email/notes/margin_percent/tarifs par défaut ; `activity_providers` → fiche publique sans les notes internes.
- **Phase 2 ✅ implémentée (2026-07-06)** : **RLS token-aware** — le front des pages partagées envoie le token dans le header `x-share-token` (`client/src/lib/supabase.ts`) et TOUTES les policies anon SELECT exigent un `shared_link` actif du bon type, scopé à SES lignes (token client → son booking, driver → ses trajets, manager → trajets avec commission, etc.). **Sans token valide, `anon` ne lit plus AUCUNE ligne.** Migration : `2026-07-06_phase2_token_rls.sql` ; matrice d'accès et pièges : `phase2-rls-token-aware.md`. Conséquences : le tableau « exposé » ci-dessus se lit désormais « exposé au porteur d'un token du bon type » ; les pages partagées perdent le live-update Realtime (le websocket n'envoie pas le header) — elles chargent normalement au refresh ; tout nouveau type de lien doit être ajouté aux policies.

## Autres surfaces (rappel)
- **Clé `anon`** publique = normal (Supabase), la sécurité repose sur RLS.
- **2 comptes admin** créés manuellement (pas d'inscription publique).
- **PAT Supabase** créé le 2026-06-26 à révoquer (cf. mémoire `feedback_revoke_supabase_token`).
