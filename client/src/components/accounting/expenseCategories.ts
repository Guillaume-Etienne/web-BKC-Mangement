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

/**  Le libellé texte à écrire dans la colonne LEGACY `expenses.category`.
 *   Tant qu'elle existe (phase 3 la supprimera), on la garde alimentée pour que
 *   rien de ce qui la lit encore n'affiche une case vide.
 */
export function legacyLabel(cats: ExpenseCategory[], id: string | null): string {
  const cat = cats.find(c => c.id === id)
  return cat?.name ?? ''
}
