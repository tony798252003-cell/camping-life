<script setup lang="ts">
import { computed } from 'vue'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { eachDay, diffDays, weekdayMon0 } from '../../utils/dateRange'
import { useToday } from '../../composables/useToday'
import { eventsOnDay } from '../../utils/calendar/agendaRange'
import { isHoliday } from '../../utils/holidays'
import { displayTitle } from '../../utils/calendar/glance'
import { useEventCategories } from '../../composables/useEventCategories'

const props = defineProps<{ items: ViewEvent[]; from: string; to: string; highlight?: string }>()
const emit = defineEmits<{ (e: 'open', ev: ViewEvent): void }>()

const { categories } = useEventCategories()
const catName = (id: string | null) => (id ? categories.value.find((c) => c.id === id)?.name : undefined) ?? ''

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const today = useToday()

// 只列有事件的日子；多天事件涵蓋的每一天都會出現
const groups = computed(() =>
  eachDay(props.from, props.to)
    .map((day) => ({ day, events: eventsOnDay(day, props.items) }))
    .filter((g) => g.events.length > 0),
)

const dayLabel = (ymd: string) => {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}/${d}（${WEEK[weekdayMon0(ymd)]}）`
}
const time = (e: ViewEvent) =>
  e.allDay || e.startMin == null
    ? '全天'
    : `${String(Math.floor(e.startMin / 60)).padStart(2, '0')}:${String(e.startMin % 60).padStart(2, '0')}`
const dayNo = (e: ViewEvent, day: string) =>
  e.endDate > e.startDate ? `第${diffDays(e.startDate, day) + 1}/${diffDays(e.startDate, e.endDate) + 1}天` : ''
</script>

<template>
  <div class="px-4 pt-3.5 pb-28">
    <p v-if="groups.length === 0" class="text-center text-[13px] text-slate-500 py-8">這段期間沒有事件</p>
    <section v-for="g in groups" :key="g.day" :data-day="g.day" class="scroll-mt-40 mb-3">
      <h3
        class="text-[13px] font-extrabold px-2 py-1 rounded-[10px] inline-block transition-colors duration-300"
        :class="[g.day === highlight ? 'bg-primary-600 text-white' : 'text-primary-700']"
      >
        {{ dayLabel(g.day) }}<span v-if="g.day === today" class="ml-1">今天</span><span v-if="isHoliday(g.day)" class="ml-1">{{ isHoliday(g.day)!.name }}</span>
      </h3>
      <ul class="mt-1.5 space-y-2">
        <li v-for="e in g.events" :key="e.key + g.day">
          <button
            class="w-full flex items-center gap-3 text-left rounded-[18px] bg-white px-3.5 py-3 min-h-[56px]"
            :class="{ 'opacity-50': e.past }"
            @click="emit('open', e)"
          >
            <span class="w-1 self-stretch rounded-full shrink-0" :style="{ backgroundColor: e.color }"></span>
            <span class="flex flex-col min-w-0 flex-1">
              <span class="text-[15px] font-bold text-primary-900 truncate">
                {{ displayTitle(e) }}
              </span>
              <span class="text-[11px] font-semibold text-slate-500 truncate">
                {{ time(e) }}<template v-if="dayNo(e, g.day)"> · {{ dayNo(e, g.day) }}</template><template v-if="e.source === 'cpbl' || catName(e.categoryId)"> · {{ e.source === 'cpbl' ? '桃猿賽程' : catName(e.categoryId) }}</template>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
