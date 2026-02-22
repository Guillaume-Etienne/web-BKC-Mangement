import type { Booking } from '../../types/database'

interface TotalsRowProps {
  label: string
  daysInMonth: number
  bookings: Booking[]
  monthStart: Date
  type: 'lessons' | 'equipment' | 'guests'
}

export default function TotalsRow({ label, daysInMonth, bookings, monthStart, type }: TotalsRowProps) {
  // Calculer les totaux par jour
  const dailyTotals = new Array(daysInMonth).fill(0)

  for (const booking of bookings) {
    const bStart = new Date(booking.check_in + 'T00:00:00')
    const bEnd = new Date(booking.check_out + 'T00:00:00')
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)

    const visStart = bStart < monthStart ? monthStart : bStart
    const visEnd = bEnd > monthEnd ? new Date(monthEnd.getTime() + 86400000) : bEnd

    const startOffset = Math.floor((visStart.getTime() - monthStart.getTime()) / 86400000)
    const endOffset = Math.floor((visEnd.getTime() - monthStart.getTime()) / 86400000)

    const value = type === 'lessons'
      ? booking.num_lessons
      : type === 'equipment'
        ? booking.num_equipment_rentals
        : booking.participants.length

    for (let i = Math.max(0, startOffset); i < Math.min(daysInMonth, endOffset); i++) {
      dailyTotals[i] += value
    }
  }

  return (
    <div className="flex min-w-max border-b border-gray-200 bg-gray-50 font-semibold text-xs">
      {/* Label */}
      <div className="sticky left-0 z-10 shrink-0 w-20 px-2 py-2 text-xs font-bold bg-gray-100 border-r border-gray-200 flex items-center truncate">
        {label}
      </div>
      {/* Days totals */}
      <div className="shrink-0" style={{ width: `${daysInMonth * 32}px`, minHeight: '32px' }}>
        <div className="flex h-full">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const isWeekend =
              new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1).getDay() === 0
            const total = dailyTotals[i]
            return (
              <div
                key={i}
                className={`shrink-0 w-8 text-center text-xs py-1 border-r border-gray-100 flex items-center justify-center ${
                  isWeekend ? 'bg-blue-50' : ''
                } ${total > 0 ? 'text-emerald-700' : 'text-gray-400'}`}
              >
                {total > 0 ? total : '—'}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
