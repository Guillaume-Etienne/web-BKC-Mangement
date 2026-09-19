import { describe, it, expect } from 'vitest'
import {
  slugify, uniqueSlug, categoryTree, parentsOf, childrenOf, isValidParent,
  categoryColor, categoryPath, rollUpId, selfAndChildrenIds, canDelete, legacyLabel,
  reorderSiblings, moveToParent, isPostable, postableCategories, expensesOnHeadings,
} from './expenseCategories'
import type { Expense, ExpenseCategory } from '../../types/database'

const mkCat = (o: Partial<ExpenseCategory> & { id: string; name: string }): ExpenseCategory => ({
  parent_id: null, slug: slugify(o.name), color: null, sort_order: 0, archived: false, ...o,
})
const mkExpense = (o: Partial<Expense> & { id: string }): Expense => ({
  date: '2026-09-19', category: '', category_id: null, amount: 10, description: 'x', ...o,
})

/** L'arbre de référence des tests : Energy avec 3 enfants, Admin tout seul. */
const energy = mkCat({ id: 'energy', name: 'Energy', color: '#f97316', sort_order: 10 })
// Pas de 10, comme ce que la renumérotation produit : une fratrie déjà normalisée
// ne doit plus être réécrite en entier au moindre clic sur une flèche.
const petrol = mkCat({ id: 'petrol', name: 'Petrol', parent_id: 'energy', sort_order: 10 })
const elec   = mkCat({ id: 'elec',   name: 'Electricity', parent_id: 'energy', sort_order: 20 })
const gas    = mkCat({ id: 'gas',    name: 'Gas', parent_id: 'energy', sort_order: 30 })
const admin  = mkCat({ id: 'admin',  name: 'Admin', color: '#facc15', sort_order: 20 })
const TREE = [petrol, energy, gas, admin, elec]   // volontairement désordonné

describe('slugify — doit coller à l’expression SQL du backfill', () => {
  it('descend en minuscules et remplace les séparateurs', () => {
    expect(slugify('Transport')).toBe('transport')
    expect(slugify('Petrol / Elec')).toBe('petrol-elec')
  })

  it('retire les accents comme le translate() de la migration', () => {
    expect(slugify('Pièces détachées')).toBe('pieces-detachees')
  })

  it('reproduit les 6 libellés réellement présents en PROD au 2026-09-19', () => {
    const prod = ['Transport', 'Pièces détachées', 'Groseries', 'Maintenance', 'CAR', 'Admin']
    expect(prod.map(slugify)).toEqual(
      ['transport', 'pieces-detachees', 'groseries', 'maintenance', 'car', 'admin'])
  })

  it('ne laisse jamais de tiret en tête ni en queue', () => {
    expect(slugify('  — Energy —  ')).toBe('energy')
  })
})

describe('uniqueSlug', () => {
  it('garde le slug nu quand il est libre', () => {
    expect(uniqueSlug('Water', TREE)).toBe('water')
  })

  it('suffixe même quand le nom est identique à une catégorie existante', () => {
    expect(uniqueSlug('Energy', TREE)).toBe('energy-2')
  })

  it('suffixe quand le slug est déjà pris', () => {
    expect(uniqueSlug('Admin', TREE)).toBe('admin-2')
  })

  it('remonte jusqu’au premier libre', () => {
    const taken = [...TREE, mkCat({ id: 'a2', name: 'Admin 2', slug: 'admin-2' })]
    expect(uniqueSlug('Admin', taken)).toBe('admin-3')
  })

  it('retombe sur un slug par défaut si le nom ne donne aucun caractère', () => {
    expect(uniqueSlug('!!!', TREE)).toBe('category')
  })
})

describe('categoryTree', () => {
  it('range les parents par sort_order et leur rattache leurs enfants', () => {
    const tree = categoryTree(TREE)
    expect(tree.map(t => t.parent.id)).toEqual(['energy', 'admin'])
    expect(tree[0].children.map(c => c.id)).toEqual(['petrol', 'elec', 'gas'])
    expect(tree[1].children).toEqual([])
  })

  it('parentsOf ne rend que le niveau 1', () => {
    expect(parentsOf(TREE).map(c => c.id)).toEqual(['energy', 'admin'])
  })

  it('childrenOf ne rend que les enfants du parent demandé', () => {
    expect(childrenOf(TREE, 'energy')).toHaveLength(3)
    expect(childrenOf(TREE, 'admin')).toHaveLength(0)
  })
})

describe('isValidParent — la profondeur reste à 2', () => {
  it('accepte de remonter au niveau 1', () => {
    expect(isValidParent(TREE, 'petrol', null)).toBe(true)
  })

  it('accepte un parent de niveau 1', () => {
    expect(isValidParent(TREE, 'admin', 'energy')).toBe(true)
  })

  it('refuse un enfant comme parent (ce serait un 3e niveau)', () => {
    expect(isValidParent(TREE, 'admin', 'petrol')).toBe(false)
  })

  it('refuse de se prendre soi-même comme parent', () => {
    expect(isValidParent(TREE, 'energy', 'energy')).toBe(false)
  })

  it('refuse de ranger un parent QUI A des enfants sous un autre parent', () => {
    expect(isValidParent(TREE, 'energy', 'admin')).toBe(false)
  })

  it('refuse un parent inconnu', () => {
    expect(isValidParent(TREE, 'admin', 'nexistepas')).toBe(false)
  })
})

describe('categoryColor — l’enfant hérite du parent', () => {
  it('rend sa propre couleur quand il en a une', () => {
    expect(categoryColor(TREE, 'energy')).toBe('#f97316')
  })

  it('rend celle du parent pour un enfant sans couleur', () => {
    expect(categoryColor(TREE, 'petrol')).toBe('#f97316')
    expect(categoryColor(TREE, 'gas')).toBe('#f97316')
  })

  it('retombe sur la palette pour un parent sans couleur', () => {
    const cats = [mkCat({ id: 'p', name: 'Plain' })]
    expect(categoryColor(cats, 'p')).toBe('#60a5fa')
  })

  it('rend une couleur neutre pour une catégorie inconnue, sans planter', () => {
    expect(categoryColor(TREE, 'disparue')).toBe('#94a3b8')
    expect(categoryColor(TREE, null)).toBe('#94a3b8')
  })
})

describe('categoryPath', () => {
  it('préfixe l’enfant de son parent', () => {
    expect(categoryPath(TREE, 'petrol')).toBe('Energy · Petrol')
  })

  it('laisse un parent seul', () => {
    expect(categoryPath(TREE, 'energy')).toBe('Energy')
  })

  it('rend une chaîne vide pour une catégorie inconnue', () => {
    expect(categoryPath(TREE, null)).toBe('')
  })
})

describe('rollUpId — ce qui fait tenir la matrice du Summary', () => {
  it('remonte un enfant à son parent', () => {
    expect(rollUpId(TREE, 'petrol')).toBe('energy')
  })

  it('laisse un parent sur lui-même', () => {
    expect(rollUpId(TREE, 'energy')).toBe('energy')
  })

  it('laisse passer un id inconnu tel quel plutôt que de le perdre', () => {
    expect(rollUpId(TREE, 'disparue')).toBe('disparue')
  })

  it('trois sous-catégories se totalisent en UNE colonne', () => {
    const ids = ['petrol', 'elec', 'gas'].map(id => rollUpId(TREE, id))
    expect(new Set(ids).size).toBe(1)
  })
})

describe('selfAndChildrenIds — filtrer sur un parent prend ses enfants', () => {
  it('rend le parent et ses enfants', () => {
    expect(selfAndChildrenIds(TREE, 'energy').sort())
      .toEqual(['elec', 'energy', 'gas', 'petrol'])
  })

  it('rend un enfant seul', () => {
    expect(selfAndChildrenIds(TREE, 'petrol')).toEqual(['petrol'])
  })
})

describe('canDelete — on n’ampute jamais l’historique', () => {
  it('autorise la suppression d’une catégorie vide', () => {
    expect(canDelete(TREE, [], 'admin')).toEqual({ ok: true })
  })

  it('refuse une catégorie qui porte des dépenses, et dit combien', () => {
    const expenses = [mkExpense({ id: 'e1', category_id: 'admin' }), mkExpense({ id: 'e2', category_id: 'admin' })]
    expect(canDelete(TREE, expenses, 'admin')).toEqual({ ok: false, reason: 'has-expenses', count: 2 })
  })

  it('refuse un parent qui a des enfants, même sans aucune dépense', () => {
    expect(canDelete(TREE, [], 'energy')).toEqual({ ok: false, reason: 'has-children', count: 3 })
  })

  it('ignore les dépenses rangées ailleurs', () => {
    const expenses = [mkExpense({ id: 'e1', category_id: 'energy' })]
    expect(canDelete(TREE, expenses, 'admin')).toEqual({ ok: true })
  })
})

describe('isPostable / postableCategories — un parent découpé devient un titre', () => {
  it('un parent SANS enfant porte des dépenses', () => {
    expect(isPostable(TREE, 'admin')).toBe(true)
  })

  it('un parent AVEC des enfants n’en porte plus', () => {
    expect(isPostable(TREE, 'energy')).toBe(false)
  })

  it('un enfant en porte toujours — il ne peut pas avoir d’enfants', () => {
    expect(isPostable(TREE, 'petrol')).toBe(true)
  })

  it('la liste des destinations exclut le titre et garde l’ordre de l’arbre', () => {
    expect(postableCategories(TREE).map(c => c.id)).toEqual(['petrol', 'elec', 'gas', 'admin'])
  })

  it('« Energy » n’est proposé nulle part comme destination', () => {
    expect(postableCategories(TREE).some(c => c.id === 'energy')).toBe(false)
  })

  it('devenir parent retire la catégorie des destinations', () => {
    const avant = postableCategories([admin, energy, petrol])
    expect(avant.map(c => c.id)).toContain('admin')
    const apres = postableCategories([admin, energy, petrol,
      mkCat({ id: 'sub', name: 'Sub', parent_id: 'admin' })])
    expect(apres.map(c => c.id)).not.toContain('admin')
    expect(apres.map(c => c.id)).toContain('sub')
  })
})

describe('expensesOnHeadings — les dépenses restées sur un titre', () => {
  it('ne signale rien quand tout est bien rangé', () => {
    const ok = [mkExpense({ id: 'e1', category_id: 'petrol' }), mkExpense({ id: 'e2', category_id: 'admin' })]
    expect(expensesOnHeadings(TREE, ok)).toEqual([])
  })

  it('repère celles restées sur un parent devenu titre, et les compte', () => {
    const ko = [
      mkExpense({ id: 'e1', category_id: 'energy' }),
      mkExpense({ id: 'e2', category_id: 'energy' }),
      mkExpense({ id: 'e3', category_id: 'petrol' }),
    ]
    const out = expensesOnHeadings(TREE, ko)
    expect(out).toHaveLength(1)
    expect(out[0].category.id).toBe('energy')
    expect(out[0].count).toBe(2)
  })

  it('ne signale pas un parent sans enfant qui porte des dépenses', () => {
    expect(expensesOnHeadings(TREE, [mkExpense({ id: 'e1', category_id: 'admin' })])).toEqual([])
  })

  it('ignore les dépenses sans catégorie plutôt que de planter', () => {
    expect(expensesOnHeadings(TREE, [mkExpense({ id: 'e1', category_id: null })])).toEqual([])
  })
})

describe('reorderSiblings — les flèches de la liste', () => {
  it('échange deux parents et ne réécrit QUE ceux qui bougent', () => {
    const out = reorderSiblings(TREE, 'admin', -1)   // Admin remonte au-dessus d'Energy
    expect(out.map(c => c.id).sort()).toEqual(['admin', 'energy'])
    const byId = Object.fromEntries(out.map(c => [c.id, c.sort_order]))
    expect(byId.admin).toBeLessThan(byId.energy)
  })

  it('réordonne à l’intérieur d’une fratrie d’enfants, sans toucher aux parents', () => {
    const out = reorderSiblings(TREE, 'gas', -1)      // Gas passe devant Electricity
    expect(out.map(c => c.id).sort()).toEqual(['elec', 'gas'])
    const byId = Object.fromEntries(out.map(c => [c.id, c.sort_order]))
    expect(byId.gas).toBeLessThan(byId.elec)
  })

  it('ne fait rien en haut de liste', () => {
    expect(reorderSiblings(TREE, 'energy', -1)).toEqual([])
  })

  it('normalise une fratrie héritée d’une numérotation serrée, une seule fois', () => {
    // Le backfill pose sort_order 1,2,3 ; le premier déplacement renumérote toute
    // la fratrie en 10,20,30 — y compris celui qui n'a pas changé de place.
    const serre = [
      mkCat({ id: 'a', name: 'A', parent_id: 'p', sort_order: 1 }),
      mkCat({ id: 'b', name: 'B', parent_id: 'p', sort_order: 2 }),
      mkCat({ id: 'c', name: 'C', parent_id: 'p', sort_order: 3 }),
      mkCat({ id: 'p', name: 'P' }),
    ]
    const premier = reorderSiblings(serre, 'c', -1)
    expect(premier.map(c => c.id).sort()).toEqual(['a', 'b', 'c'])
    // Une fois normalisée, la fois suivante ne touche que la paire échangée.
    const apres = serre.map(c => premier.find(o => o.id === c.id) ?? c)
    expect(reorderSiblings(apres, 'b', -1).map(c => c.id).sort()).toEqual(['b', 'c'])
  })

  it('ne fait rien en bas de liste', () => {
    expect(reorderSiblings(TREE, 'gas', 1)).toEqual([])
  })

  it('ne fait rien sur une catégorie inconnue', () => {
    expect(reorderSiblings(TREE, 'disparue', 1)).toEqual([])
  })

  it('l’ordre obtenu est bien celui qu’on relira', () => {
    const out = reorderSiblings(TREE, 'gas', -1)
    const after = TREE.map(c => out.find(o => o.id === c.id) ?? c)
    expect(childrenOf(after, 'energy').map(c => c.id)).toEqual(['petrol', 'gas', 'elec'])
  })
})

describe('moveToParent — ranger une catégorie ailleurs', () => {
  it('range un parent SANS enfant sous un autre parent', () => {
    const moved = moveToParent(TREE, 'admin', 'energy')
    expect(moved).toMatchObject({ id: 'admin', parent_id: 'energy' })
  })

  it('libère la couleur quand la catégorie devient un enfant (elle héritera)', () => {
    expect(moveToParent(TREE, 'admin', 'energy')!.color).toBeNull()
  })

  it('remonte un enfant au niveau 1 et lui donne une couleur', () => {
    const moved = moveToParent(TREE, 'petrol', null)
    expect(moved).toMatchObject({ id: 'petrol', parent_id: null })
    expect(moved!.color).toBeTruthy()
  })

  it('le place en fin de sa nouvelle fratrie', () => {
    const moved = moveToParent(TREE, 'admin', 'energy')!
    const maxChild = Math.max(...childrenOf(TREE, 'energy').map(c => c.sort_order))
    expect(moved.sort_order).toBeGreaterThan(maxChild)
  })

  it('refuse ce que isValidParent refuse — pas de 3e niveau', () => {
    expect(moveToParent(TREE, 'admin', 'petrol')).toBeNull()
    expect(moveToParent(TREE, 'energy', 'admin')).toBeNull()
    expect(moveToParent(TREE, 'energy', 'energy')).toBeNull()
  })

  it('renvoie null quand rien ne change', () => {
    expect(moveToParent(TREE, 'petrol', 'energy')).toBeNull()
    expect(moveToParent(TREE, 'admin', null)).toBeNull()
  })
})

describe('legacyLabel — la colonne texte reste alimentée', () => {
  it('rend le nom de la catégorie', () => {
    expect(legacyLabel(TREE, 'petrol')).toBe('Petrol')
  })

  it('rend une chaîne vide plutôt qu’un undefined pour une catégorie inconnue', () => {
    expect(legacyLabel(TREE, null)).toBe('')
  })
})
