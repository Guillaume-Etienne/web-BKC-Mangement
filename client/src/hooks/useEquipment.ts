import { useTable } from './useSupabase'
import type { Equipment, EquipmentRental } from '../types/database'

export function useEquipment() {
  return useTable<Equipment>('equipment', { order: 'name' })
}

export function useEquipmentRentals() {
  return useTable<EquipmentRental>('equipment_rentals', { order: 'date', ascending: false })
}
