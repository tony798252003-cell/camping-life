<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { layoutWeek } from '../../utils/calendar/monthLayout'
import { allDayFor, layoutDay } from '../../utils/calendar/timeGridLayout'
import { taipeiMinutes } from '../../utils/dateRange'

const props = defineProps<{ days: string[]; events: ViewEvent[]; today: string }>()
const emit = defineEmits<{
  (e: 'select-day', ymd: string): void
  (e: 'open', ev: ViewEvent): void
}>()

const HEAD = ['一', '二', '三', '四', '五', '六', '日']
const HOUR_H = 48
const ROW_H = 18
const MAX_ROWS = 3
const hours = Array.from({ length: 24 }, (_, i) => i)

// 全天區：多天橫條在上，單日全天事件（含桃猿）依序排在下面，一律佔「列」
const allDay = computed(() => {
  const { bars } = layoutWeek(props.days, props.events, Number.MAX_SAFE_INTEGER)
  const barRows = bars.reduce((m, b) => Math.max(m, b.row + 1), 0)
  const items = bars.map((b) => ({ key: b.event.key, event: b.event, row: b.row, col: b.startCol, span: b.span }))
  let maxSingles = 0
  props.days.forEach((d, col) => {
    const singles = allDayFor(d, props.events).filter((e) => e.startDate === e.endDate)
    maxSingles = Math.max(maxSingles, singles.length)
    singles.forEach((event, i) => items.push({ key: `${event.key}@${d}`, event, row: barRows + i, col, span: 1 }))
  })
  return { items, rows: barRows + maxSingles }
})
const expanded = ref(false)
const shownRows = computed(() => (expanded.value ? allDay.value.rows : Math.min(allDay.value.rows, MAX_ROWS)))
const visibleItems = computed(() => allDay.value.items.filter((i) => i.row < shownRows.value))

const columns = computed(() => props.days.map((d) => ({ day: d, items: layoutDay(d, props.events) })))

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
  <div class="px-2 select-none">
    <!-- 表頭：點日期跳日檢視 -->
    <div class="flex">
      <span class="w-9 shrink-0"></span>
      <div class="grid grid-cols-7 flex-1 text-center">
        <button
          v-for="(d, i) in days"
          :key="d"
          type="button"
          class="py-1 flex flex-col items-center active:bg-primary-100"
          :aria-label="d"
          @click="emit('select-day', d)"
        >
          <span class="text-[11px] text-primary-400">{{ HEAD[i] }}</span>
          <span
            class="inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-full text-sm font-semibold"
            :class="d === today ? 'bg-primary-500 text-white' : 'text-primary-900'"
          >{{ Number(d.slice(8)) }}</span>
        </button>
      </div>
    </div>

    <!-- 全天區 -->
    <div v-if="allDay.rows > 0" class="flex border-t border-primary-100 py-0.5">
      <span class="w-9 shrink-0 text-[10px] text-primary-400 pt-0.5">全天</span>
      <div class="relative flex-1" :style="{ height: `${shownRows * ROW_H}px` }">
        <button
          v-for="i in visibleItems"
          :key="i.key"
          type="button"
          class="absolute h-4 px-1 rounded text-[10px] leading-none font-medium text-white truncate text-left"
          :class="i.event.past ? 'opacity-50' : ''"
          :style="{
            top: `${i.row * ROW_H}px`,
            left: `calc(${(i.col / 7) * 100}% + 1px)`,
            width: `calc(${(i.span / 7) * 100}% - 2px)`,
            backgroundColor: i.event.color,
          }"
          @click="emit('open', i.event)"
        >{{ i.span > 1 ? i.event.title : i.event.title.slice(0, 3) }}</button>
      </div>
    </div>
    <button
      v-if="allDay.rows > MAX_ROWS"
      type="button"
      class="ml-9 text-[11px] text-primary-500 py-0.5"
      @click="expanded = !expanded"
    >{{ expanded ? '收合' : `展開（還有 ${allDay.rows - MAX_ROWS} 列）` }}</button>

    <!-- 時間軸 -->
    <div ref="scroller" class="overflow-y-auto border-t border-primary-100" style="height: 56vh">
      <div class="relative flex" :style="{ height: `${24 * HOUR_H}px` }">
        <div class="w-9 shrink-0 relative">
          <span
            v-for="h in hours"
            :key="h"
            class="absolute right-1 text-[10px] text-primary-400 -translate-y-1/2"
            :style="{ top: `${h * HOUR_H}px` }"
          >{{ h === 0 ? '' : String(h).padStart(2, '0') }}</span>
        </div>
        <div class="relative flex-1 grid grid-cols-7">
          <span
            v-for="h in hours"
            :key="'l' + h"
            class="absolute inset-x-0 border-t border-primary-100 pointer-events-none"
            :style="{ top: `${h * HOUR_H}px` }"
          ></span>
          <div v-for="c in columns" :key="c.day" class="relative border-l border-primary-100">
            <button
              v-for="p in c.items"
              :key="p.event.key"
              type="button"
              class="absolute rounded text-[10px] leading-tight font-medium text-white overflow-hidden text-left px-0.5 border border-white/60"
              :class="p.event.past ? 'opacity-50' : ''"
              :style="{
                top: `${(p.top / 60) * HOUR_H}px`,
                height: `${Math.max(((p.bottom - p.top) / 60) * HOUR_H, 16)}px`,
                left: `${(p.col / p.cols) * 100}%`,
                width: `${100 / p.cols}%`,
                backgroundColor: p.event.color,
              }"
              @click="emit('open', p.event)"
            >{{ p.event.title.slice(0, 3) }}</button>
            <!-- 現在時間線：只有今天 -->
            <span
              v-if="c.day === today"
              class="absolute inset-x-0 h-0.5 bg-red-500 z-10 pointer-events-none"
              :style="{ top: `${(nowMin / 60) * HOUR_H}px` }"
            ></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
