<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { buildMonthWeeks } from '../../utils/calendar/monthLayout'
import { cellTint, weekRow } from '../../utils/calendar/glance'
import { eventsOnDay } from '../../utils/calendar/agendaRange'
import { weekdayMon0 } from '../../utils/dateRange'
import OwnerLegend from '../calendar/OwnerLegend.vue'

const props = defineProps<{ events: ViewEvent[]; today: string; expanded: boolean; selected: string | null }>()
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'select', ymd: string): void
  (e: 'open-calendar'): void
}>()

const HEAD = ['一', '二', '三', '四', '五', '六', '日']
const month = computed(() => Number(props.today.slice(5, 7)))
const rows = computed<(string | null)[][]>(() => {
  if (!props.expanded) return [weekRow(props.today)]
  const y = Number(props.today.slice(0, 4))
  // 月檢視：非本月的日期留空白（鄰月事件不在速覽範圍）
  return buildMonthWeeks(y, month.value).map((w) => w.map((d) => (Number(d.slice(5, 7)) === month.value ? d : null)))
})

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
  <section class="bg-white/90 rounded-[28px] px-4 py-3.5">
    <div class="flex items-center justify-between mb-1.5">
      <span class="text-[15px] font-extrabold text-primary-900">{{ expanded ? `${month} 月` : '這週' }}</span>
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
