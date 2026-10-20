import { ref, computed, watch } from 'vue'
import { getCpblSchedule } from '../services/cpblService'
import type { CpblSchedule } from '../types/database'
import { buildFeed } from '../utils/calendar/eventSources'
import { todayYmd } from '../utils/dateRange'
import { useCalendarEvents } from './useCalendarEvents'
import { useEventCategories } from './useEventCategories'
import { useTrips } from './useTrips'
import { useUserProfile } from './useUserProfile'

const STORAGE_KEY = 'cal.hiddenCategories'

function readHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

const hiddenCategoryIds = ref<Set<string>>(readHidden())
const games = ref<CpblSchedule[]>([])

export function useCalendarFeed() {
  const { events } = useCalendarEvents()
  const { categories } = useEventCategories()
  const { trips } = useTrips()
  const { showCpbl } = useUserProfile()

  const feed = computed(() =>
    buildFeed({
      events: events.value,
      trips: trips.value,
      games: games.value,
      categories: categories.value,
      showCpbl: showCpbl.value,
      hiddenCategoryIds: hiddenCategoryIds.value,
      today: todayYmd(),
    }),
  )

  const loadGames = async (fromYmd: string, toYmd: string) => {
    games.value = await getCpblSchedule(fromYmd, toYmd)
  }

  return { feed, hiddenCategoryIds, loadGames }
}

// 篩選變更後寫回 localStorage；寫入失敗（無痕、被封鎖）不影響畫面
watch(
  hiddenCategoryIds,
  (s) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)
