<script setup lang="ts">
import { CalendarPlus, Tent } from 'lucide-vue-next'

// 「新增營區」選項由 Task 4.5 加回
defineProps<{ open: boolean; date?: string }>()
const emit = defineEmits<{
  (e: 'pick', kind: 'event' | 'trip' | 'campsite', date?: string): void
  (e: 'close'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" @click.self="emit('close')">
      <div class="w-full max-w-md bg-white rounded-t-[28px] p-5 pb-safe shadow-xl">
        <div class="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4"></div>
        <p class="text-[13px] font-bold text-primary-700 mb-3">
          新增{{ date ? `（${date}）` : '' }}
        </p>
        <button
          class="w-full flex items-center gap-3 px-4 min-h-[56px] rounded-[18px] active:bg-primary-100 text-left"
          @click="emit('pick', 'event', date)"
        >
          <CalendarPlus class="w-6 h-6 text-primary-600" />
          <span class="text-[15px] font-bold text-primary-900">事件</span>
        </button>
        <button
          class="w-full flex items-center gap-3 px-4 min-h-[56px] rounded-[18px] active:bg-primary-100 text-left"
          @click="emit('pick', 'trip', date)"
        >
          <Tent class="w-6 h-6 text-emerald-600" />
          <span class="text-[15px] font-bold text-primary-900">露營</span>
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
