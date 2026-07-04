---
name: project_taxi_planning
description: Taxi planning views (Kanban/List) — Kanban deprioritized to maybe next year
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f5399f4-4b21-4223-99ba-8584a5084480
---

Le planning taxi (`TaxiPage` onglet Planning) a 2 vues du même `taxi_trips` : **Kanban** (`TaxiKanbanView`, colonnes par chauffeur + drag&drop) et **List** (`TaxiListView`, tableau trié/filtré). Commun : `SummaryTable` (Completed/Planned/Total), 3 statuts (confirmed/needs_details/done), lien booking pré-remplit pax/bagages, marge centre via `computeTaxiMarginEur` au taux global.

**Décision (2026-06-30)** : la vue **Kanban est mise de côté** — on s'en occupera peut-être l'année prochaine. Pour l'instant on se concentre sur la vue **List**.

**Why** : priorité ailleurs ; le Kanban n'est pas le point de douleur actuel.

**How to apply** : ne pas investir d'effort sur le Kanban (refacto, features). La duplication de code Kanban↔List (`SummaryTable`, `TRIP_TYPE_LABELS`, `STATUS_CONFIG`, modale d'édition) n'est PAS à factoriser tant que le Kanban reste gelé — factoriser n'aurait de sens que si on garde les deux. Si on améliore le planning taxi, le faire sur la **List view** uniquement.
