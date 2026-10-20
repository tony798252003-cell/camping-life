<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import NextTripCard from '../components/home/NextTripCard.vue'
import GlanceCalendar from '../components/home/GlanceCalendar.vue'
import TodayList from '../components/home/TodayList.vue'
import EventDetailSheet from '../components/calendar/EventDetailSheet.vue'
import CpblGameSheet from '../components/calendar/CpblGameSheet.vue'
import { useCalendarFeed } from '../composables/useCalendarFeed'
import { useCalendarEvents } from '../composables/useCalendarEvents'
import { useEventCategories } from '../composables/useEventCategories'
import { useEventOpener } from '../composables/useEventOpener'
import { useToday } from '../composables/useToday'
import { useUserProfile } from '../composables/useUserProfile'
import { buildMonthWeeks } from '../utils/calendar/monthLayout'
import { dayAgenda, weekRow } from '../utils/calendar/glance'
import { addDays } from '../utils/dateRange'

// App.vue 會把 trips、session 等 props 全部丟給 router-view，這裡都不需要
defineOptions({ inheritAttrs: false })

const STORAGE_KEY = 'home.glanceExpanded'
const router = useRouter()
const today = useToday()
const { feed, selectedDate, loadGames } = useCalendarFeed()
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
const toggle = () => {
  expanded.value = !expanded.value
  try {
    localStorage.setItem(STORAGE_KEY, expanded.value ? '1' : '0')
  } catch {
    /* 無痕或被封鎖時只是不記住 */
  }
}

// 速覽可見範圍（本週或整月）＋明天，賽程只抓這段
const loadRange = computed(() => {
  const days = expanded.value
    ? buildMonthWeeks(Number(today.value.slice(0, 4)), Number(today.value.slice(5, 7))).flat()
    : weekRow(today.value)
  const tomorrow = addDays(today.value, 1)
  return { from: [days[0]!, today.value].sort()[0]!, to: [days[days.length - 1]!, tomorrow].sort().reverse()[0]! }
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

// 今天；今天沒事才補明天
const sections = computed(() => {
  const t = dayAgenda(today.value, feed.value)
  if (t.length) return [{ label: '今天', day: today.value, items: t }]
  const tomorrowYmd = addDays(today.value, 1)
  const n = dayAgenda(tomorrowYmd, feed.value)
  return n.length ? [{ label: '明天', day: tomorrowYmd, items: n }] : []
})

const goCalendar = (date?: string) => {
  if (date) selectedDate.value = date
  router.push({ path: '/calendar', query: date ? { view: 'month', date } : {} })
}
</script>

<template>
  <div class="px-4 pt-2 pb-6 flex flex-col gap-3.5">
    <NextTripCard />
    <GlanceCalendar
      :events="feed"
      :today="today"
      :expanded="expanded"
      @toggle="toggle"
      @select="goCalendar"
      @open-calendar="goCalendar()"
    />
    <TodayList :sections="sections" @open="onOpen" />
    <router-link to="/stats" class="self-center min-h-[44px] flex items-center text-[13px] font-bold text-primary-600">露營統計 ›</router-link>

    <EventDetailSheet :event-id="detailEventId" @close="detailEventId = null" />
    <CpblGameSheet :game="gameSheet" @close="gameSheet = null" @add="onAddGame" />
  </div>
</template>
