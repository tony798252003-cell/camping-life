<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { allDayFor, layoutDay } from '../../utils/calendar/timeGridLayout'
import { addDays, diffDays, taipeiMinutes, weekdayMon0 } from '../../utils/dateRange'
import { useTrips } from '../../composables/useTrips'
import TripDayWeather from './TripDayWeather.vue'
import { subtitle } from '../../utils/calendar/glance'
import { OWNER_LABEL } from '../../utils/calendar/visibility'

const props = defineProps<{ date: string; events: ViewEvent[]; today: string }>()
const emit = defineEmits<{
  (e: 'select-day', ymd: string): void
  (e: 'open', ev: ViewEvent): void
}>()

const HEAD = ['一', '二', '三', '四', '五', '六', '日']
const HOUR_H = 48
const MAX_ROWS = 3
const hours = Array.from({ length: 24 }, (_, i) => i)
const { findTripById } = useTrips()

const strip = computed(() => {
  const mon = addDays(props.date, -weekdayMon0(props.date))
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
})

const allDay = computed(() => allDayFor(props.date, props.events))
const expanded = ref(false)
const shownAllDay = computed(() => (expanded.value ? allDay.value : allDay.value.slice(0, MAX_ROWS)))
const positioned = computed(() => layoutDay(props.date, props.events))

const tripOf = (e: ViewEvent) => (e.source === 'trip' ? findTripById(Number(e.sourceId)) : undefined)

// 「第 n/N 天」：夜衝那一天不算在天數內（夜衝是 trip_date 前一晚）
const dayLabel = (e: ViewEvent): string | null => {
  if (e.endDate === e.startDate) return null
  const first = e.nightRushDate ? addDays(e.startDate, 1) : e.startDate
  if (props.date < first) return null
  return `第 ${diffDays(first, props.date) + 1}/${diffDays(first, e.endDate) + 1} 天`
}
const nightRushLabel = (e: ViewEvent): string | null => {
  if (!e.nightRushDate || props.date !== e.nightRushDate) return null
  const t = tripOf(e)?.campsites?.night_rush_time
  return `夜衝 ${(t || '18:00').slice(0, 5)} 起`
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const scroller = ref<HTMLElement | null>(null)
const nowMin = ref(taipeiMinutes(new Date()))
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (scroller.value) scroller.value.scrollTop = 7 * HOUR_H
  timer = setInterval(() => (nowMin.value = taipeiMinutes(new Date())), 60_000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="mx-3 mt-1 bg-white rounded-[24px] px-1.5 py-2 select-none">
    <div class="grid grid-cols-7 text-center">
      <button
        v-for="(d, i) in strip"
        :key="d"
        type="button"
        class="min-h-[48px] py-1 flex flex-col items-center justify-center rounded-[12px] active:bg-primary-50"
        :aria-label="d"
        @click="emit('select-day', d)"
      >
        <span class="text-[11px] font-bold text-slate-500">{{ HEAD[i] }}</span>
        <span
          class="inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold"
          :class="d === date ? 'bg-primary-600 text-white' : d === today ? 'ring-2 ring-primary-500 text-primary-900' : 'text-primary-900'"
        >{{ Number(d.slice(8)) }}</span>
      </button>
    </div>

    <!-- 全天區 -->
    <div v-if="allDay.length" class="border-t border-primary-100 py-1 space-y-1">
      <div
        v-for="e in shownAllDay"
        :key="e.key"
        class="w-full flex items-center gap-2 text-left text-[15px]"
      >
        <button type="button" class="flex-1 min-w-0 flex items-center gap-2 text-left" @click="emit('open', e)">
          <span class="w-1.5 self-stretch rounded-full shrink-0" :style="{ backgroundColor: e.color }"></span>
          <span class="flex flex-col min-w-0 flex-1" :class="e.past ? 'opacity-50' : ''">
            <span class="truncate font-medium">{{ e.title }}</span>
            <span class="text-[11px] font-semibold text-slate-500 truncate">{{ subtitle(e, ['全天', dayLabel(e), nightRushLabel(e)].filter(Boolean).join(' · ')) }}</span>
          </span>
          <span class="text-xs font-black shrink-0" :style="{ color: e.color }">{{ OWNER_LABEL[e.owner] }}</span>
        </button>
        <TripDayWeather v-if="tripOf(e)" :trip="tripOf(e)!" :date="date" />
      </div>
      <button
        v-if="allDay.length > MAX_ROWS"
        type="button"
        class="min-h-[44px] text-[11px] font-bold text-primary-600"
        @click="expanded = !expanded"
      >{{ expanded ? '收合' : `展開（還有 ${allDay.length - MAX_ROWS} 項）` }}</button>
    </div>

    <div ref="scroller" class="overflow-y-auto border-t border-primary-100" style="height: 56vh">
      <div class="relative flex" :style="{ height: `${24 * HOUR_H}px` }">
        <div class="w-9 shrink-0 relative">
          <span
            v-for="h in hours"
            :key="h"
            class="absolute right-1 text-[10px] text-slate-500 -translate-y-1/2"
            :style="{ top: `${h * HOUR_H}px` }"
          >{{ h === 0 ? '' : String(h).padStart(2, '0') }}</span>
        </div>
        <div class="relative flex-1 border-l border-primary-100">
          <span
            v-for="h in hours"
            :key="'l' + h"
            class="absolute inset-x-0 border-t border-primary-100 pointer-events-none"
            :style="{ top: `${h * HOUR_H}px` }"
          ></span>
          <button
            v-for="p in positioned"
            :key="p.event.key"
            type="button"
            class="absolute rounded-[10px] text-[13px] leading-tight font-medium text-white overflow-hidden text-left px-1.5 py-0.5 border border-white/60"
            :class="p.event.past ? 'opacity-50' : ''"
            :style="{
              top: `${(p.top / 60) * HOUR_H}px`,
              height: `${Math.max(((p.bottom - p.top) / 60) * HOUR_H, HOUR_H / 2)}px`,
              left: `${(p.col / p.cols) * 100}%`,
              width: `${100 / p.cols}%`,
              backgroundColor: p.event.color,
            }"
            @click="emit('open', p.event)"
          >
            <span class="block truncate">{{ p.event.title }}</span>
            <span class="block text-[10px] opacity-90">{{ hhmm(p.top) }}–{{ hhmm(p.bottom) }}</span>
          </button>
          <span
            v-if="date === today"
            class="absolute inset-x-0 h-0.5 bg-red-500 z-10 pointer-events-none"
            :style="{ top: `${(nowMin / 60) * HOUR_H}px` }"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>
