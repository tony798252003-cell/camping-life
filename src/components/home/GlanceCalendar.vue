<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { buildMonthWeeks } from '../../utils/calendar/monthLayout'
import { cellTint, glanceLabel, glanceMonth, weekRow } from '../../utils/calendar/glance'
import { eventsOnDay } from '../../utils/calendar/agendaRange'
import { addDays, weekdayMon0 } from '../../utils/dateRange'
import { useHorizontalSwipe } from '../../composables/useHorizontalSwipe'
import OwnerLegend from '../calendar/OwnerLegend.vue'

// offset：收合時是幾週後、展開時是幾個月後（0 = 本週／本月）
const props = defineProps<{ events: ViewEvent[]; today: string; expanded: boolean; selected: string | null; offset: number }>()
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'shift', n: 1 | -1): void
  (e: 'reset'): void
  (e: 'select', ymd: string): void
  (e: 'open-calendar'): void
}>()

const HEAD = ['一', '二', '三', '四', '五', '六', '日']
const label = computed(() => glanceLabel(props.today, props.expanded, props.offset))
const rows = computed<(string | null)[][]>(() => {
  if (!props.expanded) return [weekRow(addDays(props.today, props.offset * 7))]
  const { year, month } = glanceMonth(props.today, props.offset)
  // 月檢視：非該月的日期留空白（鄰月事件不在速覽範圍）
  return buildMonthWeeks(year, month).map((w) => w.map((d) => (Number(d.slice(5, 7)) === month ? d : null)))
})

// 卡片左右滑：收合換週、展開換月
const card = ref<HTMLElement | null>(null)
useHorizontalSwipe(card, (n) => emit('shift', n))

const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日']
const ariaLabel = (d: string) => {
  const n = eventsOnDay(d, props.events).length
  return `${Number(d.slice(5, 7))} 月 ${Number(d.slice(8))} 日 週${WEEKDAY[weekdayMon0(d)]}，${n} 個事件`
}

const cellStyle = (d: string) => {
  if (d === props.today) return undefined // 今天一律實心天藍，不套分類色
  const t = cellTint(d, props.events)
  return t ? { backgroundColor: t.bg, boxShadow: `inset 0 -3px 0 ${t.color}` } : undefined
}
</script>

<template>
  <div class="flex flex-col gap-2">
  <div class="flex items-center justify-between px-1">
    <h2 class="text-xs font-bold uppercase tracking-widest text-slate-500">行事曆</h2>
    <button
      type="button"
      class="-my-3 min-h-[44px] flex items-center gap-0.5 text-[13px] font-bold text-primary-600"
      @click="emit('open-calendar')"
    >完整行事曆<ChevronRight class="w-4 h-4" /></button>
  </div>
  <section ref="card" class="bg-white/90 rounded-[28px] px-4 py-3.5">
    <div class="flex items-center justify-between mb-1.5">
      <div class="flex items-center min-w-0 -ml-2.5">
        <button type="button" class="w-11 h-11 shrink-0 flex items-center justify-center text-primary-600 rounded-full active:bg-primary-100" :aria-label="expanded ? '上個月' : '上一週'" @click="emit('shift', -1)"><ChevronLeft class="w-5 h-5" /></button>
        <span v-if="offset === 0" class="text-[15px] font-extrabold text-primary-900 whitespace-nowrap">{{ label }}</span>
        <button
          v-else
          type="button"
          class="min-h-[44px] flex items-center gap-1.5 text-[15px] font-extrabold text-primary-900 whitespace-nowrap"
          aria-label="回到今天"
          @click="emit('reset')"
        >{{ label }}<span class="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-[11px] font-bold">今天</span></button>
        <button type="button" class="w-11 h-11 shrink-0 flex items-center justify-center text-primary-600 rounded-full active:bg-primary-100" :aria-label="expanded ? '下個月' : '下一週'" @click="emit('shift', 1)"><ChevronRight class="w-5 h-5" /></button>
      </div>
      <button
        type="button"
        class="min-h-[44px] px-3 rounded-[12px] bg-primary-100 text-primary-700 text-[13px] font-extrabold"
        :aria-expanded="expanded"
        @click="emit('toggle')"
      >{{ expanded ? '收合成這週 ▴' : '展開整月 ▾' }}</button>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center">
      <span v-for="h in HEAD" :key="h" class="text-[11px] font-semibold text-slate-500">{{ h }}</span>
      <template v-for="(r, i) in rows" :key="i">
        <template v-for="(d, j) in r" :key="`${i}-${j}`">
          <button
            v-if="d"
            type="button"
            class="h-11 rounded-[10px] flex items-center justify-center text-[13px] font-bold active:scale-95 transition-transform"
            :class="[d === today ? 'bg-primary-600 text-white' : 'text-primary-900', d === selected ? 'outline outline-2 outline-offset-1 outline-primary-900' : '']"
            :style="cellStyle(d)"
            :aria-label="ariaLabel(d)"
            :aria-pressed="d === selected"
            @click="emit('select', d)"
          >{{ Number(d.slice(8)) }}</button>
          <span v-else></span>
        </template>
      </template>
    </div>
    <OwnerLegend class="mt-2.5" />
  </section>
  </div>
</template>
