<script setup lang="ts">
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { displayTitle, timeLabel } from '../../utils/calendar/glance'

defineProps<{ sections: { label: string; day: string; items: ViewEvent[] }[] }>()
const emit = defineEmits<{ (e: 'open', ev: ViewEvent): void }>()
</script>

<template>
  <section class="flex flex-col gap-2">
    <p v-if="sections.length === 0" class="text-[13px] text-slate-500 px-1">今明兩天沒有安排</p>
    <template v-for="s in sections" :key="s.day">
      <span class="text-[13px] font-extrabold text-primary-700 px-1">{{ s.label }}</span>
      <button
        v-for="e in s.items"
        :key="e.key + s.day"
        type="button"
        class="w-full flex items-center gap-3 bg-white/90 rounded-[18px] px-3.5 py-3 min-h-[56px] text-left"
        @click="emit('open', e)"
      >
        <span class="w-1 self-stretch rounded-full shrink-0" :style="{ backgroundColor: e.color }"></span>
        <span class="flex flex-col min-w-0">
          <span class="text-[15px] font-bold text-primary-900 truncate">{{ displayTitle(e) }}</span>
          <span class="text-[11px] font-semibold text-slate-500">{{ timeLabel(e, s.day) }}</span>
        </span>
      </button>
    </template>
  </section>
</template>
