<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import CpblToggle from './CpblToggle.vue'
import type { EventCategory } from '../../types/database'

export type CalendarViewMode = 'month' | 'week' | 'day'

defineProps<{
  title: string
  view: CalendarViewMode
  categories: EventCategory[]
  hiddenCategoryIds: Set<string>
}>()
const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'today'): void
  (e: 'update:view', v: CalendarViewMode): void
  (e: 'toggle-category', id: string): void
}>()

const VIEWS: { key: CalendarViewMode; label: string }[] = [
  { key: 'month', label: '月' },
  { key: 'week', label: '週' },
  { key: 'day', label: '日' },
]
</script>

<template>
  <div data-cal-header class="sticky top-0 z-20 bg-primary-50/90 backdrop-blur-md px-4 pt-2 pb-1">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center min-w-0">
        <button class="w-11 h-11 -ml-2.5 flex items-center justify-center text-primary-600 rounded-full active:bg-primary-100" aria-label="上一個" @click="emit('prev')"><ChevronLeft class="w-6 h-6" /></button>
        <h2 class="text-xl font-black text-primary-900 whitespace-nowrap">{{ title }}</h2>
        <button class="w-11 h-11 flex items-center justify-center text-primary-600 rounded-full active:bg-primary-100" aria-label="下一個" @click="emit('next')"><ChevronRight class="w-6 h-6" /></button>
      </div>
      <div class="flex bg-primary-100 rounded-[14px] p-[3px] shrink-0">
        <button
          v-for="v in VIEWS"
          :key="v.key"
          class="min-w-[44px] min-h-[44px] rounded-[11px] text-[13px] font-extrabold transition-colors"
          :class="view === v.key ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-700 font-bold'"
          :aria-pressed="view === v.key"
          @click="emit('update:view', v.key)"
        >{{ v.label }}</button>
      </div>
    </div>

    <div class="flex items-center gap-2 overflow-x-auto">
      <button
        class="shrink-0 min-h-11 flex items-center"
        @click="emit('today')"
      ><span class="px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">今天</span></button>
      <CpblToggle />
      <button
        v-for="c in categories"
        :key="c.id"
        class="shrink-0 min-h-11 flex items-center transition-opacity"
        :class="hiddenCategoryIds.has(c.id) ? 'opacity-40' : ''"
        :aria-pressed="!hiddenCategoryIds.has(c.id)"
        @click="emit('toggle-category', c.id)"
      >
        <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-xs font-bold text-primary-900">
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: c.color }"></span>{{ c.name }}
        </span>
      </button>
    </div>
  </div>
</template>
