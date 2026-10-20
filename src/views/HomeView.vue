<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNewItemSheet } from '../composables/useNewItemSheet'
import NextTripCard from '../components/home/NextTripCard.vue'
import GlanceCalendar from '../components/home/GlanceCalendar.vue'
import AgendaList from '../components/home/AgendaList.vue'
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
import { dayLabel, weekAgenda, weekRow } from '../utils/calendar/glance'
import { addDays } from '../utils/dateRange'
import { isHoliday } from '../utils/holidays'

// App.vue 會把 trips、session 等 props 全部丟給 router-view，這裡都不需要
defineOptions({ inheritAttrs: false })

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
  const first = days[0]!
  const last = days[days.length - 1]!
  return { from: first < today.value ? first : today.value, to: last > tomorrow ? last : tomorrow }
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
const sections = computed(() => {
  if (selected.value) {
    const d = selected.value
    return [{ label: label(d), day: d, items: eventsOnDay(d, feed.value) }]
  }
  return weekAgenda(today.value, feed.value).map((s) => ({ ...s, label: label(s.day) }))
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
  <div class="px-4 pt-2 pb-6 flex flex-col gap-3.5">
    <NextTripCard />
    <GlanceCalendar
      :events="feed"
      :today="today"
      :expanded="expanded"
      @toggle="toggle"
      :selected="selected"
      @select="onSelect"
      @open-calendar="goCalendar"
    />
    <AgendaList :sections="sections" :selected="selected" @open="onOpen" @clear="selected = null" @add="newItem.open(selected)" />
    <router-link to="/stats" class="self-center min-h-[44px] flex items-center text-[13px] font-bold text-primary-600">露營統計 ›</router-link>

    <EventDetailSheet :event-id="detailEventId" @close="detailEventId = null" />
    <CpblGameSheet :game="gameSheet" @close="gameSheet = null" @add="onAddGame" />
  </div>
</template>
