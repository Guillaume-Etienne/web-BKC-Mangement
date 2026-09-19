import { useState } from 'react'
import type { Expense, ExpenseCategory } from '../../types/database'
import type { AccountingHandlers } from './types'
import {
  categoryTree, childrenOf, parentsOf, uniqueSlug, canDelete, categoryColor,
  isValidParent, reorderSiblings, moveToParent, CATEGORY_PALETTE,
} from './expenseCategories'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

/**  Le vrai gestionnaire de catégories — celui d'avant le 2026-09-19 n'écrivait
 *   nulle part : une catégorie ajoutée vivait dans un `useState` et disparaissait
 *   au rechargement si aucune dépense ne l'utilisait.
 *
 *   Tout est modifiable ici, et un seul geste est destructif :
 *   - renommer     → le libellé change partout d'un coup, aucune dépense ne bouge
 *   - ranger sous  → change le parent (`moveToParent` refuse le 3e niveau)
 *   - couleur      → sur un PARENT seulement, ses enfants en héritent
 *   - ↑ ↓          → l'ordre d'affichage, dans sa fratrie
 *   - archiver     → sort de la saisie, l'historique reste intact  ← le défaut
 *   - supprimer    → seulement si RIEN ne s'y rattache (cf. `canDelete`)
 */
interface Props {
  categories: ExpenseCategory[]
  expenses:   Expense[]
  handlers:   AccountingHandlers
  onClose:    () => void
}

export default function ExpenseCategoryManager({ categories, expenses, handlers, onClose }: Props) {
  const { lang } = useLanguage()
  const [showArchived, setShowArchived] = useState(false)
  const [addingUnder,  setAddingUnder]  = useState<string | null | 'root'>(null)
  const [editing,      setEditing]      = useState<string | null>(null)
  const [draft,        setDraft]        = useState('')
  const [notice,       setNotice]       = useState<string | null>(null)

  const visible = showArchived ? categories : categories.filter(c => !c.archived)
  const tree    = categoryTree(visible)

  const countFor = (id: string) => expenses.filter(e => e.category_id === id).length

  const submitNew = (parentId: string | null) => {
    const name = draft.trim()
    if (!name || !isValidParent(categories, null, parentId)) return
    const siblings = parentId ? childrenOf(categories, parentId) : parentsOf(categories)
    handlers.addExpenseCategory({
      id: crypto.randomUUID(),
      parent_id: parentId,
      slug: uniqueSlug(name, categories),
      name,
      // Seul un parent porte une couleur : l'enfant hérite de la sienne.
      color: parentId ? null : CATEGORY_PALETTE[parentsOf(categories).length % CATEGORY_PALETTE.length],
      sort_order: (siblings.at(-1)?.sort_order ?? 0) + 10,
      archived: false,
    })
    setDraft(''); setAddingUnder(null)
  }

  const submitRename = (cat: ExpenseCategory) => {
    const name = draft.trim()
    // Le slug ne bouge JAMAIS au renommage : c'est la clé stable que le code cite.
    if (name && name !== cat.name) handlers.updateExpenseCategory({ ...cat, name })
    setDraft('')
  }

  const move = (cat: ExpenseCategory, dir: -1 | 1) => {
    // Une seule flèche peut renuméroter plusieurs lignes : on les écrit toutes.
    for (const c of reorderSiblings(categories, cat.id, dir)) handlers.updateExpenseCategory(c)
  }

  const reparent = (cat: ExpenseCategory, nextParentId: string | null) => {
    const moved = moveToParent(categories, cat.id, nextParentId)
    if (moved) handlers.updateExpenseCategory(moved)
  }

  const remove = (cat: ExpenseCategory) => {
    const verdict = canDelete(categories, expenses, cat.id)
    if (verdict.ok) { handlers.deleteExpenseCategory(cat.id); setNotice(null); return }
    setNotice(
      (verdict.reason === 'has-expenses'
        ? i18n.accounting.ex_cant_delete_used[lang]
        : i18n.accounting.ex_cant_delete_parent[lang]
      ).replace('{count}', String(verdict.count)),
    )
  }

  // ── Une ligne dépliée : tout ce qui se modifie sur la catégorie ────────────
  const editPanel = (cat: ExpenseCategory) => {
    const isTop = cat.parent_id === null
    // Un parent qui a déjà des enfants ne peut pas être rangé ailleurs
    // (ce serait un 3e niveau) — on le dit plutôt que de griser sans expliquer.
    const canMove = isValidParent(categories, cat.id, parentsOf(categories).find(p => p.id !== cat.id)?.id ?? null)
    return (
      <div className={`${isTop ? 'pl-6' : 'pl-14'} pr-2 pb-3 pt-1 space-y-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">{i18n.accounting.ex_rename[lang]}</label>
          <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { submitRename(cat); setEditing(null) } }}
            onBlur={() => submitRename(cat)}
            className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200" />

          <label className="text-xs text-gray-500 dark:text-gray-400">{i18n.accounting.ex_move_to[lang]}</label>
          <select value={cat.parent_id ?? ''} disabled={!canMove && isTop}
            onChange={e => reparent(cat, e.target.value || null)}
            className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200 disabled:opacity-40">
            <option value="">{i18n.accounting.ex_top_level[lang]}</option>
            {parentsOf(categories)
              .filter(p => isValidParent(categories, cat.id, p.id))
              .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button onClick={() => move(cat, -1)} title={i18n.accounting.ex_move_up[lang]}
            className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">↑</button>
          <button onClick={() => move(cat, 1)} title={i18n.accounting.ex_move_down[lang]}
            className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">↓</button>

          <button onClick={() => { setEditing(null); setDraft('') }}
            className="ml-auto px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            {i18n.accounting.ex_done[lang]}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-gray-500 dark:text-gray-400">{i18n.accounting.ex_color[lang]}</label>
          {isTop ? CATEGORY_PALETTE.map(c => (
            <button key={c} onClick={() => handlers.updateExpenseCategory({ ...cat, color: c })}
              title={c}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                cat.color === c ? 'border-gray-700 dark:border-gray-200 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }} />
          )) : (
            <span className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColor(categories, cat.id) }} />
              {i18n.accounting.ex_color_inherited[lang]}
            </span>
          )}
        </div>
      </div>
    )
  }

  const row = (cat: ExpenseCategory, depth: 0 | 1) => {
    const used  = countFor(cat.id)
    const color = categoryColor(categories, cat.id)
    const open  = editing === cat.id
    return (
      <div key={cat.id}>
        <div className={`flex items-center gap-2 py-1.5 ${depth === 1 ? 'pl-8' : ''}`}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className={`text-sm ${cat.archived ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
            {cat.name}
          </span>
          {cat.archived && (
            <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-gray-300 dark:border-gray-700 rounded px-1">
              {i18n.accounting.ex_archived[lang]}
            </span>
          )}
          <span className="text-xs text-gray-400">{used > 0 ? `· ${used}` : ''}</span>

          <span className="ml-auto flex items-center gap-1">
            {depth === 0 && !cat.archived && (
              <button onClick={() => { setAddingUnder(cat.id); setDraft('') }}
                className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors">
                {i18n.accounting.ex_add_sub[lang]}
              </button>
            )}
            <button onClick={() => { setEditing(open ? null : cat.id); setDraft(cat.name) }}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                open ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                     : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              {i18n.accounting.ex_edit[lang]}
            </button>
            <button onClick={() => handlers.updateExpenseCategory({ ...cat, archived: !cat.archived })}
              className="text-xs px-2 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              {cat.archived ? i18n.accounting.ex_unarchive[lang] : i18n.accounting.ex_archive[lang]}
            </button>
            <button onClick={() => remove(cat)} title={i18n.common.btn_delete[lang]}
              className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg leading-none px-1">×</button>
          </span>
        </div>
        {open && editPanel(cat)}
      </div>
    )
  }

  const addRow = (parentId: string | null) => (
    <div className={`flex items-center gap-2 py-1.5 ${parentId ? 'pl-8' : ''}`}>
      <input autoFocus type="text" value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submitNew(parentId); if (e.key === 'Escape') setAddingUnder(null) }}
        placeholder={parentId ? i18n.accounting.ex_new_subcategory[lang] : i18n.accounting.ex_category_name[lang]}
        className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200" />
      <button onClick={() => submitNew(parentId)}
        className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        {i18n.common.btn_add[lang]}
      </button>
      <button onClick={() => setAddingUnder(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-2">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="font-semibold text-gray-700 dark:text-gray-300">{i18n.accounting.ex_manage_categories[lang]}</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            {i18n.accounting.ex_show_archived[lang]}
          </label>
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {i18n.accounting.ex_done[lang]}
          </button>
        </div>
      </div>

      {notice && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {tree.map(({ parent, children }) => (
          <div key={parent.id}>
            {row(parent, 0)}
            {children.map(c => row(c, 1))}
            {addingUnder === parent.id && addRow(parent.id)}
          </div>
        ))}
      </div>

      {tree.length === 0 && (
        <p className="text-sm text-gray-400 py-2">{i18n.accounting.ex_no_categories[lang]}</p>
      )}

      {addingUnder === 'root'
        ? addRow(null)
        : <button onClick={() => { setAddingUnder('root'); setDraft('') }}
            className="text-xs px-2 py-1 border border-dashed border-gray-300 dark:border-gray-700 rounded-full text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-colors">
            {i18n.accounting.ex_new_category[lang]}
          </button>
      }
    </div>
  )
}
