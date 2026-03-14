import type { SharedAccountingData, AccountingHandlers } from './types'

const METHOD_LABELS: Record<string, string> = {
  cash_eur:        'Cash EUR',
  cash_mzn:        'Cash MZN',
  transfer:        'Transfer',
  card_palmeiras:  'Card Palmeiras',
}

interface Props {
  data:     SharedAccountingData
  handlers: AccountingHandlers
}

export default function UnverifiedPayments({ data, handlers }: Props) {
  const { payments, bookings, clients } = data

  const unverified = payments
    .filter(p => !p.is_verified)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Unverified Payments</h2>
        {unverified.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-orange-100 text-orange-700">
            {unverified.length}
          </span>
        )}
      </div>

      {unverified.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-gray-500">All payments have been verified.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Booking</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Method</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {unverified.map(p => {
                const booking = bookings.find(b => b.id === p.booking_id)
                const client  = booking ? clients.find(c => c.id === booking.client_id) : null
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{p.date}</td>
                    <td className="px-4 py-3">
                      {booking
                        ? <span className="font-mono font-bold text-blue-600">#{String(booking.booking_number).padStart(3, '0')}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {client ? `${client.first_name} ${client.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{METHOD_LABELS[p.method] ?? p.method}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{p.amount.toFixed(2)} €</td>
                    <td className="px-4 py-3 text-gray-500 italic text-xs max-w-xs truncate">{p.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handlers.verifyPayment(p.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                      >
                        ✓ Verify
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-600">Total unverified</td>
                <td className="px-4 py-3 text-right font-bold text-gray-800">
                  {unverified.reduce((s, p) => s + p.amount, 0).toFixed(2)} €
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
