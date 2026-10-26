<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNewItemSheet } from '../composables/useNewItemSheet'
import NextTripCard from '../components/home/NextTripCard.vue'
import GlanceCalendar from '../components/home/GlanceCalendar.vue'
import HomeAgendaList from '../components/home/HomeAgendaList.vue'
import HomeLists from '../components/home/HomeLists.vue'
import EventDetailSheet from '../components/calendar/EventDetailSheet.vue'
import CpblGameSheet from '../components/calendar/CpblGameSheet.vue'
import { useCalendarFeed } from '../composables/useCalendarFeed'
import { useCalendarEvents } from '../composables/useCalendarEvents'
import { eventsOnDay } from '../utils/calendar/agendaRange'
import { useEventCategories } from '../composables/useEventCategories'
import { useEventOpener } from '../composables/useEventOpener'
import { useToday } from '../composables/useToday'
import { useUserProfile } from '../composables/useUserProfile'
import { buildMonthWeeks } from '../utils/calendar/monthLayout'
import { dayLabel, glanceAgendaDays, glanceAgendaTitle, glanceMonth, rangeAgenda, weekRow } from '../utils/calendar/glance'
import { addDays } from '../utils/dateRange'
import { isHoliday } from '../utils/holidays'

const STORAGE_KEY = 'home.glanceExpanded'
const router = useRouter()
const today = useToday()
const { feed, loadGames } = useCalendarFeed()
const { fetchEvents } = useCalendarEvents()
const { load: loadCategories } = useEventCategories()
const { showCpbl } = useUserProfile()
const { detailEventId, gameSheet, onOpen, onAddGame } = useEventOpener()

const readExpanded = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
const expanded = ref(readExpanded())
// 速覽換期間：收合時幾週後、展開時幾個月後；切換收合／展開就回到本週／本月
const offset = ref(0)
const toggle = () => {
  expanded.value = !expanded.value
  offset.value = 0
  try {
    localStorage.setItem(STORAGE_KEY, expanded.value ? '1' : '0')
  } catch {
    /* 無痕或被封鎖時只是不記住 */
  }
}

// 速覽可見範圍（換過的週或月）＋本週＋明天，賽程只抓這段；下方清單固定是本週，換期間也要保留
const loadRange = computed(() => {
  const { year, month } = glanceMonth(today.value, offset.value)
  const days = expanded.value ? buildMonthWeeks(year, month).flat() : weekRow(addDays(today.value, offset.value * 7))
  const thisWeek = weekRow(today.value)
  const tomorrow = addDays(today.value, 1)
  const first = days[0]! < thisWeek[0]! ? days[0]! : thisWeek[0]!
  const last = [days[days.length - 1]!, thisWeek[6]!, tomorrow].reduce((a, b) => (a > b ? a : b))
  return { from: first, to: last }
})
watch(
  [loadRange, showCpbl],
  async ([r, on]) => {
    if (!on) return
    try {
      await loadGames(r.from, r.to)
    } catch (e) {
      console.error('[HomeView] loadGames error:', e)
    }
  },
  { immediate: true },
)
onMounted(() => {
  loadCategories()
  fetchEvents()
})

// 點速覽的日期只選取、不跳頁；清單改顯示那天（null = 本週）
const selected = ref<string | null>(null)
const newItem = useNewItemSheet()
const label = (d: string) => dayLabel(d, today.value, isHoliday(d)?.name)
const agendaTitle = computed(() => glanceAgendaTitle(today.value, expanded.value, offset.value))
// 換期間就取消選取的日子，清單直接顯示新期間
watch(offset, () => { selected.value = null })
const sections = computed(() => {
  if (selected.value) {
    const d = selected.value
    return [{ label: label(d), day: d, items: eventsOnDay(d, feed.value) }]
  }
  return rangeAgenda(glanceAgendaDays(today.value, expanded.value, offset.value), feed.value).map((s) => ({ ...s, label: label(s.day) }))
})
// 再點同一天 = 取消選取
const onSelect = (d: string) => {
  selected.value = selected.value === d ? null : d
}

const goCalendar = () => {
  router.push({ path: '/calendar' })
}
</script>

<template>
  <div class="px-4 pt-2 pb-6 flex flex-col gap-4">
    <GlanceCalendar
      :events="feed"
      :today="today"
      :expanded="expanded"
      :offset="offset"
      @toggle="toggle"
      @shift="(n) => (offset += n)"
      @reset="offset = 0"
      :selected="selected"
      @select="onSelect"
      @open-calendar="goCalendar"
    />
    <HomeAgendaList :sections="sections" :selected="selected" :title="agendaTitle" @open="onOpen" @clear="selected = null" @add="newItem.open(selected)" />
    <HomeLists />
    <NextTripCard />
    <router-link to="/stats" class="self-center min-h-[44px] flex items-center text-[13px] font-bold text-primary-600">露營統計 ›</router-link>

    <EventDetailSheet :event-id="detailEventId" @close="detailEventId = null" />
    <CpblGameSheet :game="gameSheet" @close="gameSheet = null" @add="onAddGame" />
  </div>
</template>
