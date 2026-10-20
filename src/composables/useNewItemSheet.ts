import { ref } from 'vue'

// 「新增」bottom sheet 的開關：MainLayout 的 FAB 與 DayListSheet 的「＋在這天新增」共用
const isOpen = ref(false)
const date = ref<string | undefined>(undefined)

export function useNewItemSheet() {
  const open = (d?: string | null) => {
    date.value = d ?? undefined
    isOpen.value = true
  }
  const close = () => {
    isOpen.value = false
  }
  return { isOpen, date, open, close }
}
