# Tarification des leçons — prix client vs paie moniteur

**2026-07-29** · migration `supabase/migrations/2026-07-29_lesson_pricing.sql`

## Le problème

`instructors.rate_private/rate_group/rate_supervision` servait aux **deux** côtés :
le client était facturé au tarif du moniteur, et le moniteur crédité du prix client.
Conséquences :

- marge impossible — sur un cours privé le centre gagnait **0 €** ;
- sur un cours de groupe le moniteur touchait **moins** que sur un privé, alors que le
  client, lui, payait par tête (le centre encaissait toute la différence) ;
- les tarifs saisis dans **Options → Pricing** (`price_items`, `category='lesson'`)
  n'étaient lus par **aucun** calcul — de la donnée morte.

## Le modèle retenu

| | Source | Formule |
|---|---|---|
| **Prix client** | `price_items` (Options → Pricing), figé sur la leçon | tarif horaire × durée × nb élèves si groupe |
| **Paie moniteur** | `instructors.rate_*` (Options → Instructors) | tarif horaire × durée, **à plat** |

Deux écrans, deux barèmes, aucun couplage. Un moniteur peut être à **0 €** (les
propriétaires qui donnent cours eux-mêmes) sans que ça change ce que paie le client.

Exemple — groupe 2h à 3 élèves, Pierrot à 20 €/h :
client `36 × 2 × 3 = 216 €` · Pierrot `20 × 2 = 40 €` · centre **176 €**.

## Le snapshot

`lessons.price_per_hour` fige le prix client à la création de la leçon, depuis
`price_items`. Même principe que `booking_room_prices` : **changer un tarif ne
refacture pas le passé**. `NULL` → repli sur le tarif courant.

Le prix reste éditable leçon par leçon (crayon ✏️ dans Accounting → Bookings),
utile quand une session est écourtée ou négociée sur place.

## Le lien type → tarif

Colonne explicite `price_items.lesson_type` (enum `lesson_type`), **pas** un
rapprochement par nom. Renommer « Private » en « Private lesson » aurait sinon fait
basculer la facturation sur un prix par défaut sans rien dire — le même piège que le
« full house à 100 € ». Un index unique partiel garantit un seul tarif par type.

Le sélecteur « Applies to » apparaît dans Management → Pricing dès que la catégorie
est `lesson`. Sans lien, la leçon est facturée 0 et l'écran l'affiche en rouge
(« no price configured »).

## Les remises

Deux mécanismes indépendants, qui se cumulent :

- **prix de la leçon** — ajuste ce que cette leçon coûte ;
- **discount de fin de séjour** — ligne `payments.is_discount` sur le booking,
  déduite du total tous postes confondus (`dû = total − remises − encaissé`).

Ni l'un ni l'autre ne touche à la paie du moniteur.

Le crayon ✏️ de `BookingFinances` édite désormais le **prix client**.
`lesson_rate_overrides` ne sert plus qu'aux **exceptions de paie**, depuis l'onglet
Instructors.

## 🔒 Conséquence sécurité (traitée dans la même migration)

`instructors.rate_*` était lisible par `anon` (Lot C, 2026-07-06) parce que
`ClientSharePage` s'en servait pour afficher le prix des leçons. Ces colonnes sont
devenues de la **paie** → un client muni d'un lien de partage aurait lu les salaires.

La migration révoque :

- `instructors` → `GRANT SELECT (id, first_name, last_name)` seulement ;
- `lesson_rate_overrides` → policy anon supprimée + `REVOKE` (exceptions de paie).

`ClientSharePage` lit `lessons.price_per_hour` et n'a plus besoin de rien d'autre.
⚠️ Son `select` liste les colonnes explicitement : avec l'ancien select la page
renverrait **42501** et n'afficherait plus rien.

## À faire par gui

1. Passer la migration sur **TEST et PROD**, puis les vérifications en bas du fichier
   SQL (dont le curl anon qui doit renvoyer 42501 sur `rate_private`).
2. Vérifier qu'aucune ligne de tarif de cours n'est restée `lesson_type IS NULL`
   (le seed TEST est en français — rattachement manuel probable).
3. **Options → Instructors** : mettre sa propre paie et celle de sa compagne à **0**,
   vérifier Rémi et Tere (encore aux défauts 50/35/25 ; seul Pierrot est renseigné).

## Tests

`client/src/components/accounting/utils.test.ts` — 97 tests, dont la séparation des
deux barèmes, le snapshot qui gèle un tarif, le groupe facturé par tête mais payé à
plat, le moniteur à 0 €, et le rattachement par `lesson_type` insensible au renommage.
