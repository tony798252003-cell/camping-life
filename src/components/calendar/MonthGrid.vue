<script setup lang="ts">
import { computed } from 'vue'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { buildMonthWeeks, layoutWeek, type WeekBar } from '../../utils/calendar/monthLayout'
import { isHoliday } from '../../utils/holidays'

const props = defineProps<{
  year: number
  month: number
  events: ViewEvent[]
  today: string
  selected?: string | null
}>()
const emit = defineEmits<{ (e: 'select', ymd: string): void }>()

const HEAD = ['一', '二', '三', '四', '五', '六', '日']
const BAR_TOP = 22 // 日期數字列高度（px）
const BAR_H = 18 // 每條 bar 佔的高度（h-4 + 間距）

const weeks = computed(() =>
  buildMonthWeeks(props.year, props.month).map((days) => ({
    days,
    layout: layoutWeek(days, props.events),
  })),
)
const inMonth = (ymd: string) => Number(ymd.slice(5, 7)) === props.month

const barStyle = (b: WeekBar) => {
  const e = b.event
  const planning = e.tripStatus === 'planning'
  return {
    top: `${BAR_TOP + b.row * BAR_H}px`,
    left: `calc(${(b.startCol / 7) * 100}% + 2px)`,
    width: `calc(${(b.span / 7) * 100}% - 4px)`,
    backgroundColor: planning ? `${e.color}22` : e.color,
    color: planning ? e.color : '#fff',
    border: planning ? `1px dashed ${e.color}` : undefined,
  }
}
// 夜衝：第一格（出發前一晚）顏色較淡
const nightRushFirst = (b: WeekBar) => !!b.event.nightRushDate && !b.continuesBefore && b.event.startDate === b.event.nightRushDate && b.span > 1
</script>

<template>
  <div class="px-2 select-none">
    <div class="grid grid-cols-7 text-center text-[11px] text-primary-400 py-1">
      <span v-for="h in HEAD" :key="h">{{ h }}</span>
    </div>
    <div v-for="w in weeks" :key="w.days[0]" class="relative grid grid-cols-7 border-t border-primary-100">
      <button
        v-for="d in w.days"
        :key="d"
        type="button"
        class="h-[82px] flex flex-col items-center text-center pt-0.5 active:bg-primary-100"
        :class="[
          inMonth(d) ? '' : 'opacity-40',
          selected === d ? 'bg-primary-50' : '',
        ]"
        :aria-label="d"
        @click="emit('select', d)"
      >
        <span class="relative self-stretch flex flex-col items-center h-[22px]">
          <span
            class="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-semibold leading-none"
            :class="[
              d === today ? 'ring-2 ring-primary-500' : '',
              isHoliday(d) ? 'text-red-500' : 'text-primary-900',
            ]"
          >{{ Number(d.slice(8)) }}</span>
          <span v-if="isHoliday(d)" class="text-[8px] leading-none text-red-500 truncate max-w-full">{{ isHoliday(d)!.name }}</span>
          <span v-if="w.layout.cpblDays.has(d)" class="absolute right-0.5 top-0 text-[10px] leading-none text-yellow-400">⚾</span>
        </span>
        <!-- 預留 2 條 bar 的高度 -->
        <span class="mt-[36px] flex gap-0.5 h-2 items-center">
          <span
            v-for="e in (w.layout.dots[d] ?? []).slice(0, 3)"
            :key="e.key"
            class="w-1.5 h-1.5 rounded-full"
            :class="{ 'opacity-50': e.past }"
            :style="{ backgroundColor: e.color }"
          ></span>
        </span>
      </button>

      <!-- 多天事件橫條：不吃點擊，點擊落到底下的日期格 -->
      <div
        v-for="b in w.layout.bars"
        :key="b.event.key + b.startCol"
        class="absolute h-4 flex items-center overflow-hidden text-[10px] leading-none font-medium pointer-events-none"
        :class="[
          b.event.past ? 'opacity-50' : '',
          b.continuesBefore ? 'rounded-l-none' : 'rounded-l-full',
          b.continuesAfter ? 'rounded-r-none' : 'rounded-r-full',
        ]"
        :style="barStyle(b)"
      >
        <span v-if="nightRushFirst(b)" class="h-full bg-white/50 shrink-0" :style="{ width: `${100 / b.span}%` }"></span>
        <span class="px-1.5 truncate">{{ b.event.title }}</span>
      </div>
    </div>
  </div>
</template>
