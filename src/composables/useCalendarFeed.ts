import { ref, computed, watch } from 'vue'
import { getCpblSchedule } from '../services/cpblService'
import type { CpblSchedule } from '../types/database'
import { buildFeed } from '../utils/calendar/eventSources'
import { isOwnerFilter, type OwnerFilter } from '../utils/calendar/ownerFilter'
import { todayYmd } from '../utils/dateRange'
import { useCalendarEvents } from './useCalendarEvents'
import { useAuth } from './useAuth'
import { useEventCategories } from './useEventCategories'
import { useFamily } from './useFamily'
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

const OWNER_KEY = 'cal.ownerFilter'

function readOwnerFilter(): OwnerFilter {
  try {
    const raw = localStorage.getItem(OWNER_KEY)
    return isOwnerFilter(raw) ? raw : 'all'
  } catch {
    return 'all'
  }
}

const ownerFilter = ref<OwnerFilter>(readOwnerFilter())
const hiddenCategoryIds = ref<Set<string>>(readHidden())
const games = ref<CpblSchedule[]>([])
// 月曆上最後點選的日期（YYYY-MM-DD）；FAB 新增時當預設日期
const selectedDate = ref<string | null>(null)

export function useCalendarFeed() {
  const { events } = useCalendarEvents()
  const { categories } = useEventCategories()
  const { trips } = useTrips()
  const { showCpbl } = useUserProfile()
  const { session } = useAuth()
  const { names } = useFamily()

  const feed = computed(() =>
    buildFeed({
      events: events.value,
      trips: trips.value,
      games: games.value,
      categories: categories.value,
      showCpbl: showCpbl.value,
      hiddenCategoryIds: hiddenCategoryIds.value,
      today: todayYmd(),
      ctx: { meId: session.value?.user?.id ?? null, names: names.value },
    }),
  )

  const loadGames = async (fromYmd: string, toYmd: string) => {
    games.value = await getCpblSchedule(fromYmd, toYmd)
  }

  return { feed, hiddenCategoryIds, ownerFilter, selectedDate, games, loadGames }
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

watch(ownerFilter, (v) => {
  try {
    localStorage.setItem(OWNER_KEY, v)
  } catch {
    /* ignore */
  }
})
