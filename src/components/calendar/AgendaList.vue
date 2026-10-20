<script setup lang="ts">
import { computed } from 'vue'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { eachDay, diffDays, weekdayMon0 } from '../../utils/dateRange'
import { useToday } from '../../composables/useToday'
import { eventsOnDay } from '../../utils/calendar/agendaRange'
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
  <div class="pb-6">
    <div class="px-4">
    <p v-if="groups.length === 0" class="text-center text-sm text-primary-400 py-8">這段期間沒有事件</p>
    <section v-for="g in groups" :key="g.day" :data-day="g.day" class="scroll-mt-40 mb-3">
      <h3
        class="text-xs font-bold px-2 py-1 rounded-lg inline-block transition-colors duration-300"
        :class="[g.day === highlight ? 'bg-accent-orange text-white' : 'text-primary-600']"
      >
        {{ dayLabel(g.day) }}<span v-if="g.day === today" class="ml-1">今天</span>
      </h3>
      <ul class="mt-1 space-y-1">
        <li v-for="e in g.events" :key="e.key + g.day">
          <button
            class="w-full flex items-stretch gap-3 text-left rounded-xl bg-white/80 hover:bg-white overflow-hidden"
            :class="{ 'opacity-50': e.past, 'border border-dashed border-primary-300': e.tripStatus === 'planning' }"
            @click="emit('open', e)"
          >
            <span class="w-1 shrink-0" :style="{ backgroundColor: e.color }"></span>
            <span class="py-2 text-xs text-primary-600 w-10 shrink-0">{{ time(e) }}</span>
            <span class="py-2 text-sm font-medium text-primary-900 truncate flex-1">
              {{ e.title }}
              <span v-if="e.tripStatus === 'planning'" class="text-[10px] text-primary-400 ml-1">規劃中</span>
              <span v-if="dayNo(e, g.day)" class="text-[10px] text-primary-400 ml-1">{{ dayNo(e, g.day) }}</span>
            </span>
            <span class="py-2 pr-3 text-[10px] text-primary-400 shrink-0">{{ e.source === 'cpbl' ? '棒球' : catName(e.categoryId) }}</span>
          </button>
        </li>
      </ul>
    </section>
    </div>
  </div>
</template>
