---
name: CSV import bug — Google Form wraps rows in outer quotes
description: Import clients CSV ne fonctionne pas, 0 new + unknown form
type: project
originSessionId: f1496f4c-483d-4c6a-b540-1102486c552b
---
## Problème confirmé

`parseGoogleFormsCSV` affiche "0 new" + "unknown form" pour le CSV EN.

**Why:** Le formulaire Google Forms anglais a le texte du contrat BKC (liability waiver, multi-lignes) intégré dans une colonne de l'en-tête. Google exporte ça en entourant TOUTE la ligne d'une paire de guillemets externes. Résultat : chaque ligne (header + data) est parsée comme **1 seul champ** au lieu de 30+ champs.

- `isDataRow(row)` → `row[0]` = toute la ligne → ne matche pas `TIMESTAMP_RE` → `dataRows = []`
- `detectLanguage(headerRow)` → `headerRow[13]` = `undefined` → retourne `'unknown'`

**Fichier test :** `./temp/test-import.csv` (ligne de data : Christophe Sassolas, 4 voyageurs, arrivée 04/11/2026)

## Fix nécessaire — partie 1 : unwrap des lignes outer-quoted

Dans `parseGoogleFormsCSV` (après `parseCSV(csvText)`), si une row n'a qu'1 champ et contient des virgules, re-parser ce champ comme inner CSV :

```js
const allRows = parseCSV(csvText).map(row => {
  if (row.length === 1 && row[0].includes(',')) {
    const inner = parseCSV(row[0])
    if (inner.length >= 1 && inner[0].length > 1) return inner[0]
  }
  return row
})
```

## Fix nécessaire — partie 2 : colonne mapping COL_EN

Après unwrap, `headerRow[13]` = "How did you know us?" → langue = 'en' ✓

Mais `COL_EN.traveler1Start = 20` est probablement incorrect pour cette version du formulaire. Dans les données réelles :
- Index 13 = Christophe (prénom voyageur 1)
- Index 25 = Sylvie Pernodet (contact urgence name ?)
- Index 26 = +33 6 86 87 27 24 (emergency phone)
- Index 27 = sylviecezariat@orange.fr (emergency email)
- Index 28 = Ami (emergency relation)
- Index 31 = www.bilenekite.com (how did you know us)

Mapping probable pour ce formulaire :
- `traveler1Start: 13` (au lieu de 20)
- `emergencyName: 25` (au lieu de 14)
- etc.

**→ À vérifier** : comparer header inner-parsé avec data inner-parsé pour confirmer les indices exacts.

## How to apply

Reprendre depuis `parseGoogleFormsCSV.ts` et `ImportCSVModal.tsx`. Appliquer le fix unwrap en premier, tester en dev, puis ajuster COL_EN si les voyageurs sont mal mappés.
