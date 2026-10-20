<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CalendarHeader, { type CalendarViewMode } from './CalendarHeader.vue'
import MonthGrid from './MonthGrid.vue'
import AgendaList from './AgendaList.vue'
import DayListSheet from './DayListSheet.vue'
import EventDetailSheet from './EventDetailSheet.vue'
import CpblGameSheet from './CpblGameSheet.vue'
import { useCalendarFeed } from '../../composables/useCalendarFeed'
import { useCalendarEvents } from '../../composables/useCalendarEvents'
import { useEventCategories } from '../../composables/useEventCategories'
import { useEventEditor } from '../../composables/useEventEditor'
import { useNewItemSheet } from '../../composables/useNewItemSheet'
import { useTripModal } from '../../composables/useTripModal'
import { useTrips } from '../../composables/useTrips'
import { useUserProfile } from '../../composables/useUserProfile'
import { agendaRange, dayClickAction, eventsOnDay } from '../../utils/calendar/agendaRange'
import { buildMonthWeeks } from '../../utils/calendar/monthLayout'
import type { CpblSchedule } from '../../types/database'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { addDays, todayYmd } from '../../utils/dateRange'

// App.vue 會把 trips、session 等 props 全部丟給 router-view，這裡都不需要，不能落到根元素
defineOptions({ inheritAttrs: false })

const route = useRoute()
const router = useRouter()
const { feed, hiddenCategoryIds, selectedDate, games, loadGames } = useCalendarFeed()
const { fetchEvents } = useCalendarEvents()
const { categories, load: loadCategories } = useEventCategories()
const { showCpbl, setShowCpbl } = useUserProfile()
const { findTripById } = useTrips()
const { openEdit } = useTripModal()
const newItem = useNewItemSheet()
const eventEditor = useEventEditor()

const YMD = /^\d{4}-\d{2}-\d{2}$/
const today = computed(() => todayYmd())
const view = computed<CalendarViewMode>(() => {
  const v = route.query.view
  return v === 'week' || v === 'day' ? v : 'month'
})
const date = computed(() => {
  const d = route.query.date
  return typeof d === 'string' && YMD.test(d) ? d : today.value
})
const year = computed(() => Number(date.value.slice(0, 4)))
const month = computed(() => Number(date.value.slice(5, 7)))

const setQuery = (patch: { view?: CalendarViewMode; date?: string }) =>
  router.replace({ query: { ...route.query, view: patch.view ?? view.value, date: patch.date ?? date.value } })

const shiftMonth = (n: number) => {
  const idx = year.value * 12 + (month.value - 1) + n
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  // 切到今天所在的月份時，date 直接用今天
  return today.value.startsWith(first.slice(0, 7)) ? today.value : first
}
const step = (n: 1 | -1) =>
  setQuery({ date: view.value === 'month' ? shiftMonth(n) : addDays(date.value, n * (view.value === 'week' ? 7 : 1)) })

const title = computed(() => `${year.value}年${month.value}月`)

const range = computed(() => agendaRange(year.value, month.value, today.value))
const agendaItems = computed(() => feed.value.filter((e) => e.startDate <= range.value.to && e.endDate >= range.value.from))

// 月格會顯示鄰月日期，賽程要抓整個可見範圍
const visibleRange = computed(() => {
  const weeks = buildMonthWeeks(year.value, month.value)
  return { from: weeks[0]![0]!, to: weeks[weeks.length - 1]![6]! }
})
watch(
  [visibleRange, showCpbl],
  async ([r, on]) => {
    if (!on) return
    try {
      await loadGames(r.from, r.to)
    } catch (e) {
      console.error('[CalendarHome] loadGames error:', e)
    }
  },
  { immediate: true },
)

onMounted(() => {
  loadCategories()
  fetchEvents()
})

const toggleCategory = (id: string) => {
  const next = new Set(hiddenCategoryIds.value)
  if (!next.delete(id)) next.add(id)
  hiddenCategoryIds.value = next
}

const highlight = ref<string | undefined>(undefined)
let highlightTimer: ReturnType<typeof setTimeout> | undefined
const sheetDate = ref<string | null>(null)

const onSelectDay = async (ymd: string) => {
  selectedDate.value = ymd
  if (dayClickAction(ymd, range.value, feed.value) === 'sheet') {
    sheetDate.value = ymd
    return
  }
  await nextTick()
  document.querySelector(`[data-day="${ymd}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  highlight.value = ymd
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => (highlight.value = undefined), 1500)
}

const detailEventId = ref<string | null>(null)
const gameSheet = ref<CpblSchedule | null>(null)

const onOpen = (ev: ViewEvent) => {
  if (ev.source === 'trip') {
    const trip = findTripById(Number(ev.sourceId))
    if (trip) openEdit(trip)
  } else if (ev.source === 'event') {
    detailEventId.value = String(ev.sourceId)
  } else {
    gameSheet.value = games.value.find((g) => g.id === ev.sourceId) ?? null
  }
}
const onAddGame = (g: CpblSchedule) => {
  gameSheet.value = null
  eventEditor.openWithGame(g)
}
const onAddOnDay = (ymd: string) => {
  sheetDate.value = null
  newItem.open(ymd)
}
</script>

<template>
  <div class="min-h-full">
    <CalendarHeader
      :title="title"
      :view="view"
      :show-cpbl="showCpbl"
      :categories="categories"
      :hidden-category-ids="hiddenCategoryIds"
      @prev="step(-1)"
      @next="step(1)"
      @today="setQuery({ date: today })"
      @update:view="(v) => setQuery({ view: v })"
      @toggle-cpbl="setShowCpbl(!showCpbl)"
      @toggle-category="toggleCategory"
    />

    <template v-if="view === 'month'">
      <MonthGrid :year="year" :month="month" :events="feed" :today="today" :selected="selectedDate" @select="onSelectDay" />
      <AgendaList :items="agendaItems" :from="range.from" :to="range.to" :highlight="highlight" @open="onOpen" />
    </template>
    <!-- 週／日檢視：後續 task 實作；先讓 query 切得過去且不壞畫面 -->
    <p v-else class="text-center text-sm text-primary-400 py-16">{{ view === 'week' ? '週' : '日' }}檢視即將推出</p>

    <DayListSheet
      :open="sheetDate !== null"
      :date="sheetDate ?? ''"
      :items="sheetDate ? eventsOnDay(sheetDate, feed) : []"
      @close="sheetDate = null"
      @open="(e) => { sheetDate = null; onOpen(e) }"
      @add="onAddOnDay"
    />
    <EventDetailSheet :event-id="detailEventId" @close="detailEventId = null" />
    <CpblGameSheet :game="gameSheet" @close="gameSheet = null" @add="onAddGame" />
  </div>
</template>
