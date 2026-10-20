<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { isHoliday } from '../../utils/holidays'

const props = defineProps<{ open: boolean; date: string; items: ViewEvent[] }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open', ev: ViewEvent): void
  (e: 'add', date: string): void
}>()

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const label = () => {
  const [y, m, d] = props.date.split('-').map(Number) as [number, number, number]
  const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${m}/${d}（${w}）${isHoliday(props.date)?.name ?? ''}`
}
const time = (e: ViewEvent) =>
  e.allDay || e.startMin == null
    ? '全天'
    : `${String(Math.floor(e.startMin / 60)).padStart(2, '0')}:${String(e.startMin % 60).padStart(2, '0')}`
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" @click.self="emit('close')">
      <div class="w-full max-w-md bg-white rounded-t-3xl p-5 pb-safe shadow-xl max-h-[70vh] overflow-y-auto">
        <div class="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"></div>
        <h3 class="font-bold text-primary-900 mb-3">{{ label() }}</h3>

        <p v-if="items.length === 0" class="text-sm text-primary-400 py-6 text-center">這天沒有事件</p>
        <ul v-else class="space-y-2 mb-3">
          <li v-for="e in items" :key="e.key">
            <button
              class="w-full flex items-stretch gap-3 text-left rounded-xl bg-primary-50 hover:bg-primary-100 overflow-hidden"
              :class="{ 'opacity-50': e.past }"
              @click="emit('open', e)"
            >
              <span class="w-1 shrink-0" :style="{ backgroundColor: e.color }"></span>
              <span class="py-2 text-xs text-primary-600 w-10 shrink-0">{{ time(e) }}</span>
              <span class="py-2 pr-3 text-sm font-medium text-primary-900 truncate">{{ e.title }}</span>
            </button>
          </li>
        </ul>

        <button
          class="w-full flex items-center justify-center gap-1 py-3 rounded-2xl btn-primary font-bold text-sm"
          @click="emit('add', date)"
        >
          <Plus class="w-4 h-4" /> 在這天新增
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom, 20px));
}
</style>
