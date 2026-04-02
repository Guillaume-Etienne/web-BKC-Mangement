import { useMemo, useState } from 'react'
import type { SharedAccountingData } from './types'
import { countNights, getRoomNightlyRate, fmtEur } from './utils'

interface Props { data: SharedAccountingData }

export default function HousesTab({ data }: Props) {
  const { accommodations, rooms, houseRentals, bookingRooms, bookings, bookingRoomPrices, seasons } = data

  const houses    = useMemo(() => accommodations.filter(a => a.type === 'house'),    [accommodations])
  const bungalows = useMemo(() => accommodations.filter(a => a.type === 'bungalow'), [accommodations])

  const currentSeason = seasons[seasons.length - 1]
  const [period, setPeriod] = useState<'all' | 'season'>('season')

  // ── Per-house stats ────────────────────────────────────────────────────────
  const houseStats = useMemo(() => {
    return houses.map(house => {
      const houseRooms = rooms.filter(r => r.accommodation_id === house.id)
      const roomIds    = new Set(houseRooms.map(r => r.id))

      let rentals = houseRentals.filter(r => r.accommodation_id === house.id)
      if (period === 'season' && currentSeason) {
        rentals = rentals.filter(
          r => r.end_date >= currentSeason.start_date && r.start_date <= currentSeason.end_date
        )
      }
      const totalRentalCost = rentals.reduce((s, r) => s + r.total_cost, 0)

      const bookingLines: { bookingId: string; roomId: string; roomName: string; checkIn: string; checkOut: string; nights: number; rate: number; revenue: number }[] = []

      for (const br of bookingRooms) {
        if (!roomIds.has(br.room_id)) continue
        const booking = bookings.find(b => b.id === br.booking_id)
        if (!booking || booking.status === 'cancelled') continue
        if (period === 'season' && currentSeason) {
          if (booking.check_out <= currentSeason.start_date || booking.check_in >= currentSeason.end_date) continue
        }
        const nights  = countNights(booking.check_in, booking.check_out)
        const rate    = getRoomNightlyRate(booking.id, br.room_id, data)
        const revenue = nights * rate
        const room    = houseRooms.find(r => r.id === br.room_id)
        bookingLines.push({ bookingId: booking.id, roomId: br.room_id, roomName: room?.name ?? '?', checkIn: booking.check_in, checkOut: booking.check_out, nights, rate, revenue })
      }
      bookingLines.sort((a, b) => b.checkIn.localeCompare(a.checkIn))

      const totalRevenue = bookingLines.reduce((s, l) => s + l.revenue, 0)
      const balance      = totalRevenue - totalRentalCost

      return { house, houseRooms, rentals, totalRentalCost, bookingLines, totalRevenue, balance }
    })
  }, [houses, rooms, houseRentals, bookingRooms, bookings, period, currentSeason, data])

  // ── Per-bungalow stats ─────────────────────────────────────────────────────
  const bungStats = useMemo(() => {
    return bungalows.map(bung => {
      const bungRooms = rooms.filter(r => r.accommodation_id === bung.id)
      const roomIds   = new Set(bungRooms.map(r => r.id))
      const costRate  = bung.cost_per_night ?? 0

      const bookingLines: { bookingId: string; clientName: string; checkIn: string; checkOut: string; nights: number; sellRate: number; revenue: number; cost: number; margin: number }[] = []

      for (const br of bookingRooms) {
        if (!roomIds.has(br.room_id)) continue
        const booking = bookings.find(b => b.id === br.booking_id)
        if (!booking || booking.status === 'cancelled') continue
        if (period === 'season' && currentSeason) {
          if (booking.check_out <= currentSeason.start_date || booking.check_in >= currentSeason.end_date) continue
        }
        const nights   = countNights(booking.check_in, booking.check_out)
        const sellRate = bookingRoomPrices.find(p => p.booking_id === br.booking_id && p.room_id === br.room_id)?.price_per_night ?? 0
        const revenue  = sellRate * nights
        const cost     = costRate * nights
        const client   = data.clients.find(c => c.id === booking.client_id)
        bookingLines.push({
          bookingId:  booking.id,
          clientName: client ? `${client.first_name} ${client.last_name}` : `#${booking.booking_number}`,
          checkIn:    booking.check_in,
          checkOut:   booking.check_out,
          nights, sellRate, revenue, cost,
          margin:     revenue - cost,
        })
      }
      bookingLines.sort((a, b) => b.checkIn.localeCompare(a.checkIn))

      const totalRevenue = bookingLines.reduce((s, l) => s + l.revenue, 0)
      const totalCost    = bookingLines.reduce((s, l) => s + l.cost, 0)
      const totalMargin  = totalRevenue - totalCost

      return { bung, costRate, bookingLines, totalRevenue, totalCost, totalMargin }
    })
  }, [bungalows, rooms, bookingRooms, bookings, bookingRoomPrices, period, currentSeason, data.clients])

  const grandHouseRent    = houseStats.reduce((s, h) => s + h.totalRentalCost, 0)
  const grandHouseRevenue = houseStats.reduce((s, h) => s + h.totalRevenue, 0)
  const grandBungRevenue  = bungStats.reduce((s, b) => s + b.totalRevenue, 0)
  const grandBungCost     = bungStats.reduce((s, b) => s + b.totalCost, 0)
  const grandRevenue      = grandHouseRevenue + grandBungRevenue
  const grandCost         = grandHouseRent + grandBungCost
  const grandBalance      = grandRevenue - grandCost

  return (
    <div className="space-y-6">

      {/* Period selector */}
      <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 w-fit">
        {([
          { id: 'season', label: `Season ${currentSeason?.label ?? ''}` },
          { id: 'all',    label: 'All time' },
        ] as { id: 'all' | 'season'; label: string }[]).map(opt => (
          <button key={opt.id} onClick={() => setPeriod(opt.id)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              period === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-1">Total costs</p>
          <p className="text-xl font-bold text-red-700">− {fmtEur(grandCost)}</p>
          <p className="text-xs text-red-400 mt-0.5">Houses: {fmtEur(grandHouseRent)} · Bungalows: {fmtEur(grandBungCost)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-1">Booking revenue</p>
          <p className="text-xl font-bold text-emerald-700">+ {fmtEur(grandRevenue)}</p>
          <p className="text-xs text-emerald-400 mt-0.5">Houses: {fmtEur(grandHouseRevenue)} · Bungalows: {fmtEur(grandBungRevenue)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${grandBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${grandBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Balance</p>
          <p className={`text-xl font-bold ${grandBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {grandBalance >= 0 ? '+' : ''}{fmtEur(grandBalance)}
          </p>
        </div>
      </div>

      {/* ── Houses section ─────────────────────────────────────────────────── */}
      {houses.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">🏠 Houses</h2>
          <div className="space-y-4">
            {houseStats.map(({ house, rentals, totalRentalCost, bookingLines, totalRevenue, balance }) => (
              <div key={house.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{house.name}</h3>
                    {!house.is_active && <span className="text-xs text-gray-400 ml-2">inactive</span>}
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span className="text-red-600 font-medium">Rent: − {fmtEur(totalRentalCost)}</span>
                    <span className="text-emerald-700 font-medium">Revenue: + {fmtEur(totalRevenue)}</span>
                    <span className={`font-bold ${balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {balance >= 0 ? '+' : ''}{fmtEur(balance)}
                    </span>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                  {/* Rental periods */}
                  <div>
                    <div className="px-4 py-3 border-b">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rental periods</h4>
                    </div>
                    {rentals.length === 0 ? (
                      <p className="px-4 py-6 text-gray-400 text-sm text-center">No rental periods{period === 'season' ? ' this season' : ''}.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">From</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">To</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-red-400">Cost (€)</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...rentals].sort((a, b) => b.start_date.localeCompare(a.start_date)).map(r => (
                            <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{r.start_date}</td>
                              <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{r.end_date}</td>
                              <td className="px-4 py-2 text-right text-red-600 font-medium">− {fmtEur(r.total_cost)}</td>
                              <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-[120px]">{r.notes ?? ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {/* Booking revenue */}
                  <div>
                    <div className="px-4 py-3 border-b">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Booking revenue</h4>
                    </div>
                    {bookingLines.length === 0 ? (
                      <p className="px-4 py-6 text-gray-400 text-sm text-center">No bookings{period === 'season' ? ' this season' : ''}.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Room</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Period</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400">Nights</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400">Rate</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-emerald-500">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookingLines.map((line, i) => (
                            <tr key={`${line.bookingId}-${line.roomId}-${i}`} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-700">{line.roomName}</td>
                              <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{line.checkIn} → {line.checkOut}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{line.nights}</td>
                              <td className="px-4 py-2 text-right text-gray-400 text-xs">{fmtEur(line.rate)}/n</td>
                              <td className="px-4 py-2 text-right text-emerald-700 font-medium">+ {fmtEur(line.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bungalows section ──────────────────────────────────────────────── */}
      {bungalows.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">🏡 Bungalows</h2>
          <div className="space-y-4">
            {bungStats.map(({ bung, costRate, bookingLines, totalRevenue, totalCost, totalMargin }) => (
              <div key={bung.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{bung.name}</h3>
                    <span className="text-xs text-gray-400">Cost: {fmtEur(costRate)}/night</span>
                    {!bung.is_active && <span className="text-xs text-gray-400 ml-2">inactive</span>}
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span className="text-red-600 font-medium">Cost: − {fmtEur(totalCost)}</span>
                    <span className="text-emerald-700 font-medium">Revenue: + {fmtEur(totalRevenue)}</span>
                    <span className={`font-bold ${totalMargin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      Margin: {totalMargin >= 0 ? '+' : ''}{fmtEur(totalMargin)}
                    </span>
                  </div>
                </div>
                {bookingLines.length === 0 ? (
                  <p className="px-4 py-6 text-gray-400 text-sm text-center">No bookings{period === 'season' ? ' this season' : ''}.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Client</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Period</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400">Nights</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-red-400">Cost/n</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-emerald-500">Sell/n</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-blue-500">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingLines.map((line, i) => (
                        <tr key={`${line.bookingId}-${i}`} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-700">{line.clientName}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{line.checkIn} → {line.checkOut}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{line.nights}</td>
                          <td className="px-4 py-2 text-right text-red-500">{fmtEur(costRate)}</td>
                          <td className="px-4 py-2 text-right text-emerald-600">{fmtEur(line.sellRate)}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${line.margin >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                            {line.margin >= 0 ? '+' : ''}{fmtEur(line.margin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {houses.length === 0 && bungalows.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No accommodations configured. Add them in Management → Accommodations.
        </div>
      )}

    </div>
  )
}
