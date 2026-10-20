import { ref } from 'vue'
import { eventQueries } from '../services/db/events'
import type { CalendarEventRow, NewCalendarEvent } from '../types/database'
import type { EventInput } from '../utils/calendar/eventRow'

// 模組層級 ref：整個 app 共用同一份事件，登出時 reset()
const events = ref<CalendarEventRow[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

export function useCalendarEvents() {
  async function load() {
    isLoading.value = true
    error.value = null
    try {
      events.value = await eventQueries.listAll()
    } catch (e: any) {
      console.error('Error fetching events:', e)
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  async function create(i: EventInput) {
    const row = await eventQueries.create(i)
    events.value = [...events.value, row]
    return row
  }

  async function update(id: string, i: EventInput) {
    await eventQueries.update(id, i)
    await load()
  }

  async function remove(id: string) {
    await eventQueries.remove(id)
    events.value = events.value.filter((e) => e.id !== id)
  }

  function reset() {
    events.value = []
    error.value = null
  }

  // 過渡別名：舊 CalendarView.vue 還在用，M3 新畫面接上後移除
  async function addEvent(row: NewCalendarEvent) {
    const created = await eventQueries.createRaw(row)
    events.value = [...events.value, created]
    return created
  }
  async function updateEvent(id: string, row: Partial<NewCalendarEvent>) {
    const updated = await eventQueries.updateRaw(id, row)
    events.value = events.value.map((e) => (e.id === id ? updated : e))
    return updated
  }

  return {
    events, load, create, update, remove, reset,
    isLoading, error,
    fetchEvents: load, addEvent, updateEvent, deleteEvent: remove,
  }
}
