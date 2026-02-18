import type { Booking } from '../../types/database'

const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-500',
  provisional: 'bg-amber-400',
  cancelled: 'bg-gray-400',
}

interface BookingBarProps {
  booking: Booking
  startCol: number // 1-indexed grid column start
  endCol: number   // 1-indexed grid column end (exclusive)
  totalDays: number
}

export default function BookingBar({ booking, startCol, endCol }: BookingBarProps) {
  const clientName = booking.client
    ? `${booking.client.first_name} ${booking.client.last_name}`
    : 'Client inconnu'

  return (
    <div
      className={`absolute top-1 bottom-1 rounded ${statusColors[booking.status] ?? 'bg-gray-400'} text-white text-xs flex items-center px-1 overflow-hidden whitespace-nowrap z-10 opacity-90`}
      style={{
        left: `${((startCol - 1) / (endCol - startCol + (endCol - startCol))) * 0}px`,
        gridColumnStart: startCol,
        gridColumnEnd: endCol,
      }}
      title={`${clientName} — ${booking.check_in} → ${booking.check_out} (${booking.status})`}
    >
      {clientName}
    </div>
  )
}
