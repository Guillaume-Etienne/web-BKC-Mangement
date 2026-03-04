import { useTable } from './useSupabase'
import type { Accommodation, Room } from '../types/database'

export function useAccommodations() {
  return useTable<Accommodation>('accommodations', { order: 'name' })
}

export function useRooms() {
  return useTable<Room>('rooms', { order: 'name' })
}
