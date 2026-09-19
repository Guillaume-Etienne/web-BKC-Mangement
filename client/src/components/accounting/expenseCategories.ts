/**  Catégories de dépenses — arbre à 2 niveaux.
 *
 *   Un parent a `parent_id === null`, un enfant pointe vers son parent. La
 *   profondeur est limitée à 2 **ici et dans l'UI**, pas par la base : un
 *   trigger de validation bloquerait des INSERT, ce que le projet s'interdit.
 *   `isValidParent` est le garde-fou, et il doit être appelé avant toute
 *   écriture de `parent_id`.
 *
 *   La couleur vit sur le parent et descend aux enfants : deux sous-catégories
 *   d'« Energy » se lisent comme une même famille sur les graphes. Avant le
 *   2026-09-19 la couleur était dérivée de l'INDEX dans un tableau, donc
 *   ajouter une catégorie décalait la couleur de toutes les autres.
 */
import type { Expense, ExpenseCategory } from '../../types/database'

/** Palette de repli, utilisée seulement quand un parent n'a pas de couleur. */
export const CATEGORY_PALETTE = [
  '#60a5fa', '#34d399', '#f97316', '#a78bfa', '#facc15',
  '#f472b6', '#38bdf8', '#4ade80', '#fb923c', '#c084fc',
]

/**  Doit donner EXACTEMENT le même résultat que l'expression SQL du backfill
 *   (migration 2026-09-19_expense_categories.sql, étapes 4 et 5) : si les deux
 *   divergent, une catégorie créée à l'écran ne retombera pas sur la ligne
 *   attendue et on fabriquera un doublon silencieux.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Rend le slug unique en suffixant -2, -3… (l'unicité est aussi en base). */
export function uniqueSlug(name: string, existing: ExpenseCategory[]): string {
  const base = slugify(name) || 'category'
  const taken = new Set(existing.map(c => c.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export const isParent = (c: ExpenseCategory) => c.parent_id === null

export function parentsOf(cats: ExpenseCategory[]): ExpenseCategory[] {
  return cats.filter(isParent).sort(compareCategories)
}

export function childrenOf(cats: ExpenseCategory[], parentId: string): ExpenseCategory[] {
  return cats.filter(c => c.parent_id === parentId).sort(compareCategories)
}

export const compareCategories = (a: ExpenseCategory, b: ExpenseCategory) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name)

/** Arbre prêt à rendre : chaque parent avec ses enfants, dans l'ordre d'affichage. */
export function categoryTree(cats: ExpenseCategory[]): { parent: ExpenseCategory; children: ExpenseCategory[] }[] {
  return parentsOf(cats).map(parent => ({ parent, children: childrenOf(cats, parent.id) }))
}

/**  Un enfant ne peut pas devenir parent d'un autre : 2 niveaux, pas 3.
 *   Refuse aussi de se prendre soi-même comme parent, et de ranger un parent
 *   qui a déjà des enfants sous un autre parent (ce qui créerait le 3e niveau).
 */
export function isValidParent(
  cats: ExpenseCategory[], categoryId: string | null, nextParentId: string | null,
): boolean {
  if (nextParentId === null) return true
  if (nextParentId === categoryId) return false
  const next = cats.find(c => c.id === nextParentId)
  if (!next || !isParent(next)) return false
  if (categoryId && childrenOf(cats, categoryId).length > 0) return false
  return true
}

/** Couleur effective : la sienne, sinon celle de son parent, sinon la palette. */
export function categoryColor(cats: ExpenseCategory[], id: string | null): string {
  const cat = cats.find(c => c.id === id)
  if (!cat) return '#94a3b8'                       // catégorie inconnue / supprimée
  if (cat.color) return cat.color
  const parent = cat.parent_id ? cats.find(c => c.id === cat.parent_id) : null
  if (parent?.color) return parent.color
  const idx = parentsOf(cats).findIndex(p => p.id === (parent?.id ?? cat.id))
  return CATEGORY_PALETTE[(idx >= 0 ? idx : 0) % CATEGORY_PALETTE.length]
}

/** « Energy · Petrol » pour un enfant, « Energy » pour un parent. */
export function categoryPath(cats: ExpenseCategory[], id: string | null, sep = ' · '): string {
  const cat = cats.find(c => c.id === id)
  if (!cat) return ''
  const parent = cat.parent_id ? cats.find(c => c.id === cat.parent_id) : null
  return parent ? `${parent.name}${sep}${cat.name}` : cat.name
}

/**  La catégorie sous laquelle une dépense est TOTALISÉE dans les vues repliées :
 *   son parent si elle est rangée dans un enfant, elle-même sinon. C'est ce qui
 *   évite une matrice mois × catégories à 24 colonnes.
 */
export function rollUpId(cats: ExpenseCategory[], id: string | null): string | null {
  const cat = cats.find(c => c.id === id)
  if (!cat) return id
  return cat.parent_id ?? cat.id
}

/** Les ids qu'un filtre sur `id` doit retenir : lui-même + ses enfants. */
export function selfAndChildrenIds(cats: ExpenseCategory[], id: string): string[] {
  return [id, ...childrenOf(cats, id).map(c => c.id)]
}

/**  Une catégorie n'est supprimable que si RIEN ne s'y rattache — ni une dépense,
 *   ni une sous-catégorie. Sinon c'est `archived` qu'il faut utiliser, pour la
 *   sortir de la saisie sans amputer l'historique.
 *   (La base dit la même chose via ON DELETE RESTRICT ; on le dit AUSSI ici pour
 *   pouvoir l'expliquer à l'écran au lieu de laisser Postgres refuser.)
 */
export function canDelete(
  cats: ExpenseCategory[], expenses: Expense[], id: string,
): { ok: true } | { ok: false; reason: 'has-expenses' | 'has-children'; count: number } {
  const children = childrenOf(cats, id)
  if (children.length > 0) return { ok: false, reason: 'has-children', count: children.length }
  const used = expenses.filter(e => e.category_id === id).length
  if (used > 0) return { ok: false, reason: 'has-expenses', count: used }
  return { ok: true }
}

/**  Une catégorie peut-elle PORTER une dépense ?
 *
 *   Décision de gui, 2026-09-19 : dès qu'une catégorie est découpée en
 *   sous-catégories, elle devient un TITRE — on range dans une de ses branches,
 *   plus dans le tronc. C'est la convention comptable habituelle, et c'est ce
 *   qui fait disparaître le doublon « Energy / Energy » du select (le nom
 *   servait à la fois d'en-tête de groupe et de première option).
 *
 *   Un enfant est toujours « postable » : il ne peut pas avoir d'enfants.
 */
export function isPostable(cats: ExpenseCategory[], id: string): boolean {
  return childrenOf(cats, id).length === 0
}

/** Les catégories où l'on peut ranger une dépense, dans l'ordre de l'arbre. */
export function postableCategories(cats: ExpenseCategory[]): ExpenseCategory[] {
  return categoryTree(cats).flatMap(({ parent, children }) =>
    children.length === 0 ? [parent] : children)
}

/**  Les dépenses restées sur une catégorie DEVENUE un titre.
 *
 *   Le cas arrive tout seul : on range 5 factures sur « Energy », puis on crée
 *   « Petrol » — les 5 ne bougent pas et se retrouvent sur un titre. Elles
 *   s'affichent et se totalisent toujours correctement (`rollUpId` les laisse
 *   sur elles-mêmes), mais plus personne ne peut les saisir là : il faut les
 *   reventiler. On les remonte à l'écran plutôt que de les laisser dormir.
 */
export function expensesOnHeadings(
  cats: ExpenseCategory[], expenses: Expense[],
): { category: ExpenseCategory; count: number }[] {
  const out: { category: ExpenseCategory; count: number }[] = []
  for (const c of parentsOf(cats)) {
    if (isPostable(cats, c.id)) continue
    const count = expenses.filter(e => e.category_id === c.id).length
    if (count > 0) out.push({ category: c, count })
  }
  return out
}

/**  Déplacer une catégorie d'un cran dans SA fratrie (les parents entre eux, les
 *   enfants d'un même parent entre eux). Renvoie les lignes à écrire — seulement
 *   celles dont le `sort_order` change vraiment, pour ne pas réécrire toute la
 *   table à chaque clic sur une flèche.
 *   Tableau vide = le geste n'a pas lieu d'être (déjà en bout de liste).
 */
export function reorderSiblings(
  cats: ExpenseCategory[], id: string, dir: -1 | 1,
): ExpenseCategory[] {
  const cat = cats.find(c => c.id === id)
  if (!cat) return []
  const sibs = cat.parent_id === null ? parentsOf(cats) : childrenOf(cats, cat.parent_id)
  const i = sibs.findIndex(c => c.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sibs.length) return []
  const next = [...sibs]
  ;[next[i], next[j]] = [next[j], next[i]]
  // On renumérote de 10 en 10 : des trous réguliers, donc une insertion
  // ultérieure n'oblige pas à tout décaler.
  return next
    .map((c, k) => ({ ...c, sort_order: (k + 1) * 10 }))
    .filter(c => c.sort_order !== cats.find(o => o.id === c.id)!.sort_order)
}

/**  Ranger une catégorie sous un autre parent, ou la remonter au niveau 1.
 *   Renvoie `null` si le déplacement est refusé (cf. `isValidParent` : pas de
 *   3e niveau, pas de boucle) ou s'il ne change rien.
 *
 *   La couleur suit la règle de l'affichage : seul un parent en porte une.
 *   Devenir enfant la libère (il héritera), être promu parent en attribue une —
 *   sinon un parent promu resterait gris et toute sa descendance avec lui.
 */
export function moveToParent(
  cats: ExpenseCategory[], id: string, nextParentId: string | null,
): ExpenseCategory | null {
  const cat = cats.find(c => c.id === id)
  if (!cat || cat.parent_id === nextParentId) return null
  if (!isValidParent(cats, id, nextParentId)) return null
  const sibs = (nextParentId === null ? parentsOf(cats) : childrenOf(cats, nextParentId))
    .filter(s => s.id !== id)
  return {
    ...cat,
    parent_id: nextParentId,
    sort_order: (sibs.at(-1)?.sort_order ?? 0) + 10,
    color: nextParentId === null
      ? (cat.color ?? CATEGORY_PALETTE[parentsOf(cats).length % CATEGORY_PALETTE.length])
      : null,
  }
}

/**  Le libellé texte à écrire dans la colonne LEGACY `expenses.category`.
 *   Tant qu'elle existe (phase 3 la supprimera), on la garde alimentée pour que
 *   rien de ce qui la lit encore n'affiche une case vide.
 */
export function legacyLabel(cats: ExpenseCategory[], id: string | null): string {
  const cat = cats.find(c => c.id === id)
  return cat?.name ?? ''
}
