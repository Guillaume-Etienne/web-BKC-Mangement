import { useTable } from './useSupabase'
import type { Instructor } from '../types/database'

export function useInstructors() {
  return useTable<Instructor>('instructors', { order: 'last_name' })
}
