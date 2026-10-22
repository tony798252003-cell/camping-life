<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import CpblToggle from './CpblToggle.vue'
import { OWNER_COLOR, OWNER_LABEL } from '../../utils/calendar/visibility'
import { OWNER_FILTERS, type OwnerFilter } from '../../utils/calendar/ownerFilter'
import type { EventCategory } from '../../types/database'

export type CalendarViewMode = 'month' | 'week' | 'day'

const props = defineProps<{
  title: string
  view: CalendarViewMode
  categories: EventCategory[]
  hiddenCategoryIds: Set<string>
  ownerFilter: OwnerFilter
}>()
const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'today'): void
  (e: 'update:view', v: CalendarViewMode): void
  (e: 'toggle-category', id: string): void
  (e: 'update:ownerFilter', v: OwnerFilter): void
}>()

const catOpen = ref(false)
// 只算還存在的分類，避免已刪除分類的殘留 id 讓徽章數字錯誤
const hiddenCount = computed(() => props.categories.filter((c) => props.hiddenCategoryIds.has(c.id)).length)

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

    <div class="flex items-center gap-2">
      <div class="flex flex-1 bg-primary-100 rounded-[14px] p-[3px]" role="group" aria-label="篩選誰的行程">
        <button
          v-for="o in OWNER_FILTERS"
          :key="o"
          class="flex-1 min-h-[44px] rounded-[11px] text-[13px] flex items-center justify-center gap-1.5 transition-colors"
          :class="ownerFilter === o ? 'bg-white text-primary-900 font-extrabold shadow-sm' : 'text-primary-700 font-bold'"
          :aria-pressed="ownerFilter === o"
          @click="emit('update:ownerFilter', o)"
        >
          <span v-if="o !== 'all'" class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: OWNER_COLOR[o] }"></span>{{ o === 'all' ? '全部' : OWNER_LABEL[o] }}
        </button>
      </div>
      <button
        class="shrink-0 min-h-[44px] px-3.5 rounded-[14px] bg-white text-[13px] font-bold text-primary-900 flex items-center gap-1"
        :aria-label="hiddenCount ? `分類篩選，已隱藏 ${hiddenCount} 個` : '分類篩選'"
        :aria-expanded="catOpen"
        @click="catOpen = true"
      >分類<template v-if="hiddenCount"> · {{ hiddenCount }}</template><ChevronDown class="w-4 h-4" /></button>
    </div>

    <div class="flex items-center gap-2 overflow-x-auto">
      <button
        class="shrink-0 min-h-11 flex items-center"
        @click="emit('today')"
      ><span class="px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">今天</span></button>
      <CpblToggle />
    </div>

    <Teleport to="body">
      <div v-if="catOpen" class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" @click.self="catOpen = false">
        <div class="w-full max-w-md bg-white rounded-t-[28px] p-5 pb-safe shadow-xl max-h-[70vh] overflow-y-auto" role="dialog" aria-label="分類篩選">
          <div class="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4"></div>
          <h3 class="text-[15px] font-extrabold text-primary-900 mb-2">顯示哪些分類</h3>
          <ul>
            <li v-for="c in categories" :key="c.id">
              <label class="flex items-center gap-3 min-h-[44px] text-[15px] font-bold text-primary-900 cursor-pointer">
                <input
                  type="checkbox"
                  class="w-5 h-5 accent-primary-600"
                  :checked="!hiddenCategoryIds.has(c.id)"
                  @change="emit('toggle-category', c.id)"
                />{{ c.name }}
              </label>
            </li>
          </ul>
          <button class="w-full min-h-[44px] mt-3 rounded-[14px] bg-primary-600 text-white text-sm font-bold" @click="catOpen = false">完成</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
