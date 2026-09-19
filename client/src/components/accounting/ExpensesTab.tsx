import { useState, useMemo } from 'react'
import type { SharedAccountingData, AccountingHandlers } from './types'
import type { Expense, ExpenseCategory } from '../../types/database'
import { fmtEur, fmtMonth } from './utils'
import { todayISO, fmtDate } from '../../utils/dates'
import {
  categoryTree, categoryColor, categoryPath, rollUpId, selfAndChildrenIds,
  legacyLabel, childrenOf, postableCategories, expensesOnHeadings,
} from './expenseCategories'

import ExpenseCategoryManager from './ExpenseCategoryManager'
import MonthInput from '../common/MonthInput'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

interface Props {
  data:     SharedAccountingData
  handlers: AccountingHandlers
}

type View = 'list' | 'summary'

// ── Select à 2 niveaux, partagé par la saisie et les filtres ────────────────
//
// Une catégorie DÉCOUPÉE en sous-catégories devient un TITRE : on range dans une
// de ses branches, plus dans le tronc (décision gui, 2026-09-19). C'est aussi ce
// qui fait disparaître le doublon — le nom du parent servait à la fois d'en-tête
// de groupe ET de première option, donc « Energy » s'affichait deux fois.
//
// Deux modes, parce que les deux selects ne posent pas la même question :
//   'entry'  → OÙ ranger cette dépense ?  un titre n'est pas une réponse
//   'filter' → QUOI regarder ?            un titre veut dire « lui et tout ce
//              qu'il contient », donc il reste proposé, libellé « X — tout »
interface CatSelectProps {
  categories: ExpenseCategory[]
  value:      string
  onChange:   (v: string) => void
  allLabel?:  string          // présent = un choix « toutes » en tête (filtres)
  className?: string
  mode?:      'entry' | 'filter'
}
function CategorySelect({ categories, value, onChange, allLabel, className, mode = 'entry' }: CatSelectProps) {
  const { lang } = useLanguage()
  const tree = categoryTree(categories)
  const isFilter = mode === 'filter'
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={className ?? 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200'}>
      {allLabel && <option value="all">{allLabel}</option>}
      {tree.map(({ parent, children }) =>
        children.length === 0
          ? <option key={parent.id} value={parent.id}>{parent.name}</option>
          : (
            <optgroup key={parent.id} label={parent.name}>
              {isFilter && (
                <option value={parent.id}>
                  {i18n.accounting.ex_all_of[lang].replace('{name}', parent.name)}
                </option>
              )}
              {/* ⚠️ En saisie, le titre reste proposé dans UN seul cas : quand une
                  dépense y est déjà rangée (elle date d'avant la création des
                  sous-catégories). Sans ça, rouvrir cette ligne afficherait la
                  première option de la liste et le moindre Enregistrer la
                  reclasserait EN SILENCE. Le bandeau au-dessus de la liste invite
                  à la reventiler. */}
              {!isFilter && value === parent.id && (
                <option value={parent.id}>{parent.name}</option>
              )}
              {/* Pas d'indentation à la main : le navigateur décale déjà les options
                  d'un <optgroup>, et un préfixe d'espaces insécables casse la
                  recherche au clavier — taper « p » ne trouvait jamais « Petrol ». */}
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ),
      )}
    </select>
  )
}

// ── Add expense form (module-scope) ──────────────────────────────────────────
interface AddFormProps {
  categories: ExpenseCategory[]        // actives seulement
  allCategories: ExpenseCategory[]     // archivées incluses, pour le libellé legacy
  onAdd: (e: Expense) => void
  onCancel: () => void
}
function AddExpenseForm({ categories, allCategories, onAdd, onCancel }: AddFormProps) {
  const { lang } = useLanguage()
  const [date,        setDate]        = useState(todayISO())
  // La première DESTINATION réelle, dans l'ordre de l'arbre : ni un titre, ni
  // le premier du tableau brut (trié par `sort_order`, un enfant peut arriver
  // en tête — vu à l'écran, le formulaire s'ouvrait sur « Petrol »).
  const [categoryId,  setCategoryId]  = useState(postableCategories(categories)[0]?.id ?? '')
  const [amount,      setAmount]      = useState('')
  const [description, setDescription] = useState('')

  const submit = () => {
    const amt = parseFloat(amount)
    if (!date || !description.trim() || isNaN(amt) || amt <= 0 || !categoryId) return
    onAdd({
      id: crypto.randomUUID(),
      date,
      category_id: categoryId,
      // Colonne LEGACY : on la garde alimentée tant qu'elle existe (phase 3).
      category: legacyLabel(allCategories, categoryId),
      amount: amt,
      description: description.trim(),
    })
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-5 space-y-4">
      <p className="font-semibold text-blue-800 dark:text-blue-400">{i18n.accounting.ex_new_expense[lang]}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{i18n.common.label_date[lang]}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{i18n.accounting.ex_category[lang]}</label>
          <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{i18n.accounting.bf_amount_eur[lang]}</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{i18n.accounting.palm_description_col[lang]}</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="What was this expense for?"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          {i18n.common.btn_cancel[lang]}
        </button>
        <button onClick={submit}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          {i18n.accounting.ex_add_expense[lang]}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExpensesTab({ data, handlers }: Props) {
  const { lang } = useLanguage()
  const { expenses, expenseCategories, seasons } = data
  const currentSeason = seasons[seasons.length - 1]

  const [view,        setView]        = useState<View>('list')
  const [showAddForm, setShowAddForm] = useState(false)
  // Édition en place d'une dépense : un brouillon local, écrit seulement au Save.
  // ⚠️ Le montant est tenu en CHAÎNE, comme dans le formulaire d'ajout. Sur un
  // <input type="number"> contrôlé, `valueAsNumber` vaut NaN à chaque frappe
  // intermédiaire (« 55. » n'est pas un nombre) : l'état partait en NaN et les
  // caractères se perdaient — taper « 55.25 » laissait « 25 » (vu à l'écran).
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editDraft,   setEditDraft]   = useState<Expense | null>(null)
  const [editAmount,  setEditAmount]  = useState('')
  const [showManager, setShowManager] = useState(false)
  // Replié par défaut : 6 catégories × 4 sous-catégories feraient 24 colonnes.
  const [detailed,    setDetailed]    = useState(false)

  // Les archivées restent lisibles (une vieille dépense y pointe encore) mais
  // ne sont plus proposées à la saisie.
  const activeCategories = useMemo(
    () => expenseCategories.filter(c => !c.archived), [expenseCategories])

  // List filters
  const [filterCat,   setFilterCat]   = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState('')
  const [search,      setSearch]      = useState('')

  // ── Période : UNE seule pour les deux vues ────────────────────────────────
  // Avant le 2026-09-19 elle n'existait que dans le Résumé, qui démarrait sur la
  // saison pendant que la Liste montrait tout : deux totaux à un clic l'un de
  // l'autre, 1748 EUR d'écart sur TEST, et rien à l'écran pour dire que ce
  // n'était pas la même période. L'écran ne se trompait pas, il mentait.
  // Défaut « tout le temps » : c'est ce que la Liste a toujours montré, donc
  // personne ne voit son écran rétrécir — et la saison reste à un clic.
  type Period = 'all' | 'season' | 'custom'
  const [period,   setPeriod]   = useState<Period>('all')
  const [periodFrom,     setPeriodFrom]     = useState(currentSeason?.start_date.slice(0, 7) ?? '')
  const [periodTo,       setPeriodTo]       = useState(currentSeason?.end_date.slice(0, 7) ?? '')

  const colorOf = (id: string | null) => categoryColor(expenseCategories, id)
  const pathOf  = (id: string | null) =>
    categoryPath(expenseCategories, id) || i18n.accounting.ex_uncategorised[lang]

  /** L'axe de regroupement : le parent quand on est replié, la feuille sinon. */
  const groupOf = (e: Expense) =>
    detailed ? e.category_id : rollUpId(expenseCategories, e.category_id)

  /** Filtrer sur un parent doit ramener ses sous-catégories avec lui. */
  const catMatches = useMemo(() => {
    if (filterCat === 'all') return () => true
    const wanted = new Set(selfAndChildrenIds(expenseCategories, filterCat))
    return (e: Expense) => e.category_id !== null && wanted.has(e.category_id)
  }, [filterCat, expenseCategories])

  // ── Summary data ──────────────────────────────────────────────────────────
  // La base commune aux DEUX vues : liste, répartition, cartes et matrice
  // partent toutes d'ici, donc leurs totaux ne peuvent plus diverger.
  const periodExpenses = useMemo(() => {
    if (period === 'season' && currentSeason) {
      const from = currentSeason.start_date.slice(0, 7)
      const to   = currentSeason.end_date.slice(0, 7)
      return expenses.filter(e => e.date.slice(0, 7) >= from && e.date.slice(0, 7) <= to)
    }
    if (period === 'custom' && periodFrom && periodTo) {
      return expenses.filter(e => e.date.slice(0, 7) >= periodFrom && e.date.slice(0, 7) <= periodTo)
    }
    return expenses
  }, [expenses, period, currentSeason, periodFrom, periodTo])

  /** Le nom de la période active — accolé à chaque total, pour qu'aucun chiffre
   *  de cet écran ne soit lisible sans savoir ce qu'il couvre. */
  const periodLabel =
    period === 'season' ? (currentSeason?.label ?? '')
    : period === 'custom' && periodFrom && periodTo ? `${fmtMonth(periodFrom)} → ${fmtMonth(periodTo)}`
    : i18n.common.period_all_time[lang]

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => periodExpenses
    .filter(catMatches)
    .filter(e => !filterMonth || e.date.startsWith(filterMonth))
    .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))
  , [periodExpenses, catMatches, filterMonth, search])

  // months × catégories (repliées sur le parent, ou détaillées)
  const summaryMatrix = useMemo(() => {
    const months = [...new Set(periodExpenses.map(e => e.date.slice(0, 7)))].sort()
    const cats   = [...new Set(periodExpenses.map(groupOf))]
    const totals: Record<string, Record<string, number>> = {}
    for (const e of periodExpenses) {
      const m = e.date.slice(0, 7)
      const g = String(groupOf(e))
      if (!totals[m]) totals[m] = {}
      totals[m][g] = (totals[m][g] ?? 0) + e.amount
    }
    const monthTotals = months.map(m => Object.values(totals[m] ?? {}).reduce((s, v) => s + v, 0))
    const catTotals: Record<string, number> = {}
    for (const e of periodExpenses) {
      const g = String(groupOf(e))
      catTotals[g] = (catTotals[g] ?? 0) + e.amount
    }
    const grandTotal = periodExpenses.reduce((s, e) => s + e.amount, 0)
    const ordered = cats.sort((a, b) => (catTotals[String(b)] ?? 0) - (catTotals[String(a)] ?? 0))
    return { months, cats: ordered, totals, monthTotals, catTotals, grandTotal }
  }, [periodExpenses, detailed, expenseCategories])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grand totals for list ─────────────────────────────────────────────────
  const listTotal = filtered.reduce((s, e) => s + e.amount, 0)

  // ── Totals by category (all time, for breakdown bar) ─────────────────────
  const allByCat = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of periodExpenses) {
      const g = String(groupOf(e))
      m[g] = (m[g] ?? 0) + e.amount
    }
    return m
  }, [periodExpenses, detailed, expenseCategories])   // eslint-disable-line react-hooks/exhaustive-deps
  const allTotal = Object.values(allByCat).reduce((s, v) => s + v, 0) || 1

  const startEdit = (e: Expense) => {
    setEditingId(e.id); setEditDraft({ ...e }); setEditAmount(String(e.amount))
  }
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); setEditAmount('') }
  const saveEdit = () => {
    if (!editDraft) return
    const amt = parseFloat(editAmount)
    if (!editDraft.date || !editDraft.description.trim() || isNaN(amt) || !editDraft.category_id) return
    handlers.updateExpense({
      ...editDraft,
      amount: amt,
      description: editDraft.description.trim(),
      // On réaligne la colonne LEGACY sur la catégorie choisie, sinon elle
      // garderait le libellé d'avant et les deux colonnes se contrediraient.
      category: legacyLabel(expenseCategories, editDraft.category_id),
    })
    cancelEdit()
  }

  // Une catégorie devenue titre peut garder des dépenses d'avant son découpage :
  // elles s'affichent et se totalisent bien, mais plus personne ne peut les
  // SAISIR là. On les remonte au lieu de les laisser dormir.
  const onHeadings = useMemo(
    () => expensesOnHeadings(expenseCategories, expenses), [expenseCategories, expenses])

  const detailToggle = (
    <button onClick={() => setDetailed(v => !v)}
      className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-colors">
      {detailed ? i18n.accounting.ex_collapse_children[lang] : i18n.accounting.ex_expand_children[lang]}
    </button>
  )

  return (
    <div className="space-y-6">

      {/* View toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
          {(['list', 'summary'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors capitalize ${
                view === v ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              {v === 'list' ? i18n.accounting.ex_list_view[lang] : i18n.accounting.ex_summary_view[lang]}
            </button>
          ))}
        </div>

        {/* Liste des catégories : chaque famille montre son parent ET ses enfants,
            et chaque pastille filtre la liste. Avant, seuls les parents s'affichaient,
            avec un simple compteur « · 3 » — on ne pouvait pas lire ses sous-catégories
            sans ouvrir le gestionnaire. */}
        <div className="flex items-center gap-2 flex-wrap">
          {categoryTree(activeCategories).map(({ parent, children }) => (
            <span key={parent.id}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-800 p-0.5">
              <button onClick={() => setFilterCat(filterCat === parent.id ? 'all' : parent.id)}
                title={i18n.accounting.ex_filter_by_category[lang]}
                className={`text-xs px-2 py-0.5 rounded-full font-semibold transition-all ${
                  filterCat === parent.id ? 'ring-2 ring-offset-1 dark:ring-offset-gray-950' : 'hover:opacity-80'
                }`}
                style={{ backgroundColor: colorOf(parent.id) + '33', color: colorOf(parent.id) }}>
                {parent.name}
              </button>
              {children.map(c => (
                <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? 'all' : c.id)}
                  title={i18n.accounting.ex_filter_by_category[lang]}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-all ${
                    filterCat === c.id ? 'ring-2 ring-offset-1 dark:ring-offset-gray-950' : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: colorOf(c.id) + '1f', color: colorOf(c.id) }}>
                  {c.name}
                </button>
              ))}
            </span>
          ))}
          <button onClick={() => setShowManager(v => !v)}
            className="text-xs px-2 py-1 border border-dashed border-gray-300 dark:border-gray-700 rounded-full text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-colors">
            {i18n.accounting.ex_manage_categories[lang]}
          </button>
        </div>
      </div>

      {showManager && (
        <ExpenseCategoryManager
          categories={expenseCategories} expenses={expenses}
          handlers={handlers} onClose={() => setShowManager(false)} />
      )}

      {/* Période — AU-DESSUS des deux vues : c'est la même question pour la
          liste et pour le résumé, et deux réponses différentes faisaient
          diverger leurs totaux sans le dire. */}
      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
          {([
            { id: 'all',    label: i18n.common.period_all_time[lang] },
            { id: 'season', label: i18n.accounting.palm_season_label[lang].replace('{label}', currentSeason?.label ?? '') },
            { id: 'custom', label: i18n.accounting.palm_custom[lang] },
          ] as { id: Period; label: string }[]).map(opt => (
            <button key={opt.id} onClick={() => setPeriod(opt.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                period === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <MonthInput value={periodFrom} onChange={setPeriodFrom} allowEmpty />
            <span className="text-gray-400 dark:text-gray-400">→</span>
            <MonthInput value={periodTo} onChange={setPeriodTo} allowEmpty />
          </div>
        )}
        <div className="ml-auto">{detailToggle}</div>
      </div>



      {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
      {view === 'list' && (<>

        {onHeadings.map(({ category, count }) => (
          <div key={category.id}
            className="flex flex-wrap items-center gap-3 text-sm text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3">
            <span>
              {i18n.accounting.ex_on_heading[lang]
                .replace('{count}', String(count))
                .replace('{name}', category.name)}
            </span>
            <button onClick={() => setFilterCat(category.id)}
              className="ml-auto px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
              {i18n.accounting.ex_show_them[lang]}
            </button>
          </div>
        ))}

        {/* Category breakdown bar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              {i18n.accounting.ex_breakdown[lang]}
              <span className="ml-2 font-normal text-xs text-gray-400">· {periodLabel}</span>
            </p>
            {detailToggle}
          </div>
          {Object.entries(allByCat).sort((a, b) => b[1] - a[1]).map(([catId, val]) => (
            <div key={catId} className="flex items-center gap-3">
              <button onClick={() => setFilterCat(filterCat === catId ? 'all' : catId)}
                className={`w-32 text-left text-xs px-2 py-0.5 rounded-full font-semibold truncate transition-all ${
                  filterCat === catId ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: colorOf(catId) + '33', color: colorOf(catId) }}>
                {pathOf(catId)}
              </button>
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(val / allTotal) * 100}%`, backgroundColor: colorOf(catId) }} />
              </div>
              <p className="w-24 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{fmtEur(val)}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-48" />
          <MonthInput value={filterMonth} onChange={setFilterMonth} allowEmpty />
          <CategorySelect categories={expenseCategories} value={filterCat} onChange={setFilterCat}
            mode="filter" allLabel={i18n.accounting.ex_all_categories[lang]}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200" />
          {(filterCat !== 'all' || filterMonth || search) && (
            <button onClick={() => { setFilterCat('all'); setFilterMonth(''); setSearch('') }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{i18n.accounting.ex_clear[lang]}</button>
          )}
          <div className="ml-auto">
            <button onClick={() => setShowAddForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              {i18n.accounting.ex_add_expense[lang]}
            </button>
          </div>
        </div>

        {showAddForm && (
          activeCategories.length === 0
            ? <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                {i18n.accounting.ex_no_categories[lang]}
              </p>
            : <AddExpenseForm categories={activeCategories} allCategories={expenseCategories}
                onAdd={e => { handlers.addExpense(e); setShowAddForm(false) }}
                onCancel={() => setShowAddForm(false)} />
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.common.label_date[lang]}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.ex_category[lang]}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">{i18n.accounting.palm_description_col[lang]}</th>
                <th className="px-4 py-3 text-right font-semibold text-red-500 dark:text-red-400">{i18n.common.label_amount[lang]}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-400 text-sm">{i18n.accounting.ex_no_expenses_match[lang]}</td></tr>
              )}
              {filtered.map(e => editingId === e.id && editDraft ? (
                <tr key={e.id} className="border-b bg-blue-50/60 dark:bg-blue-950/30">
                  <td className="px-4 py-2">
                    <input type="date" value={editDraft.date}
                      onChange={ev => setEditDraft({ ...editDraft, date: ev.target.value })}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200" />
                  </td>
                  <td className="px-4 py-2">
                    <CategorySelect categories={activeCategories} value={editDraft.category_id ?? ''}
                      onChange={v => setEditDraft({ ...editDraft, category_id: v })}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={editDraft.description}
                      onChange={ev => setEditDraft({ ...editDraft, description: ev.target.value })}
                      onKeyDown={ev => { if (ev.key === 'Enter') saveEdit(); if (ev.key === 'Escape') cancelEdit() }}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" step="0.01" value={editAmount}
                      onChange={ev => setEditAmount(ev.target.value)}
                      onKeyDown={ev => { if (ev.key === 'Enter') saveEdit(); if (ev.key === 'Escape') cancelEdit() }}
                      className="w-28 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-900 dark:text-gray-200" />
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={saveEdit}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      {i18n.common.btn_save[lang]}
                    </button>
                    <button onClick={cancelEdit}
                      className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">×</button>
                  </td>
                </tr>
              ) : (
                <tr key={e.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                      style={{ backgroundColor: colorOf(e.category_id) + '33', color: colorOf(e.category_id) }}>
                      {pathOf(e.category_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{e.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">− {fmtEur(e.amount)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(e)} title={i18n.accounting.ex_edit_expense[lang]}
                      className="text-xs px-2 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      {i18n.accounting.ex_edit[lang]}
                    </button>
                    <button onClick={() => handlers.deleteExpense(e.id)}
                      className="ml-1 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {i18n.accounting.ex_expense_count[lang].replace('{count}', String(filtered.length)).replace('{s}', filtered.length !== 1 ? 's' : '')}
                    <span className="ml-2 font-normal text-xs text-gray-400">· {periodLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">− {fmtEur(listTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </>)}

      {/* ── SUMMARY VIEW ──────────────────────────────────────────────────── */}
      {view === 'summary' && (<>

        {/* KPI cards by category */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {summaryMatrix.cats.map(catId => {
            const id  = catId === null ? null : String(catId)
            const key = String(catId)
            const kids = id && !detailed ? childrenOf(expenseCategories, id) : []
            return (
              <div key={key} className="rounded-xl border p-4"
                style={{ borderColor: colorOf(id) + '66', backgroundColor: colorOf(id) + '11' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colorOf(id) }}>{pathOf(id)}</p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">− {fmtEur(summaryMatrix.catTotals[key] ?? 0)}</p>
                {kids.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-1 truncate" title={kids.map(k => k.name).join(', ')}>
                    {kids.map(k => k.name).join(' · ')}
                  </p>
                )}
              </div>
            )
          })}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{i18n.common.label_total[lang]}</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">− {fmtEur(summaryMatrix.grandTotal)}</p>
            <p className="text-[11px] text-gray-400 mt-1 truncate">{periodLabel}</p>
          </div>
        </div>

        {/* Month × Category table */}
        {summaryMatrix.months.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{i18n.accounting.label_month[lang]}</th>
                  {summaryMatrix.cats.map(catId => (
                    <th key={String(catId)} className="px-4 py-3 text-right font-semibold whitespace-nowrap"
                      style={{ color: colorOf(catId === null ? null : String(catId)) }}>
                      {pathOf(catId === null ? null : String(catId))}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">{i18n.common.label_total[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {[...summaryMatrix.months].reverse().map((m, mi) => {
                  const monthTotal = summaryMatrix.monthTotals[summaryMatrix.months.length - 1 - mi]
                  return (
                    <tr key={m} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtMonth(m)}</td>
                      {summaryMatrix.cats.map(catId => {
                        const val = summaryMatrix.totals[m]?.[String(catId)] ?? 0
                        return (
                          <td key={String(catId)} className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                            {val ? `− ${fmtEur(val)}` : '–'}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">− {fmtEur(monthTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 border-t font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{i18n.common.label_total[lang]}</td>
                  {summaryMatrix.cats.map(catId => (
                    <td key={String(catId)} className="px-4 py-3 text-right" style={{ color: colorOf(catId === null ? null : String(catId)) }}>
                      − {fmtEur(summaryMatrix.catTotals[String(catId)] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-red-700 dark:text-red-400">− {fmtEur(summaryMatrix.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </>)}
    </div>
  )
}
