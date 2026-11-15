import { useState } from 'react'
import { sortKitesBySize } from '../../utils/kiteSort'
import type { Booking, BookingParticipant, Client, Equipment, EquipmentRental, PriceItem, RentalSlot } from '../../types/database'
import { rentalBillable } from '../../types/database'
import { useLanguage } from '../../contexts/LanguageContext'
import { i18n } from '../../data/i18n'
import { RENTAL_TYPES, boardPickerCategory, rentalGear, rentalKind, rentalLabel, showsKitePicker, type RentalKind } from './rentalTypes'
import GuestPicker from './GuestPicker'

interface Props {
  rental: EquipmentRental
  equipment: Equipment[]
  bookings: Booking[]
  bookingParticipants: BookingParticipant[]
  clients: Client[]
  priceItems: PriceItem[]
  onSave: (r: EquipmentRental) => void
  onClose: () => void
  /** Left out where deleting is not offered (the accounting page). */
  onDelete?: (id: string) => void
}

/** Full edit form of one equipment rental (guest, type, gear, slot, price, notes).
 *  Shared by the Planning and the Accounting pages: both open the very same form. */
export default function EditRentalModal({
  rental, equipment, bookings, bookingParticipants, clients, priceItems, onSave, onClose, onDelete,
}: Props) {
  const { lang } = useLanguage()

  // Rate from Options → Pricing, keyed by what it bills (never by name).
  // null = nothing configured for that type; 'free' is 0 by definition.
  function rentalPrice(type: RentalKind, slot: RentalSlot): number | null {
    if (type === 'free') return 0
    return priceItems.find(p => p.billable_type === rentalBillable(type, slot))?.price ?? null
  }

  const initialType = rentalKind(rental, equipment) ?? 'free'
  const [price, setPrice] = useState(String(rental.price))
  const [slot, setSlot] = useState<RentalSlot>(rental.slot)
  const [participantId, setParticipantId] = useState(rental.participant_id ?? '')
  const [type, setType] = useState<RentalKind>(initialType)
  // The inverse of rentalGear. Older rows hold one piece of gear and their type
  // was deduced from its category, so the same rule sorts it into the right slot.
  const [kiteId, setKiteId] = useState<string | null>(showsKitePicker(initialType) ? rental.equipment_id : null)
  const [boardId, setBoardId] = useState<string | null>(
    initialType === 'full' ? rental.board_equipment_id ?? null : boardPickerCategory(initialType) ? rental.equipment_id : null,
  )
  const [notes, setNotes] = useState(rental.notes ?? '')
  const [clientNote, setClientNote] = useState(rental.client_note ?? '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(price)
    if (isNaN(parsed) || parsed < 0) return
    // The frozen grid price only moves when what is rented changes (or was never
    // recorded): editing a note or a discount must not re-grid an old rental.
    const sameProduct = rental.rental_type === type && rental.slot === slot
    const bookingId = participantId ? bookingParticipants.find(p => p.id === participantId)?.booking_id : undefined
    onSave({
      ...rental,
      price: parsed,
      slot,
      participant_id: participantId || null,
      booking_id: bookingId || rental.booking_id,
      ...rentalGear(type, kiteId, boardId),
      rental_type: type,
      list_price: sameProduct && rental.list_price != null ? rental.list_price : rentalPrice(type, slot),
      notes: notes || null,
      client_note: clientNote || null,
    })
  }

  function remove() {
    if (!onDelete) return
    if (confirm(i18n.planning.msg_confirm_delete_rental[lang])) onDelete(rental.id)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { e.stopPropagation(); onClose() }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{i18n.planning.title_edit_rental[lang]}</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3 overflow-y-auto min-h-0 flex-1">
          {/* Participant */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Guest (tap again to clear)</label>
            <GuestPicker
              date={rental.date}
              selectedIds={participantId ? [participantId] : []}
              onToggle={id => setParticipantId(prev => prev === id ? '' : id)}
              bookings={bookings} bookingParticipants={bookingParticipants} clients={clients}
            />
          </div>
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
            <div className="grid grid-cols-3 gap-1">
              {RENTAL_TYPES.map(rt => (
                <button key={rt.key} type="button"
                  onClick={() => {
                    // Same rule as the slot: a price that still equals the old rate follows the new type.
                    if (price === String(rentalPrice(type, slot) ?? 0)) {
                      setPrice(String(rentalPrice(rt.key, slot) ?? 0))
                    }
                    if (boardPickerCategory(rt.key) !== boardPickerCategory(type)) setBoardId(null)
                    setType(rt.key)
                  }}
                  className={`text-xs py-1.5 px-1 rounded border text-center leading-tight transition-colors ${type === rt.key ? 'bg-amber-500 border-amber-600 dark:border-amber-500 text-white font-semibold' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-800'}`}>
                  <div>{rt.icon}</div>
                  <div>{rt.label}</div>
                </button>
              ))}
            </div>
          </div>
          {/* Equipment */}
          {showsKitePicker(type) && (
            <select value={kiteId ?? ''} onChange={e => setKiteId(e.target.value || null)}
              className="w-full text-sm border rounded px-2 py-1.5">
              <option value="">🪂 Kite — not specified</option>
              {sortKitesBySize(equipment.filter(e => e.category === 'kite' && e.is_active)).map(e => (
                <option key={e.id} value={e.id}>🪂 {e.name}</option>
              ))}
            </select>
          )}
          {boardPickerCategory(type) && (
            <select value={boardId ?? ''} onChange={e => setBoardId(e.target.value || null)}
              className="w-full text-sm border rounded px-2 py-1.5">
              <option value="">🏄 {rentalLabel(type === 'full' ? 'board' : type, 'staff')} — not specified</option>
              {equipment.filter(e => e.category === boardPickerCategory(type) && e.is_active).map(e => (
                <option key={e.id} value={e.id}>🏄 {e.name}</option>
              ))}
            </select>
          )}
          {/* Slot + Price */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Slot</label>
              <select value={slot} onChange={e => {
                const next = e.target.value as RentalSlot
                // The price follows the slot's rate unless it was typed by hand.
                if (price === String(rentalPrice(type, slot) ?? 0)) {
                  setPrice(String(rentalPrice(type, next) ?? 0))
                }
                setSlot(next)
              }}
                className="w-full text-sm border rounded px-2 py-1.5">
                <option value="morning">{i18n.planning.slot_morning[lang]}</option>
                <option value="afternoon">{i18n.planning.slot_afternoon[lang]}</option>
                <option value="full_day">{i18n.planning.slot_full_day[lang]}</option>
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Price (€)</label>
              <input type="number" min="0" step="0.5"
                value={price} onChange={e => setPrice(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1.5 text-right font-semibold" />
            </div>
          </div>
          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note for us (internal)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional" className="w-full text-sm border rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note for the guest (visible on their page)</label>
            <input type="text" value={clientNote} onChange={e => setClientNote(e.target.value)}
              placeholder="Optional" className="w-full text-sm border rounded px-2 py-1.5" />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            {onDelete && (
              <button type="button" onClick={remove}
                className="px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded font-medium text-sm">{i18n.common.btn_delete[lang]}</button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium text-sm">{i18n.common.btn_cancel[lang]}</button>
            <button type="submit"
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">{i18n.common.btn_save[lang]}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
