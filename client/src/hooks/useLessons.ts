import { useTable } from './useSupabase'
import type { Lesson, DayActivity } from '../types/database'

export function useLessons() {
  return useTable<Lesson>('lessons', { order: 'date' })
}

export function useDayActivities() {
  return useTable<DayActivity>('day_activities', { order: 'date' })
}
