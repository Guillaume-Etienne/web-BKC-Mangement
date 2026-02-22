import type { Booking } from '../../types/database'
import { CELL_W } from '../../hooks/useBookingDrag'

interface TotalsRowProps {
  label: string
  totalDays: number
  seasonStart: Date
  bookings: Booking[]
  type: 'lessons' | 'equipment' | 'guests'
}

export default function TotalsRow({ label, totalDays, seasonStart, bookings, type }: TotalsRowProps) {
  const dailyTotals = new Array(totalDays).fill(0)

  for (const booking of bookings) {
    const bStart = new Date(booking.check_in + 'T00:00:00')
    const bEnd = new Date(booking.check_out + 'T00:00:00')
    const startOffset = Math.max(0, Math.round((bStart.getTime() - seasonStart.getTime()) / 86400000))
    const endOffset = Math.min(totalDays, Math.round((bEnd.getTime() - seasonStart.getTime()) / 86400000))
    const value = type === 'lessons'
      ? booking.num_lessons
      : type === 'equipment'
        ? booking.num_equipment_rentals
        : booking.participants.length

    for (let i = startOffset; i < endOffset; i++) {
      dailyTotals[i] += value
    }
  }

  return (
    <div className="flex min-w-max border-b border-gray-200 bg-gray-50 text-xs">
      <div className="sticky left-0 z-10 shrink-0 w-20 px-2 py-2 text-xs font-bold bg-gray-100 border-r border-gray-200 flex items-center truncate">
        {label}
      </div>
      <div className="shrink-0" style={{ width: `${totalDays * CELL_W}px`, minHeight: '28px' }}>
        <div className="flex h-full">
          {Array.from({ length: totalDays }, (_, i) => {
            const d = new Date(seasonStart.getTime() + i * 86400000)
            const dow = d.getDay()
            const total = dailyTotals[i]
            return (
              <div
                key={i}
                className={`shrink-0 text-center py-1 border-r flex items-center justify-center ${
                  dow === 0 ? 'border-r-gray-300' : 'border-r-gray-100'
                } ${dow === 0 || dow === 6 ? 'bg-blue-50' : ''} ${
                  total > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-300'
                }`}
                style={{ width: CELL_W }}
              >
                {total > 0 ? total : '·'}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
