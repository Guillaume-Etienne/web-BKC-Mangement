import type { TaxiTripType, TaxiTripStatus } from '../types/database'

// User-facing copy for the public taxi share pages (driver + manager), in PT / EN.
// Drivers and the taxi manager are Mozambican → Portuguese by default, English toggle
// so the center can re-read. Pattern mirrors formI18n.ts: access with tr.key[lang].

export type TaxiLang = 'pt' | 'en'

export const TAXI_LANGS: { code: TaxiLang; flag: string; label: string }[] = [
  { code: 'pt', flag: '🇲🇿', label: 'Português' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
]

type Tr = Record<TaxiLang, string>

export const tr = {
  // ── Driver page ───────────────────────────────────────────────────────────
  driver_statement: { pt: 'Extrato do motorista', en: 'Driver statement' },
  manager_statement:{ pt: 'Resumo do gestor',     en: 'Manager summary' },

  // Money block
  my_money:       { pt: 'O meu dinheiro 💰',  en: 'My money 💰' },
  // {amount} and {count} are interpolated by fmt()
  earned_line:    { pt: 'Já ganhaste {amount} com {count}.',      en: "You've already earned {amount} on {count}." },
  upcoming_line:  { pt: 'Vais ganhar {amount} com {count}.',      en: "You'll earn {amount} on {count}." },
  total_line:     { pt: 'No total: {amount} ({count}).',          en: 'In total: {amount} ({count}).' },
  trips_done:     { pt: '{count} viagens terminadas',            en: '{count} completed trips' },
  trips_upcoming: { pt: '{count} viagens marcadas',              en: '{count} upcoming trips' },
  trips_all:      { pt: '{count} viagens',                       en: '{count} trips' },

  // Sections
  upcoming_trips:  { pt: 'Próximas viagens',   en: 'Upcoming trips' },
  completed_trips: { pt: 'Viagens terminadas', en: 'Completed trips' },
  no_trips:        { pt: 'Sem viagens.',       en: 'No trips.' },

  // Columns / card fields
  col_date:   { pt: 'Data',        en: 'Date' },
  col_time:   { pt: 'Hora',        en: 'Time' },
  col_route:  { pt: 'Trajeto',     en: 'Route' },
  col_client: { pt: 'Cliente',     en: 'Client' },
  col_pax:    { pt: 'Pessoas',     en: 'Pax' },
  col_bags:   { pt: 'Malas',       en: 'Bags' },
  col_boards: { pt: 'Pranchas',    en: 'Boards' },
  col_notes:  { pt: 'Notas',       en: 'Notes' },
  col_amount: { pt: 'Valor (MZN)', en: 'Amount (MZN)' },
  total:      { pt: 'Total',       en: 'Total' },

  // Card-only short labels (e.g. "3 pessoas · 2 malas · 1 prancha")
  unit_pax:    { pt: 'pessoas', en: 'pax' },
  unit_bags:   { pt: 'malas',   en: 'bags' },
  unit_boards: { pt: 'pranchas',en: 'boards' },

  // Options bar
  opt_view_cards: { pt: 'Cartões', en: 'Cards' },
  opt_view_table: { pt: 'Tabela',  en: 'Table' },

  footer_updated: { pt: 'Atualizado', en: 'Updated' },
  not_found:      { pt: 'Não encontrado.', en: 'Not found.' },
  loading:        { pt: 'A carregar…', en: 'Loading…' },

  // ── Manager page ────────────────────────────────────────────────────────
  col_driver:      { pt: 'Motorista', en: 'Driver' },
  mgr_all_trips:   { pt: 'Todas as viagens', en: 'All trips' },
  mgr_by_driver:   { pt: 'Por motorista',    en: 'By driver' },
  fin_title:       { pt: 'As minhas finanças 💰', en: 'My finances 💰' },
  fin_earned:      { pt: 'Comissão ganha',        en: 'Commission earned' },
  fin_paid:        { pt: 'Adiantamentos recebidos', en: 'Advances received' },
  fin_balance_due: { pt: 'Saldo a receber',       en: 'Balance to receive' },
  fin_overpaid:    { pt: 'Recebido a mais',       en: 'Overpaid (credit)' },
  fin_balanced:    { pt: 'Tudo certo',            en: 'All settled' },
  fin_explain:     { pt: 'Saldo = comissão ganha − adiantamentos recebidos', en: 'Balance = commission earned − advances received' },
  history_title:   { pt: 'Histórico de pagamentos', en: 'Payment history' },
  col_reason:      { pt: 'Motivo', en: 'Reason' },
  no_payments:     { pt: 'Sem pagamentos ainda.', en: 'No payments yet.' },

  // ── Public taxi schedule ────────────────────────────────────────────────
  public_title:     { pt: 'Horário dos táxis', en: 'Taxi schedule' },
  public_sub:       { pt: 'Atualizado em tempo real · Sem dados financeiros', en: 'Updated live · No financial data' },
  filter_all_drivers:{ pt: 'Todos os motoristas', en: 'All drivers' },
  show_past:        { pt: 'Mostrar viagens passadas', en: 'Show past trips' },
  today:            { pt: 'Hoje', en: 'Today' },
  unassigned:       { pt: 'Não atribuído', en: 'Unassigned' },
  no_upcoming:      { pt: 'Nenhuma viagem prevista', en: 'No upcoming trips' },
  seats_free:       { pt: '{n} lugares livres', en: '{n} seats free' },
  seats_full:       { pt: 'Lotado', en: 'Full' },
} satisfies Record<string, Tr>

// ── Enum label helpers ────────────────────────────────────────────────────────

const TRIP_TYPE: Record<TaxiTripType, Tr> = {
  'aero-to-center': { pt: 'Aeroporto → Centro', en: 'Airport → Center' },
  'center-to-aero': { pt: 'Centro → Aeroporto', en: 'Center → Airport' },
  'aero-to-spot':   { pt: 'Aeroporto → Spot',   en: 'Airport → Spot' },
  'spot-to-aero':   { pt: 'Spot → Aeroporto',   en: 'Spot → Airport' },
  'center-to-town': { pt: 'Centro → Vila',      en: 'Center → Town' },
  'town-to-center': { pt: 'Vila → Centro',      en: 'Town → Center' },
  'other':          { pt: 'Outro',              en: 'Other' },
}

const STATUS: Record<TaxiTripStatus, Tr> = {
  confirmed:     { pt: 'Confirmado',      en: 'Confirmed' },
  needs_details: { pt: 'Faltam detalhes', en: 'Details needed' },
  done:          { pt: 'Concluído',       en: 'Done' },
}

export const tripTypeLabel = (type: TaxiTripType, lang: TaxiLang): string =>
  (TRIP_TYPE[type] ?? TRIP_TYPE.other)[lang]

export const statusLabel = (status: TaxiTripStatus, lang: TaxiLang): string =>
  STATUS[status][lang]

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Interpolate {placeholders} in a template string. */
export const fmt = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))

/** Amount in MZN, grouped with a thin space, e.g. "12 000 MZN". */
export const mzn = (n: number): string => `${n.toLocaleString('pt-PT')} MZN`

const WEEKDAYS: Record<TaxiLang, string[]> = {
  pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

export type DateMode = 'readable' | 'iso'
export type ViewMode = 'cards' | 'table'

/** ISO date → "Seg 30/06" (readable) or the raw ISO string. */
export function formatTripDate(iso: string, lang: TaxiLang, mode: DateMode): string {
  if (mode === 'iso') return iso
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  const wd = WEEKDAYS[lang][d.getDay()]
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${wd} ${dd}/${mm}`
}
