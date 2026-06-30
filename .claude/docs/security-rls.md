# Sécurité & RLS — accès `anon` et pages partagées

> **À lire avant de créer une page partagée OU d'ajouter une policy `anon` dans `schema.sql`.**
> Ce fichier explique ce qui est exposé publiquement, pourquoi, et la checklist pour ne pas créer de fuite.

## Le modèle de sécurité en une phrase

L'app n'a **pas de serveur** : le front React parle directement à Supabase avec la **clé `anon`**, qui est **PUBLIQUE** (livrée dans le bundle JS, récupérable par n'importe qui). La seule protection des données = **les policies RLS**. Donc :

> ⚠️ **Une policy `FOR SELECT TO anon USING (true)` rend TOUTE la table lisible par TOUT LE MONDE sur Internet**, pas seulement par les pages de l'app.

## Le piège à connaître absolument : token ≠ protection

Les liens partagés (`?share=<token>`) **ne protègent PAS les données**. Le token sert uniquement à **router l'UI** côté React (`App.tsx` choisit quelle page afficher). Les données, elles, sont lues par la clé `anon` via l'API REST Supabase.

Conséquence : quelqu'un qui extrait la clé `anon` du bundle peut taper `GET /rest/v1/clients?select=*` et **tout lire**, sans aucun token. Le token ne ralentit même pas.

## Ce qui est exposé en lecture publique aujourd'hui (`USING (true)`)

| Table | Sensibilité | Exposée pour quelle page |
|-------|-------------|--------------------------|
| `clients` | 🔴 **perso** (noms, emails, téléphones) | ClientSharePage |
| `booking_participants` | 🔴 **perso** (passeports !, niveaux, notes) | ClientSharePage |
| `bookings`, `booking_rooms`, `booking_room_prices` | 🟠 résa + prix | ClientSharePage / Forecast |
| `payments` | 🔴 **finances** (montants, paiements) | ClientSharePage |
| `taxi_trips`, `taxi_drivers` | 🟠 trajets + tarifs | Taxi / Driver share |
| `taxi_manager_payments` | 🔴 **finances** (commissions, avances) | TaxiManagerSharePage |
| `lessons`, `instructors`, `lesson_rate_overrides` | 🟠 cours + tarifs instructeurs | ClientSharePage / Forecast |
| `activity_providers`, `activity_bookings`, `activity_payments` | 🟠 activités + finances | ActivityProviderSharePage |
| `equipment`, `equipment_rentals` | 🟡 matériel | ClientSharePage |
| `dining_events` | 🟡 repas | ClientSharePage |
| `external_accommodations`, `external_accommodation_bookings` | 🟡 hébergements ext. | ClientSharePage |
| `rooms`, `accommodations` | 🟢 référentiel | Forecast / Client |

**Bonnes nouvelles (ce qui est correct) :**
- `anon` ne peut que **lire** ces tables — **aucune écriture/suppression** possible (sauf le cas ci-dessous).
- `shared_links` : policy correcte (`is_active = true AND non expiré`).
- `form_submissions` : `anon` peut **INSÉRER** uniquement en `status = 'pending'`, et **ne peut rien lire** (les soumissions ne fuient pas).
- Tables **non exposées** (donc privées) : `expenses`, `instructor_debts/payments`, `palmeiras_*`, `email_logs`, `seasons`, `house_rentals`, `room_rates`, `price_items`, `day_activities`, `taxi_pricing_defaults`, `form_submissions` (lecture).

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

## Durcissement recommandé (chantier futur, non fait)

Pour supprimer la fuite sans casser les pages partagées, par ordre de préférence :
1. **Edge Functions** (service role) : la page publique appelle une fonction qui valide le token et ne renvoie **que** les données autorisées (colonnes + lignes filtrées). C'est le plus propre.
2. **RLS token-aware** : passer le token de partage à la requête et vérifier dans `shared_links` (plus complexe, couple chaque table au token).
3. **Vues `security_invoker` filtrées** exposées à `anon` à la place des tables brutes (limite au moins les colonnes).

> Tant que ce n'est pas fait, considérer toutes les tables du tableau comme **publiques**. Ne jamais y stocker un secret.

## Autres surfaces (rappel)
- **Clé `anon`** publique = normal (Supabase), la sécurité repose sur RLS.
- **2 comptes admin** créés manuellement (pas d'inscription publique).
- **PAT Supabase** créé le 2026-06-26 à révoquer (cf. mémoire `feedback_revoke_supabase_token`).
