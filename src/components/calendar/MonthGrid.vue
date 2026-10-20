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
const BAR_TOP = 35 // 日期圓圈（4 + 28）加間距後，細 bar 的起點（px）
const BAR_H = 6 // 每條 bar 佔的高度（4px bar + 2px 間距）

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
    left: `calc(${(b.startCol / 7) * 100}% + 3px)`,
    width: `calc(${(b.span / 7) * 100}% - 6px)`,
    backgroundColor: planning ? `${e.color}55` : e.color,
  }
}
// 夜衝：第一格（出發前一晚）顏色較淡
const nightRushFirst = (b: WeekBar) => !!b.event.nightRushDate && !b.continuesBefore && b.event.startDate === b.event.nightRushDate && b.span > 1
</script>

<template>
  <section class="mx-3 bg-white rounded-[24px] px-1.5 pt-2 pb-2.5 select-none">
    <div class="grid grid-cols-7 text-center text-[11px] font-bold text-slate-500 pt-1 pb-1.5">
      <span v-for="h in HEAD" :key="h">{{ h }}</span>
    </div>
    <div v-for="w in weeks" :key="w.days[0]" class="relative grid grid-cols-7">
      <button
        v-for="d in w.days"
        :key="d"
        type="button"
        class="h-[58px] flex flex-col items-center text-center pt-1 rounded-[12px] active:bg-primary-50"
        :class="[
          inMonth(d) ? '' : 'opacity-40',
          selected === d && d !== today ? 'bg-primary-50' : '',
        ]"
        :aria-label="d"
        :title="isHoliday(d)?.name"
        @click="emit('select', d)"
      >
        <span
          class="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold leading-none"
          :class="d === today ? 'bg-primary-600 text-white' : isHoliday(d) ? 'text-red-500' : 'text-primary-900'"
        >{{ Number(d.slice(8)) }}</span>
        <!-- 預留 2 條 bar 的高度（絕對定位），圓點在其下 -->
        <span class="mt-[16px] flex gap-[3px] h-[5px] items-center">
          <span
            v-for="e in (w.layout.dots[d] ?? []).slice(0, 3)"
            :key="e.key"
            class="w-[5px] h-[5px] rounded-full"
            :class="{ 'opacity-50': e.past }"
            :style="{ backgroundColor: e.color }"
          ></span>
          <span v-if="w.layout.cpblDays.has(d)" class="w-[5px] h-[5px] rounded-full bg-[#9d1c32]"></span>
        </span>
      </button>

      <!-- 多天事件細橫條：不吃點擊，點擊落到底下的日期格 -->
      <div
        v-for="b in w.layout.bars"
        :key="b.event.key + b.startCol"
        class="absolute h-1 flex overflow-hidden pointer-events-none"
        :class="[
          b.event.past ? 'opacity-50' : '',
          b.continuesBefore ? 'rounded-l-none' : 'rounded-l-full',
          b.continuesAfter ? 'rounded-r-none' : 'rounded-r-full',
        ]"
        :style="barStyle(b)"
        :title="b.event.title"
      >
        <span v-if="nightRushFirst(b)" class="h-full bg-white/50 shrink-0" :style="{ width: `${100 / b.span}%` }"></span>
      </div>
    </div>
  </section>
</template>
