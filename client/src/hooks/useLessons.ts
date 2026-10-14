import { useMemo } from 'react'
import { useTable } from './useSupabase'
import type { Lesson, LessonRiderGear, DayActivity } from '../types/database'

/** Lessons with each rider's gear attached as `rider_gear`. The gear is a second
 *  query merged here rather than an embedded select: if its table is missing
 *  (migration not run yet) the lessons themselves still load. */
export function useLessons() {
  const lessons = useTable<Lesson>('lessons', { order: 'date' })
  const gear = useTable<LessonRiderGear>('lesson_participant_gear')
  const data = useMemo(() => {
    if (gear.data.length === 0) return lessons.data
    const byLesson = new Map<string, LessonRiderGear[]>()
    for (const g of gear.data) {
      const list = byLesson.get(g.lesson_id)
      if (list) list.push(g); else byLesson.set(g.lesson_id, [g])
    }
    return lessons.data.map(l => byLesson.has(l.id) ? { ...l, rider_gear: byLesson.get(l.id) } : l)
  }, [lessons.data, gear.data])
  return { ...lessons, data }
}

export function useDayActivities() {
  return useTable<DayActivity>('day_activities', { order: 'date' })
}
