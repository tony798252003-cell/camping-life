import { ref } from 'vue'
import { todayYmd } from '../utils/dateRange'

// 共用的「今天」：頁面重新可見、或跨過台北午夜時更新
const today = ref(todayYmd())
let started = false

function refresh() {
  today.value = todayYmd()
}

function scheduleMidnight() {
  const now = Date.now()
  const next = new Date(`${todayYmd()}T00:00:00+08:00`).getTime() + 86400000
  setTimeout(() => {
    refresh()
    scheduleMidnight()
  }, Math.max(next - now, 1000) + 500)
}

export function useToday() {
  if (!started && typeof document !== 'undefined') {
    started = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh()
    })
    scheduleMidnight()
  }
  return today
}
