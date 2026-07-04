---
name: Supabase Realtime — plan d'implémentation
description: Plan complet pour remplacer le polling manuel par des WebSocket postgres_changes dans useTable
type: project
---

## Objectif
Remplacer le polling manuel (`refresh()`) par des subscriptions `postgres_changes` Supabase dans `useTable`.
Résultat : les 2 admins voient les changements en temps réel sans F5, sur toutes les pages.

**Why:** Actuellement si l'admin B modifie un booking, l'admin A ne voit rien. Priorité pour les tests à 2.

**How to apply:** Implémenter en 2 étapes parallèles (code + dashboard Supabase).

---

## Étape 1 — Code : modifier `useTable` (`client/src/hooks/useSupabase.ts`)

Ajouter un 2e `useEffect` qui subscribe à `postgres_changes`. Sur tout event (INSERT/UPDATE/DELETE),
incrémenter `tick` → déclenche le re-fetch existant. Toutes les pages deviennent automatiquement realtime.

```
useTable
  ├── useEffect [table, tick] → SELECT (déjà là)
  └── useEffect [table]       → subscribe postgres_changes → setTick (à ajouter)
```

Pattern à implémenter :
```ts
const channelName = useRef(`rt-${table}-${Math.random().toString(36).slice(2)}`)

useEffect(() => {
  const channel = supabase
    .channel(channelName.current)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      setTick(t => t + 1)
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [table])
```

**Aucun autre fichier à modifier** — tous les hooks domaine et pages héritent automatiquement.

---

## Étape 2 — Supabase Dashboard : activer la Replication

Les tables doivent être dans la publication `supabase_realtime`. Exécuter dans SQL Editor :

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE
  bookings, booking_rooms, booking_room_prices, booking_participants, payments,
  lessons, instructors, equipment_rentals, equipment,
  taxi_trips, taxi_drivers,
  activity_bookings, activity_payments, activity_providers,
  house_rentals, seasons, expenses, dining_events,
  palmeiras_rents, palmeiras_reversals, palmeiras_entries, palmeiras_sub_lets,
  external_accommodations, external_accommodation_bookings;
```

---

## Status (mars 2026)
- [ ] Étape 1 — modifier useTable
- [ ] Étape 2 — ALTER PUBLICATION en prod
