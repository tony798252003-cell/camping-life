<script setup lang="ts">
import { ref, computed } from 'vue'
import { CalendarSearch } from 'lucide-vue-next'
import type { NewCampingTrip } from '../../types/database'
import { buildFeed } from '../../utils/calendar/eventSources'
import { holidays } from '../../utils/holidays'
import {
  busySpans, candidateLabel, candidateTag, isNotYetBookable, suggestTripDates, type TripDateCandidate,
} from '../../utils/tripDateSuggest'
import { useCalendarEvents } from '../../composables/useCalendarEvents'
import { useEventCategories } from '../../composables/useEventCategories'
import { useTrips } from '../../composables/useTrips'
import { useAuth } from '../../composables/useAuth'
import { useToday } from '../../composables/useToday'

// 「建議日期」：接下來 3 個月沒有安排的週末和連假，點一個就填入日期與天數
const props = defineProps<{
  form: NewCampingTrip
  tripId?: number | null // 編輯中的行程，不算自己的日期
  bookableUntil?: string | null // 已選營區的可訂到日期
}>()

const MONTHS = 3
const open = ref(false)
const today = useToday()
const { events, fetchEvents } = useCalendarEvents()
const { categories, load: loadCategories } = useEventCategories()
const { trips } = useTrips()
const { session } = useAuth()

// 自己組 feed：不套用行事曆畫面的分類隱藏與桃猿開關，被隱藏的分類照樣要避開
const suggestions = computed(() => {
  const feed = buildFeed({
    events: events.value,
    trips: trips.value,
    games: [],
    categories: categories.value,
    showCpbl: false,
    hiddenCategoryIds: new Set(),
    today: today.value,
    ctx: { meId: session.value?.user?.id ?? null, names: new Map() },
  })
  return suggestTripDates({ today: today.value, months: MONTHS, holidays, busy: busySpans(feed, props.tripId) })
})

const show = () => {
  // 沒進過首頁／行事曆時事件與分類還沒載入
  if (!events.value.length) fetchEvents()
  if (!categories.value.length) loadCategories()
  open.value = true
}

const pick = (c: TripDateCandidate) => {
  props.form.trip_date = c.start
  props.form.duration_days = c.days
  open.value = false
}
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-1 bg-white/75 rounded-full px-3 py-1.5 text-[13px] font-bold text-primary-800 active:scale-95 transition-transform"
    @click="show"
  >
    <CalendarSearch class="w-4 h-4" />
    建議日期
  </button>

  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" @click.self="open = false">
      <div class="w-full max-w-md bg-white rounded-t-[28px] p-5 pb-safe shadow-xl max-h-[75vh] flex flex-col">
        <div class="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4"></div>
        <p class="text-[13px] font-bold text-primary-700 mb-3">建議日期（接下來 {{ MONTHS }} 個月）</p>
        <div class="overflow-y-auto -mx-1">
          <p v-if="!suggestions.length" class="px-4 py-6 text-center text-[14px] text-gray-500">
            接下來 {{ MONTHS }} 個月的週末和連假都有安排了
          </p>
          <button
            v-for="c in suggestions"
            :key="c.start"
            type="button"
            class="w-full flex flex-col items-start justify-center gap-1 px-4 py-2 min-h-[56px] rounded-[18px] active:bg-primary-100 text-left"
            @click="pick(c)"
          >
            <span class="text-[15px] font-bold text-primary-900">{{ candidateLabel(c) }}</span>
            <span v-if="candidateTag(c) || isNotYetBookable(bookableUntil, c.start)" class="flex items-center gap-1.5">
              <span v-if="candidateTag(c)" class="text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">{{ candidateTag(c) }}</span>
              <span v-if="isNotYetBookable(bookableUntil, c.start)" class="text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">尚未開放</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom, 20px));
}
</style>
