import type { SharedAccountingData, AccountingHandlers } from './types'
import { fmtDate } from '../../utils/dates'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'

interface Props {
  data:     SharedAccountingData
  handlers: AccountingHandlers
}

export default function UnverifiedPayments({ data, handlers }: Props) {
  const { lang } = useLanguage()
  const methodLabels: Record<string, string> = {
    cash_eur:        i18n.accounting.method_cash_eur[lang],
    cash_mzn:        i18n.accounting.method_cash_mzn[lang],
    transfer:        i18n.accounting.method_transfer[lang],
    card_palmeiras:  i18n.accounting.method_card_palmeiras[lang],
  }
  const { payments, bookings, clients } = data

  const unverified = payments
    .filter(p => !p.is_verified)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{i18n.accounting.uvp_title[lang]}</h2>
        {unverified.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
            {unverified.length}
          </span>
        )}
      </div>

      {unverified.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-gray-500 dark:text-gray-400">{i18n.accounting.uvp_all_verified[lang]}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{i18n.accounting.uvp_date_col[lang]}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{i18n.accounting.uvp_booking_col[lang]}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{i18n.accounting.uvp_client_col[lang]}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{i18n.accounting.uvp_method_col[lang]}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{i18n.accounting.uvp_amount_col[lang]}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{i18n.accounting.uvp_notes_col[lang]}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {unverified.map(p => {
                const booking = bookings.find(b => b.id === p.booking_id)
                const client  = booking ? clients.find(c => c.id === booking.client_id) : null
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="px-4 py-3">
                      {booking
                        ? <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{String(booking.booking_number).padStart(3, '0')}</span>
                        : <span className="text-gray-400 dark:text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                      {client ? `${client.first_name} ${client.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{methodLabels[p.method] ?? p.method}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{p.amount.toFixed(2)} €</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 italic text-xs max-w-xs truncate">{p.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handlers.verifyPayment(p.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                      >
                        {i18n.accounting.uvp_verify_btn[lang]}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-800 border-t">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">{i18n.accounting.uvp_total_unverified[lang]}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200">
                  {unverified.reduce((s, p) => s + p.amount, 0).toFixed(2)} €
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
