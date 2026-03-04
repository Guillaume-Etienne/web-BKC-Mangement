import { useTable } from './useSupabase'
import type { Client } from '../types/database'

export function useClients() {
  return useTable<Client>('clients', { order: 'last_name' })
}
