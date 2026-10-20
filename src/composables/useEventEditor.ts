import { ref } from 'vue'
import type { CalendarEventRow, CpblSchedule } from '../types/database'

// 事件編輯 sheet 的開關：MainLayout 的 FAB、CalendarHome 的詳情／比賽 sheet 共用
const isOpen = ref(false)
const editing = ref<CalendarEventRow | null>(null)
const initialDate = ref<string | null>(null)
const presetGame = ref<CpblSchedule | null>(null)

export function useEventEditor() {
  const openNew = (date?: string | null) => {
    editing.value = null
    initialDate.value = date ?? null
    presetGame.value = null
    isOpen.value = true
  }
  const openEdit = (e: CalendarEventRow) => {
    editing.value = e
    initialDate.value = null
    presetGame.value = null
    isOpen.value = true
  }
  // 從比賽 sheet 加入：新增模式並預先套用比賽資料
  const openWithGame = (g: CpblSchedule) => {
    editing.value = null
    initialDate.value = g.game_date
    presetGame.value = g
    isOpen.value = true
  }
  const close = () => {
    isOpen.value = false
  }
  return { isOpen, editing, initialDate, presetGame, openNew, openEdit, openWithGame, close }
}
