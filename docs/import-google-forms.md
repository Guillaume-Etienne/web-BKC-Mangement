# Import Google Forms → CRM

## Implémentation — ce qui a été fait

- `client/src/types/database.ts` — 5 nouveaux champs sur `Client` + 4 sur `Booking` (`import_id` + emergency contact)
- `client/src/data/mock.ts` — mocks mis à jour avec les nouveaux champs à `null`
- `client/src/utils/parseGoogleFormsCSV.ts` — parser complet : détection FR/EN, extraction 1 à 4 voyageurs, calcul dates, déduplication par timestamp
- `client/src/components/clients/ImportCSVModal.tsx` — modal 4 étapes : Pick → Review → Conflicts → Confirm
- `client/src/pages/ClientsPage.tsx` — bouton "Import CSV" + gestion d'état locale
- `client/src/pages/BookingsPage.tsx` — wizard mis à jour pour les nouveaux champs

Points techniques notables :
- Le parser gère le bug des années (`0024` → `2024`) présent dans de vrais enregistrements du CSV
- Les lignes CGU en tête de fichier sont filtrées automatiquement via regex sur le timestamp
- Réimport idempotent : même CSV importé 10 fois = même résultat, seules les nouvelles lignes passent
- Les conflits résolus ne réapparaissent jamais (timestamp marqué comme traité)

---

## Contexte

Les clients remplissent un formulaire Google avant leur arrivée (1 par langue : FR, EN, ES à venir).
L'export Google Sheets → CSV est ensuite importé manuellement dans l'app via la page Clients.

Formulaires actuels :
- `INFORMATION CLIENT FRANÇAIS (Responses) - Form responses 1.csv`
- `TRAVELERS INFORMATION ENGLISH (Responses) - Form responses 1.csv`

---

## Structure des CSV

### Particularité : les lignes CGU

Les CSV Google Forms incluent le texte des conditions générales en tête de fichier (multi-ligne dans la dernière colonne du header).
**Les vraies données commencent à la première ligne dont la col 1 ressemble à un timestamp** (`DD/MM/YYYY HH:MM:SS`).

### Différences FR vs EN

| Champ | FR (col index) | EN (col index) |
|---|---|---|
| Timestamp | 0 | 0 |
| Référent groupe | 1 | 1 |
| Nb personnes | 2 | 2 |
| Nb nuits | 3 | 3 |
| Date arrivée Maputo | 4 | 4 |
| Heure arrivée | 5 | 5 |
| Date départ | 6 | 6 |
| Heure vol retour | 7 | 7 |
| Transport aéroport | 8 | 8 |
| Nb bagages standard | 9 | 9 |
| Nb bagages kitesurf | 10 | 10 |
| Nb lits doubles | 11 | 11 |
| Nb lits simples | 12 | 12 |
| **Comment nous avez-vous connus** | *(absent / col finale)* | **13** |
| **Contact urgence nom** | **25** | **14** |
| **Contact urgence tél** | **26** | **15** |
| **Contact urgence email** | **27** | **16** |
| **Contact urgence relation** | **28** | **17** |
| Assurance voyage | 29 | 18 |
| Acceptation CGU | 30 | 19 |
| **Voyageur 1 prénom** | **13** | **20** |
| **Voyageur 1 nom** | **14** | **21** |
| **Voyageur 1 passeport** | **15** | **22** |
| Voyageur 2 prénom | 16 | 23 |
| Voyageur 2 nom | 17 | 24 |
| Voyageur 2 passeport | 18 | 25 |
| Voyageur 3 prénom | 19 | 26 |
| Voyageur 3 nom | 20 | 27 |
| Voyageur 3 passeport | 21 | 28 |
| Voyageur 4 prénom | 22 | 29 |
| Voyageur 4 nom | 23 | 30 |
| Voyageur 4 passeport | 24 | 31 |

> **Détection automatique de la langue** : on compare les en-têtes par nom de colonne (pas par index),
> car l'ordre varie entre FR et EN. Clé de détection : si col[13] contient "How did you know" → EN, sinon → FR.

---

## Mapping vers les types de l'app

### Client (1 à 4 par ligne CSV)

| Champ `Client` | Source CSV |
|---|---|
| `first_name` | Prénom voyageur N |
| `last_name` | Nom voyageur N |
| `passport_number` | Passeport voyageur N |
| `email` | *(absent dans le formulaire — null)* |
| `phone` | *(absent dans le formulaire — null)* |
| `import_id` | Timestamp de la ligne (col 0) |

### Booking (1 par ligne CSV)

| Champ `Booking` | Source CSV | Notes |
|---|---|---|
| `check_in` | Date arrivée Maputo | format DD/MM/YYYY → YYYY-MM-DD |
| `check_out` | calculé : check_in + nb nuits | |
| `arrival_time` | Heure arrivée | format HH:MM:SS → HH:MM |
| `departure_time` | Heure vol retour | |
| `taxi_arrival` | Transport aéroport | "Oui" / "Yes" → true |
| `taxi_departure` | Transport aéroport retour | même champ — toujours true si renseigné |
| `luggage_count` | Nb bagages standard | |
| `boardbag_count` | Nb bagages kitesurf | |
| `status` | **`'confirmed'`** | Le client n'envoie le formulaire que s'il est sûr de venir |
| `import_id` | Timestamp de la ligne (col 0) | |
| `client_id` | ID du voyageur 1 (référent groupe) | |
| `participants` | Voyageurs 2-4 | liés au booking |

### Contact d'urgence (stocké sur Client ET Booking)

Le contact d'urgence est stocké **sur le `Client` (voyageur 1)** et **sur le `Booking`**.
Champs à ajouter aux types :

```ts
// Sur Client
emergency_contact_name?: string | null
emergency_contact_phone?: string | null
emergency_contact_email?: string | null
emergency_contact_relation?: string | null

// Sur Booking (copie au moment de l'import)
emergency_contact_name?: string | null
emergency_contact_phone?: string | null
emergency_contact_email?: string | null
```

---

## Déduplication — clé naturelle : le Timestamp Google Forms

Chaque soumission de formulaire a un timestamp unique (col 0, ex: `14/07/2024 15:32:02`).
Ce timestamp est stocké comme `import_id` sur les `Client` et `Booking` créés.

**Règle :** à la réimport, si `import_id` est déjà présent dans la base → ligne ignorée silencieusement.
→ On peut réimporter le même CSV 10 fois sans effet de bord, seules les nouvelles lignes passent.
→ Les conflits une fois résolus ne réapparaissent jamais.

---

## Flux d'import (4 étapes UI)

### Étape 1 — Parse
- Détection de la langue via les en-têtes
- Ignorer les lignes avant le premier timestamp
- Classifier chaque ligne :
  - ✅ **NEW** — timestamp inconnu, aucun passeport connu
  - ⏭ **SKIP** — timestamp déjà importé (import_id existe)
  - ⚠️ **CONFLICT** — passeport connu mais données différentes (nom, etc.)

### Étape 2 — Revue
- Tableau résumé : N nouvelles lignes, X à ignorer, Y conflits
- Les SKIP sont masqués par défaut (section repliable)
- Les CONFLICTS sont mis en évidence en haut

### Étape 3 — Résolution des conflits
- Pour chaque ⚠️ : carte côte-à-côte "Existant dans l'app" vs "Nouveau dans le CSV"
- Choix : **Garder l'existant** / **Prendre le CSV** / **Merger champ par champ**
- Une fois résolu, le timestamp est marqué comme traité → ne réapparaît jamais

### Étape 4 — Confirmation
- Résumé final : "X clients créés, Y bookings créés, Z ignorés"
- Bouton **Import**

---

## Types à modifier

```ts
// database.ts — champs à ajouter

interface Client {
  // ... champs existants ...
  import_id: string | null                  // timestamp Google Forms
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_email: string | null
  emergency_contact_relation: string | null
}

interface Booking {
  // ... champs existants ...
  import_id: string | null                  // timestamp Google Forms
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_email: string | null
}
```

---

## Fichiers à créer / modifier

| Fichier | Rôle |
|---|---|
| `client/src/utils/parseGoogleFormsCSV.ts` | Parser CSV + détection langue + extraction données |
| `client/src/components/clients/ImportCSVModal.tsx` | UI des 4 étapes |
| `client/src/pages/ClientsPage.tsx` | Bouton "Import CSV" + intégration modal |
| `client/src/types/database.ts` | Ajout des champs `import_id` + emergency contact |
| `client/src/data/mock.ts` | Mise à jour des mocks avec nouveaux champs |
