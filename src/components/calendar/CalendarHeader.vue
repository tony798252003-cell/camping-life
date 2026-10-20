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
  <div class="sticky top-0 z-20 bg-white/70 backdrop-blur-md px-4 pt-2 pb-2">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-lg font-bold text-primary-900 whitespace-nowrap">{{ title }}</h2>
      <div class="flex items-center gap-1">
        <button class="p-1 rounded-full hover:bg-primary-100" aria-label="上一個" @click="emit('prev')"><ChevronLeft class="w-5 h-5" /></button>
        <button class="px-2 py-1 text-xs font-bold rounded-full hover:bg-primary-100 text-primary-600" @click="emit('today')">今天</button>
        <button class="p-1 rounded-full hover:bg-primary-100" aria-label="下一個" @click="emit('next')"><ChevronRight class="w-5 h-5" /></button>
        <div class="flex ml-1 rounded-full bg-primary-100 p-0.5">
          <button
            v-for="v in VIEWS"
            :key="v.key"
            class="px-2.5 py-0.5 text-xs font-bold rounded-full transition-colors"
            :class="view === v.key ? 'bg-white text-primary-600 shadow-sm' : 'text-primary-400'"
            @click="emit('update:view', v.key)"
          >{{ v.label }}</button>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 mt-2 overflow-x-auto">
      <CpblToggle />
      <button
        v-for="c in categories"
        :key="c.id"
        class="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-opacity"
        :class="hiddenCategoryIds.has(c.id) ? 'opacity-40 border-gray-300' : 'border-transparent bg-white'"
        :aria-pressed="!hiddenCategoryIds.has(c.id)"
        @click="emit('toggle-category', c.id)"
      >
        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: c.color }"></span>{{ c.name }}
      </button>
    </div>
  </div>
</template>
